-- Notificações inteligentes por departamento

create table if not exists public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null, -- 'critico', 'importante', 'informativo', 'departamento'
  titulo text not null,
  descricao text,
  departamento_id uuid references public.departamentos(id) on delete set null,
  lida boolean default false,
  lida_em timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.notificacoes enable row level security;

create policy "usuario_ve_suas_notificacoes" on public.notificacoes
  for select using (
    user_id = auth.uid() and empresa_id in (
      select empresa_id from public.usuario_empresas where user_id = auth.uid()
    )
  );

create policy "admin_marca_como_lida" on public.notificacoes
  for update
  using (
    user_id = auth.uid() and empresa_id in (
      select empresa_id from public.usuario_empresas
      where user_id = auth.uid()
    )
  );

create index idx_notif_user_lida on public.notificacoes(user_id, lida, created_at desc);
create index idx_notif_empresa_tipo on public.notificacoes(empresa_id, tipo, created_at desc);
