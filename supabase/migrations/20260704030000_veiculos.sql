-- Veículos (cadastro e gestão) — parte do Patrimônio. Despesas (IPVA/seguro/
-- manutenção) lançam saída no fluxo. Alertas de vencimento de IPVA/seguro.
create table if not exists public.veiculos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  placa text, modelo text, marca text, ano text, renavam text, cor text,
  km numeric(12,0) default 0,
  valor numeric(15,2) default 0,
  ipva numeric(15,2) default 0, ipva_venc date,
  seguro numeric(15,2) default 0, seguro_venc date,
  status text default 'ativo',
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists veiculos_empresa_idx on public.veiculos (empresa_id);
alter table public.veiculos enable row level security;
drop policy if exists "own veiculos" on public.veiculos;
create policy "own veiculos" on public.veiculos for all
  using (empresa_id in (select empresa_id from public.usuarios where id = auth.uid()) or empresa_id = auth.uid())
  with check (empresa_id in (select empresa_id from public.usuarios where id = auth.uid()) or empresa_id = auth.uid());
