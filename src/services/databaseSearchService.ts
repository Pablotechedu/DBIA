import { getSupabaseClient } from '../db/supabaseClient';
import type { QueryResult } from '../types/query';

type DbTopic = 'campaigns' | 'leads' | 'agents' | 'calls' | 'general';

interface CampaignRow {
  name: string;
  product_name: string;
  status: string;
  target_leads_count: number;
}

interface LeadRow {
  status: string;
  interest_level: string;
}

interface AgentRow {
  name: string;
  status: string;
  email: string;
}

interface CallRow {
  result: string;
  duration_seconds: number;
}

interface DbQueryResult {
  answer: string;
  metadata: Record<string, unknown>;
}

/** Detecta el tema de la consulta a partir de palabras clave. */
function detectTopic(query: string): DbTopic {
  const q = query.toLowerCase();
  if (/campa[ñn]a|producto|seguro|cr[eé]dito|inversi[oó]n/.test(q)) return 'campaigns';
  if (/lead|prospecto|cliente|inter[eé]s/.test(q)) return 'leads';
  if (/agente|asesor|vendedor|representante/.test(q)) return 'agents';
  if (/llamada|call|contacto|duraci[oó]n/.test(q)) return 'calls';
  return 'general';
}

async function queryCampaigns(): Promise<DbQueryResult> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('campaigns')
    .select('name, product_name, status, target_leads_count')
    .order('status');

  if (error) throw new Error(`Error consultando campañas: ${error.message}`);

  const rows = (data ?? []) as CampaignRow[];

  if (rows.length === 0) {
    return {
      answer: 'No se encontraron campañas en la base de datos.',
      metadata: { topic: 'campaigns', total: 0 },
    };
  }

  const active = rows.filter(c => c.status === 'active');
  const other = rows.filter(c => c.status !== 'active');

  const lines: string[] = [`Se encontraron ${rows.length} campaña(s) en total.`];

  if (active.length > 0) {
    lines.push(`\nCampañas activas (${active.length}):`);
    active.forEach(c =>
      lines.push(`- ${c.name} | Producto: ${c.product_name} | Objetivo: ${c.target_leads_count} prospectos`)
    );
  }
  if (other.length > 0) {
    lines.push(`\nOtras campañas (${other.length}):`);
    other.forEach(c =>
      lines.push(`- ${c.name} | Producto: ${c.product_name} | Estado: ${c.status}`)
    );
  }

  return {
    answer: lines.join('\n'),
    metadata: { topic: 'campaigns', total: rows.length, active: active.length },
  };
}

async function queryLeads(): Promise<DbQueryResult> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('leads')
    .select('status, interest_level')
    .order('status');

  if (error) throw new Error(`Error consultando prospectos: ${error.message}`);

  const rows = (data ?? []) as LeadRow[];

  if (rows.length === 0) {
    return {
      answer: 'No se encontraron prospectos en la base de datos.',
      metadata: { topic: 'leads', total: 0 },
    };
  }

  const byStatus: Record<string, number> = {};
  const byInterest: Record<string, number> = {};
  for (const row of rows) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
    byInterest[row.interest_level] = (byInterest[row.interest_level] ?? 0) + 1;
  }

  const lines: string[] = [`Se encontraron ${rows.length} prospecto(s) en total.`];
  lines.push('\nDistribución por estado:');
  Object.entries(byStatus).forEach(([st, count]) => lines.push(`- ${st}: ${count}`));
  lines.push('\nDistribución por nivel de interés:');
  Object.entries(byInterest).forEach(([lvl, count]) => lines.push(`- ${lvl}: ${count}`));

  return {
    answer: lines.join('\n'),
    metadata: { topic: 'leads', total: rows.length },
  };
}

async function queryAgents(): Promise<DbQueryResult> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('agents')
    .select('name, status, email')
    .order('name');

  if (error) throw new Error(`Error consultando agentes: ${error.message}`);

  const rows = (data ?? []) as AgentRow[];

  if (rows.length === 0) {
    return {
      answer: 'No se encontraron agentes en la base de datos.',
      metadata: { topic: 'agents', total: 0 },
    };
  }

  const active = rows.filter(a => a.status === 'active');
  const other = rows.filter(a => a.status !== 'active');

  const lines: string[] = [`Se encontraron ${rows.length} agente(s) registrado(s).`];

  if (active.length > 0) {
    lines.push(`\nAgentes activos (${active.length}):`);
    active.forEach(a => lines.push(`- ${a.name} (${a.email})`));
  }
  if (other.length > 0) {
    lines.push(`\nAgentes inactivos/con permiso (${other.length}):`);
    other.forEach(a => lines.push(`- ${a.name} | Estado: ${a.status}`));
  }

  return {
    answer: lines.join('\n'),
    metadata: { topic: 'agents', total: rows.length, active: active.length },
  };
}

async function queryCalls(): Promise<DbQueryResult> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('calls')
    .select('result, duration_seconds')
    .order('result');

  if (error) throw new Error(`Error consultando llamadas: ${error.message}`);

  const rows = (data ?? []) as CallRow[];

  if (rows.length === 0) {
    return {
      answer: 'No se encontraron llamadas en la base de datos.',
      metadata: { topic: 'calls', total: 0 },
    };
  }

  const byResult: Record<string, number> = {};
  let totalSeconds = 0;
  for (const row of rows) {
    byResult[row.result] = (byResult[row.result] ?? 0) + 1;
    totalSeconds += row.duration_seconds;
  }
  const avgSeconds = Math.round(totalSeconds / rows.length);

  const lines: string[] = [
    `Se registraron ${rows.length} llamada(s) en total.`,
    `Duración promedio: ${avgSeconds} segundos.`,
    '\nResultados:',
  ];
  Object.entries(byResult).forEach(([r, count]) => lines.push(`- ${r}: ${count}`));

  return {
    answer: lines.join('\n'),
    metadata: { topic: 'calls', total: rows.length, avgDurationSeconds: avgSeconds },
  };
}

/** Busca información estructurada en la base de datos relacional según la consulta. */
export async function searchDatabase(query: string): Promise<QueryResult> {
  const topic = detectTopic(query);

  let result: DbQueryResult;

  switch (topic) {
    case 'campaigns':
      result = await queryCampaigns();
      break;
    case 'leads':
      result = await queryLeads();
      break;
    case 'agents':
      result = await queryAgents();
      break;
    case 'calls':
      result = await queryCalls();
      break;
    default:
      result = {
        answer: 'Puede consultar información sobre campañas, prospectos (leads), agentes y llamadas del call center.',
        metadata: { topic: 'general' },
      };
  }

  return {
    answer: result.answer,
    source: 'database',
    metadata: result.metadata,
  };
}
