import { classifyIntent } from './intentClassifier';
import { getChatModel } from './chatModel';
import type { IntentClassification } from '../types/query';

jest.mock('./chatModel');

const mockGetChatModel = getChatModel as jest.MockedFunction<typeof getChatModel>;

describe('classifyIntent', () => {
  const mockInvoke = jest.fn();
  const mockWithStructuredOutput = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockWithStructuredOutput.mockReturnValue({ invoke: mockInvoke });
    mockGetChatModel.mockReturnValue({
      withStructuredOutput: mockWithStructuredOutput,
    } as unknown as ReturnType<typeof getChatModel>);
  });

  it('retorna IntentClassification para una consulta de base de datos', async () => {
    const expected: IntentClassification = {
      source: 'database',
      confidence: 0.9,
      reasoning: 'La consulta menciona el precio de un producto específico.',
    };
    mockInvoke.mockResolvedValue(expected);

    const result = await classifyIntent('¿Cuál es el precio del producto X?');

    expect(result).toEqual(expected);
  });

  it('retorna IntentClassification para una consulta RAG', async () => {
    const expected: IntentClassification = {
      source: 'rag',
      confidence: 0.85,
      reasoning: 'La consulta trata sobre la política de devoluciones.',
    };
    mockInvoke.mockResolvedValue(expected);

    const result = await classifyIntent('¿Cuál es la política de devoluciones?');

    expect(result).toEqual(expected);
  });

  it('retorna IntentClassification para una consulta combinada', async () => {
    const expected: IntentClassification = {
      source: 'combined',
      confidence: 0.75,
      reasoning: 'Requiere datos del producto y conocimiento de políticas.',
    };
    mockInvoke.mockResolvedValue(expected);

    const result = await classifyIntent('¿Puedo devolver el producto X que compré ayer?');

    expect(result).toEqual(expected);
  });

  it('invoca el modelo con dos mensajes (sistema y usuario)', async () => {
    mockInvoke.mockResolvedValue({ source: 'database', confidence: 0.8, reasoning: 'test' });

    await classifyIntent('¿Cuántas unidades quedan?');

    expect(mockWithStructuredOutput).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    const invokedMessages = mockInvoke.mock.calls[0][0];
    expect(invokedMessages).toHaveLength(2);
  });
});
