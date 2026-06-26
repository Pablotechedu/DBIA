import { z } from 'zod';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { getChatModel } from './chatModel';
import { CLASSIFICATION_SYSTEM_TEMPLATE, CLASSIFICATION_HUMAN_TEMPLATE } from './prompts';
import type { IntentClassification } from '../types/query';

// El esquema Zod refleja exactamente IntentClassification, incluidas todas las entidades.
const IntentSchema = z.object({
  source: z.enum(['database', 'rag', 'hybrid', 'general', 'unsupported']),
  intent: z.string(),
  confidence: z.number().min(0).max(1),
  entities: z.object({
    table: z.enum(['agents', 'campaigns', 'leads', 'calls']).nullable(),
    leadStatus: z.string().nullable(),
    interestLevel: z.string().nullable(),
    agentName: z.string().nullable(),
    campaignStatus: z.string().nullable(),
    documentTopic: z.string().nullable(),
  }),
});

// Tipos mínimos para evitar que el compilador resuelva los genéricos recursivos de LangChain
// (TS2589). Las aserciones solo afectan los tipos en compilación; en ejecución se usan los
// objetos reales.
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
