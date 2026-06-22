import { searchRag } from './ragSearchService';
import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase';
import { getEmbeddingModel } from '../ai/embeddingModel';
import { getSupabaseClient } from '../db/supabaseClient';

jest.mock('@langchain/community/vectorstores/supabase');
jest.mock('../ai/embeddingModel');
jest.mock('../db/supabaseClient');

const MockSupabaseVectorStore = SupabaseVectorStore as jest.MockedClass<typeof SupabaseVectorStore>;
const mockGetEmbeddingModel = getEmbeddingModel as jest.MockedFunction<typeof getEmbeddingModel>;
const mockGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;

interface FakeDoc {
  pageContent: string;
  metadata: Record<string, unknown>;
}

function buildMocks(docs: FakeDoc[]) {
  const similaritySearchFn = jest.fn().mockResolvedValue(docs);
  MockSupabaseVectorStore.mockImplementation(
    () => ({ similaritySearch: similaritySearchFn }) as unknown as SupabaseVectorStore
  );
  mockGetEmbeddingModel.mockReturnValue({} as ReturnType<typeof getEmbeddingModel>);
  mockGetSupabaseClient.mockReturnValue({} as ReturnType<typeof getSupabaseClient>);
  return { similaritySearchFn };
}

describe('searchRag', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('configuración de SupabaseVectorStore', () => {
    it('crea SupabaseVectorStore con tableName "documents" y queryName "match_documents"', async () => {
      buildMocks([]);

      await searchRag('¿Qué es el seguro de vida?');

      expect(MockSupabaseVectorStore).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          tableName: 'documents',
          queryName: 'match_documents',
        })
      );
    });

    it('llama a similaritySearch con la consulta y 4 resultados', async () => {
      const { similaritySearchFn } = buildMocks([]);

      await searchRag('¿Cuáles son las políticas de ventas?');

      expect(similaritySearchFn).toHaveBeenCalledWith('¿Cuáles son las políticas de ventas?', 4);
    });

    it('pasa el cliente Supabase y el modelo de embeddings al constructor', async () => {
      const fakeEmbeddings = { embedQuery: jest.fn() };
      const fakeClient = { from: jest.fn() };
      mockGetEmbeddingModel.mockReturnValue(fakeEmbeddings as unknown as ReturnType<typeof getEmbeddingModel>);
      mockGetSupabaseClient.mockReturnValue(fakeClient as unknown as ReturnType<typeof getSupabaseClient>);
      const similaritySearchFn = jest.fn().mockResolvedValue([]);
      MockSupabaseVectorStore.mockImplementation(
        () => ({ similaritySearch: similaritySearchFn }) as unknown as SupabaseVectorStore
      );

      await searchRag('Consulta');

      expect(MockSupabaseVectorStore).toHaveBeenCalledWith(
        fakeEmbeddings,
        expect.objectContaining({ client: fakeClient })
      );
    });
  });

  describe('formato de respuesta', () => {
    it('siempre retorna source "rag"', async () => {
      buildMocks([{ pageContent: 'Contenido de ejemplo.', metadata: {} }]);

      const result = await searchRag('consulta');

      expect(result.source).toBe('rag');
    });

    it('retorna mensaje en español cuando no hay documentos relevantes', async () => {
      buildMocks([]);

      const result = await searchRag('consulta sin resultados');

      expect(result.answer).toMatch(/no se encontraron documentos/i);
    });

    it('indica totalDocuments 0 en metadata cuando no hay resultados', async () => {
      buildMocks([]);

      const result = await searchRag('consulta vacía');

      expect(result.metadata?.totalDocuments).toBe(0);
    });

    it('incluye el contenido de los documentos en la respuesta', async () => {
      buildMocks([
        { pageContent: 'Manual de capacitación para agentes.', metadata: {} },
        { pageContent: 'Guía de productos disponibles.', metadata: {} },
      ]);

      const result = await searchRag('¿Cómo capacitar agentes?');

      expect(result.answer).toContain('Manual de capacitación para agentes.');
      expect(result.answer).toContain('Guía de productos disponibles.');
    });

    it('indica la cantidad de documentos encontrados en la respuesta', async () => {
      buildMocks([
        { pageContent: 'Doc 1', metadata: {} },
        { pageContent: 'Doc 2', metadata: {} },
        { pageContent: 'Doc 3', metadata: {} },
      ]);

      const result = await searchRag('búsqueda');

      expect(result.answer).toContain('3');
    });

    it('incluye totalDocuments en metadata cuando hay resultados', async () => {
      buildMocks([
        { pageContent: 'Documento relevante.', metadata: { categoria: 'ventas' } },
      ]);

      const result = await searchRag('ventas');

      expect(result.metadata?.totalDocuments).toBe(1);
    });

    it('incluye la metadata del documento en la respuesta cuando está disponible', async () => {
      buildMocks([
        { pageContent: 'Procedimiento de ventas.', metadata: { categoria: 'ventas', version: '2.0' } },
      ]);

      const result = await searchRag('procedimiento');

      expect(result.answer).toContain('categoria: ventas');
    });
  });

  describe('manejo de errores', () => {
    it('propaga errores lanzados por similaritySearch', async () => {
      const similaritySearchFn = jest.fn().mockRejectedValue(new Error('conexión rechazada'));
      MockSupabaseVectorStore.mockImplementation(
        () => ({ similaritySearch: similaritySearchFn }) as unknown as SupabaseVectorStore
      );
      mockGetEmbeddingModel.mockReturnValue({} as ReturnType<typeof getEmbeddingModel>);
      mockGetSupabaseClient.mockReturnValue({} as ReturnType<typeof getSupabaseClient>);

      await expect(searchRag('consulta que falla')).rejects.toThrow('conexión rechazada');
    });
  });
});
