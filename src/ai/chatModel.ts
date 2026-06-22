import { ChatOllama } from '@langchain/ollama';

let model: ChatOllama | null = null;

/** Retorna el modelo de chat Ollama singleton. */
export function getChatModel(): ChatOllama {
  if (model) return model;

  const baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  const modelName = process.env.OLLAMA_CHAT_MODEL ?? 'gemma3';

  model = new ChatOllama({ baseUrl, model: modelName, temperature: 0 });
  return model;
}
