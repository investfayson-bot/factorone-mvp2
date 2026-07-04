-- Sócios e suas cotas (%). Base da distribuição de receitas/lucro por sócio.
create table if not exists public.socios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  nome text,
  cota numeric(6,2) default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists socios_empresa_idx on public.socios (empresa_id);
alter table public.socios enable row level security;
drop policy if exists "own socios" on public.socios;
create policy "own socios" on public.socios for all
  using (empresa_id in (select empresa_id from public.usuarios where id = auth.uid()) or empresa_id = auth.uid())
  with check (empresa_id in (select empresa_id from public.usuarios where id = auth.uid()) or empresa_id = auth.uid());
