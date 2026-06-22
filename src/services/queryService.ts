import { classifyIntent } from '../ai/intentClassifier';
import { generateAnswer } from '../ai/answerChain';
import { searchDatabase } from './databaseSearchService';
import { searchRag } from './ragSearchService';
import type { QueryResponse } from '../types/query';

const RESPUESTA_NO_SOPORTADA =
  'Lo siento, esta consulta no está relacionada con las operaciones del call center de ventas. ' +
  'Por favor, reformule su pregunta sobre campañas, prospectos, agentes, llamadas o procedimientos de ventas.';

export async function handleQuery(question: string): Promise<QueryResponse> {
  const classification = await classifyIntent(question);

  if (classification.source === 'unsupported') {
    return {
      question,
      classification,
      answer: RESPUESTA_NO_SOPORTADA,
    };
  }

  let databaseContext: string | undefined;
  let documentContext: string | undefined;
  let databaseResults: Record<string, unknown> | undefined;
  let documentsUsed: Record<string, unknown>[] | undefined;

  if (classification.source === 'database' || classification.source === 'combined') {
    const dbResult = await searchDatabase(question);
    databaseContext = dbResult.answer;
    databaseResults = dbResult.metadata;
  }

  if (classification.source === 'rag' || classification.source === 'combined') {
    const ragResult = await searchRag(question);
    documentContext = ragResult.answer;
    documentsUsed = ragResult.metadata ? [ragResult.metadata] : [];
  }

  const answer = await generateAnswer({
    question,
    classification,
    databaseContext,
    documentContext,
  });

  return {
    question,
    classification,
    answer,
    databaseResults,
    documentsUsed,
  };
}
