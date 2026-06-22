import { generateAnswer } from './answerChain';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { getChatModel } from './chatModel';
import type { AnswerInput } from './answerChain';
import type { IntentClassification } from '../types/query';

jest.mock('@langchain/core/prompts', () => ({
  ChatPromptTemplate: {
    fromMessages: jest.fn(),
  },
}));
jest.mock('@langchain/core/output_parsers', () => ({
  StringOutputParser: jest.fn(),
}));
jest.mock('./chatModel');

const mockGetChatModel = getChatModel as jest.MockedFunction<typeof getChatModel>;
const MockStringOutputParser = StringOutputParser as jest.MockedClass<typeof StringOutputParser>;

const CLASSIFICATION_DB: IntentClassification = {
  source: 'database',
  confidence: 0.9,
  reasoning: 'La consulta es sobre datos de campañas.',
};

function buildMockChain(resolvedAnswer: string) {
  const mockInvoke = jest.fn().mockResolvedValue(resolvedAnswer);
  const mockFinalChain = { invoke: mockInvoke };
  const mockPipe2 = jest.fn().mockReturnValue(mockFinalChain);
  const mockIntermediateChain = { pipe: mockPipe2 };
  const mockPipe1 = jest.fn().mockReturnValue(mockIntermediateChain);
  const mockTemplate = { pipe: mockPipe1 };

  (ChatPromptTemplate.fromMessages as jest.Mock).mockReturnValue(mockTemplate);
  MockStringOutputParser.mockImplementation(() => ({}) as StringOutputParser);
  mockGetChatModel.mockReturnValue({} as ReturnType<typeof getChatModel>);

  return { mockInvoke, mockPipe1, mockPipe2 };
}

describe('generateAnswer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('construcción de la cadena', () => {
    it('crea un ChatPromptTemplate con mensajes de sistema y usuario', async () => {
      buildMockChain('respuesta');

      await generateAnswer({ question: 'prueba', classification: CLASSIFICATION_DB });

      expect(ChatPromptTemplate.fromMessages).toHaveBeenCalledWith([
        ['system', expect.stringContaining('call center de ventas')],
        ['human', expect.stringContaining('{question}')],
      ]);
    });

    it('encadena el modelo de chat con el template', async () => {
      const { mockPipe1 } = buildMockChain('respuesta');

      await generateAnswer({ question: 'prueba', classification: CLASSIFICATION_DB });

      expect(mockPipe1).toHaveBeenCalledWith(expect.anything());
    });

    it('encadena StringOutputParser al final de la cadena', async () => {
      const { mockPipe2 } = buildMockChain('respuesta');

      await generateAnswer({ question: 'prueba', classification: CLASSIFICATION_DB });

      expect(mockPipe2).toHaveBeenCalledWith(expect.any(Object));
    });
  });

  describe('invocación con parámetros correctos', () => {
    it('pasa la pregunta al invoke de la cadena', async () => {
      const { mockInvoke } = buildMockChain('respuesta de prueba');

      await generateAnswer({ question: '¿Cuántas campañas activas hay?', classification: CLASSIFICATION_DB });

      expect(mockInvoke).toHaveBeenCalledWith(
        expect.objectContaining({ question: '¿Cuántas campañas activas hay?' })
      );
    });

    it('pasa el reasoning de la clasificación al invoke', async () => {
      const { mockInvoke } = buildMockChain('respuesta');

      await generateAnswer({ question: 'pregunta', classification: CLASSIFICATION_DB });

      expect(mockInvoke).toHaveBeenCalledWith(
        expect.objectContaining({ reasoning: 'La consulta es sobre datos de campañas.' })
      );
    });

    it('incluye el databaseContext cuando se proporciona', async () => {
      const { mockInvoke } = buildMockChain('respuesta');

      await generateAnswer({
        question: 'pregunta',
        classification: CLASSIFICATION_DB,
        databaseContext: 'Hay 5 campañas activas.',
      });

      expect(mockInvoke).toHaveBeenCalledWith(
        expect.objectContaining({ databaseContext: 'Hay 5 campañas activas.' })
      );
    });

    it('usa texto de reemplazo cuando databaseContext es undefined', async () => {
      const { mockInvoke } = buildMockChain('respuesta');

      await generateAnswer({ question: 'pregunta', classification: CLASSIFICATION_DB });

      expect(mockInvoke).toHaveBeenCalledWith(
        expect.objectContaining({ databaseContext: 'No hay datos de base de datos disponibles.' })
      );
    });

    it('incluye el documentContext cuando se proporciona', async () => {
      const { mockInvoke } = buildMockChain('respuesta');

      await generateAnswer({
        question: 'pregunta',
        classification: CLASSIFICATION_DB,
        documentContext: 'Manual de ventas versión 2.0.',
      });

      expect(mockInvoke).toHaveBeenCalledWith(
        expect.objectContaining({ documentContext: 'Manual de ventas versión 2.0.' })
      );
    });

    it('usa texto de reemplazo cuando documentContext es undefined', async () => {
      const { mockInvoke } = buildMockChain('respuesta');

      await generateAnswer({ question: 'pregunta', classification: CLASSIFICATION_DB });

      expect(mockInvoke).toHaveBeenCalledWith(
        expect.objectContaining({ documentContext: 'No hay documentos relevantes disponibles.' })
      );
    });
  });

  describe('valor de retorno', () => {
    it('retorna la respuesta generada por la cadena', async () => {
      buildMockChain('El call center tiene 3 campañas activas.');

      const result = await generateAnswer({ question: 'pregunta', classification: CLASSIFICATION_DB });

      expect(result).toBe('El call center tiene 3 campañas activas.');
    });
  });

  describe('manejo de errores', () => {
    it('propaga errores lanzados por la cadena', async () => {
      const mockInvoke = jest.fn().mockRejectedValue(new Error('Ollama no disponible'));
      const mockFinalChain = { invoke: mockInvoke };
      const mockPipe2 = jest.fn().mockReturnValue(mockFinalChain);
      const mockIntermediateChain = { pipe: mockPipe2 };
      const mockPipe1 = jest.fn().mockReturnValue(mockIntermediateChain);
      const mockTemplate = { pipe: mockPipe1 };
      (ChatPromptTemplate.fromMessages as jest.Mock).mockReturnValue(mockTemplate);
      MockStringOutputParser.mockImplementation(() => ({}) as StringOutputParser);
      mockGetChatModel.mockReturnValue({} as ReturnType<typeof getChatModel>);

      const input: AnswerInput = { question: 'pregunta', classification: CLASSIFICATION_DB };

      await expect(generateAnswer(input)).rejects.toThrow('Ollama no disponible');
    });
  });
});
