export class SearchService {
  constructor(dbManager, vectorStoreManager, embeddingsService) {
    this.db = dbManager.instance;
    this.vectorStore = vectorStoreManager;
    this.embeddings = embeddingsService;
  }

  async search(queryText, limit = 3) {
    const queryVector = await this.embeddings.generate(queryText);
    
    // 1. Buscamos candidatos en LanceDB con un techo máximo de seguridad (1.50)
    const SAFETY_CEILING = 1.50;
    const candidates = await this.vectorStore.search(queryVector, limit * 2, SAFETY_CEILING);

    let matches = [];

    if (candidates.length > 0) {
      const minDistance = candidates[0]._distance; // La menor distancia encontrada

      // Si la mejor coincidencia está dentro de un rango razonable
      if (minDistance <= 1.45) {
        // 💡 UMBRAL AUTOMÁTICO: Acepta elementos que no se alejen más de +0.20 del mejor resultado
        const autoMaxDistance = Math.min(1.45, minDistance + 0.20);
        
        const filteredCandidates = candidates
          .filter(r => r._distance <= autoMaxDistance)
          .slice(0, limit);

        const itemIds = filteredCandidates.map(r => r.id);
        const distanceMap = new Map(filteredCandidates.map(r => [r.id, r._distance]));
        const placeholders = itemIds.map(() => '?').join(',');

        const rawItems = this.db.prepare(`
          SELECT k.*, c.exports, c.imports, c.functions, c.classes, c.dependencies
          FROM knowledge_items k
          LEFT JOIN code_ast_metadata c ON k.id = c.item_id
          WHERE k.id IN (${placeholders}) AND k.status = 'active'
        `).all(...itemIds);

        matches = rawItems.map(item => ({
          ...this.hydrateItem(item),
          _distance: distanceMap.get(item.id)
        }));

        matches.sort((a, b) => (a._distance ?? 0) - (b._distance ?? 0));
      }
    }

    // 2. FALLBACK: Si no hubo coincidencias dentro del rango dinámico, busca por texto en SQLite
    if (matches.length === 0) {
      matches = this.fallbackSqliteSearch(queryText, limit);
    }

    return {
      found: matches.length > 0,
      matches
    };
  }

  fallbackSqliteSearch(queryText, limit = 3) {
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

    return rawItems.map(item => ({
      ...this.hydrateItem(item),
      _distance: 0
    }));
  }

  hydrateItem(item) {
    const safeParse = (jsonStr) => {
      try { return jsonStr ? JSON.parse(jsonStr) : []; } catch { return []; }
    };

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