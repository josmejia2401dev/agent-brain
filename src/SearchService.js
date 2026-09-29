export class SearchService {
  constructor(dbManager, vectorStoreManager, embeddingsService) {
    this.db = dbManager.instance;
    this.vectorStore = vectorStoreManager;
    this.embeddings = embeddingsService;
  }

  async search(queryText, limit = 3, maxDistance = 1.15) {
    const queryVector = await this.embeddings.generate(queryText);
    const vectorResults = await this.vectorStore.search(queryVector, limit, maxDistance);

    if (!vectorResults.length) {
      return { found: false, matches: [], relations: [] };
    }

    const itemIds = vectorResults.map(r => r.id);
    const distanceMap = new Map(vectorResults.map(r => [r.id, r._distance]));
    const placeholders = itemIds.map(() => '?').join(',');

    const rawItems = this.db.prepare(`
      SELECT k.*, c.exports, c.imports, c.functions, c.classes, c.dependencies
      FROM knowledge_items k
      LEFT JOIN code_ast_metadata c ON k.id = c.item_id
      WHERE k.id IN (${placeholders}) AND k.status = 'active'
    `).all(...itemIds);

    const matches = rawItems.map(item => ({
      ...this.hydrateItem(item),
      _distance: distanceMap.get(item.id)
    }));

    // Ordenar resultados respetando el orden de cercanía del vector search
    matches.sort((a, b) => (a._distance ?? 0) - (b._distance ?? 0));

    const relations = this.db.prepare(`
      SELECT r.relation_type, r.notes, k_target.id as target_id, k_target.title as target_title, k_target.item_type as target_type
      FROM knowledge_relations r
      JOIN knowledge_items k_target ON r.target_id = k_target.id
      WHERE r.source_id IN (${placeholders})
    `).all(...itemIds);

    return {
      found: matches.length > 0,
      matches,
      relations
    };
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