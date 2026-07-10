-- FactorOne MVP — Schema Supabase
-- Cole no SQL Editor e clique Run

create extension if not exists "uuid-ossp";

-- Drop tudo se existir e recriar limpo
drop table if exists aicfo_historico cascade;
drop table if exists cashflow cascade;
drop table if exists invoices cascade;
drop table if exists despesas cascade;
drop table if exists metricas cascade;
drop table if exists usuarios cascade;
drop table if exists empresas cascade;

-- EMPRESAS
create table empresas (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  cnpj text,
  setor text,
  plano text default 'trial',
  plano_ativo boolean default true,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz default now()
);

-- USUARIOS
create table usuarios (
  id uuid primary key references auth.users on delete cascade,
  empresa_id uuid references empresas(id) on delete cascade,
  nome text,
  email text,
  papel text default 'admin',
  created_at timestamptz default now()
);

-- METRICAS
create table metricas (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid references empresas(id) on delete cascade unique,
  saldo numeric default 0,
  mrr numeric default 0,
  burn_rate numeric default 0,
  runway numeric default 0,
  receita_mes numeric default 0,
  despesas_mes numeric default 0,
  lucro_mes numeric default 0,
  a_receber numeric default 0,
  a_pagar numeric default 0,
  updated_at timestamptz default now()
);

-- DESPESAS
create table despesas (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid references empresas(id) on delete cascade,
  descricao text not null,
  valor numeric not null,
  categoria text default 'outros',
  data date default current_date,
  status text default 'pago',
  comprovante_url text,
  created_by uuid,
  created_at timestamptz default now()
);

-- INVOICES
create table invoices (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid references empresas(id) on delete cascade,
  numero text,
  cliente_nome text not null,
  valor numeric not null,
  vencimento date,
  status text default 'rascunho',
  descricao text,
  created_at timestamptz default now()
);

-- CASHFLOW
create table cashflow (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid references empresas(id) on delete cascade,
  mes text not null,
  entradas numeric default 0,
  saidas numeric default 0,
  projetado boolean default false,
  created_at timestamptz default now()
);

-- AI CFO HISTORICO
create table aicfo_historico (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid references empresas(id) on delete cascade,
  role text,
  conteudo text not null,
  created_at timestamptz default now()
);

-- RLS
alter table empresas enable row level security;
alter table usuarios enable row level security;
alter table metricas enable row level security;
alter table despesas enable row level security;
alter table invoices enable row level security;
alter table cashflow enable row level security;
alter table aicfo_historico enable row level security;

-- Policies
create policy "usuarios_self" on usuarios for all using (id = auth.uid());
create policy "empresa_by_user" on empresas for all using (id in (select empresa_id from usuarios where id = auth.uid()));
create policy "metricas_by_user" on metricas for all using (empresa_id in (select empresa_id from usuarios where id = auth.uid()));
create policy "despesas_by_user" on despesas for all using (empresa_id in (select empresa_id from usuarios where id = auth.uid()));
create policy "invoices_by_user" on invoices for all using (empresa_id in (select empresa_id from usuarios where id = auth.uid()));
create policy "cashflow_by_user" on cashflow for all using (empresa_id in (select empresa_id from usuarios where id = auth.uid()));
create policy "aicfo_by_user" on aicfo_historico for all using (empresa_id in (select empresa_id from usuarios where id = auth.uid()));

-- Storage
insert into storage.buckets (id, name, public) values ('comprovantes', 'comprovantes', false) on conflict do nothing;

drop policy if exists "upload_comp" on storage.objects;
drop policy if exists "ver_comp" on storage.objects;
create policy "upload_comp" on storage.objects for insert with check (bucket_id = 'comprovantes' and auth.role() = 'authenticated');
create policy "ver_comp" on storage.objects for select using (bucket_id = 'comprovantes' and auth.role() = 'authenticated');
