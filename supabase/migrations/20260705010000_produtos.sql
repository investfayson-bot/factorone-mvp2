-- Produtos: custo de matéria-prima + preço → margem por venda ("quanto sobra").
-- Registrar venda gera receita + CMV em transacoes, alimentando o DRE.
-- Acesso só via service role (rota /api/produtos).
create table if not exists public.produtos (
  id uuid primary key,
  empresa_id uuid not null,
  nome text not null default '',
  unidade text default 'un',
  custo numeric default 0,
  preco numeric default 0,
  vendidos integer default 0,
  ativo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists produtos_empresa_idx on public.produtos (empresa_id);
alter table public.produtos enable row level security;
-- Sem policy de propósito: acesso só via service role (a rota de API).
