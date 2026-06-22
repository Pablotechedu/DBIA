import { OllamaEmbeddings } from '@langchain/ollama';
import { getEmbeddingModel } from './embeddingModel';

describe('getEmbeddingModel', () => {
  it('retorna una instancia de OllamaEmbeddings', () => {
    const model = getEmbeddingModel();
    expect(model).toBeInstanceOf(OllamaEmbeddings);
  });

  it('retorna el mismo modelo en llamadas sucesivas (singleton)', () => {
    const modelo1 = getEmbeddingModel();
    const modelo2 = getEmbeddingModel();
    expect(modelo1).toBe(modelo2);
  });
});
