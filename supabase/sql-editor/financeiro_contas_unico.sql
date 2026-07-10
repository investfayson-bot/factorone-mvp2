-- =============================================================================
-- FactorOne — Financeiro: Contas a Pagar/Receber, Régua, Logs, Conciliação
-- Cole este bloco INTEIRO no Supabase SQL Editor e execute uma vez.
-- Pré-requisitos: public.empresas, public.usuarios, public.centros_custo,
-- public.transacoes, public.extrato_bancario, public.contas_bancarias,
-- public.notas_emitidas (como no projeto FactorOne).
-- =============================================================================

-- Corrige instalação anterior com dias_atraso como GENERATED (erro 42P17)
DO $$
BEGIN
  IF to_regclass('public.contas_receber') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = 'contas_receber'
        AND c.column_name = 'dias_atraso' AND c.is_generated = 'ALWAYS'
    ) THEN
      ALTER TABLE public.contas_receber DROP COLUMN dias_atraso;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = 'contas_receber'
        AND c.column_name = 'dias_atraso'
    ) THEN
      ALTER TABLE public.contas_receber ADD COLUMN dias_atraso int NOT NULL DEFAULT 0;
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.contas_pagar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  fornecedor_nome text NOT NULL,
  fornecedor_documento text,
  categoria text DEFAULT 'Outros',
  centro_custo_id uuid REFERENCES public.centros_custo(id),
  valor numeric(15,2) NOT NULL,
  valor_pago numeric(15,2) DEFAULT 0,
  data_emissao date DEFAULT CURRENT_DATE,
  data_vencimento date NOT NULL,
  data_pagamento date,
  tipo_pagamento text CHECK (tipo_pagamento IN ('pix','ted','boleto','cartao','dinheiro','outro')),
  codigo_barras text,
  chave_pix text,
  status text CHECK (status IN ('pendente','vencida','paga','parcialmente_paga','cancelada')) DEFAULT 'pendente',
  recorrente boolean DEFAULT false,
  recorrencia_tipo text CHECK (recorrencia_tipo IN ('semanal','mensal','trimestral','anual')),
  recorrencia_proxima date,
  observacoes text,
  comprovante_url text,
  extrato_id uuid REFERENCES public.extrato_bancario(id),
  transaction_id uuid REFERENCES public.transacoes(id),
  parcelas int DEFAULT 1,
  parcela_atual int DEFAULT 1,
  parcela_pai_id uuid REFERENCES public.contas_pagar(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.contas_pagar ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios veem proprias contas_pagar" ON public.contas_pagar;
CREATE POLICY "usuarios veem proprias contas_pagar" ON public.contas_pagar
FOR ALL USING (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.contas_receber (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  cliente_nome text NOT NULL,
  cliente_documento text,
  cliente_email text,
  categoria text DEFAULT 'Receita Operacional',
  valor numeric(15,2) NOT NULL,
  valor_recebido numeric(15,2) DEFAULT 0,
  data_emissao date DEFAULT CURRENT_DATE,
  data_vencimento date NOT NULL,
  data_recebimento date,
  tipo_cobranca text CHECK (tipo_cobranca IN ('boleto','pix','cartao','transferencia','dinheiro','outro')),
  chave_pix_cobranca text,
  link_pagamento text,
  status text CHECK (status IN ('pendente','vencida','recebida','parcialmente_recebida','cancelada','protestada')) DEFAULT 'pendente',
  nota_fiscal_id uuid REFERENCES public.notas_emitidas(id),
  recorrente boolean DEFAULT false,
  recorrencia_tipo text CHECK (recorrencia_tipo IN ('semanal','mensal','trimestral','anual')),
  recorrencia_proxima date,
  dias_atraso int NOT NULL DEFAULT 0,
  juros_mora numeric(5,4) DEFAULT 0.0033,
  multa numeric(5,4) DEFAULT 0.02,
  observacoes text,
  extrato_id uuid REFERENCES public.extrato_bancario(id),
  transaction_id uuid REFERENCES public.transacoes(id),
  parcelas int DEFAULT 1,
  parcela_atual int DEFAULT 1,
  parcela_pai_id uuid REFERENCES public.contas_receber(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.contas_receber ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios veem proprias contas_receber" ON public.contas_receber;
CREATE POLICY "usuarios veem proprias contas_receber" ON public.contas_receber
FOR ALL USING (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));

CREATE OR REPLACE FUNCTION public.trg_contas_receber_dias_atraso()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('recebida', 'cancelada') THEN
    NEW.dias_atraso := 0;
  ELSIF NEW.data_vencimento < CURRENT_DATE THEN
    NEW.dias_atraso := (CURRENT_DATE - NEW.data_vencimento);
  ELSE
    NEW.dias_atraso := 0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_dias_atraso_contas_receber ON public.contas_receber;
CREATE TRIGGER set_dias_atraso_contas_receber
BEFORE INSERT OR UPDATE ON public.contas_receber
FOR EACH ROW
EXECUTE FUNCTION public.trg_contas_receber_dias_atraso();

CREATE TABLE IF NOT EXISTS public.reguas_cobranca (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL DEFAULT 'Régua Padrão',
  ativo boolean DEFAULT true,
  notificacoes jsonb DEFAULT '[
    {"dias": -3, "canal": "email", "mensagem": "Lembrete: vencimento em 3 dias"},
    {"dias": -1, "canal": "email", "mensagem": "Lembrete: vencimento amanhã"},
    {"dias": 0, "canal": "email", "mensagem": "Hoje é o dia do vencimento"},
    {"dias": 1, "canal": "email", "mensagem": "Vencimento ontem - pagamento pendente"},
    {"dias": 5, "canal": "email", "mensagem": "5 dias em atraso"},
    {"dias": 15, "canal": "email", "mensagem": "15 dias em atraso - contato urgente"}
  ]',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.reguas_cobranca ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios veem proprias reguas" ON public.reguas_cobranca;
CREATE POLICY "usuarios veem proprias reguas" ON public.reguas_cobranca
FOR ALL USING (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.log_cobrancas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_receber_id uuid REFERENCES public.contas_receber(id),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  canal text CHECK (canal IN ('email','whatsapp','sms')) NOT NULL,
  destinatario text NOT NULL,
  mensagem text NOT NULL,
  status text CHECK (status IN ('enviado','erro','pendente')) DEFAULT 'pendente',
  enviado_em timestamptz DEFAULT now()
);
ALTER TABLE public.log_cobrancas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios veem proprios logs" ON public.log_cobrancas;
CREATE POLICY "usuarios veem proprios logs" ON public.log_cobrancas
FOR ALL USING (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.conciliacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  conta_id uuid REFERENCES public.contas_bancarias(id),
  extrato_id uuid REFERENCES public.extrato_bancario(id),
  tipo_match text CHECK (tipo_match IN ('conta_pagar','conta_receber','despesa','transaction','manual')),
  referencia_id uuid,
  confidence numeric(5,4) DEFAULT 1.0,
  metodo text CHECK (metodo IN ('exato','fuzzy','manual')) DEFAULT 'exato',
  criado_em timestamptz DEFAULT now()
);
ALTER TABLE public.conciliacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios veem proprias conciliacoes" ON public.conciliacoes;
CREATE POLICY "usuarios veem proprias conciliacoes" ON public.conciliacoes
FOR ALL USING (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));

INSERT INTO public.reguas_cobranca (empresa_id, nome)
SELECT e.id, 'Régua Padrão'
FROM public.empresas e
WHERE NOT EXISTS (SELECT 1 FROM public.reguas_cobranca r WHERE r.empresa_id = e.id);

INSERT INTO public.contas_pagar (
  empresa_id, descricao, fornecedor_nome,
  valor, data_vencimento, status, categoria
)
SELECT
  e.id,
  cp.descricao,
  cp.fornecedor,
  cp.valor,
  (CURRENT_DATE + cp.dias)::date,
  cp.status,
  cp.categoria
FROM public.empresas e
CROSS JOIN (VALUES
  ('Aluguel Escritório', 'Imobiliária Central', 3500.00, 5, 'pendente', 'Aluguel/Infraestrutura'),
  ('Internet e Telefone', 'Vivo Empresas', 450.00, 3, 'pendente', 'Tecnologia/Software'),
  ('Fornecedor Matéria Prima', 'Aço Brasil Ltda', 12000.00, -2, 'vencida', 'Fornecedores'),
  ('Software ERP', 'TOTVS', 890.00, 10, 'pendente', 'Tecnologia/Software'),
  ('Energia Elétrica', 'CPFL', 1200.00, 7, 'pendente', 'Aluguel/Infraestrutura')
) AS cp(descricao, fornecedor, valor, dias, status, categoria)
WHERE NOT EXISTS (SELECT 1 FROM public.contas_pagar x WHERE x.empresa_id = e.id AND x.descricao = cp.descricao);

INSERT INTO public.contas_receber (
  empresa_id, descricao, cliente_nome,
  cliente_email, valor, data_vencimento, status, categoria
)
SELECT
  e.id,
  cr.descricao,
  cr.cliente,
  cr.email,
  cr.valor,
  (CURRENT_DATE + cr.dias)::date,
  cr.status,
  'Receita Operacional'
FROM public.empresas e
CROSS JOIN (VALUES
  ('Consultoria Financeira', 'TechCorp Ltda', 'financeiro@techcorp.com', 8500.00, 5, 'pendente'),
  ('Desenvolvimento Software', 'StartupXYZ', 'ceo@startupxyz.com', 15000.00, -3, 'vencida'),
  ('Serviços de Marketing', 'Varejão ABC', 'compras@varejao.com', 3200.00, 12, 'pendente'),
  ('Manutenção Mensal', 'Indústria Norte', 'financeiro@industria.com', 2800.00, 20, 'pendente'),
  ('Projeto Especial', 'Construtora Sul', 'dir@construtora.com', 22000.00, -8, 'vencida')
) AS cr(descricao, cliente, email, valor, dias, status)
WHERE NOT EXISTS (SELECT 1 FROM public.contas_receber y WHERE y.empresa_id = e.id AND y.descricao = cr.descricao);

-- Recalcula dias_atraso nas linhas já inseridas (trigger já rodou no INSERT)
UPDATE public.contas_receber SET updated_at = now() WHERE true;
