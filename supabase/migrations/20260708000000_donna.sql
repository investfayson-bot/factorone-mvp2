-- Donna autônoma: motor de regras de autonomia + agente de e-mail (Gmail) +
-- atendimento (widget do site). empresa_id segue o padrão livre do projeto
-- (pode ser id de empresas OU o próprio user.id).

-- ── Regras de autonomia (canal + palavra-chave → automático | rascunho) ─────
create table if not exists public.donna_regras (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  nome text,
  canal text not null check (canal in ('email', 'site', 'telegram')),
  criterio text not null,
  autonomia text not null default 'rascunho' check (autonomia in ('rascunho', 'automatico')),
  ativa boolean default true,
  created_at timestamptz default now()
);
create index if not exists donna_regras_empresa_idx on public.donna_regras (empresa_id);
alter table public.donna_regras enable row level security;
drop policy if exists "own donna_regras" on public.donna_regras;
create policy "own donna_regras" on public.donna_regras for all
  using (empresa_id in (select empresa_id from public.usuarios where id = auth.uid()) or empresa_id = auth.uid())
  with check (empresa_id in (select empresa_id from public.usuarios where id = auth.uid()) or empresa_id = auth.uid());

-- ── Conta Google conectada (1 por empresa) ──────────────────────────────────
create table if not exists public.google_contas (
  empresa_id uuid primary key,
  email text not null,
  refresh_token_cifrado text not null,
  escopos text,
  conectado_em timestamptz default now(),
  ultima_sincronizacao timestamptz,
  ativo boolean default true
);
alter table public.google_contas enable row level security;
drop policy if exists "own google_contas" on public.google_contas;
create policy "own google_contas" on public.google_contas for all
  using (empresa_id in (select empresa_id from public.usuarios where id = auth.uid()) or empresa_id = auth.uid())
  with check (empresa_id in (select empresa_id from public.usuarios where id = auth.uid()) or empresa_id = auth.uid());

-- ── E-mails processados pela Donna (dedupe + fila de aprovação) ────────────
create table if not exists public.donna_emails_processados (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  gmail_message_id text not null,
  gmail_thread_id text,
  remetente text,
  assunto text,
  snippet text,
  regra_id uuid references public.donna_regras(id) on delete set null,
  autonomia_aplicada text check (autonomia_aplicada in ('rascunho', 'automatico')),
  acao text check (acao in ('respondido', 'rascunho_criado', 'arquivado', 'ignorado')),
  corpo_resposta text,
  status text not null default 'concluido' check (status in ('concluido', 'pendente_aprovacao', 'aprovado', 'descartado')),
  created_at timestamptz default now(),
  unique (empresa_id, gmail_message_id)
);
create index if not exists donna_emails_empresa_status_idx on public.donna_emails_processados (empresa_id, status);
alter table public.donna_emails_processados enable row level security;
drop policy if exists "own donna_emails_processados" on public.donna_emails_processados;
create policy "own donna_emails_processados" on public.donna_emails_processados for all
  using (empresa_id in (select empresa_id from public.usuarios where id = auth.uid()) or empresa_id = auth.uid())
  with check (empresa_id in (select empresa_id from public.usuarios where id = auth.uid()) or empresa_id = auth.uid());

-- ── Atendimento (widget de chat no site público) ────────────────────────────
create table if not exists public.atendimento_conversas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  visitante_nome text,
  visitante_email text,
  status text not null default 'aberta' check (status in ('aberta', 'aguardando_humano', 'encerrada')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists atendimento_conversas_empresa_idx on public.atendimento_conversas (empresa_id, status);
alter table public.atendimento_conversas enable row level security;
drop policy if exists "own atendimento_conversas" on public.atendimento_conversas;
create policy "own atendimento_conversas" on public.atendimento_conversas for all
  using (empresa_id in (select empresa_id from public.usuarios where id = auth.uid()) or empresa_id = auth.uid())
  with check (empresa_id in (select empresa_id from public.usuarios where id = auth.uid()) or empresa_id = auth.uid());
-- escrita do visitante anônimo passa pela rota pública com client service role
-- (mesmo padrão de agenda_config/sites/produtos) — sem policy de anon aqui.

create table if not exists public.atendimento_mensagens (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.atendimento_conversas(id) on delete cascade,
  empresa_id uuid not null,
  autor text not null check (autor in ('visitante', 'donna', 'humano')),
  texto text not null,
  pendente_aprovacao boolean default false,
  created_at timestamptz default now()
);
create index if not exists atendimento_mensagens_conversa_idx on public.atendimento_mensagens (conversa_id, created_at);
alter table public.atendimento_mensagens enable row level security;
drop policy if exists "own atendimento_mensagens" on public.atendimento_mensagens;
create policy "own atendimento_mensagens" on public.atendimento_mensagens for all
  using (empresa_id in (select empresa_id from public.usuarios where id = auth.uid()) or empresa_id = auth.uid())
  with check (empresa_id in (select empresa_id from public.usuarios where id = auth.uid()) or empresa_id = auth.uid());
