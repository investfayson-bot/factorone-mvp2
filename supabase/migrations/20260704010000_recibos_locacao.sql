-- Recibos de locação (modelo do Excel): aluguel + juros/multa + água + outros
-- (bruto) − comissão − desconto = líquido. Marcar pago lança receita no fluxo.
create table if not exists public.recibos_locacao (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  numero text,
  locatario text,
  endereco text,
  periodo text,
  aluguel numeric(15,2) default 0,
  juros numeric(15,2) default 0,
  comissao numeric(15,2) default 0,
  agua numeric(15,2) default 0,
  outros numeric(15,2) default 0,
  desconto numeric(15,2) default 0,
  vencimento date,
  pagamento date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists recibos_empresa_idx on public.recibos_locacao (empresa_id);
alter table public.recibos_locacao enable row level security;
drop policy if exists "own recibos" on public.recibos_locacao;
create policy "own recibos" on public.recibos_locacao for all
  using (empresa_id in (select empresa_id from public.usuarios where id = auth.uid()) or empresa_id = auth.uid())
  with check (empresa_id in (select empresa_id from public.usuarios where id = auth.uid()) or empresa_id = auth.uid());
