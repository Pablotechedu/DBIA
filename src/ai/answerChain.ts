import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { getChatModel } from './chatModel';
import type { IntentClassification } from '../types/query';

export interface AnswerInput {
  question: string;
  classification: IntentClassification;
  databaseContext?: string;
  documentContext?: string;
}

const SYSTEM_TEMPLATE = `Eres un asistente inteligente para un call center de ventas.
Responde las preguntas de los agentes de ventas de forma clara, precisa y siempre en español.

Información de la base de datos:
{databaseContext}

Información de documentos:
{documentContext}`;

const HUMAN_TEMPLATE = `Pregunta: {question}

Razonamiento de clasificación: {reasoning}

Proporciona una respuesta útil y completa en español.`;

export async function generateAnswer(input: AnswerInput): Promise<string> {
  const { question, classification, databaseContext, documentContext } = input;

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', SYSTEM_TEMPLATE],
    ['human', HUMAN_TEMPLATE],
  ]);

  const chain = prompt.pipe(getChatModel()).pipe(new StringOutputParser());

  return chain.invoke({
    question,
    reasoning: classification.reasoning,
    databaseContext: databaseContext ?? 'No hay datos de base de datos disponibles.',
    documentContext: documentContext ?? 'No hay documentos relevantes disponibles.',
  });
}
