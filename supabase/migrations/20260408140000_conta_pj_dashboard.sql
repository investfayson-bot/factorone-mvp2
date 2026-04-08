CREATE TABLE IF NOT EXISTS public.contas_bancarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo text CHECK (tipo IN ('conta_pj_factorone','corrente','poupanca','investimento')) DEFAULT 'corrente',
  banco_nome text NOT NULL,
  banco_codigo text,
  agencia text,
  numero_conta text,
  digito text,
  saldo numeric(15,2) DEFAULT 0,
  saldo_disponivel numeric(15,2) DEFAULT 0,
  saldo_bloqueado numeric(15,2) DEFAULT 0,
  limite_pix numeric(15,2) DEFAULT 0,
  is_principal boolean DEFAULT false,
  open_finance_id text,
  status text CHECK (status IN ('ativa','inativa','pendente','bloqueada')) DEFAULT 'ativa',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.extrato_bancario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id uuid REFERENCES public.contas_bancarias(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  valor numeric(15,2) NOT NULL,
  tipo text CHECK (tipo IN ('credito','debito')) NOT NULL,
  categoria text DEFAULT 'Outros',
  data_transacao timestamptz NOT NULL DEFAULT now(),
  data_compensacao date,
  saldo_apos numeric(15,2),
  tipo_operacao text CHECK (tipo_operacao IN ('pix','ted','doc','boleto','cartao','tarifa','rendimento','transferencia','outros')) DEFAULT 'outros',
  contraparte_nome text,
  contraparte_documento text,
  contraparte_banco text,
  chave_pix text,
  comprovante_url text,
  conciliado boolean DEFAULT false,
  transaction_id uuid REFERENCES public.transacoes(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.investimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  conta_id uuid REFERENCES public.contas_bancarias(id),
  tipo text CHECK (tipo IN ('cdi','cdb','lci','lca','tesouro_direto','fundos','acoes','outros')) NOT NULL,
  nome text NOT NULL,
  valor_aplicado numeric(15,2) NOT NULL,
  valor_atual numeric(15,2) NOT NULL,
  rentabilidade_contratada numeric(8,4),
  percentual_cdi numeric(8,4),
  data_aplicacao date NOT NULL,
  data_vencimento date,
  status text CHECK (status IN ('ativo','vencido','resgatado')) DEFAULT 'ativo',
  rendimento_total numeric(15,2) GENERATED ALWAYS AS (valor_atual - valor_aplicado) STORED,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.transferencias_agendadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  conta_origem_id uuid REFERENCES public.contas_bancarias(id),
  tipo text CHECK (tipo IN ('pix','ted','doc','boleto')) NOT NULL,
  valor numeric(15,2) NOT NULL,
  destinatario_nome text NOT NULL,
  destinatario_documento text,
  destinatario_banco text,
  destinatario_agencia text,
  destinatario_conta text,
  chave_pix text,
  descricao text,
  data_agendada date NOT NULL,
  status text CHECK (status IN ('agendado','processando','concluido','cancelado','erro')) DEFAULT 'agendado',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.contas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extrato_bancario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transferencias_agendadas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios veem proprias contas" ON public.contas_bancarias;
CREATE POLICY "usuarios veem proprias contas" ON public.contas_bancarias FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
);
DROP POLICY IF EXISTS "usuarios veem proprio extrato" ON public.extrato_bancario;
CREATE POLICY "usuarios veem proprio extrato" ON public.extrato_bancario FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
);
DROP POLICY IF EXISTS "usuarios veem proprios investimentos" ON public.investimentos;
CREATE POLICY "usuarios veem proprios investimentos" ON public.investimentos FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
);
DROP POLICY IF EXISTS "usuarios veem proprias transferencias" ON public.transferencias_agendadas;
CREATE POLICY "usuarios veem proprias transferencias" ON public.transferencias_agendadas FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
);

INSERT INTO public.contas_bancarias (empresa_id, tipo, banco_nome, banco_codigo, saldo, saldo_disponivel, is_principal, status)
SELECT id, 'conta_pj_factorone', 'FactorOne Bank', '399', 11877.00, 11877.00, true, 'ativa'
FROM public.empresas
WHERE NOT EXISTS (
  SELECT 1 FROM public.contas_bancarias cb WHERE cb.empresa_id = empresas.id
);
