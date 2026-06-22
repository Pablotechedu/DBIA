import { ChatOllama } from '@langchain/ollama';
import { getChatModel } from './chatModel';

describe('getChatModel', () => {
  it('retorna una instancia de ChatOllama', () => {
    const model = getChatModel();
    expect(model).toBeInstanceOf(ChatOllama);
  });

  it('retorna el mismo modelo en llamadas sucesivas (singleton)', () => {
    const modelo1 = getChatModel();
    const modelo2 = getChatModel();
    expect(modelo1).toBe(modelo2);
  });
});
