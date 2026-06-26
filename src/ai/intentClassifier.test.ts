import { classifyIntent } from './intentClassifier';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { getChatModel } from './chatModel';
import type { IntentClassification } from '../types/query';

jest.mock('@langchain/core/prompts', () => ({
  ChatPromptTemplate: {
    fromMessages: jest.fn(),
  },
}));
jest.mock('@langchain/core/output_parsers', () => ({
  StructuredOutputParser: {
    fromZodSchema: jest.fn(),
  },
}));
jest.mock('./chatModel');

const mockGetChatModel = getChatModel as jest.MockedFunction<typeof getChatModel>;
const mockFromZodSchema = StructuredOutputParser.fromZodSchema as jest.Mock;

const EXPECTED: IntentClassification = {
  source: 'database',
  confidence: 0.9,
  reasoning: 'La consulta menciona el precio de un producto específico.',
};

function buildMockChain(resolved: IntentClassification) {
  const mockInvoke = jest.fn().mockResolvedValue(resolved);
  const mockFinalChain = { invoke: mockInvoke };
  const mockPipe2 = jest.fn().mockReturnValue(mockFinalChain);
  const mockIntermediateChain = { pipe: mockPipe2 };
  const mockPipe1 = jest.fn().mockReturnValue(mockIntermediateChain);
  const mockTemplate = { pipe: mockPipe1 };

  (ChatPromptTemplate.fromMessages as jest.Mock).mockReturnValue(mockTemplate);

  const getFormatInstructions = jest.fn().mockReturnValue('INSTRUCCIONES_DE_FORMATO');
  mockFromZodSchema.mockReturnValue({ getFormatInstructions });
  mockGetChatModel.mockReturnValue({} as ReturnType<typeof getChatModel>);

  return { mockInvoke, mockPipe1, mockPipe2, getFormatInstructions };
}

describe('classifyIntent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('construcción de la cadena', () => {
    it('crea un parser estructurado a partir del esquema Zod', async () => {
      buildMockChain(EXPECTED);

      await classifyIntent('¿Cuál es el precio del producto X?');

      expect(mockFromZodSchema).toHaveBeenCalledTimes(1);
    });

    it('crea un ChatPromptTemplate con mensajes de sistema y usuario', async () => {
      buildMockChain(EXPECTED);

      await classifyIntent('¿Cuál es el precio del producto X?');

      expect(ChatPromptTemplate.fromMessages).toHaveBeenCalledWith([
        ['system', expect.stringContaining('{formatInstructions}')],
        ['human', expect.stringContaining('{query}')],
      ]);
    });

    it('encadena el modelo de chat con el template', async () => {
      const { mockPipe1 } = buildMockChain(EXPECTED);

      await classifyIntent('consulta');

      expect(mockPipe1).toHaveBeenCalledWith(expect.anything());
    });

    it('encadena el parser estructurado al final de la cadena', async () => {
      const { mockPipe2 } = buildMockChain(EXPECTED);

      await classifyIntent('consulta');

      expect(mockPipe2).toHaveBeenCalledWith(expect.any(Object));
    });
  });

  describe('invocación', () => {
    it('inyecta las format instructions en el invoke de la cadena', async () => {
      const { mockInvoke } = buildMockChain(EXPECTED);

      await classifyIntent('consulta');

      expect(mockInvoke).toHaveBeenCalledWith(
        expect.objectContaining({ formatInstructions: 'INSTRUCCIONES_DE_FORMATO' })
      );
    });

    it('pasa la consulta del usuario al invoke de la cadena', async () => {
      const { mockInvoke } = buildMockChain(EXPECTED);

      await classifyIntent('¿Cuántas unidades quedan?');

      expect(mockInvoke).toHaveBeenCalledWith(
        expect.objectContaining({ query: '¿Cuántas unidades quedan?' })
      );
    });
  });

  describe('valor de retorno', () => {
    it('retorna la IntentClassification producida por la cadena', async () => {
      buildMockChain(EXPECTED);

      const result = await classifyIntent('¿Cuál es el precio del producto X?');

      expect(result).toEqual(EXPECTED);
    });
  });

  describe('manejo de errores', () => {
    it('propaga errores lanzados por la cadena', async () => {
      const mockInvoke = jest.fn().mockRejectedValue(new Error('Ollama no disponible'));
      const mockPipe2 = jest.fn().mockReturnValue({ invoke: mockInvoke });
      const mockPipe1 = jest.fn().mockReturnValue({ pipe: mockPipe2 });
      (ChatPromptTemplate.fromMessages as jest.Mock).mockReturnValue({ pipe: mockPipe1 });
      mockFromZodSchema.mockReturnValue({ getFormatInstructions: jest.fn().mockReturnValue('x') });
      mockGetChatModel.mockReturnValue({} as ReturnType<typeof getChatModel>);

      await expect(classifyIntent('consulta')).rejects.toThrow('Ollama no disponible');
    });
  });
});
