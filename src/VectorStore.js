import * as lancedb from '@lancedb/lancedb';

export class VectorStoreManager {
  constructor(config) {
    this.dbDir = config.vectorDbDir;
    this.tableName = config.vectorTableName;
    this.db = null;
    this.table = null;
  }

  async connect() {
    if (!this.db) {
      this.db = await lancedb.connect(this.dbDir);
    }
  }

  async addVector(record) {
    await this.connect();
    const tables = await this.db.tableNames();

    if (!tables.includes(this.tableName)) {
      this.table = await this.db.createTable(this.tableName, [record]);
    } else {
      if (!this.table) this.table = await this.db.openTable(this.tableName);
      await this.table.add([record]);
    }
  }

  async deleteVector(itemId) {
    await this.connect();
    const tables = await this.db.tableNames();
    if (!tables.includes(this.tableName)) return;

    if (!this.table) this.table = await this.db.openTable(this.tableName);
    // Elimina el vector correspondiente usando el ID como filtro SQL
    await this.table.delete(`id = '${itemId}'`);
  }
  
  async search(vector, limit = 5, maxDistance = 1.15) {
    await this.connect();
    const tables = await this.db.tableNames();
    if (!tables.includes(this.tableName)) return [];

    if (!this.table) this.table = await this.db.openTable(this.tableName);
    const results = await this.table.search(vector).limit(limit).toArray();

    // Filtra los resultados que superen el umbral razonable para distancia L2 (1.15)
    return results.filter(r => r._distance === undefined || r._distance <= maxDistance);
  }
}