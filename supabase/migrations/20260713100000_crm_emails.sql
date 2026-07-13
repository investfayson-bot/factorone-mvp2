-- Armazenamento de emails pra processamento automático de leads

create table if not exists public.crm_emails (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  de text not null,
  nome_remetente text,
  assunto text not null,
  corpo text,
  processado boolean default false,
  oportunidade_id uuid references public.crm_oportunidades(id) on delete set null,
  processado_em timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.crm_emails enable row level security;

create policy "empresa_ve_emails" on public.crm_emails
  for select using (
    empresa_id in (
      select empresa_id from public.usuario_empresas where user_id = auth.uid()
    )
  );

create index idx_crm_emails_nao_processados on public.crm_emails(empresa_id, processado, created_at desc);
create index idx_crm_emails_de on public.crm_emails(empresa_id, de);
