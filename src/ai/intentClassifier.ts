import { z } from 'zod';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { getChatModel } from './chatModel';
import { CLASSIFICATION_SYSTEM_TEMPLATE, CLASSIFICATION_HUMAN_TEMPLATE } from './prompts';
import type { IntentClassification } from '../types/query';

// El esquema Zod refleja exactamente IntentClassification para que el parser pueda validar la salida.
const IntentSchema = z.object({
  source: z.enum(['database', 'rag', 'combined', 'unsupported']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

// Tipos mínimos para evitar que el compilador resuelva los genéricos recursivos de LangChain
// (TS2589). Las aserciones solo afectan los tipos en compilación; en ejecución se usan los
// objetos reales (StructuredOutputParser y el chain de Runnables).
interface FormatParser {
  getFormatInstructions(): string;
}
interface ClassificationChain {
  invoke(input: { query: string; formatInstructions: string }): Promise<IntentClassification>;
}

/**
 * Clasifica la intención de la consulta mediante un chain de LangChain:
 * prompt | modelo de chat | StructuredOutputParser. Las instrucciones de formato del parser
 * se inyectan en el prompt para forzar el formato correcto de la respuesta.
 */
export async function classifyIntent(query: string): Promise<IntentClassification> {
  const parser = (StructuredOutputParser.fromZodSchema as (schema: unknown) => FormatParser)(
    IntentSchema
  );

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', CLASSIFICATION_SYSTEM_TEMPLATE],
    ['human', CLASSIFICATION_HUMAN_TEMPLATE],
  ]);

  const chain = (prompt as unknown as {
    pipe(model: unknown): { pipe(parser: unknown): ClassificationChain };
  })
    .pipe(getChatModel())
    .pipe(parser);

  return chain.invoke({
    query,
    formatInstructions: parser.getFormatInstructions(),
  });
}
