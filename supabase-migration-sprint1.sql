-- FactorOne Sprint 1 Migration
-- Cole no SQL Editor do Supabase e clique Run ANTES de testar os módulos

-- 1. Ajusta tabela base transactions para referenciar empresas (não auth.users)
--    transacoes é uma VIEW de public.transactions — alterar a tabela base
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transacoes_empresa_id_fkey;
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_empresa_id_fkey;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_empresa_id_fkey
  FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "user_own_data" ON public.transactions;
DROP POLICY IF EXISTS "transacoes_empresa" ON public.transactions;
CREATE POLICY "transacoes_empresa" ON public.transactions FOR ALL
  USING (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));

-- 2. Centros de custo
CREATE TABLE IF NOT EXISTS centros_custo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE centros_custo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "centros_custo_empresa" ON centros_custo;
CREATE POLICY "centros_custo_empresa" ON centros_custo FOR ALL
  USING (empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid()));

-- 3. Metricas financeiras (DRE)
CREATE TABLE IF NOT EXISTS metricas_financeiras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES empresas(id) ON DELETE CASCADE,
  competencia date NOT NULL,
  receita_bruta numeric DEFAULT 0,
  deducoes numeric DEFAULT 0,
  receita_liquida numeric DEFAULT 0,
  cmv numeric DEFAULT 0,
  lucro_bruto numeric DEFAULT 0,
  despesas_operacionais numeric DEFAULT 0,
  ebitda numeric DEFAULT 0,
  depreciacao numeric DEFAULT 0,
  ebit numeric DEFAULT 0,
  resultado_financeiro numeric DEFAULT 0,
  lair numeric DEFAULT 0,
  impostos numeric DEFAULT 0,
  lucro_liquido numeric DEFAULT 0,
  margem_bruta numeric DEFAULT 0,
  margem_ebitda numeric DEFAULT 0,
  margem_liquida numeric DEFAULT 0,
  roi numeric DEFAULT 0,
  roic numeric DEFAULT 0,
  roce numeric DEFAULT 0,
  capital_investido numeric DEFAULT 0,
  capital_empregado numeric DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (empresa_id, competencia)
);
ALTER TABLE metricas_financeiras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "metricas_financeiras_empresa" ON metricas_financeiras;
CREATE POLICY "metricas_financeiras_empresa" ON metricas_financeiras FOR ALL
  USING (empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid()));

-- 4. Lancamentos contabeis
CREATE TABLE IF NOT EXISTS lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES empresas(id) ON DELETE CASCADE,
  conta_id uuid,
  descricao text,
  valor numeric DEFAULT 0,
  tipo text CHECK (tipo IN ('debito', 'credito')),
  competencia date,
  origem text,
  transaction_id uuid,
  despesa_id uuid,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE lancamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lancamentos_empresa" ON lancamentos;
CREATE POLICY "lancamentos_empresa" ON lancamentos FOR ALL
  USING (empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid()));

-- 5. Plano de contas
CREATE TABLE IF NOT EXISTS plano_contas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES empresas(id) ON DELETE CASCADE,
  codigo text,
  nome text NOT NULL,
  tipo text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE plano_contas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plano_contas_empresa" ON plano_contas;
CREATE POLICY "plano_contas_empresa" ON plano_contas FOR ALL
  USING (empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid()));

-- 6. Colunas extras na tabela despesas (que o app espera)
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS data_despesa date;
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS data_vencimento date;
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS data_pagamento date;
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS tipo_pagamento text;
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS responsavel_id uuid;
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS responsavel_nome text;
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS observacao text;
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS aprovado_por uuid;
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS aprovado_em timestamptz;
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS rejeitado_motivo text;
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS transaction_id uuid;
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS recorrente boolean DEFAULT false;
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS recorrencia_tipo text;
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS centro_custo_id uuid REFERENCES centros_custo(id);

-- Atualiza status default de despesas para workflow de aprovacao
ALTER TABLE despesas ALTER COLUMN status SET DEFAULT 'pendente_aprovacao';

-- Atualiza RLS de despesas (caso tenha policy antiga)
DROP POLICY IF EXISTS "despesas_empresa" ON despesas;
CREATE POLICY "despesas_empresa" ON despesas FOR ALL
  USING (empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid()));
