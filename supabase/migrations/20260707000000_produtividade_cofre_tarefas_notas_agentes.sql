-- Produtividade & infra: cofre pessoal, cofre de chaves de API, projetos,
-- tarefas (Scale), anotações + fluxogramas, log de ações dos agentes.
-- empresa_id é uuid livre (pode ser id de empresas OU o próprio user.id, por causa
-- do split de id-space do projeto). RLS cobre os dois casos.

-- ── Projetos (unidade de negócio / marca — ex: "OLI") ──────────────────────
create table if not exists public.projetos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  nome text not null,
  cor text default '#3D7A6E',
  descricao text,
  created_at timestamptz default now()
);
create index if not exists projetos_empresa_idx on public.projetos (empresa_id);
alter table public.projetos enable row level security;
drop policy if exists "own projetos" on public.projetos;
create policy "own projetos" on public.projetos for all
  using (empresa_id in (select empresa_id from public.usuarios where id = auth.uid()) or empresa_id = auth.uid())
  with check (empresa_id in (select empresa_id from public.usuarios where id = auth.uid()) or empresa_id = auth.uid());

-- Permite classificar uma transação dentro de um projeto (ex: quanto a OLI vendeu).
-- `transacoes` é uma view sobre `transactions` — a coluna entra na tabela base
-- e a view é recriada para expor o campo (view simples de 1 tabela = updatable).
alter table public.transactions add column if not exists projeto_id uuid references public.projetos(id) on delete set null;
create index if not exists transactions_projeto_idx on public.transactions (projeto_id);

create or replace view public.transacoes as
  select id, empresa_id, data, descricao, categoria, tipo, valor, status, created_at, due_date, competencia, banco, projeto_id
  from public.transactions;

-- ── Cofre pessoal (senhas/códigos, criptografados AES-256-GCM) ─────────────
create table if not exists public.cofre_pessoal (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  user_id uuid references auth.users(id) on delete cascade,
  rotulo text not null,
  valor_cifrado text not null,
  nota text,
  created_at timestamptz default now()
);
create index if not exists cofre_pessoal_empresa_idx on public.cofre_pessoal (empresa_id);
alter table public.cofre_pessoal enable row level security;
drop policy if exists "own cofre_pessoal" on public.cofre_pessoal;
create policy "own cofre_pessoal" on public.cofre_pessoal for all
  using (empresa_id in (select empresa_id from public.usuarios where id = auth.uid()) or empresa_id = auth.uid())
  with check (empresa_id in (select empresa_id from public.usuarios where id = auth.uid()) or empresa_id = auth.uid());

-- ── Cofre de chaves de API (bring-your-own key por integração) ─────────────
create table if not exists public.cofre_api_keys (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  provider text not null,
  valor_cifrado text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (empresa_id, provider)
);
create index if not exists cofre_api_keys_empresa_idx on public.cofre_api_keys (empresa_id);
alter table public.cofre_api_keys enable row level security;
drop policy if exists "own cofre_api_keys" on public.cofre_api_keys;
create policy "own cofre_api_keys" on public.cofre_api_keys for all
  using (empresa_id in (select empresa_id from public.usuarios where id = auth.uid()) or empresa_id = auth.uid())
  with check (empresa_id in (select empresa_id from public.usuarios where id = auth.uid()) or empresa_id = auth.uid());

-- ── Tarefas (Scale) ─────────────────────────────────────────────────────────
create table if not exists public.tarefas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  projeto_id uuid references public.projetos(id) on delete set null,
  parent_id uuid references public.tarefas(id) on delete cascade,
  titulo text not null,
  responsavel text,
  prioridade text default 'media' check (prioridade in ('baixa','media','alta','urgente')),
  prazo date,
  status text default 'a_fazer' check (status in ('a_fazer','fazendo','rascunho','feito')),
  ordem integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists tarefas_empresa_idx on public.tarefas (empresa_id);
create index if not exists tarefas_parent_idx on public.tarefas (parent_id);
alter table public.tarefas enable row level security;
drop policy if exists "own tarefas" on public.tarefas;
create policy "own tarefas" on public.tarefas for all
  using (empresa_id in (select empresa_id from public.usuarios where id = auth.uid()) or empresa_id = auth.uid())
  with check (empresa_id in (select empresa_id from public.usuarios where id = auth.uid()) or empresa_id = auth.uid());

-- ── Anotações (bloco de notas) ──────────────────────────────────────────────
create table if not exists public.anotacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  titulo text,
  conteudo text,
  cor text default '#F5EFD8',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists anotacoes_empresa_idx on public.anotacoes (empresa_id);
alter table public.anotacoes enable row level security;
drop policy if exists "own anotacoes" on public.anotacoes;
create policy "own anotacoes" on public.anotacoes for all
  using (empresa_id in (select empresa_id from public.usuarios where id = auth.uid()) or empresa_id = auth.uid())
  with check (empresa_id in (select empresa_id from public.usuarios where id = auth.uid()) or empresa_id = auth.uid());

-- ── Fluxogramas (canvas visual: nós + conexões em jsonb) ────────────────────
create table if not exists public.fluxogramas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  nome text default 'Fluxo',
  dados jsonb not null default '{"nodes":[],"edges":[]}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists fluxogramas_empresa_idx on public.fluxogramas (empresa_id);
alter table public.fluxogramas enable row level security;
drop policy if exists "own fluxogramas" on public.fluxogramas;
create policy "own fluxogramas" on public.fluxogramas for all
  using (empresa_id in (select empresa_id from public.usuarios where id = auth.uid()) or empresa_id = auth.uid())
  with check (empresa_id in (select empresa_id from public.usuarios where id = auth.uid()) or empresa_id = auth.uid());

-- ── Log de ações autônomas dos agentes (Donna, Louis, ...) ──────────────────
create table if not exists public.agentes_acoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  agente_id text not null,
  agente_nome text not null,
  acao text not null,
  detalhe text,
  custo_usd numeric(12,8) default 0,
  created_at timestamptz default now()
);
create index if not exists agentes_acoes_empresa_idx on public.agentes_acoes (empresa_id, created_at desc);
alter table public.agentes_acoes enable row level security;
drop policy if exists "own agentes_acoes" on public.agentes_acoes;
create policy "own agentes_acoes" on public.agentes_acoes for all
  using (empresa_id in (select empresa_id from public.usuarios where id = auth.uid()) or empresa_id = auth.uid())
  with check (empresa_id in (select empresa_id from public.usuarios where id = auth.uid()) or empresa_id = auth.uid());
