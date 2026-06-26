import { searchDatabase } from './databaseSearchService';
import { getSupabaseClient } from '../db/supabaseClient';
import type { IntentClassification } from '../types/query';

jest.mock('../db/supabaseClient');

const mockGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;

const NULL_ENTITIES: IntentClassification['entities'] = {
  table: null,
  leadStatus: null,
  interestLevel: null,
  agentName: null,
  campaignStatus: null,
  documentTopic: null,
};

function makeClassification(
  table: IntentClassification['entities']['table'],
  overrides: Partial<IntentClassification['entities']> = {}
): IntentClassification {
  return {
    source: 'database',
    intent: 'consulta de prueba',
    confidence: 0.9,
    entities: { ...NULL_ENTITIES, table, ...overrides },
  };
}

/** Construye la cadena de mocks del query builder de Supabase con soporte para eq/ilike/order. */
function buildChain(result: { data: unknown; error: { message: string } | null }) {
  // El proxy resuelve cualquier llamada encadenada devolviendo el mismo objeto o el resultado final.
  const terminal = jest.fn().mockResolvedValue(result);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chainable: any = {
    order: terminal,
    eq: jest.fn().mockImplementation(() => chainable),
    ilike: jest.fn().mockImplementation(() => chainable),
    select: jest.fn().mockImplementation(() => chainable),
  };
  // Cuando se llama con argumentos que hacen un join (agents!inner), devolver también chainable.
  chainable.from = jest.fn().mockReturnValue(chainable);

  const fromFn = jest.fn().mockReturnValue(chainable);
  mockGetSupabaseClient.mockReturnValue({ from: fromFn } as unknown as ReturnType<typeof getSupabaseClient>);
  return { fromFn, chainable };
}

describe('searchDatabase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('enrutamiento por entities.table', () => {
    it('consulta la tabla campaigns cuando entities.table es "campaigns"', async () => {
      const { fromFn } = buildChain({
        data: [{ name: 'Campaña A', product_name: 'Seguro', status: 'active', start_date: null, end_date: null, target_leads_count: 100 }],
        error: null,
      });

      await searchDatabase(makeClassification('campaigns'));

      expect(fromFn).toHaveBeenCalledWith('campaigns');
    });

    it('consulta la tabla leads cuando entities.table es "leads"', async () => {
      const { fromFn } = buildChain({
        data: [{ full_name: 'Juan', status: 'new', interest_level: 'high', phone: null }],
        error: null,
      });

      await searchDatabase(makeClassification('leads'));

      expect(fromFn).toHaveBeenCalledWith('leads');
    });

    it('consulta la tabla agents cuando entities.table es "agents"', async () => {
      const { fromFn } = buildChain({
        data: [{ full_name: 'Carlos', status: 'active', email: 'carlos@test.com' }],
        error: null,
      });

      await searchDatabase(makeClassification('agents'));

      expect(fromFn).toHaveBeenCalledWith('agents');
    });

    it('consulta la tabla calls cuando entities.table es "calls"', async () => {
      const { fromFn } = buildChain({
        data: [{ result: 'completed', duration_seconds: 300, call_date: '2026-01-01' }],
        error: null,
      });

      await searchDatabase(makeClassification('calls'));

      expect(fromFn).toHaveBeenCalledWith('calls');
    });

    it('retorna mensaje general cuando entities.table es null', async () => {
      const result = await searchDatabase(makeClassification(null));

      expect(result.answer).toContain('campañas');
      expect(result.answer).toContain('prospectos');
      expect(mockGetSupabaseClient).not.toHaveBeenCalled();
    });
  });

  describe('formato de respuesta', () => {
    it('siempre retorna source "database"', async () => {
      buildChain({ data: [], error: null });

      const result = await searchDatabase(makeClassification('campaigns'));

      expect(result.source).toBe('database');
    });

    it('indica total de registros encontrados', async () => {
      buildChain({
        data: [
          { name: 'Camp 1', product_name: 'Prod A', status: 'active', start_date: null, end_date: null, target_leads_count: 100 },
          { name: 'Camp 2', product_name: 'Prod B', status: 'closed', start_date: null, end_date: null, target_leads_count: 50 },
        ],
        error: null,
      });

      const result = await searchDatabase(makeClassification('campaigns'));

      expect(result.answer).toContain('2');
    });

    it('responde en español cuando no hay registros', async () => {
      buildChain({ data: [], error: null });

      const result = await searchDatabase(makeClassification('campaigns'));

      expect(result.answer).toMatch(/no se encontr/i);
    });
  });

  describe('manejo de errores de base de datos', () => {
    it('lanza un error descriptivo en español cuando Supabase falla en campaigns', async () => {
      buildChain({ data: null, error: { message: 'connection refused' } });

      await expect(searchDatabase(makeClassification('campaigns'))).rejects.toThrow('campaña');
    });

    it('lanza un error descriptivo en español cuando Supabase falla en leads', async () => {
      buildChain({ data: null, error: { message: 'timeout' } });

      await expect(searchDatabase(makeClassification('leads'))).rejects.toThrow('prospecto');
    });

    it('lanza un error descriptivo en español cuando Supabase falla en agents', async () => {
      buildChain({ data: null, error: { message: 'unauthorized' } });

      await expect(searchDatabase(makeClassification('agents'))).rejects.toThrow('agente');
    });

    it('lanza un error descriptivo en español cuando Supabase falla en calls', async () => {
      buildChain({ data: null, error: { message: 'timeout' } });

      await expect(searchDatabase(makeClassification('calls'))).rejects.toThrow('llamada');
    });
  });
});
