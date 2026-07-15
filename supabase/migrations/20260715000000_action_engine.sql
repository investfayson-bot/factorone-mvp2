-- Action Engine v1 — spec em docs/superpowers/specs/2026-07-15-action-engine-design.md
-- Duas tabelas: `events` (fato imutável, o que aconteceu) e `work_items`
-- (fila de atenção, criada pelo Action Engine — nunca publicada direto por
-- um módulo). Um work_item pode nascer já "resolvido" (IA decidiu sozinha)
-- só pra manter o histórico auditável — nunca é descartado silenciosamente.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  tipo text not null check (tipo in ('transaction_received','document_uploaded','tax_due')),
  payload jsonb not null,
  publicado_por text not null,
  created_at timestamptz not null default now()
);
create index if not exists events_empresa_idx on public.events(empresa_id);
create index if not exists events_tipo_idx on public.events(tipo);

create table if not exists public.work_items (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  tipo text not null check (tipo in ('transaction_received','document_uploaded','tax_due')),
  origem text not null check (origem in ('open_finance','documento','obrigacao_fiscal')),
  -- 'tabela:id' da linha que originou (ex.: 'cofre_fiscal_documentos:<uuid>') — dedup e link de volta.
  origem_ref text not null,
  responsavel_papel text not null check (responsavel_papel in ('financeiro','contador','dono')),
  status text not null default 'aberto' check (status in ('aberto','em_analise','resolvido','ignorado')),
  prazo date,
  impacto_valor numeric,
  score numeric not null default 0,
  sugestao_ia jsonb,
  historico jsonb not null default '[]'::jsonb,
  arquivo_path text,
  chat_thread_id uuid,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
-- Nunca dois work_items ABERTOS pra mesma origem (evita duplicar se o
-- publicador rodar de novo antes do primeiro ser resolvido). Resolvidos não
-- entram nessa restrição — histórico pode ter várias linhas resolvidas.
create unique index if not exists work_items_origem_aberto_idx
  on public.work_items(origem_ref) where status in ('aberto','em_analise');
create index if not exists work_items_empresa_score_idx
  on public.work_items(empresa_id, score desc) where status in ('aberto','em_analise');

alter table public.events enable row level security;
drop policy if exists "events select by empresa" on public.events;
create policy "events select by empresa" on public.events
  for select using (empresa_id in (select empresa_id from public.usuario_empresas where user_id = auth.uid()));

alter table public.work_items enable row level security;
drop policy if exists "work_items select by empresa" on public.work_items;
create policy "work_items select by empresa" on public.work_items
  for select using (empresa_id in (select empresa_id from public.usuario_empresas where user_id = auth.uid()));
-- Sem policy de insert/update/delete pro client: toda escrita passa por
-- rota server-side (service role), mesmo padrão de usuario_empresas.

-- Fix: linhas novas de extrato_bancario nasciam com status_classificacao
-- 'confirmada' por default (nunca precisavam de revisão), porque só quem
-- setava esse campo explicitamente era o motor lazy da tela Extrato. Com o
-- Action Engine classificando na ingestão (Task 5), o default correto pra
-- uma linha nova é "ainda não foi vista" — 'sugerida'.
alter table public.extrato_bancario
  alter column status_classificacao set default 'sugerida';
