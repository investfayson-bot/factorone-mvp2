-- Token por empresa para o webhook de captação (o "tradutor universal").
-- Ferramentas externas (Zapier/Make/RD/form) chamam /api/inbound?token=... e o
-- lead cai no modelo canônico (marketing_leads). Só o service role acessa a tabela.
create table if not exists public.inbound_tokens (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null unique,
  token text not null unique,
  created_at timestamptz default now()
);
alter table public.inbound_tokens enable row level security;
-- Sem policy de propósito: acesso só via service role (as rotas de API).
