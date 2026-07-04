-- Agendamento público (tipo Calendly). O dono define disponibilidade + um token;
-- o cliente abre /agendar/<token>, escolhe horário e marca. A reunião entra como
-- crm_atividades e o cliente vira marketing_leads (funil). Só service role acessa.
create table if not exists public.agenda_config (
  empresa_id uuid primary key,
  token text unique not null,
  titulo text default 'Reunião',
  duracao int default 30,
  hora_inicio text default '09:00',
  hora_fim text default '18:00',
  dias jsonb default '[1,2,3,4,5]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.agenda_config enable row level security;
-- sem policy: acesso só via service role (rotas de API)
