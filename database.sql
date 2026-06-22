-- ============================================================
-- Base de datos: Sistema de call center de ventas
-- Ejecutar este script en Supabase SQL Editor
-- ============================================================

-- Habilitar extensión de vectores
create extension if not exists vector;

-- ============================================================
-- Tablas relacionales
-- ============================================================

-- Agentes del call center
create table if not exists agents (
  id         serial primary key,
  name       text not null,
  email      text not null unique,
  phone      text,
  hire_date  date not null,
  status     text not null default 'active' check (status in ('active', 'inactive', 'on_leave')),
  metadata   jsonb default '{}'::jsonb
);

create index if not exists idx_agents_status on agents (status);

-- Campañas de venta
create table if not exists campaigns (
  id                  serial primary key,
  name                text not null,
  product_name        text not null,
  status              text not null default 'active' check (status in ('active', 'paused', 'closed')),
  start_date          date not null,
  end_date            date,
  target_leads_count  integer not null default 0,
  metadata            jsonb default '{}'::jsonb
);

create index if not exists idx_campaigns_status on campaigns (status);

-- Prospectos asociados a campañas
create table if not exists leads (
  id               serial primary key,
  campaign_id      integer not null references campaigns (id) on delete cascade,
  first_name       text not null,
  last_name        text not null,
  email            text,
  phone            text,
  interest_level   text not null default 'medium' check (interest_level in ('low', 'medium', 'high')),
  status           text not null default 'new' check (status in ('new', 'contacted', 'follow_up', 'converted', 'rejected')),
  metadata         jsonb default '{}'::jsonb
);

create index if not exists idx_leads_interest_level on leads (interest_level);
create index if not exists idx_leads_status         on leads (status);
create index if not exists idx_leads_campaign_id    on leads (campaign_id);

-- Llamadas realizadas por agentes a prospectos
create table if not exists calls (
  id                serial primary key,
  agent_id          integer not null references agents (id) on delete cascade,
  lead_id           integer not null references leads (id) on delete cascade,
  called_at         timestamptz not null default now(),
  duration_seconds  integer not null default 0,
  result            text not null check (result in ('completed', 'scheduled_follow_up', 'no_answer', 'rejected', 'voicemail')),
  notes             text,
  metadata          jsonb default '{}'::jsonb
);

create index if not exists idx_calls_result   on calls (result);
create index if not exists idx_calls_agent_id on calls (agent_id);
create index if not exists idx_calls_lead_id  on calls (lead_id);

-- ============================================================
-- Tabla vectorial (compatible con SupabaseVectorStore)
-- ============================================================

create table if not exists documents (
  id        bigserial primary key,
  content   text not null,
  metadata  jsonb default '{}'::jsonb,
  embedding vector(768)
);

create index if not exists idx_documents_metadata on documents using gin (metadata);

-- ============================================================
-- Función de búsqueda semántica
-- ============================================================

