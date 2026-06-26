/** Fuente de origen de la respuesta a una consulta */
export type QuerySource = 'database' | 'rag' | 'hybrid' | 'general' | 'unsupported';

/** Entidades extraídas de la consulta para enrutar las búsquedas en base de datos */
export interface IntentEntities {
  table: 'agents' | 'campaigns' | 'leads' | 'calls' | null;
  leadStatus: string | null;
  interestLevel: string | null;
  agentName: string | null;
  campaignStatus: string | null;
  documentTopic: string | null;
}

/** Resultado de la clasificación de intención del usuario */
export interface IntentClassification {
  source: QuerySource;
  intent: string;
  confidence: number;
  entities: IntentEntities;
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
