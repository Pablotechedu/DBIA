import { z } from 'zod';
import { getChatModel } from './chatModel';
import { buildClassificationMessages } from './prompts';
import type { IntentClassification } from '../types/query';

const IntentSchema = z.object({
  source: z.enum(['database', 'rag', 'combined']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

// Tipo mínimo del modelo con salida estructurada.
interface StructuredModel {
  invoke(messages: unknown): Promise<IntentClassification>;
}

export async function classifyIntent(query: string): Promise<IntentClassification> {
  // La aserción se aplica antes de llamar a withStructuredOutput para evitar que el compilador
  // resuelva los tipos genéricos recursivos del método (TS2589).
  const model = (getChatModel() as unknown as {
    withStructuredOutput(schema: unknown): StructuredModel;
  }).withStructuredOutput(IntentSchema);

  return model.invoke(buildClassificationMessages(query));
}
