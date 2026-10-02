import { DatabaseSync } from 'node:sqlite';

export class DatabaseManager {
  constructor(dbPath) {
    this.db = new DatabaseSync(dbPath);
    this.configurePragmas();
    this.initSchema();
  }

  configurePragmas() {
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA synchronous = NORMAL;');
  }

  initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_items (
          id TEXT PRIMARY KEY,
          item_type TEXT CHECK(item_type IN (
              'code_snippet', 'bug_error', 'post_mortem',
              'best_practice', 'anti_pattern', 'architecture_adr',
              'config_script', 'prompt_template', 'concept_note', 'project_context'
          )) NOT NULL,
          title TEXT NOT NULL,
          summary TEXT,
          content TEXT NOT NULL,
          language_tech TEXT,
          status TEXT CHECK(status IN ('active', 'deprecated', 'draft', 'experimental')) DEFAULT 'active',
          source_origin TEXT,
          metadata JSON,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS code_ast_metadata (
          item_id TEXT PRIMARY KEY,
          exports JSON,
          imports JSON,
          functions JSON,
          classes JSON,
          dependencies JSON,
          FOREIGN KEY (item_id) REFERENCES knowledge_items(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          category TEXT CHECK(category IN ('principle', 'technology', 'topic', 'severity')) NOT NULL
      );
      CREATE TABLE IF NOT EXISTS item_tags (
          item_id TEXT NOT NULL,
          tag_id INTEGER NOT NULL,
          PRIMARY KEY (item_id, tag_id),
          FOREIGN KEY (item_id) REFERENCES knowledge_items(id) ON DELETE CASCADE,
          FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS search_feedback (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          query_text TEXT NOT NULL,
          item_id TEXT NOT NULL,
          hits INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(query_text, item_id),
          FOREIGN KEY (item_id) REFERENCES knowledge_items(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_items_type ON knowledge_items(item_type);
      CREATE INDEX IF NOT EXISTS idx_items_status ON knowledge_items(status);
      CREATE INDEX IF NOT EXISTS idx_items_tech ON knowledge_items(language_tech);
      CREATE INDEX IF NOT EXISTS idx_feedback_query ON search_feedback(query_text);
    `);
  }

  get instance() {
    return this.db;
  }
}