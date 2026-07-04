-- Sites/landing pages gerados pelo FactorOne. Hospedados por nós em /site/<slug>.
-- Um site por empresa (v1). O formulário do site captura lead (funil).
create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null unique,
  slug text unique not null,
  nome text,
  slogan text,
  ramo text,
  template text default 'moderno',
  cor text default '#3D7A6E',
  sobre text,
  servicos jsonb default '[]'::jsonb,
  whatsapp text,
  email text,
  telefone text,
  publicado boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists sites_slug_idx on public.sites (slug);
alter table public.sites enable row level security;
-- leitura pública é via API service role; escrita idem (rotas). Sem policy p/ anon.
