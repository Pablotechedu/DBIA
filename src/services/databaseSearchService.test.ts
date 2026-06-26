import { searchDatabase } from './databaseSearchService';
import { getSupabaseClient } from '../db/supabaseClient';

jest.mock('../db/supabaseClient');

const mockGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;

/** Construye una cadena de mocks para el query builder de Supabase. */
function buildChain(result: { data: unknown; error: { message: string } | null }) {
  const orderFn = jest.fn().mockResolvedValue(result);
  const selectFn = jest.fn().mockReturnValue({ order: orderFn });
  const fromFn = jest.fn().mockReturnValue({ select: selectFn });
  mockGetSupabaseClient.mockReturnValue({ from: fromFn } as unknown as ReturnType<typeof getSupabaseClient>);
  return { fromFn, selectFn, orderFn };
}

describe('searchDatabase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('detección de tema por palabras clave', () => {
    it('consulta la tabla campaigns cuando la consulta menciona "campaña"', async () => {
      const { fromFn } = buildChain({
        data: [{ name: 'Campaña A', product_name: 'Seguro', status: 'active', target_leads_count: 100 }],
        error: null,
      });

      await searchDatabase('¿Cuántas campañas activas hay?');

      expect(fromFn).toHaveBeenCalledWith('campaigns');
    });

    it('consulta la tabla leads cuando la consulta menciona "prospecto"', async () => {
      const { fromFn } = buildChain({
        data: [{ status: 'new', interest_level: 'high' }],
        error: null,
      });

      await searchDatabase('¿Cuántos prospectos están en follow_up?');

      expect(fromFn).toHaveBeenCalledWith('leads');
    });

    it('consulta la tabla agents cuando la consulta menciona "agente"', async () => {
      const { fromFn } = buildChain({
        data: [{ name: 'Carlos', status: 'active', email: 'carlos@test.com' }],
        error: null,
      });

      await searchDatabase('¿Qué agentes están activos?');

      expect(fromFn).toHaveBeenCalledWith('agents');
    });

    it('consulta la tabla calls cuando la consulta menciona "llamada"', async () => {
      const { fromFn } = buildChain({
        data: [{ result: 'completed', duration_seconds: 300 }],
        error: null,
      });

      await searchDatabase('¿Cuántas llamadas se completaron?');

      expect(fromFn).toHaveBeenCalledWith('calls');
    });

    it('retorna mensaje general cuando la consulta no coincide con ningún tema', async () => {
      const result = await searchDatabase('¿Cuál es el clima hoy?');

      expect(result.answer).toContain('campañas');
      expect(result.answer).toContain('prospectos');
      expect(result.answer).toContain('agentes');
      expect(result.answer).toContain('llamadas');
      expect(mockGetSupabaseClient).not.toHaveBeenCalled();
    });
  });

  describe('formato de respuesta', () => {
    it('siempre retorna source "database"', async () => {
      buildChain({ data: [], error: null });

      const result = await searchDatabase('¿Qué campañas hay?');

      expect(result.source).toBe('database');
    });

    it('incluye metadata con el tema detectado', async () => {
      buildChain({
        data: [{ name: 'Camp A', product_name: 'Prod', status: 'active', target_leads_count: 50 }],
        error: null,
      });

      const result = await searchDatabase('¿Qué campañas existen?');

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.topic).toBe('campaigns');
    });

    it('indica total de registros encontrados en campaigns', async () => {
      buildChain({
        data: [
          { name: 'Camp 1', product_name: 'Prod A', status: 'active', target_leads_count: 100 },
          { name: 'Camp 2', product_name: 'Prod B', status: 'closed', target_leads_count: 50 },
        ],
        error: null,
      });

      const result = await searchDatabase('¿Cuántas campañas hay?');

      expect(result.answer).toContain('2');
    });

    it('responde en español cuando no hay campañas', async () => {
      buildChain({ data: [], error: null });

      const result = await searchDatabase('¿Qué campañas hay?');

      expect(result.answer).toMatch(/no se encontr/i);
    });

    it('indica duración promedio en respuestas de llamadas', async () => {
      buildChain({
        data: [
          { result: 'completed', duration_seconds: 200 },
          { result: 'no_answer', duration_seconds: 100 },
        ],
        error: null,
      });

      const result = await searchDatabase('¿Cuáles son los resultados de las llamadas?');

      expect(result.answer).toContain('150');
    });
  });

  describe('manejo de errores de base de datos', () => {
    it('lanza un error descriptivo en español cuando Supabase falla en campaigns', async () => {
      buildChain({ data: null, error: { message: 'connection refused' } });

      await expect(searchDatabase('¿Qué campañas hay?')).rejects.toThrow('campaña');
    });

    it('lanza un error descriptivo en español cuando Supabase falla en leads', async () => {
      buildChain({ data: null, error: { message: 'timeout' } });

      await expect(searchDatabase('¿Cuántos prospectos hay?')).rejects.toThrow('prospecto');
    });

    it('lanza un error descriptivo en español cuando Supabase falla en agents', async () => {
      buildChain({ data: null, error: { message: 'unauthorized' } });

      await expect(searchDatabase('¿Qué agentes hay?')).rejects.toThrow('agente');
    });

    it('lanza un error descriptivo en español cuando Supabase falla en calls', async () => {
      buildChain({ data: null, error: { message: 'timeout' } });

      await expect(searchDatabase('¿Cuántas llamadas hay?')).rejects.toThrow('llamada');
    });
  });
});