create or replace function match_documents (
  query_embedding vector(768),
  match_count     int  default 5,
  filter          jsonb default '{}'
)
returns table (
  id         bigint,
  content    text,
  metadata   jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where documents.metadata @> filter
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- ============================================================
-- Datos de prueba — agentes
-- ============================================================

insert into agents (name, email, phone, hire_date, status, metadata) values
  ('Carlos López',    'carlos.lopez@callcenter.com',    '+502-5551-0001', '2022-03-15', 'active',   '{"region": "central", "especialidad": "seguros"}'),
  ('María García',    'maria.garcia@callcenter.com',    '+502-5551-0002', '2021-08-01', 'active',   '{"region": "norte",   "especialidad": "créditos"}'),
  ('Juan Rodríguez',  'juan.rodriguez@callcenter.com',  '+502-5551-0003', '2023-01-10', 'active',   '{"region": "sur",     "especialidad": "inversiones"}'),
  ('Ana Martínez',    'ana.martinez@callcenter.com',    '+502-5551-0004', '2020-06-20', 'inactive', '{"region": "central", "especialidad": "seguros"}');

-- ============================================================
-- Datos de prueba — campañas
-- ============================================================

insert into campaigns (name, product_name, status, start_date, end_date, target_leads_count, metadata) values
  ('Campaña Seguros Premium Q2',   'Seguro de Vida Premium',  'active', '2026-04-01', '2026-06-30', 200, '{"presupuesto": 50000, "canal": "telefónico"}'),
  ('Campaña Crédito Personal',     'Crédito Personal 12%',   'active', '2026-05-01', '2026-07-31', 150, '{"presupuesto": 30000, "canal": "telefónico"}'),
  ('Campaña Inversión Verano 2025','Fondo de Inversión',      'closed', '2025-06-01', '2025-08-31', 100, '{"presupuesto": 20000, "canal": "digital"}');

-- ============================================================
-- Datos de prueba — prospectos
-- ============================================================

insert into leads (campaign_id, first_name, last_name, email, phone, interest_level, status, metadata) values
  -- Campaña 1 (Seguros Premium)
  (1, 'Roberto',  'Fuentes',    'roberto.fuentes@email.com',  '+502-4001-0001', 'high',   'follow_up',  '{"ciudad": "Guatemala", "edad": 42}'),
  (1, 'Claudia',  'Méndez',     'claudia.mendez@email.com',   '+502-4001-0002', 'high',   'contacted',  '{"ciudad": "Mixco",     "edad": 35}'),
  (1, 'Fernando', 'Castro',     'fernando.castro@email.com',  '+502-4001-0003', 'medium', 'new',        '{"ciudad": "Villa Nueva","edad": 50}'),
  (1, 'Lucía',    'Pérez',      'lucia.perez@email.com',      '+502-4001-0004', 'high',   'follow_up',  '{"ciudad": "Guatemala", "edad": 29}'),
  -- Campaña 2 (Crédito Personal)
  (2, 'Mario',    'Hernández',  'mario.hernandez@email.com',  '+502-4002-0001', 'high',   'follow_up',  '{"ciudad": "Escuintla", "edad": 38}'),
  (2, 'Sandra',   'Velásquez',  'sandra.velasquez@email.com', '+502-4002-0002', 'medium', 'new',        '{"ciudad": "Quetzal",   "edad": 45}'),
  (2, 'Diego',    'Ramírez',    'diego.ramirez@email.com',    '+502-4002-0003', 'low',    'rejected',   '{"ciudad": "Guatemala", "edad": 60}'),
  (2, 'Patricia', 'Solano',     'patricia.solano@email.com',  '+502-4002-0004', 'medium', 'converted',  '{"ciudad": "Mixco",     "edad": 33}');

-- ============================================================
-- Datos de prueba — llamadas
-- ============================================================

insert into calls (agent_id, lead_id, called_at, duration_seconds, result, notes, metadata) values
  -- Carlos López
  (1, 1, '2026-05-10 09:00:00+00', 320, 'scheduled_follow_up', 'Prospecto interesado, solicita llamada la próxima semana.',            '{"intentos": 1}'),
  (1, 2, '2026-05-11 10:30:00+00', 180, 'completed',            'Se explicaron beneficios del seguro. Cliente considera la oferta.',    '{"intentos": 1}'),
  (1, 4, '2026-05-12 14:00:00+00', 410, 'scheduled_follow_up', 'Muy interesada, pide cotización formal para envío por correo.',        '{"intentos": 2}'),
  -- María García
  (2, 5, '2026-05-13 11:00:00+00', 295, 'scheduled_follow_up', 'Solicitó tiempo para revisar términos del crédito.',                  '{"intentos": 1}'),
  (2, 6, '2026-05-14 09:30:00+00',  90, 'no_answer',            'No contestó. Se dejó mensaje de voz.',                                '{"intentos": 1}'),
  (2, 7, '2026-05-15 15:00:00+00', 120, 'rejected',             'No está interesado en ningún producto crediticio.',                   '{"intentos": 1}'),
  -- Juan Rodríguez
  (3, 3, '2026-05-16 08:45:00+00', 210, 'completed',            'Presentación completa. Enviará documentos la próxima semana.',        '{"intentos": 1}'),
  (3, 8, '2026-05-17 13:15:00+00', 370, 'completed',            'Proceso de conversión iniciado. Firma de contrato pendiente.',        '{"intentos": 3}'),
  (3, 5, '2026-05-20 10:00:00+00', 260, 'scheduled_follow_up', 'Segunda llamada. Cliente pide más tiempo. Reagendado para el lunes.', '{"intentos": 2}');
