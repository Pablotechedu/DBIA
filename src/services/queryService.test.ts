import { handleQuery } from './queryService';
import { classifyIntent } from '../ai/intentClassifier';
import { generateAnswer } from '../ai/answerChain';
import { searchDatabase } from './databaseSearchService';
import { searchRag } from './ragSearchService';
import type { IntentClassification, QueryResult } from '../types/query';

jest.mock('../ai/intentClassifier');
jest.mock('../ai/answerChain');
jest.mock('./databaseSearchService');
jest.mock('./ragSearchService');

const mockClassifyIntent = classifyIntent as jest.MockedFunction<typeof classifyIntent>;
const mockGenerateAnswer = generateAnswer as jest.MockedFunction<typeof generateAnswer>;
const mockSearchDatabase = searchDatabase as jest.MockedFunction<typeof searchDatabase>;
const mockSearchRag = searchRag as jest.MockedFunction<typeof searchRag>;

const NULL_ENTITIES: IntentClassification['entities'] = {
  table: 'campaigns',
  leadStatus: null,
  interestLevel: null,
  agentName: null,
  campaignStatus: 'active',
  documentTopic: null,
};

const DB_CLASSIFICATION: IntentClassification = {
  source: 'database',
  intent: 'Consulta sobre campañas activas.',
  confidence: 0.95,
  entities: NULL_ENTITIES,
};

const RAG_CLASSIFICATION: IntentClassification = {
  source: 'rag',
  intent: 'Consulta sobre procedimientos documentados.',
  confidence: 0.88,
  entities: { ...NULL_ENTITIES, table: null, campaignStatus: null, documentTopic: 'ventas' },
};

const HYBRID_CLASSIFICATION: IntentClassification = {
  source: 'hybrid',
  intent: 'La consulta requiere datos de BD y documentos.',
  confidence: 0.8,
  entities: NULL_ENTITIES,
};

const GENERAL_CLASSIFICATION: IntentClassification = {
  source: 'general',
  intent: 'Pregunta conceptual sin fuentes internas.',
  confidence: 0.85,
  entities: { ...NULL_ENTITIES, table: null, campaignStatus: null },
};

const UNSUPPORTED_CLASSIFICATION: IntentClassification = {
  source: 'unsupported',
  intent: 'Solicitud fuera del alcance del sistema.',
  confidence: 0.9,
  entities: { ...NULL_ENTITIES, table: null, campaignStatus: null },
};

const DB_RESULT: QueryResult = {
  answer: 'Hay 5 campañas activas.',
  source: 'database',
  metadata: { table: 'campaigns', total: 5 },
};

const RAG_RESULT: QueryResult = {
  answer: 'El manual de ventas indica el procedimiento X.',
  source: 'rag',
  metadata: { totalDocuments: 2 },
};

