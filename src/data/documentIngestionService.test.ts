import { ingestTextDocument } from './documentIngestionService';
import { getEmbeddingModel } from '../ai/embeddingModel';
import { getSupabaseClient } from '../db/supabaseClient';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase';
import { Document } from '@langchain/core/documents';

jest.mock('../ai/embeddingModel');
jest.mock('../db/supabaseClient');
jest.mock('@langchain/textsplitters');
jest.mock('@langchain/community/vectorstores/supabase');

const mockGetEmbeddingModel = getEmbeddingModel as jest.MockedFunction<typeof getEmbeddingModel>;
const mockGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;
const MockSplitter = RecursiveCharacterTextSplitter as jest.MockedClass<typeof RecursiveCharacterTextSplitter>;
const mockFromDocuments = SupabaseVectorStore.fromDocuments as jest.MockedFunction<
  typeof SupabaseVectorStore.fromDocuments
>;

const FAKE_EMBEDDINGS = { embedDocuments: jest.fn() };
const FAKE_CLIENT = { from: jest.fn() };

function buildMocks(chunks: Document[]) {
  const splitDocuments = jest.fn().mockResolvedValue(chunks);
  MockSplitter.mockImplementation(() => ({ splitDocuments }) as unknown as RecursiveCharacterTextSplitter);

  mockGetEmbeddingModel.mockReturnValue(FAKE_EMBEDDINGS as unknown as ReturnType<typeof getEmbeddingModel>);
  mockGetSupabaseClient.mockReturnValue(FAKE_CLIENT as unknown as ReturnType<typeof getSupabaseClient>);
  mockFromDocuments.mockResolvedValue({} as unknown as SupabaseVectorStore);

  return { splitDocuments };
}

function makeChunks(n: number): Document[] {
  return Array.from({ length: n }, (_, i) => new Document({ pageContent: `fragmento ${i}`, metadata: {} }));
}

describe('ingestTextDocument', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fragmentación (chunking)', () => {
    it('configura el divisor con chunkSize 800 y chunkOverlap 120', async () => {
      buildMocks(makeChunks(3));

      await ingestTextDocument({ content: 'Manual largo de ventas.' });

      expect(MockSplitter).toHaveBeenCalledWith({ chunkSize: 800, chunkOverlap: 120 });
    });

    it('divide el documento en fragmentos antes de almacenarlo', async () => {
      const { splitDocuments } = buildMocks(makeChunks(3));

      await ingestTextDocument({ content: 'Contenido extenso para fragmentar.' });

      expect(splitDocuments).toHaveBeenCalledTimes(1);
      const docsArg = splitDocuments.mock.calls[0][0] as Document[];
      expect(docsArg[0].pageContent).toBe('Contenido extenso para fragmentar.');
    });

    it('incluye title en la metadata cuando se proporciona', async () => {
      const { splitDocuments } = buildMocks(makeChunks(2));

      await ingestTextDocument({ content: 'Texto.', title: 'Guion de llamada inicial' });

      const docsArg = splitDocuments.mock.calls[0][0] as Document[];
      expect(docsArg[0].metadata).toEqual(expect.objectContaining({ title: 'Guion de llamada inicial' }));
    });

    it('incluye category en la metadata cuando se proporciona', async () => {
      const { splitDocuments } = buildMocks(makeChunks(2));

      await ingestTextDocument({ content: 'Texto.', category: 'Ventas' });

      const docsArg = splitDocuments.mock.calls[0][0] as Document[];
      expect(docsArg[0].metadata).toEqual(expect.objectContaining({ category: 'Ventas' }));
    });

    it('incluye tags en la metadata cuando se proporcionan', async () => {
      const { splitDocuments } = buildMocks(makeChunks(2));

      await ingestTextDocument({ content: 'Texto.', tags: ['guion', 'llamada', 'ventas'] });

      const docsArg = splitDocuments.mock.calls[0][0] as Document[];
      expect(docsArg[0].metadata).toEqual(expect.objectContaining({ tags: ['guion', 'llamada', 'ventas'] }));
    });

    it('incluye filename en la metadata cuando se proporciona', async () => {
      const { splitDocuments } = buildMocks(makeChunks(2));

      await ingestTextDocument({ content: 'Texto.', filename: 'guion.txt' });

      const docsArg = splitDocuments.mock.calls[0][0] as Document[];
      expect(docsArg[0].metadata).toEqual(expect.objectContaining({ filename: 'guion.txt' }));
    });

    it('usa metadata vacía cuando no se proporcionan campos opcionales', async () => {
      const { splitDocuments } = buildMocks(makeChunks(1));

      await ingestTextDocument({ content: 'Texto.' });

      const docsArg = splitDocuments.mock.calls[0][0] as Document[];
      expect(docsArg[0].metadata).toEqual({});
    });
  });

  describe('almacenamiento vectorial', () => {
    it('almacena los fragmentos con SupabaseVectorStore.fromDocuments', async () => {
      const chunks = makeChunks(4);
      buildMocks(chunks);

      await ingestTextDocument({ content: 'Documento.' });

      expect(mockFromDocuments).toHaveBeenCalledTimes(1);
      expect(mockFromDocuments).toHaveBeenCalledWith(
        chunks,
        FAKE_EMBEDDINGS,
        expect.objectContaining({ tableName: 'documents', queryName: 'match_documents' })
      );
    });

    it('retorna la cantidad de fragmentos generados', async () => {
      buildMocks(makeChunks(5));

      const result = await ingestTextDocument({ content: 'Documento.' });

      expect(result).toEqual({ chunksIngested: 5 });
    });
  });

  describe('validación', () => {
    it('lanza un error cuando el contenido está vacío', async () => {
      buildMocks(makeChunks(0));

      await expect(ingestTextDocument({ content: '   ' })).rejects.toThrow(/contenido/i);
    });
  });
});
