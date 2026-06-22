import { OllamaEmbeddings } from '@langchain/ollama';

let embeddings: OllamaEmbeddings | null = null;

/** Retorna el modelo de embeddings Ollama singleton. */
export function getEmbeddingModel(): OllamaEmbeddings {
  if (embeddings) return embeddings;

  const baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  const modelName = process.env.OLLAMA_EMBEDDING_MODEL ?? 'nomic-embed-text';

  embeddings = new OllamaEmbeddings({ baseUrl, model: modelName });
  return embeddings;
}