describe('handleQuery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateAnswer.mockResolvedValue('Respuesta generada por el LLM.');
  });

  describe('clasificación de intención', () => {
    it('llama a classifyIntent con la pregunta del usuario', async () => {
      mockClassifyIntent.mockResolvedValue(DB_CLASSIFICATION);
      mockSearchDatabase.mockResolvedValue(DB_RESULT);

      await handleQuery('¿Cuántas campañas activas hay?');

      expect(mockClassifyIntent).toHaveBeenCalledWith('¿Cuántas campañas activas hay?');
    });
  });

  describe('fuente "database"', () => {
    it('llama a searchDatabase con la clasificación y no a searchRag', async () => {
      mockClassifyIntent.mockResolvedValue(DB_CLASSIFICATION);
      mockSearchDatabase.mockResolvedValue(DB_RESULT);

      await handleQuery('¿Cuántas campañas activas hay?');

      expect(mockSearchDatabase).toHaveBeenCalledWith(DB_CLASSIFICATION);
      expect(mockSearchRag).not.toHaveBeenCalled();
    });

    it('pasa el answer de la DB como databaseContext a generateAnswer', async () => {
      mockClassifyIntent.mockResolvedValue(DB_CLASSIFICATION);
      mockSearchDatabase.mockResolvedValue(DB_RESULT);

      await handleQuery('pregunta');

      expect(mockGenerateAnswer).toHaveBeenCalledWith(
        expect.objectContaining({ databaseContext: 'Hay 5 campañas activas.' })
      );
    });

    it('incluye la metadata de la DB en databaseResults', async () => {
      mockClassifyIntent.mockResolvedValue(DB_CLASSIFICATION);
      mockSearchDatabase.mockResolvedValue(DB_RESULT);

      const result = await handleQuery('pregunta');

      expect(result.databaseResults).toEqual({ table: 'campaigns', total: 5 });
    });

    it('retorna documentsUsed como undefined', async () => {
      mockClassifyIntent.mockResolvedValue(DB_CLASSIFICATION);
      mockSearchDatabase.mockResolvedValue(DB_RESULT);

      const result = await handleQuery('pregunta');

      expect(result.documentsUsed).toBeUndefined();
    });
  });

  describe('fuente "rag"', () => {
    it('llama a searchRag y no a searchDatabase', async () => {
      mockClassifyIntent.mockResolvedValue(RAG_CLASSIFICATION);
      mockSearchRag.mockResolvedValue(RAG_RESULT);

      await handleQuery('¿Cuál es el procedimiento de ventas?');

      expect(mockSearchRag).toHaveBeenCalledWith('¿Cuál es el procedimiento de ventas?');
      expect(mockSearchDatabase).not.toHaveBeenCalled();
    });

    it('pasa el answer del RAG como documentContext a generateAnswer', async () => {
      mockClassifyIntent.mockResolvedValue(RAG_CLASSIFICATION);
      mockSearchRag.mockResolvedValue(RAG_RESULT);

      await handleQuery('pregunta');

      expect(mockGenerateAnswer).toHaveBeenCalledWith(
        expect.objectContaining({ documentContext: 'El manual de ventas indica el procedimiento X.' })
      );
    });

    it('incluye la metadata del RAG en documentsUsed', async () => {
      mockClassifyIntent.mockResolvedValue(RAG_CLASSIFICATION);
      mockSearchRag.mockResolvedValue(RAG_RESULT);

      const result = await handleQuery('pregunta');

      expect(result.documentsUsed).toEqual([{ totalDocuments: 2 }]);
    });

    it('retorna databaseResults como undefined', async () => {
      mockClassifyIntent.mockResolvedValue(RAG_CLASSIFICATION);
      mockSearchRag.mockResolvedValue(RAG_RESULT);

      const result = await handleQuery('pregunta');

      expect(result.databaseResults).toBeUndefined();
    });
  });

  describe('fuente "hybrid"', () => {
    it('llama a searchDatabase con la clasificación y a searchRag', async () => {
      mockClassifyIntent.mockResolvedValue(HYBRID_CLASSIFICATION);
      mockSearchDatabase.mockResolvedValue(DB_RESULT);
      mockSearchRag.mockResolvedValue(RAG_RESULT);

      await handleQuery('¿Qué prospectos de alto interés necesitan seguimiento y qué guion debo usar?');

      expect(mockSearchDatabase).toHaveBeenCalledWith(HYBRID_CLASSIFICATION);
      expect(mockSearchRag).toHaveBeenCalled();
    });

    it('incluye contexto de ambas fuentes al llamar a generateAnswer', async () => {
      mockClassifyIntent.mockResolvedValue(HYBRID_CLASSIFICATION);
      mockSearchDatabase.mockResolvedValue(DB_RESULT);
      mockSearchRag.mockResolvedValue(RAG_RESULT);

      await handleQuery('pregunta híbrida');

      expect(mockGenerateAnswer).toHaveBeenCalledWith(
        expect.objectContaining({
          databaseContext: 'Hay 5 campañas activas.',
          documentContext: 'El manual de ventas indica el procedimiento X.',
        })
      );
    });
  });

  describe('fuente "general"', () => {
    it('no llama a searchDatabase ni a searchRag', async () => {
      mockClassifyIntent.mockResolvedValue(GENERAL_CLASSIFICATION);

      await handleQuery('Explícame qué es un prospecto de ventas.');

      expect(mockSearchDatabase).not.toHaveBeenCalled();
      expect(mockSearchRag).not.toHaveBeenCalled();
    });

    it('llama a generateAnswer sin contexto de fuentes', async () => {
      mockClassifyIntent.mockResolvedValue(GENERAL_CLASSIFICATION);

      await handleQuery('Explícame qué es un prospecto de ventas.');

      expect(mockGenerateAnswer).toHaveBeenCalledWith(
        expect.objectContaining({ databaseContext: undefined, documentContext: undefined })
      );
    });
  });

  describe('fuente "unsupported"', () => {
    it('retorna respuesta segura en español sin llamar al LLM', async () => {
      mockClassifyIntent.mockResolvedValue(UNSUPPORTED_CLASSIFICATION);

      const result = await handleQuery('Borra todas las llamadas.');

      expect(mockGenerateAnswer).not.toHaveBeenCalled();
      expect(result.answer).toMatch(/call center de ventas/i);
    });

    it('no llama a searchDatabase ni a searchRag', async () => {
      mockClassifyIntent.mockResolvedValue(UNSUPPORTED_CLASSIFICATION);

      await handleQuery('pregunta no relacionada');

      expect(mockSearchDatabase).not.toHaveBeenCalled();
      expect(mockSearchRag).not.toHaveBeenCalled();
    });

    it('incluye la clasificación en la respuesta', async () => {
      mockClassifyIntent.mockResolvedValue(UNSUPPORTED_CLASSIFICATION);

      const result = await handleQuery('pregunta no relacionada');

      expect(result.classification).toEqual(UNSUPPORTED_CLASSIFICATION);
    });
  });

  describe('estructura de la respuesta', () => {
    it('incluye la pregunta original en el resultado', async () => {
      mockClassifyIntent.mockResolvedValue(DB_CLASSIFICATION);
      mockSearchDatabase.mockResolvedValue(DB_RESULT);

      const result = await handleQuery('¿Cuántos agentes activos hay?');

      expect(result.question).toBe('¿Cuántos agentes activos hay?');
    });

    it('incluye la clasificación en el resultado', async () => {
      mockClassifyIntent.mockResolvedValue(DB_CLASSIFICATION);
      mockSearchDatabase.mockResolvedValue(DB_RESULT);

      const result = await handleQuery('pregunta');

      expect(result.classification).toEqual(DB_CLASSIFICATION);
    });

    it('incluye la respuesta generada por el LLM en el resultado', async () => {
      mockClassifyIntent.mockResolvedValue(DB_CLASSIFICATION);
      mockSearchDatabase.mockResolvedValue(DB_RESULT);
      mockGenerateAnswer.mockResolvedValue('Respuesta final del sistema.');

      const result = await handleQuery('pregunta');

      expect(result.answer).toBe('Respuesta final del sistema.');
    });

    it('pasa la clasificación a generateAnswer', async () => {
      mockClassifyIntent.mockResolvedValue(DB_CLASSIFICATION);
      mockSearchDatabase.mockResolvedValue(DB_RESULT);

      await handleQuery('pregunta');

      expect(mockGenerateAnswer).toHaveBeenCalledWith(
        expect.objectContaining({ classification: DB_CLASSIFICATION })
      );
    });
  });

  describe('documentsUsed cuando metadata del RAG es undefined', () => {
    it('retorna documentsUsed como array vacío si ragResult.metadata es undefined', async () => {
      mockClassifyIntent.mockResolvedValue(RAG_CLASSIFICATION);
      mockSearchRag.mockResolvedValue({ answer: 'Texto', source: 'rag', metadata: undefined });

      const result = await handleQuery('pregunta');

      expect(result.documentsUsed).toEqual([]);
    });
  });
});
