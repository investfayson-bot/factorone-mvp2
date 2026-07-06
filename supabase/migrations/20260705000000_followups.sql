-- Pós-venda / Follow-up: cada linha é um "toque" agendado com um cliente
-- (satisfação, garantia, recompra…). Acesso só via service role (rota /api/posvenda).
create table if not exists public.followups (
  id uuid primary key,
  empresa_id uuid not null,
  cliente text not null default '',
  contato text default '',
  canal text default 'whatsapp',
  tipo text default 'satisfacao',
  mensagem text default '',
  status text default 'pendente',
  valor numeric default 0,
  agendado_para date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists followups_empresa_idx on public.followups (empresa_id, agendado_para);
alter table public.followups enable row level security;
-- Sem policy de propósito: acesso só via service role (a rota de API).
