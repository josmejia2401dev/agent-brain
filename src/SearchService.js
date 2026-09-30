export class SearchService {
  constructor(dbManager, vectorStoreManager, embeddingsService, rerankerService) {
    this.db = dbManager.instance;
    this.vectorStore = vectorStoreManager;
    this.embeddings = embeddingsService;
    this.reranker = rerankerService;
  }

  async search(queryText, limit = 3) {
    const candidatesMap = new Map();

    // 1. CAPA 1A: Búsqueda Vectorial (LanceDB)
    const queryVector = await this.embeddings.generate(`query: ${queryText}`);
    const vectorResults = await this.vectorStore.search(queryVector, 10, 1.45);

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
    const textResults = this.fallbackSqliteSearch(queryText, 10);
    textResults.forEach(item => {
      if (candidatesMap.has(item.id)) {
        // Si coincidió en ambos, lo marcamos como Híbrido
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

    // 3. CAPA 2: Re-ordenamiento de precisión con Reranker
    const rerankedMatches = await this.reranker.rank(queryText, candidates, limit);

    return {
      found: rerankedMatches.length > 0,
      matches: rerankedMatches
    };
  }

  // Carga de metadatos desde SQLite
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