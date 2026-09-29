import path from 'node:path';
import fs from 'node:fs';

const DATA_DIR = '.agent_data';

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const CONFIG = {
  dataDir: DATA_DIR,
  dbPath: path.join(DATA_DIR, 'brain.db'),
  vectorDbDir: path.join(DATA_DIR, 'lancedb_data'),
  modelsCacheDir: path.join(DATA_DIR, 'models_cache'),
  embeddingModel: 'Xenova/all-MiniLM-L6-v2',
  vectorTableName: 'knowledge_vectors'
};