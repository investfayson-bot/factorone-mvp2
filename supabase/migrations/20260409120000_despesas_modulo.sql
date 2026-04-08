-- Módulo Despesas: centros de custo, despesas estendidas, políticas, categorias por empresa

-- ========== Centros de custo ==========
CREATE TABLE IF NOT EXISTS public.centros_custo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas (id) ON DELETE CASCADE,
  nome text NOT NULL,
  codigo text,
  orcamento_mensal decimal(15, 2) DEFAULT 0,
  cor text DEFAULT '#3B82F6',
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_centros_custo_empresa ON public.centros_custo (empresa_id);

ALTER TABLE public.centros_custo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios veem proprios centros" ON public.centros_custo;
CREATE POLICY "usuarios veem proprios centros" ON public.centros_custo
  FOR ALL
  USING (
    empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
  )
  WITH CHECK (
    empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
  );

-- ========== Categorias por empresa ==========
CREATE TABLE IF NOT EXISTS public.categorias_despesa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas (id) ON DELETE CASCADE,
  nome text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (empresa_id, nome)
);

CREATE INDEX IF NOT EXISTS idx_categorias_despesa_empresa ON public.categorias_despesa (empresa_id);

ALTER TABLE public.categorias_despesa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios veem categorias despesas" ON public.categorias_despesa;
CREATE POLICY "usuarios veem categorias despesas" ON public.categorias_despesa
  FOR ALL
  USING (
    empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
  )
  WITH CHECK (
    empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
  );

-- ========== Políticas de gastos ==========
CREATE TABLE IF NOT EXISTS public.politicas_gastos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas (id) ON DELETE CASCADE,
  categoria text NOT NULL,
  limite_por_transacao decimal(15, 2),
  limite_mensal decimal(15, 2),
  requer_aprovacao_acima decimal(15, 2) DEFAULT 0,
  requer_comprovante_acima decimal(15, 2) DEFAULT 50,
  aprovadores jsonb DEFAULT '[]',
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_politicas_gastos_empresa ON public.politicas_gastos (empresa_id);

ALTER TABLE public.politicas_gastos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios veem proprias politicas" ON public.politicas_gastos;
CREATE POLICY "usuarios veem proprias politicas" ON public.politicas_gastos
  FOR ALL
  USING (
    empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
  )
  WITH CHECK (
    empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
  );

-- ========== Estender despesas (compatível com schema legado) ==========
ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS centro_custo_id uuid REFERENCES public.centros_custo (id) ON DELETE SET NULL;
ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS responsavel_id uuid REFERENCES auth.users (id) ON DELETE SET NULL;
ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS responsavel_nome text;
ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS tipo_pagamento text;
ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS data_despesa date;
ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS data_vencimento date;
ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS data_pagamento date;
ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS observacao text;
ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS aprovado_por uuid REFERENCES auth.users (id) ON DELETE SET NULL;
ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz;
ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS rejeitado_motivo text;
ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS transaction_id uuid;
ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS recorrente boolean DEFAULT false;
ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS recorrencia_tipo text;

UPDATE public.despesas
SET data_despesa = COALESCE(data, CURRENT_DATE)
WHERE data_despesa IS NULL;

ALTER TABLE public.despesas
  ALTER COLUMN data_despesa SET DEFAULT CURRENT_DATE;

-- Migrar status legado → novo domínio
UPDATE public.despesas
SET status = CASE
  WHEN status = 'pago' THEN 'pago'
  WHEN status = 'aprovacao' THEN 'pendente_aprovacao'
  ELSE 'pendente_aprovacao'
END
WHERE status IS NULL
   OR status NOT IN ('pendente_aprovacao', 'aprovado', 'rejeitado', 'pago', 'cancelado');

ALTER TABLE public.despesas DROP CONSTRAINT IF EXISTS despesas_status_check;
ALTER TABLE public.despesas
  ADD CONSTRAINT despesas_status_check CHECK (
    status IN ('pendente_aprovacao', 'aprovado', 'rejeitado', 'pago', 'cancelado')
  );

ALTER TABLE public.despesas DROP CONSTRAINT IF EXISTS despesas_tipo_pagamento_check;
ALTER TABLE public.despesas
  ADD CONSTRAINT despesas_tipo_pagamento_check CHECK (
    tipo_pagamento IS NULL OR tipo_pagamento IN ('cartao', 'pix', 'transferencia', 'boleto', 'dinheiro', 'outro')
  );

ALTER TABLE public.despesas DROP CONSTRAINT IF EXISTS despesas_recorrencia_check;
ALTER TABLE public.despesas
  ADD CONSTRAINT despesas_recorrencia_check CHECK (
    recorrencia_tipo IS NULL OR recorrencia_tipo IN ('semanal', 'mensal', 'trimestral', 'anual')
  );

ALTER TABLE public.despesas ALTER COLUMN status SET DEFAULT 'pendente_aprovacao';

DO $$
BEGIN
  IF to_regclass('public.transacoes') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'despesas_transaction_id_fkey'
     ) THEN
    ALTER TABLE public.despesas
      ADD CONSTRAINT despesas_transaction_id_fkey
      FOREIGN KEY (transaction_id) REFERENCES public.transacoes (id) ON DELETE SET NULL;
  END IF;
END $$;

-- Atualizar política RLS despesas (nome pode variar entre instalações)
DROP POLICY IF EXISTS "despesas_by_user" ON public.despesas;
DROP POLICY IF EXISTS "despesas_empresa" ON public.despesas;
DROP POLICY IF EXISTS "usuarios veem proprias despesas" ON public.despesas;

CREATE POLICY "usuarios veem proprias despesas" ON public.despesas
  FOR ALL
  USING (
    empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
  )
  WITH CHECK (
    empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
  );

-- ========== Seed categorias padrão para empresas existentes ==========
INSERT INTO public.categorias_despesa (empresa_id, nome)
SELECT e.id, v.nome
FROM public.empresas e
CROSS JOIN (
  VALUES
    ('Alimentação'),
    ('Transporte'),
    ('Hospedagem'),
    ('Tecnologia/Software'),
    ('Marketing'),
    ('Fornecedores'),
    ('Folha de Pagamento'),
    ('Impostos/Taxas'),
    ('Aluguel/Infraestrutura'),
    ('Consultoria'),
    ('Material de Escritório'),
    ('Outros')
) AS v (nome)
ON CONFLICT (empresa_id, nome) DO NOTHING;

-- ========== Novas empresas recebem categorias automaticamente ==========
CREATE OR REPLACE FUNCTION public.seed_categorias_despesa_nova_empresa()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.categorias_despesa (empresa_id, nome)
  VALUES
    (NEW.id, 'Alimentação'),
    (NEW.id, 'Transporte'),
    (NEW.id, 'Hospedagem'),
    (NEW.id, 'Tecnologia/Software'),
    (NEW.id, 'Marketing'),
    (NEW.id, 'Fornecedores'),
    (NEW.id, 'Folha de Pagamento'),
    (NEW.id, 'Impostos/Taxas'),
    (NEW.id, 'Aluguel/Infraestrutura'),
    (NEW.id, 'Consultoria'),
    (NEW.id, 'Material de Escritório'),
    (NEW.id, 'Outros')
  ON CONFLICT (empresa_id, nome) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_categorias_despesa ON public.empresas;
CREATE TRIGGER trg_seed_categorias_despesa
  AFTER INSERT ON public.empresas
  FOR EACH ROW
  EXECUTE PROCEDURE public.seed_categorias_despesa_nova_empresa();
