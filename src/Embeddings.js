import { pipeline, env } from '@xenova/transformers';

export class EmbeddingsService {
  constructor(config) {
    env.cacheDir = config.modelsCacheDir;
    this.modelName = config.embeddingModel;
    this.pipe = null;
  }

  async init() {
    if (!this.pipe) {
      this.pipe = await pipeline('feature-extraction', this.modelName);
    }
  }

  async generate(text) {
    await this.init();
    const output = await this.pipe(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }
}