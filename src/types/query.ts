/** Fuente de origen de la respuesta a una consulta */
export type QuerySource = 'database' | 'rag' | 'combined' | 'unsupported';

/** Resultado de la clasificación de intención del usuario */
export interface IntentClassification {
  source: QuerySource;
  confidence: number;
  reasoning: string;
}

/** Resultado final de una consulta al sistema */
export interface QueryResult {
  answer: string;
  source: QuerySource;
  metadata?: Record<string, unknown>;
}

/** Respuesta estructurada del orquestador de consultas */
export interface QueryResponse {
  question: string;
  classification: IntentClassification;
  answer: string;
  databaseResults?: Record<string, unknown>;
  documentsUsed?: Record<string, unknown>[];
}
