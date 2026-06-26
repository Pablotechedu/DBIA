import { getSupabaseClient } from '../db/supabaseClient';
import type { IntentClassification, QueryResult } from '../types/query';

interface CampaignRow {
  name: string;
  product_name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  target_leads_count: number;
}

interface LeadRow {
  full_name: string;
  status: string;
  interest_level: string;
  phone: string | null;
}

interface AgentRow {
  full_name: string;
  status: string;
  email: string;
}

interface CallRow {
  result: string;
  duration_seconds: number;
  call_date: string;
}

interface DbQueryResult {
  answer: string;
  metadata: Record<string, unknown>;
}

async function queryCampaigns(campaignStatus?: string | null): Promise<DbQueryResult> {
  const client = getSupabaseClient();
  let q = client
    .from('campaigns')
    .select('name, product_name, status, start_date, end_date, target_leads_count')
    .order('status');

  if (campaignStatus) q = q.eq('status', campaignStatus);

  const { data, error } = await q;
  if (error) throw new Error(`Error consultando campañas: ${error.message}`);

  const rows = (data ?? []) as CampaignRow[];
  if (rows.length === 0) {
    return {
      answer: 'No se encontraron campañas con los criterios indicados.',
      metadata: { table: 'campaigns', total: 0 },
    };
  }

  const active = rows.filter(c => c.status === 'active');
  const other = rows.filter(c => c.status !== 'active');
  const lines: string[] = [`Se encontraron ${rows.length} campaña(s).`];

  if (active.length > 0) {
    lines.push(`\nCampañas activas (${active.length}):`);
    active.forEach(c =>
      lines.push(`- ${c.name} | Producto: ${c.product_name} | Objetivo: ${c.target_leads_count} prospectos`)
    );
  }
  if (other.length > 0) {
    lines.push(`\nOtras campañas (${other.length}):`);
    other.forEach(c => lines.push(`- ${c.name} | Producto: ${c.product_name} | Estado: ${c.status}`));
  }

  return {
    answer: lines.join('\n'),
    metadata: { table: 'campaigns', total: rows.length, active: active.length },
  };
}

async function queryLeads(leadStatus?: string | null, interestLevel?: string | null): Promise<DbQueryResult> {
  const client = getSupabaseClient();
  let q = client
    .from('leads')
    .select('full_name, status, interest_level, phone')
    .order('interest_level');

  if (leadStatus) q = q.eq('status', leadStatus);
  if (interestLevel) q = q.eq('interest_level', interestLevel);

  const { data, error } = await q;
  if (error) throw new Error(`Error consultando prospectos: ${error.message}`);

  const rows = (data ?? []) as LeadRow[];
  if (rows.length === 0) {
    return {
      answer: 'No se encontraron prospectos con los criterios indicados.',
      metadata: { table: 'leads', total: 0 },
    };
  }

  const lines: string[] = [`Se encontraron ${rows.length} prospecto(s).`];
  rows.slice(0, 10).forEach(l =>
    lines.push(`- ${l.full_name} | Estado: ${l.status} | Interés: ${l.interest_level}`)
  );
  if (rows.length > 10) lines.push(`... y ${rows.length - 10} más.`);

  return {
    answer: lines.join('\n'),
    metadata: { table: 'leads', total: rows.length },
  };
}

async function queryAgents(agentName?: string | null): Promise<DbQueryResult> {
  const client = getSupabaseClient();
  let q = client
    .from('agents')
    .select('full_name, status, email')
    .order('full_name');

  if (agentName) q = q.ilike('full_name', `%${agentName}%`);

  const { data, error } = await q;
  if (error) throw new Error(`Error consultando agentes: ${error.message}`);

  const rows = (data ?? []) as AgentRow[];
  if (rows.length === 0) {
    return {
      answer: 'No se encontraron agentes con los criterios indicados.',
      metadata: { table: 'agents', total: 0 },
    };
  }

  const active = rows.filter(a => a.status === 'active');
  const lines: string[] = [`Se encontraron ${rows.length} agente(s).`];
  if (active.length > 0) {
    lines.push(`\nAgentes activos (${active.length}):`);
    active.forEach(a => lines.push(`- ${a.full_name} (${a.email})`));
  }
  const inactive = rows.filter(a => a.status !== 'active');
  if (inactive.length > 0) {
    lines.push(`\nAgentes inactivos/con permiso (${inactive.length}):`);
    inactive.forEach(a => lines.push(`- ${a.full_name} | Estado: ${a.status}`));
  }

  return {
    answer: lines.join('\n'),
    metadata: { table: 'agents', total: rows.length, active: active.length },
  };
}

async function queryCalls(agentName?: string | null, callResult?: string | null): Promise<DbQueryResult> {
  const client = getSupabaseClient();

  // Si se filtra por nombre de agente, se hace join con agents.
  let q = agentName
    ? client
        .from('calls')
        .select('result, duration_seconds, call_date, agents!inner(full_name)')
        .ilike('agents.full_name', `%${agentName}%`)
        .order('call_date', { ascending: false })
    : client
        .from('calls')
        .select('result, duration_seconds, call_date')
        .order('call_date', { ascending: false });

  if (callResult) q = q.eq('result', callResult);

  const { data, error } = await q;
  if (error) throw new Error(`Error consultando llamadas: ${error.message}`);

  const rows = (data ?? []) as CallRow[];
  if (rows.length === 0) {
    return {
      answer: 'No se encontraron llamadas con los criterios indicados.',
      metadata: { table: 'calls', total: 0 },
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
    `Se registraron ${rows.length} llamada(s). Duración promedio: ${avgSeconds} segundos.`,
    '\nResultados:',
  ];
  Object.entries(byResult).forEach(([r, count]) => lines.push(`- ${r}: ${count}`));

  return {
    answer: lines.join('\n'),
    metadata: { table: 'calls', total: rows.length, avgDurationSeconds: avgSeconds },
  };
}

/**
 * Busca información estructurada en Supabase usando la clasificación de intención.
 * La tabla y los filtros se derivan de `classification.entities`, no de SQL libre generado por el modelo.
 */
export async function searchDatabase(classification: IntentClassification): Promise<QueryResult> {
  const { entities } = classification;
  let result: DbQueryResult;

  switch (entities.table) {
    case 'campaigns':
      result = await queryCampaigns(entities.campaignStatus);
      break;
    case 'leads':
      result = await queryLeads(entities.leadStatus, entities.interestLevel);
      break;
    case 'agents':
      result = await queryAgents(entities.agentName);
      break;
    case 'calls':
      result = await queryCalls(entities.agentName, entities.leadStatus);
      break;
    default:
      result = {
        answer: 'Puede consultar información sobre campañas, prospectos (leads), agentes y llamadas del call center.',
        metadata: { table: null },
      };
  }

  return {
    answer: result.answer,
    source: 'database',
    metadata: result.metadata,
  };
}
