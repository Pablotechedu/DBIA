import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/** Retorna el cliente Supabase singleton. Lanza un error si faltan variables de entorno. */
export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error('Variable de entorno SUPABASE_URL no definida');
  if (!key) throw new Error('Variable de entorno SUPABASE_SERVICE_ROLE_KEY no definida');

  client = createClient(url, key);
  return client;
}
