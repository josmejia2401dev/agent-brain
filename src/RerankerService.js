import { AutoModelForSequenceClassification, AutoTokenizer } from '@xenova/transformers';

// 💡 Función Sigmoide para convertir logits en probabilidades de 0 a 1
const sigmoid = (x) => 1 / (1 + Math.exp(-x));

export class RerankerService {
  constructor() {
    this.modelName = 'Xenova/ms-marco-MiniLM-L-6-v2'; 
    this.tokenizer = null;
    this.model = null;
  }

  async init() {
    if (!this.model) {
      this.tokenizer = await AutoTokenizer.from_pretrained(this.modelName);
      this.model = await AutoModelForSequenceClassification.from_pretrained(this.modelName);
    }
  }

  async rank(query, documents, topK = 3) {
    try {
      await this.init();

      const scores = [];

      for (const doc of documents) {
        const textToEvaluate = `Título: ${doc.title}. Resumen: ${doc.summary || ''}. Contenido: ${doc.content.slice(0, 500)}`;
        
        const inputs = await this.tokenizer(query, textToEvaluate, {
          padding: true,
          truncation: true,
          max_length: 512
        });

        const { logits } = await this.model(inputs);
        const rawLogit = logits.data[0]; 
        
        // 💡 Cambio aquí: normalizamos el logit crudo con Sigmoide
        const normalizedScore = sigmoid(rawLogit);

        scores.push({ ...doc, _rerankScore: normalizedScore });
      }

      return scores
        .sort((a, b) => b._rerankScore - a._rerankScore)
        .slice(0, topK);

    } catch (error) {
      console.warn('⚠️ No se pudo ejecutar el Reranker (usando resultados de la Capa 1):', error.message);
      return documents.slice(0, topK);
    }
  }
}