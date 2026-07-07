-- Multi-empresa: um login pode acessar várias empresas (PJs), trocando o
-- contexto ativo. `usuarios.empresa_id` passa a significar "empresa ativa
-- agora"; `usuario_empresas` guarda a lista de empresas que o login pode
-- acessar (dona ou convidada). Nenhuma outra tabela/RLS do sistema muda —
-- todas já confiam em usuarios.empresa_id, então trocar esse valor já
-- propaga pra tudo.

create table if not exists public.usuario_empresas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  papel text not null default 'admin',
  created_at timestamptz default now(),
  unique (user_id, empresa_id)
);
create index if not exists usuario_empresas_user_idx on public.usuario_empresas (user_id);
alter table public.usuario_empresas enable row level security;
drop policy if exists "own usuario_empresas select" on public.usuario_empresas;
create policy "own usuario_empresas select" on public.usuario_empresas
  for select using (user_id = auth.uid());
-- Sem policy de insert/update/delete pro client: toda escrita passa por
-- rota server-side (service role), validada nas rotas /api/empresas*.

-- Backfill: todo login existente já é "dono" da própria empresa atual.
insert into public.usuario_empresas (user_id, empresa_id, papel)
select u.id, u.empresa_id, coalesce(u.papel, 'admin')
from public.usuarios u
where u.empresa_id is not null
on conflict (user_id, empresa_id) do nothing;

-- Fecha um gap de segurança pré-existente: a policy "usuarios_self" permitia
-- trocar o próprio empresa_id pra qualquer UUID direto pelo client. A partir
-- de agora, só rotas server-side (service role) podem mudar esse campo.
revoke update (empresa_id) on public.usuarios from authenticated;

-- Todo cadastro novo já entra com a própria empresa na lista de acesso.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_nome text;
BEGIN
  v_nome := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.empresas (nome, user_id)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'company_name', v_nome),
    NEW.id
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_empresa_id;

  IF v_empresa_id IS NULL THEN
    SELECT id INTO v_empresa_id FROM public.empresas WHERE user_id = NEW.id LIMIT 1;
  END IF;

  IF v_empresa_id IS NOT NULL THEN
    INSERT INTO public.usuarios (id, empresa_id, nome, email, papel)
    VALUES (NEW.id, v_empresa_id, v_nome, NEW.email, 'admin')
    ON CONFLICT (id) DO UPDATE
      SET empresa_id = COALESCE(public.usuarios.empresa_id, EXCLUDED.empresa_id),
          nome = COALESCE(public.usuarios.nome, EXCLUDED.nome),
          email = COALESCE(public.usuarios.email, EXCLUDED.email);

    INSERT INTO public.usuario_empresas (user_id, empresa_id, papel)
    VALUES (NEW.id, v_empresa_id, 'admin')
    ON CONFLICT (user_id, empresa_id) DO NOTHING;

    INSERT INTO public.categorias_despesa (empresa_id, nome)
    VALUES
      (v_empresa_id, 'Alimentação'),
      (v_empresa_id, 'Transporte'),
      (v_empresa_id, 'Hospedagem'),
      (v_empresa_id, 'Tecnologia/Software'),
      (v_empresa_id, 'Marketing'),
      (v_empresa_id, 'Fornecedores'),
      (v_empresa_id, 'Folha de Pagamento'),
      (v_empresa_id, 'Impostos/Taxas'),
      (v_empresa_id, 'Aluguel/Infraestrutura'),
      (v_empresa_id, 'Consultoria'),
      (v_empresa_id, 'Material de Escritório'),
      (v_empresa_id, 'Outros')
    ON CONFLICT (empresa_id, nome) DO NOTHING;

    PERFORM public.seed_plano_contas(v_empresa_id);
  END IF;

  RETURN NEW;
END;
$$;
