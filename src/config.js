import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// Obtener la ruta absoluta del archivo actual (src/config.js)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Subir un nivel desde 'src/' hacia la raíz de tu proyecto
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(PROJECT_ROOT, '.agent_data');

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