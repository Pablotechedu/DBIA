import { ingestDocument } from './documentIngestionService';
import { getEmbeddingModel } from '../ai/embeddingModel';
import { getSupabaseClient } from '../db/supabaseClient';

jest.mock('../ai/embeddingModel');
jest.mock('../db/supabaseClient');

const mockGetEmbeddingModel = getEmbeddingModel as jest.MockedFunction<typeof getEmbeddingModel>;
const mockGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;

const FAKE_EMBEDDING = Array(768).fill(0.1) as number[];

function buildMocks(insertResult: { error: { message: string } | null }) {
  const insertFn = jest.fn().mockResolvedValue(insertResult);
  const fromFn = jest.fn().mockReturnValue({ insert: insertFn });
  mockGetSupabaseClient.mockReturnValue({ from: fromFn } as unknown as ReturnType<typeof getSupabaseClient>);

  const embedDocumentsFn = jest.fn().mockResolvedValue([FAKE_EMBEDDING]);
  mockGetEmbeddingModel.mockReturnValue({ embedDocuments: embedDocumentsFn } as unknown as ReturnType<typeof getEmbeddingModel>);

  return { fromFn, insertFn, embedDocumentsFn };
}

describe('ingestDocument', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generación de embeddings', () => {
    it('llama a embedDocuments con el contenido proporcionado', async () => {
      const { embedDocumentsFn } = buildMocks({ error: null });

      await ingestDocument('Manual de ventas del call center.');

      expect(embedDocumentsFn).toHaveBeenCalledWith(['Manual de ventas del call center.']);
    });

    it('llama a embedDocuments exactamente una vez por documento', async () => {
      const { embedDocumentsFn } = buildMocks({ error: null });

      await ingestDocument('Contenido de prueba.');

      expect(embedDocumentsFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('inserción en Supabase', () => {
    it('inserta en la tabla documents', async () => {
      const { fromFn } = buildMocks({ error: null });

      await ingestDocument('Texto de ejemplo.');

      expect(fromFn).toHaveBeenCalledWith('documents');
    });

    it('incluye content, metadata y embedding en el insert', async () => {
      const { insertFn } = buildMocks({ error: null });
      const meta = { fuente: 'manual', version: 1 };

      await ingestDocument('Texto con metadata.', meta);

      expect(insertFn).toHaveBeenCalledWith({
        content: 'Texto con metadata.',
        metadata: meta,
        embedding: FAKE_EMBEDDING,
      });
    });

    it('usa metadata vacía por defecto cuando no se proporciona', async () => {
      const { insertFn } = buildMocks({ error: null });

      await ingestDocument('Texto sin metadata.');

      expect(insertFn).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: {} })
      );
    });
  });

  describe('manejo de errores', () => {
    it('lanza un error descriptivo en español cuando Supabase falla', async () => {
      buildMocks({ error: { message: 'duplicate key value' } });

      await expect(ingestDocument('Documento duplicado.')).rejects.toThrow(
        /ingestar documento/i
      );
    });

    it('el mensaje de error incluye el detalle original de Supabase', async () => {
      buildMocks({ error: { message: 'connection refused' } });

      await expect(ingestDocument('Texto.')).rejects.toThrow('connection refused');
    });
  });
});
