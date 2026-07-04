-- Patrimônio: imóveis (carteira por empreendimento) + obras (orçamento × pago × desvio).
-- empresa_id é uuid livre (pode ser id de empresas OU o próprio user.id, por causa
-- do split de id-space do projeto). RLS cobre os dois casos.

create table if not exists public.imoveis (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  empreendimento text,
  unidade text,
  tipo text,
  finalidade text,
  endereco text,
  cidade text,
  area numeric(12,2) default 0,
  aluguel numeric(15,2) default 0,
  iptu numeric(15,2) default 0,
  condominio numeric(15,2) default 0,
  locatario text,
  ocupada boolean default true,
  vgv numeric(15,2) default 0,
  reajustes jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists imoveis_empresa_idx on public.imoveis (empresa_id);
alter table public.imoveis enable row level security;
drop policy if exists "own imoveis" on public.imoveis;
create policy "own imoveis" on public.imoveis for all
  using (empresa_id in (select empresa_id from public.usuarios where id = auth.uid()) or empresa_id = auth.uid())
  with check (empresa_id in (select empresa_id from public.usuarios where id = auth.uid()) or empresa_id = auth.uid());

create table if not exists public.obras (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  nome text,
  local text,
  responsavel text,
  inicio date,
  previsao date,
  orcamento numeric(15,2) default 0,
  status text default 'andamento',
  pagamentos jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists obras_empresa_idx on public.obras (empresa_id);
alter table public.obras enable row level security;
drop policy if exists "own obras" on public.obras;
create policy "own obras" on public.obras for all
  using (empresa_id in (select empresa_id from public.usuarios where id = auth.uid()) or empresa_id = auth.uid())
  with check (empresa_id in (select empresa_id from public.usuarios where id = auth.uid()) or empresa_id = auth.uid());
