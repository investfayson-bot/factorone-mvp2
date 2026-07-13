-- Departamentos + AI por setor

create table if not exists public.departamentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  descricao text,
  chefe_id uuid references auth.users(id) on delete set null,
  ativo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(empresa_id, nome)
);

create table if not exists public.departamento_membros (
  id uuid primary key default gen_random_uuid(),
  departamento_id uuid not null references public.departamentos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text default 'membro', -- 'chefe' ou 'membro'
  created_at timestamptz default now(),
  unique(departamento_id, user_id)
);

alter table public.departamentos enable row level security;
alter table public.departamento_membros enable row level security;

create policy "empresa_ver_departamentos" on public.departamentos
  for select using (
    empresa_id in (
      select empresa_id from public.usuario_empresas where user_id = auth.uid()
    )
  );

create policy "empresa_gerenciar_departamentos" on public.departamentos
  for all using (
    empresa_id in (
      select empresa_id from public.usuario_empresas
      where user_id = auth.uid() and papel = 'admin'
    )
  );

create policy "ver_membros" on public.departamento_membros
  for select using (
    departamento_id in (
      select id from public.departamentos
      where empresa_id in (
        select empresa_id from public.usuario_empresas where user_id = auth.uid()
      )
    )
  );
