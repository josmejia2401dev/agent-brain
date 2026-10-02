export class SearchService {
  constructor(dbManager, vectorStoreManager, embeddingsService, rerankerService) {
    this.db = dbManager.instance;
    this.vectorStore = vectorStoreManager;
    this.embeddings = embeddingsService;
    this.reranker = rerankerService;
  }

  async search(queryText, limit = 50) {
    const candidatesMap = new Map();

    // 1. CAPA 1A: Búsqueda Vectorial (LanceDB)
    const queryVector = await this.embeddings.generate(`query: ${queryText}`);
    const vectorResults = await this.vectorStore.search(queryVector, limit, 1.45);
    if (vectorResults.length > 0) {
      const vectorItems = this.loadFullItems(vectorResults.map(r => r.id));
      vectorItems.forEach(item => {
        candidatesMap.set(item.id, {
          ...item,
          _source: 'Vectorial (LanceDB)',
          _distance: vectorResults.find(r => r.id === item.id)?._distance
        });
      });
    }

    // 2. CAPA 1B: Búsqueda de Texto (SQLite Fallback / FTS5)
    const textResults = this.fallbackSqliteSearch(queryText, limit);
    textResults.forEach(item => {
      if (candidatesMap.has(item.id)) {
        const existing = candidatesMap.get(item.id);
        existing._source = 'Híbrido (LanceDB + SQLite)';
      } else {
        candidatesMap.set(item.id, {
          ...item,
          _source: 'Texto Exacto (SQLite)',
          _distance: null
        });
      }
    });

    const candidates = Array.from(candidatesMap.values());
    if (candidates.length === 0) {
      return { found: false, matches: [] };
    }

    // 3. CAPA DE CALIBRACIÓN: Consultar retroalimentación previa
    // 3. CAPA DE CALIBRACIÓN: Consultar retroalimentación previa
    const feedbackHits = this.db.prepare(`
      SELECT item_id, hits 
      FROM search_feedback 
      WHERE query_text = LOWER(?)
    `).all(queryText.trim());

    const feedbackMap = new Map(feedbackHits.map(f => [f.item_id, f.hits]));

    // 4. CAPA 2: Re-ordenamiento de precisión con Reranker
    const rerankedMatches = await this.reranker.rank(queryText, candidates, candidates.length);

    // Aplicar impulso de calibración
    rerankedMatches.forEach(item => {
      if (feedbackMap.has(item.id)) {
        const hits = feedbackMap.get(item.id);
        item._boostedByFeedback = true;
        item._feedbackHits = hits;
        // Incrementa la puntuación para posicionarlo al principio
        item._rerankScore = Math.min(1.0, (item._rerankScore || 0.5) + (0.3 * hits));
      }
    });

    // Re-ordenar por score ajustado
    rerankedMatches.sort((a, b) => (b._rerankScore || 0) - (a._rerankScore || 0));

    return {
      found: rerankedMatches.length > 0,
      matches: rerankedMatches
    };
  }

  // Guarda la selección para calibrar búsquedas futuras
  registerFeedback(queryText, itemId) {
    const normalizedQuery = queryText.trim().toLowerCase();
    
    this.db.prepare(`
      INSERT INTO search_feedback (query_text, item_id, hits) 
      VALUES (?, ?, 1)
      ON CONFLICT(query_text, item_id) DO UPDATE SET 
        hits = hits + 1,
        updated_at = CURRENT_TIMESTAMP
    `).run(normalizedQuery, itemId);
  }

  loadFullItems(itemIds) {
    if (!itemIds.length) return [];
    const placeholders = itemIds.map(() => '?').join(',');
    const rawItems = this.db.prepare(`
      SELECT k.*, c.exports, c.imports, c.functions, c.classes, c.dependencies
      FROM knowledge_items k
      LEFT JOIN code_ast_metadata c ON k.id = c.item_id
      WHERE k.id IN (${placeholders}) AND k.status = 'active'
    `).all(...itemIds);
    return rawItems.map(item => this.hydrateItem(item));
  }

  fallbackSqliteSearch(queryText, limit = 5) {
    const terms = queryText.trim().split(/\s+/).filter(t => t.length > 2);
    if (terms.length === 0) return [];
    const likePattern = `%${terms.join('%')}%`;
    const rawItems = this.db.prepare(`
      SELECT k.*, c.exports, c.imports, c.functions, c.classes, c.dependencies
      FROM knowledge_items k
      LEFT JOIN code_ast_metadata c ON k.id = c.item_id
      WHERE (k.title LIKE ? OR k.summary LIKE ? OR k.content LIKE ?)
         AND k.status = 'active'
      LIMIT ?
    `).all(likePattern, likePattern, likePattern, limit);
    return rawItems.map(item => this.hydrateItem(item));
  }

  hydrateItem(item) {
    const safeParse = (str) => { try { return str ? JSON.parse(str) : []; } catch { return []; } };
    const tags = this.db.prepare(`
      SELECT t.name, t.category FROM tags t
      JOIN item_tags it ON t.id = it.tag_id
      WHERE it.item_id = ?
    `).all(item.id);
    return {
      ...item,
      metadata: safeParse(item.metadata),
      exports: safeParse(item.exports),
      imports: safeParse(item.imports),
      functions: safeParse(item.functions),
      classes: safeParse(item.classes),
      dependencies: safeParse(item.dependencies),
      tags
    };
  }
}