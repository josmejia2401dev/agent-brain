#!/usr/bin/env node
import { CONFIG } from './src/config.js';
import { DatabaseManager } from './src/Database.js';
import { EmbeddingsService } from './src/Embeddings.js';
import { VectorStoreManager } from './src/VectorStore.js';
import { IngestService } from './src/IngestService.js';
import { SearchService } from './src/SearchService.js';
import { CliApp } from './src/Cli.js';

async function bootstrap() {
  console.log('🚀 Inicializando servicios locales en .agent_data/...');

  const dbManager = new DatabaseManager(CONFIG.dbPath);
  const embeddingsService = new EmbeddingsService(CONFIG);
  const vectorStoreManager = new VectorStoreManager(CONFIG);

  await embeddingsService.init();
  await vectorStoreManager.connect();

  const ingestService = new IngestService(dbManager, vectorStoreManager, embeddingsService);
  const searchService = new SearchService(dbManager, vectorStoreManager, embeddingsService);

  const cli = new CliApp(ingestService, searchService);
  await cli.start();
}

bootstrap().catch(err => {
  console.error('❌ Error fatal al iniciar el agente:', err);
  process.exit(1);
});