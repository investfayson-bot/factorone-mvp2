-- Sprint 0 — Fixes críticos FactorOne
-- Aplicar no SQL Editor do Supabase

-- ============================================================
-- 1. Adicionar user_id à tabela empresas (coluna estava faltando)
-- ============================================================
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_empresas_user_id ON public.empresas(user_id);

-- Preencher user_id a partir da tabela usuarios (para empresas existentes)
UPDATE public.empresas e
SET user_id = u.id
FROM public.usuarios u
WHERE u.empresa_id = e.id
  AND e.user_id IS NULL;

-- ============================================================
-- 2. Corrigir FK de transactions: auth.users → empresas
-- ============================================================

-- 2a. Migrar dados existentes: se empresa_id = auth user id, corrigir para empresas.id
UPDATE public.transactions t
SET empresa_id = u.empresa_id
FROM public.usuarios u
WHERE t.empresa_id = u.id
  AND u.empresa_id IS NOT NULL;

-- 2b. Trocar FK da tabela transactions
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transacoes_empresa_id_fkey,
  DROP CONSTRAINT IF EXISTS transactions_empresa_id_fkey;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_empresa_id_fkey
  FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;

-- 2c. Atualizar RLS de transactions/transacoes
DROP POLICY IF EXISTS "user_own_data" ON public.transactions;
CREATE POLICY "empresa_own_transactions" ON public.transactions
  FOR ALL USING (
    empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
    OR empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
  );

-- ============================================================
-- 3. RLS de empresas: permitir owner via user_id
-- ============================================================
DROP POLICY IF EXISTS "empresa_by_user" ON public.empresas;
DROP POLICY IF EXISTS "empresa_usuario" ON public.empresas;

CREATE POLICY "empresa_acesso" ON public.empresas
  FOR ALL USING (
    id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
    OR user_id = auth.uid()
  );

-- ============================================================
-- 4. Trigger: auto-criar empresa + usuario ao cadastrar novo usuário
-- ============================================================
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

  -- Cria empresa se não existir para este user
  INSERT INTO public.empresas (nome, user_id)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'company_name', v_nome),
    NEW.id
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_empresa_id;

  -- Se empresa já existia (conflict), busca o id
  IF v_empresa_id IS NULL THEN
    SELECT id INTO v_empresa_id FROM public.empresas WHERE user_id = NEW.id LIMIT 1;
  END IF;

  -- Cria registro em usuarios
  IF v_empresa_id IS NOT NULL THEN
    INSERT INTO public.usuarios (id, empresa_id, nome, email, papel)
    VALUES (NEW.id, v_empresa_id, v_nome, NEW.email, 'admin')
    ON CONFLICT (id) DO UPDATE
      SET empresa_id = COALESCE(public.usuarios.empresa_id, EXCLUDED.empresa_id),
          nome = COALESCE(public.usuarios.nome, EXCLUDED.nome),
          email = COALESCE(public.usuarios.email, EXCLUDED.email);

    -- Seed categorias despesa para nova empresa
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

    -- Seed plano de contas
    PERFORM public.seed_plano_contas(v_empresa_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 5. Seed plano de contas para empresas existentes sem plano
-- ============================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT e.id FROM public.empresas e
    WHERE NOT EXISTS (SELECT 1 FROM public.plano_contas p WHERE p.empresa_id = e.id)
  LOOP
    PERFORM public.seed_plano_contas(r.id);
  END LOOP;
END $$;

-- ============================================================
-- 6. Seed categorias para empresas existentes sem categorias
-- ============================================================
INSERT INTO public.categorias_despesa (empresa_id, nome)
SELECT e.id, v.nome
FROM public.empresas e
CROSS JOIN (
  VALUES
    ('Alimentação'), ('Transporte'), ('Hospedagem'), ('Tecnologia/Software'),
    ('Marketing'), ('Fornecedores'), ('Folha de Pagamento'), ('Impostos/Taxas'),
    ('Aluguel/Infraestrutura'), ('Consultoria'), ('Material de Escritório'), ('Outros')
) AS v(nome)
WHERE NOT EXISTS (
  SELECT 1 FROM public.categorias_despesa c
  WHERE c.empresa_id = e.id AND c.nome = v.nome
)
ON CONFLICT (empresa_id, nome) DO NOTHING;
