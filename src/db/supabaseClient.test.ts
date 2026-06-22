import type { getSupabaseClient as GetSupabaseClientFn } from './supabaseClient';

describe('getSupabaseClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('lanza error si SUPABASE_URL no está definida', () => {
    delete process.env.SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-de-prueba';
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getSupabaseClient } = require('./supabaseClient') as { getSupabaseClient: typeof GetSupabaseClientFn };
      expect(() => getSupabaseClient()).toThrow('SUPABASE_URL');
    });
  });

  it('lanza error si SUPABASE_SERVICE_ROLE_KEY no está definida', () => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getSupabaseClient } = require('./supabaseClient') as { getSupabaseClient: typeof GetSupabaseClientFn };
      expect(() => getSupabaseClient()).toThrow('SUPABASE_SERVICE_ROLE_KEY');
    });
  });

  it('retorna un cliente cuando las variables de entorno están definidas', () => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-de-prueba';
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getSupabaseClient } = require('./supabaseClient') as { getSupabaseClient: typeof GetSupabaseClientFn };
      expect(getSupabaseClient()).toBeDefined();
    });
  });

  it('retorna el mismo cliente en llamadas sucesivas (singleton)', () => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-de-prueba';
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getSupabaseClient } = require('./supabaseClient') as { getSupabaseClient: typeof GetSupabaseClientFn };
      const cliente1 = getSupabaseClient();
      const cliente2 = getSupabaseClient();
      expect(cliente1).toBe(cliente2);
    });
  });
});
