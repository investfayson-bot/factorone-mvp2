-- Fix: Garantir que o dono (empresas.user_id) sempre tem papel='admin' na própria empresa
-- Problema: contas legado (demo, invest.fayson@gmail.com) foram criadas antes da trigger
-- handle_new_user existir, ou tiveram usuario_empresas mexida manualmente.

-- 1. Backfill: dono sem linha de admin na própria empresa (criar registro)
INSERT INTO public.usuario_empresas (user_id, empresa_id, papel)
SELECT e.user_id, e.id, 'admin'
FROM public.empresas e
WHERE e.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.usuario_empresas ue
    WHERE ue.user_id = e.user_id AND ue.empresa_id = e.id
  )
ON CONFLICT (user_id, empresa_id) DO NOTHING;

-- 2. Correção: dono com papel errado na própria empresa (atualizar para admin)
UPDATE public.usuario_empresas ue
SET papel = 'admin'
FROM public.empresas e
WHERE ue.empresa_id = e.id
  AND ue.user_id = e.user_id
  AND ue.papel <> 'admin';

-- 3. Adicionar coluna de plano com default 'trial' (para teste grátis 30 dias)
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS plano TEXT NOT NULL DEFAULT 'trial';

-- 4. Adicionar data de expiração do trial
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS trial_expira_em TIMESTAMPTZ;

-- 5. Backfill: gravar trial_expira_em = created_at + 30 dias para empresas sem data
UPDATE public.empresas
SET trial_expira_em = created_at + INTERVAL '30 days'
WHERE plano = 'trial' AND trial_expira_em IS NULL;

-- 6. Atualizar a trigger handle_new_user para gravar trial_expira_em em novas empresas
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

  INSERT INTO public.empresas (nome, user_id, plano, trial_expira_em)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'company_name', v_nome),
    NEW.id,
    'trial',
    NOW() + INTERVAL '30 days'
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
