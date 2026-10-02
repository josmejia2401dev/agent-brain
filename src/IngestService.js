import crypto from 'node:crypto';
import { parseJsAst } from './CodeParser.js';

export class IngestService {
  constructor(dbManager, vectorStoreManager, embeddingsService) {
    this.db = dbManager.instance;
    this.vectorStore = vectorStoreManager;
    this.embeddings = embeddingsService;
  }

  async ingest(data) {
    const itemId = `item_${crypto.randomUUID()}`;

    this.db.exec('BEGIN TRANSACTION;');
    try {
      this.db.prepare(`
        INSERT INTO knowledge_items (id, item_type, title, summary, content, language_tech, status, source_origin, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        itemId,
        data.item_type,
        data.title,
        data.summary || '',
        data.content,
        data.language_tech || 'markdown',
        data.status || 'active',
        data.source_origin || 'manual_ingest',
        JSON.stringify(data.metadata || {})
      );

      if (data.item_type === 'code_snippet' && ['javascript', 'js'].includes((data.language_tech || '').toLowerCase())) {
        const ast = parseJsAst(data.content);
        this.db.prepare(`
          INSERT INTO code_ast_metadata (item_id, exports, imports, functions, classes, dependencies)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          itemId,
          JSON.stringify(ast.exports),
          JSON.stringify(ast.imports),
          JSON.stringify(ast.functions),
          JSON.stringify(ast.classes),
          JSON.stringify(ast.dependencies)
        );
      }

      if (Array.isArray(data.tags)) {
        const insertTag = this.db.prepare(`INSERT OR IGNORE INTO tags (name, category) VALUES (?, ?)`);
        const linkTag = this.db.prepare(`INSERT INTO item_tags (item_id, tag_id) VALUES (?, (SELECT id FROM tags WHERE name = ?))`);

        for (const tag of data.tags) {
          if (!tag.name) continue;
          insertTag.run(tag.name, tag.category || 'topic');
          linkTag.run(itemId, tag.name);
        }
      }

      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }

    const textToEmbed = `${data.title}\n${data.summary}\n${data.content}`;
    const vector = await this.embeddings.generate(textToEmbed);

    await this.vectorStore.addVector({
      id: itemId,
      vector,
      title: data.title,
      item_type: data.item_type,
      language_tech: data.language_tech || '',
      summary: data.summary || ''
    });

    return itemId;
  }


  async delete(itemId) {
    // 1. SQLite elimina la nota y sus tablas relacionadas (gracias a ON DELETE CASCADE)
    this.db.prepare('DELETE FROM knowledge_items WHERE id = ?').run(itemId);

    // 2. Eliminar el vector en LanceDB
    await this.vectorStore.deleteVector(itemId);
  }

  async update(itemId, data) {
    this.db.exec('BEGIN TRANSACTION;');
    try {
      this.db.prepare(`
        UPDATE knowledge_items
        SET title = ?, summary = ?, content = ?, language_tech = ?, metadata = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        data.title,
        data.summary || '',
        data.content,
        data.language_tech || 'markdown',
        JSON.stringify(data.metadata || {}),
        itemId
      );

      // Re-analizar AST de código si aplica
      this.db.prepare('DELETE FROM code_ast_metadata WHERE item_id = ?').run(itemId);
      if (data.item_type === 'code_snippet' && ['javascript', 'js'].includes((data.language_tech || '').toLowerCase())) {
        const ast = parseJsAst(data.content);
        this.db.prepare(`
          INSERT INTO code_ast_metadata (item_id, exports, imports, functions, classes, dependencies)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          itemId,
          JSON.stringify(ast.exports),
          JSON.stringify(ast.imports),
          JSON.stringify(ast.functions),
          JSON.stringify(ast.classes),
          JSON.stringify(ast.dependencies)
        );
      }

      // Actualizar tags
      this.db.prepare('DELETE FROM item_tags WHERE item_id = ?').run(itemId);
      if (Array.isArray(data.tags)) {
        const insertTag = this.db.prepare(`INSERT OR IGNORE INTO tags (name, category) VALUES (?, ?)`);
        const linkTag = this.db.prepare(`INSERT INTO item_tags (item_id, tag_id) VALUES (?, (SELECT id FROM tags WHERE name = ?))`);

        for (const tag of data.tags) {
          if (!tag.name) continue;
          insertTag.run(tag.name, tag.category || 'topic');
          linkTag.run(itemId, tag.name);
        }
      }

      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }

    // Re-vectorizar el contenido actualizado en LanceDB
    await this.vectorStore.deleteVector(itemId);
    const textToEmbed = `${data.title}\n${data.summary}\n${data.content}`;
    const vector = await this.embeddings.generate(textToEmbed);

    await this.vectorStore.addVector({
      id: itemId,
      vector,
      title: data.title,
      item_type: data.item_type,
      language_tech: data.language_tech || '',
      summary: data.summary || ''
    });
    
  }

  // En src/IngestService.js

  async reindexAll() {
    // 1. Obtener todas las notas activas de SQLite
    const items = this.db.prepare(`
    SELECT id, item_type, title, summary, content, language_tech 
    FROM knowledge_items 
    WHERE status = 'active'
  `).all();

    if (items.length === 0) {
      return { count: 0 };
    }

    const vectorRecords = [];

    // Referencia segura al servicio de embeddings
    const embeddingsService = this.embeddings || this.embeddingsService;

    // 2. Iterar y regenerar los vectores
    for (const item of items) {
      // Obtener tags vinculados
      const tags = this.db.prepare(`
      SELECT t.name FROM tags t
      JOIN item_tags it ON t.id = it.tag_id
      WHERE it.item_id = ?
    `).all(item.id).map(t => t.name);

      // Texto enriquecido para el embedding
      const textToEmbed = `Título: ${item.title}\nTipo: ${item.item_type}\nTech: ${item.language_tech || ''}\nTags: ${tags.join(', ')}\nResumen: ${item.summary || ''}\nContenido:\n${item.content}`;

      // 💡 Método corregido: usa .generate() en lugar de .generateEmbedding()
      const vector = await embeddingsService.generate(textToEmbed);

      vectorRecords.push({
        id: item.id,
        vector: Array.from(vector),
        title: item.title,
        item_type: item.item_type,
        language_tech: item.language_tech || '',
        summary: item.summary || ''
      });
    }

    // 3. Sobrescribir en LanceDB
    await this.vectorStore.resetAndBulkInsert(vectorRecords);

    return { count: items.length };
  }
}