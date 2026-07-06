-- =============================================================================
-- FactorOne — Schema Completo Consolidado (Sprints 0-6)
-- Rode INTEIRO no SQL Editor do Supabase em um banco limpo.
-- Idempotente: usa IF NOT EXISTS / ON CONFLICT em tudo.
-- =============================================================================

-- ============================================================
-- EXTENSÕES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. EMPRESAS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.empresas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome         text NOT NULL,
  cnpj         text,
  setor        text,
  plano        text DEFAULT 'trial',
  plano_ativo  boolean DEFAULT true,
  user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  stripe_customer_id     text,
  stripe_subscription_id text,
  created_at   timestamptz DEFAULT now()
);
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "empresa_acesso" ON public.empresas;
CREATE POLICY "empresa_acesso" ON public.empresas FOR ALL USING (
  id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
  OR user_id = auth.uid()
);

-- ============================================================
-- 2. USUARIOS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.usuarios (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome       text,
  email      text,
  papel      text DEFAULT 'admin',
  whatsapp   text,
  created_at timestamptz DEFAULT now()
);
-- Adiciona coluna whatsapp em tabelas já existentes (idempotente)
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS whatsapp text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_whatsapp ON public.usuarios(whatsapp) WHERE whatsapp IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_usuarios_empresa ON public.usuarios(empresa_id);
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios_self" ON public.usuarios;
DROP POLICY IF EXISTS "usuario_proprio" ON public.usuarios;
CREATE POLICY "usuarios_self" ON public.usuarios FOR ALL USING (id = auth.uid());

-- ============================================================
-- 3. TRANSAÇÕES
-- Detecta automaticamente se transacoes é tabela ou view (depende
-- de qual migration foi rodada antes). Se for view, a tabela real
-- é transactions. Se for tabela, cria a view transactions em cima.
-- ============================================================
DO $$
BEGIN
  -- Só cria a tabela se não existir nada com esse nome (nem tabela nem view)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'transacoes'
  ) THEN
    -- Também não existe transactions como tabela? Cria transacoes como tabela.
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'transactions' AND table_type = 'BASE TABLE'
    ) THEN
      EXECUTE $sql$
        CREATE TABLE public.transacoes (
          id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          empresa_id  uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
          descricao   text NOT NULL,
          categoria   text DEFAULT 'Outros',
          valor       numeric(15,2) NOT NULL,
          tipo        text CHECK (tipo IN ('entrada','saida')) NOT NULL,
          status      text DEFAULT 'confirmada',
          data        date DEFAULT CURRENT_DATE,
          due_date    date,
          competencia date,
          banco       text,
          created_at  timestamptz DEFAULT now()
        )
      $sql$;
    END IF;
  END IF;
END $$;

-- Adicionar colunas que foram incluídas em sprints posteriores (idempotente)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'transacoes' AND table_type = 'BASE TABLE'
  ) THEN
    EXECUTE 'ALTER TABLE public.transacoes ADD COLUMN IF NOT EXISTS due_date date';
    EXECUTE 'ALTER TABLE public.transacoes ADD COLUMN IF NOT EXISTS competencia date';
    EXECUTE 'ALTER TABLE public.transacoes ADD COLUMN IF NOT EXISTS banco text';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_transacoes_empresa_data ON public.transacoes(empresa_id, data DESC)';
    EXECUTE 'ALTER TABLE public.transacoes ENABLE ROW LEVEL SECURITY';
    EXECUTE $pol$
      DROP POLICY IF EXISTS "empresa_own_transactions" ON public.transacoes;
      CREATE POLICY "empresa_own_transactions" ON public.transacoes FOR ALL USING (
        empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
        OR empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
      )
    $pol$;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'transactions' AND table_type = 'BASE TABLE'
  ) THEN
    -- transacoes é uma view; a tabela real é transactions — aplicar RLS lá
    EXECUTE 'ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS due_date date';
    EXECUTE 'ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS competencia date';
    EXECUTE 'ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS banco text';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_transacoes_empresa_data ON public.transactions(empresa_id, data DESC)';
    EXECUTE 'ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY';
    EXECUTE $pol$
      DROP POLICY IF EXISTS "empresa_own_transactions" ON public.transactions;
      CREATE POLICY "empresa_own_transactions" ON public.transactions FOR ALL USING (
        empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
        OR empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
      )
    $pol$;
  END IF;
END $$;

-- VIEW transactions: só cria/substitui se transacoes for tabela real
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'transacoes' AND table_type = 'BASE TABLE'
  ) THEN
    EXECUTE $sql$
      CREATE OR REPLACE VIEW public.transactions AS
      SELECT
        t.id, t.empresa_id, t.descricao, t.categoria, t.valor,
        CASE WHEN t.tipo = 'entrada' THEN 'receita' ELSE 'despesa' END::text AS tipo,
        CASE WHEN t.status IN ('confirmada','pago') THEN 'pago'
             WHEN t.status = 'cancelado' THEN 'cancelado'
             ELSE COALESCE(NULLIF(TRIM(t.status),''), 'pendente')
        END::text AS status,
        t.due_date,
        COALESCE(t.competencia, t.data)::date AS competencia,
        t.data, t.created_at
      FROM public.transacoes t
    $sql$;
  END IF;
END $$;

-- ============================================================
-- 4. DESPESAS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.despesas (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id           uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  descricao            text NOT NULL,
  valor                numeric(15,2) NOT NULL,
  categoria            text DEFAULT 'Outros',
  data                 date DEFAULT CURRENT_DATE,
  data_despesa         date DEFAULT CURRENT_DATE,
  data_vencimento      date,
  data_pagamento       date,
  status               text DEFAULT 'pendente_aprovacao' CHECK (
    status IN ('pendente_aprovacao','aprovado','rejeitado','pago','cancelado')
  ),
  tipo_pagamento       text CHECK (
    tipo_pagamento IS NULL OR tipo_pagamento IN ('cartao','pix','transferencia','boleto','dinheiro','outro')
  ),
  forma_pagamento      text DEFAULT 'outro',
  comprovante_url      text,
  centro_custo_id      uuid,
  responsavel_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  responsavel_nome     text,
  observacao           text,
  aprovado_por         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  aprovado_em          timestamptz,
  rejeitado_motivo     text,
  transaction_id       uuid REFERENCES public.transacoes(id) ON DELETE SET NULL,
  recorrente           boolean DEFAULT false,
  recorrencia_tipo     text CHECK (recorrencia_tipo IS NULL OR recorrencia_tipo IN ('semanal','bisemanal','mensal')),
  subcategoria         text,
  tags                 text[] DEFAULT '{}',
  metadados            jsonb DEFAULT '{}',
  projeto              text,
  moeda                text DEFAULT 'BRL',
  valor_original       numeric(15,2),
  taxa_cambio          numeric(15,6) DEFAULT 1,
  created_by           uuid,
  created_at           timestamptz DEFAULT now()
);
-- Colunas adicionadas em sprints posteriores (idempotente para bancos existentes)
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS data_despesa date;
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS data_vencimento date;
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS data_pagamento date;
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS tipo_pagamento text;
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS forma_pagamento text DEFAULT 'outro';
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS centro_custo_id uuid;
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS responsavel_id uuid;
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS responsavel_nome text;
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS observacao text;
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS aprovado_por uuid;
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS aprovado_em timestamptz;
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS rejeitado_motivo text;
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS transaction_id uuid;
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS recorrente boolean DEFAULT false;
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS recorrencia_tipo text;
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS subcategoria text;
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS metadados jsonb DEFAULT '{}';
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS projeto text;
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS moeda text DEFAULT 'BRL';
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS valor_original numeric(15,2);
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS taxa_cambio numeric(15,6) DEFAULT 1;
-- Migrar status legado
UPDATE public.despesas SET status = 'pendente_aprovacao'
WHERE status IS NULL OR status NOT IN ('pendente_aprovacao','aprovado','rejeitado','pago','cancelado');
UPDATE public.despesas SET data_despesa = COALESCE(data, CURRENT_DATE) WHERE data_despesa IS NULL;
-- Recriar constraints (DROP + ADD é idempotente)
ALTER TABLE public.despesas DROP CONSTRAINT IF EXISTS despesas_status_check;
ALTER TABLE public.despesas ADD CONSTRAINT despesas_status_check
  CHECK (status IN ('pendente_aprovacao','aprovado','rejeitado','pago','cancelado'));
ALTER TABLE public.despesas DROP CONSTRAINT IF EXISTS despesas_tipo_pagamento_check;
ALTER TABLE public.despesas ADD CONSTRAINT despesas_tipo_pagamento_check
  CHECK (tipo_pagamento IS NULL OR tipo_pagamento IN ('cartao','pix','transferencia','boleto','dinheiro','outro'));
ALTER TABLE public.despesas DROP CONSTRAINT IF EXISTS despesas_recorrencia_check;
ALTER TABLE public.despesas ADD CONSTRAINT despesas_recorrencia_check
  CHECK (recorrencia_tipo IS NULL OR recorrencia_tipo IN ('semanal','bisemanal','mensal'));
CREATE INDEX IF NOT EXISTS idx_despesas_empresa_status ON public.despesas(empresa_id, status);
ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios veem proprias despesas" ON public.despesas;
CREATE POLICY "usuarios veem proprias despesas" ON public.despesas FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
  OR empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
  OR empresa_id = auth.uid()
) WITH CHECK (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
  OR empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
  OR empresa_id = auth.uid()
);

-- ============================================================
-- 5. METRICAS (snapshot dashboard)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.metricas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     uuid REFERENCES public.empresas(id) ON DELETE CASCADE UNIQUE,
  saldo          numeric DEFAULT 0,
  mrr            numeric DEFAULT 0,
  burn_rate      numeric DEFAULT 0,
  runway         numeric DEFAULT 0,
  receita_mes    numeric DEFAULT 0,
  despesas_mes   numeric DEFAULT 0,
  lucro_mes      numeric DEFAULT 0,
  a_receber      numeric DEFAULT 0,
  a_pagar        numeric DEFAULT 0,
  updated_at     timestamptz DEFAULT now()
);
ALTER TABLE public.metricas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "metricas_by_user" ON public.metricas;
CREATE POLICY "metricas_by_user" ON public.metricas FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
);

-- ============================================================
-- 6. INVOICES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.invoices (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  numero       text,
  cliente_nome text NOT NULL,
  valor        numeric NOT NULL,
  vencimento   date,
  status       text DEFAULT 'rascunho',
  descricao    text,
  created_at   timestamptz DEFAULT now()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invoices_empresa" ON public.invoices;
CREATE POLICY "invoices_empresa" ON public.invoices FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
);

-- ============================================================
-- 7. CASHFLOW HISTÓRICO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cashflow (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  mes        text NOT NULL,
  entradas   numeric DEFAULT 0,
  saidas     numeric DEFAULT 0,
  projetado  boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.cashflow ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cashflow_empresa" ON public.cashflow;
CREATE POLICY "cashflow_empresa" ON public.cashflow FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
);

-- ============================================================
-- 8. AI CFO HISTÓRICO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.aicfo_historico (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  role       text,
  conteudo   text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.aicfo_historico ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aicfo_empresa" ON public.aicfo_historico;
CREATE POLICY "aicfo_empresa" ON public.aicfo_historico FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
);

-- ============================================================
-- 9. NOTAS FISCAIS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notas_emitidas (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id             uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo                   text NOT NULL CHECK (tipo IN ('nfe','nfse')),
  numero                 text,
  serie                  text DEFAULT '1',
  chave_acesso           text UNIQUE,
  nfeio_id               text UNIQUE,
  status                 text NOT NULL DEFAULT 'processando' CHECK (
    status IN ('processando','autorizada','rejeitada','cancelada')
  ),
  destinatario_nome      text NOT NULL,
  destinatario_cnpj_cpf  text NOT NULL,
  destinatario_email     text,
  valor_total            numeric(15,2) NOT NULL,
  valor_impostos         numeric(15,2) DEFAULT 0,
  xml_url                text,
  pdf_url                text,
  transacao_id           uuid REFERENCES public.transacoes(id) ON DELETE SET NULL,
  competencia            date,
  cancelada_em           timestamptz,
  cancelada_motivo       text,
  sefaz_motivo           text,
  raw_response           jsonb,
  created_at             timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notas_emitidas_empresa ON public.notas_emitidas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_notas_emitidas_status  ON public.notas_emitidas(status);
CREATE INDEX IF NOT EXISTS idx_notas_emitidas_created ON public.notas_emitidas(created_at DESC);
ALTER TABLE public.notas_emitidas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notas_emitidas_own" ON public.notas_emitidas;
CREATE POLICY "notas_emitidas_own" ON public.notas_emitidas FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
  OR empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
);

CREATE TABLE IF NOT EXISTS public.notas_email_envios (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nota_emitida_id  uuid NOT NULL REFERENCES public.notas_emitidas(id) ON DELETE CASCADE,
  email_para       text NOT NULL,
  status           text NOT NULL DEFAULT 'enviado',
  resend_id        text,
  erro             text,
  created_at       timestamptz DEFAULT now()
);
ALTER TABLE public.notas_email_envios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notas_email_own" ON public.notas_email_envios;
CREATE POLICY "notas_email_own" ON public.notas_email_envios FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
  OR empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
);

-- ============================================================
-- 10. CONTAS BANCÁRIAS & EXTRATO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contas_bancarias (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo              text CHECK (tipo IN ('conta_pj_factorone','corrente','poupanca','investimento')) DEFAULT 'corrente',
  banco_nome        text NOT NULL,
  banco             text,
  banco_codigo      text,
  agencia           text,
  numero_conta      text,
  digito            text,
  saldo             numeric(15,2) DEFAULT 0,
  saldo_disponivel  numeric(15,2) DEFAULT 0,
  saldo_bloqueado   numeric(15,2) DEFAULT 0,
  limite_pix        numeric(15,2) DEFAULT 0,
  is_principal      boolean DEFAULT false,
  open_finance_id   text,
  status            text CHECK (status IN ('ativa','inativa','pendente','bloqueada')) DEFAULT 'ativa',
  created_at        timestamptz DEFAULT now()
);
ALTER TABLE public.contas_bancarias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios veem proprias contas" ON public.contas_bancarias;
CREATE POLICY "usuarios veem proprias contas" ON public.contas_bancarias FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
);

CREATE TABLE IF NOT EXISTS public.extrato_bancario (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id            uuid REFERENCES public.contas_bancarias(id) ON DELETE CASCADE,
  empresa_id          uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  descricao           text NOT NULL,
  valor               numeric(15,2) NOT NULL,
  tipo                text CHECK (tipo IN ('credito','debito')) NOT NULL,
  categoria           text DEFAULT 'Outros',
  data_transacao      timestamptz NOT NULL DEFAULT now(),
  data_compensacao    date,
  saldo_apos          numeric(15,2),
  tipo_operacao       text CHECK (tipo_operacao IN ('pix','ted','doc','boleto','cartao','tarifa','rendimento','transferencia','outros')) DEFAULT 'outros',
  contraparte_nome    text,
  contraparte_documento text,
  contraparte_banco   text,
  chave_pix           text,
  comprovante_url     text,
  conciliado          boolean DEFAULT false,
  transaction_id      uuid REFERENCES public.transacoes(id),
  created_at          timestamptz DEFAULT now()
);
ALTER TABLE public.extrato_bancario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios veem proprio extrato" ON public.extrato_bancario;
CREATE POLICY "usuarios veem proprio extrato" ON public.extrato_bancario FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
);

CREATE TABLE IF NOT EXISTS public.investimentos (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id            uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  conta_id              uuid REFERENCES public.contas_bancarias(id),
  tipo                  text CHECK (tipo IN ('cdi','cdb','lci','lca','tesouro_direto','fundos','acoes','outros')) NOT NULL,
  nome                  text NOT NULL,
  valor_aplicado        numeric(15,2) NOT NULL,
  valor_atual           numeric(15,2) NOT NULL,
  rentabilidade_contratada numeric(8,4),
  percentual_cdi        numeric(8,4),
  data_aplicacao        date NOT NULL,
  data_vencimento       date,
  status                text CHECK (status IN ('ativo','vencido','resgatado')) DEFAULT 'ativo',
  rendimento_total      numeric(15,2) GENERATED ALWAYS AS (valor_atual - valor_aplicado) STORED,
  created_at            timestamptz DEFAULT now()
);
ALTER TABLE public.investimentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios veem proprios investimentos" ON public.investimentos;
CREATE POLICY "usuarios veem proprios investimentos" ON public.investimentos FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
);

CREATE TABLE IF NOT EXISTS public.transferencias_agendadas (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id            uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  conta_origem_id       uuid REFERENCES public.contas_bancarias(id),
  tipo                  text CHECK (tipo IN ('pix','ted','doc','boleto')) NOT NULL,
  valor                 numeric(15,2) NOT NULL,
  destinatario_nome     text NOT NULL,
  destinatario_documento text,
  destinatario_banco    text,
  destinatario_agencia  text,
  destinatario_conta    text,
  chave_pix             text,
  descricao             text,
  data_agendada         date NOT NULL,
  status                text CHECK (status IN ('agendado','processando','concluido','cancelado','erro')) DEFAULT 'agendado',
  created_at            timestamptz DEFAULT now()
);
ALTER TABLE public.transferencias_agendadas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios veem proprias transferencias" ON public.transferencias_agendadas;
CREATE POLICY "usuarios veem proprias transferencias" ON public.transferencias_agendadas FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
);

-- ============================================================
-- 11. CENTROS DE CUSTO & CATEGORIAS & POLÍTICAS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.centros_custo (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome             text NOT NULL,
  codigo           text,
  orcamento_mensal numeric(15,2) DEFAULT 0,
  cor              text DEFAULT '#3B82F6',
  ativo            boolean DEFAULT true,
  created_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_centros_custo_empresa ON public.centros_custo(empresa_id);
ALTER TABLE public.centros_custo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios veem proprios centros" ON public.centros_custo;
CREATE POLICY "usuarios veem proprios centros" ON public.centros_custo FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
  OR empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
) WITH CHECK (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
  OR empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
);

-- Adicionar FK de despesas.centro_custo_id agora que centros_custo existe
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'despesas_centro_custo_fkey') THEN
    ALTER TABLE public.despesas ADD CONSTRAINT despesas_centro_custo_fkey
      FOREIGN KEY (centro_custo_id) REFERENCES public.centros_custo(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.categorias_despesa (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome       text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (empresa_id, nome)
);
CREATE INDEX IF NOT EXISTS idx_categorias_despesa_empresa ON public.categorias_despesa(empresa_id);
ALTER TABLE public.categorias_despesa ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios veem categorias despesas" ON public.categorias_despesa;
CREATE POLICY "usuarios veem categorias despesas" ON public.categorias_despesa FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
  OR empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
) WITH CHECK (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
  OR empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
);

CREATE TABLE IF NOT EXISTS public.politicas_gastos (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id                uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  categoria                 text NOT NULL,
  limite_por_transacao      numeric(15,2),
  limite_mensal             numeric(15,2),
  requer_aprovacao_acima    numeric(15,2) DEFAULT 0,
  requer_comprovante_acima  numeric(15,2) DEFAULT 50,
  aprovadores               jsonb DEFAULT '[]',
  ativo                     boolean DEFAULT true,
  created_at                timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_politicas_gastos_empresa ON public.politicas_gastos(empresa_id);
ALTER TABLE public.politicas_gastos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios veem proprias politicas" ON public.politicas_gastos;
CREATE POLICY "usuarios veem proprias politicas" ON public.politicas_gastos FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
);

-- ============================================================
-- 12. CONTAS A PAGAR / RECEBER
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contas_pagar (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  descricao           text NOT NULL,
  fornecedor_nome     text NOT NULL,
  fornecedor_documento text,
  categoria           text DEFAULT 'Outros',
  centro_custo_id     uuid REFERENCES public.centros_custo(id),
  valor               numeric(15,2) NOT NULL,
  valor_pago          numeric(15,2) DEFAULT 0,
  data_emissao        date DEFAULT CURRENT_DATE,
  data_vencimento     date NOT NULL,
  data_pagamento      date,
  tipo_pagamento      text CHECK (tipo_pagamento IN ('pix','ted','boleto','cartao','dinheiro','outro')),
  codigo_barras       text,
  chave_pix           text,
  status              text CHECK (status IN ('pendente','vencida','paga','parcialmente_paga','cancelada')) DEFAULT 'pendente',
  recorrente          boolean DEFAULT false,
  recorrencia_tipo    text CHECK (recorrencia_tipo IN ('semanal','mensal','trimestral','anual')),
  recorrencia_proxima date,
  observacoes         text,
  comprovante_url     text,
  extrato_id          uuid REFERENCES public.extrato_bancario(id),
  transaction_id      uuid REFERENCES public.transacoes(id),
  parcelas            int DEFAULT 1,
  parcela_atual       int DEFAULT 1,
  parcela_pai_id      uuid REFERENCES public.contas_pagar(id),
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_empresa_venc ON public.contas_pagar(empresa_id, data_vencimento);
ALTER TABLE public.contas_pagar ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios veem proprias contas_pagar" ON public.contas_pagar;
CREATE POLICY "usuarios veem proprias contas_pagar" ON public.contas_pagar FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
);

CREATE TABLE IF NOT EXISTS public.contas_receber (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  descricao           text NOT NULL,
  cliente_nome        text NOT NULL,
  cliente_documento   text,
  cliente_email       text,
  categoria           text DEFAULT 'Receita Operacional',
  valor               numeric(15,2) NOT NULL,
  valor_recebido      numeric(15,2) DEFAULT 0,
  data_emissao        date DEFAULT CURRENT_DATE,
  data_vencimento     date NOT NULL,
  data_recebimento    date,
  tipo_cobranca       text CHECK (tipo_cobranca IN ('boleto','pix','cartao','transferencia','dinheiro','outro')),
  chave_pix_cobranca  text,
  link_pagamento      text,
  status              text CHECK (status IN ('pendente','vencida','recebida','parcialmente_recebida','cancelada','protestada')) DEFAULT 'pendente',
  nota_fiscal_id      uuid REFERENCES public.notas_emitidas(id),
  recorrente          boolean DEFAULT false,
  recorrencia_tipo    text CHECK (recorrencia_tipo IN ('semanal','mensal','trimestral','anual')),
  recorrencia_proxima date,
  dias_atraso         int NOT NULL DEFAULT 0,
  juros_mora          numeric(5,4) DEFAULT 0.0033,
  multa               numeric(5,4) DEFAULT 0.02,
  observacoes         text,
  extrato_id          uuid REFERENCES public.extrato_bancario(id),
  transaction_id      uuid REFERENCES public.transacoes(id),
  parcelas            int DEFAULT 1,
  parcela_atual       int DEFAULT 1,
  parcela_pai_id      uuid REFERENCES public.contas_receber(id),
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contas_receber_empresa_venc ON public.contas_receber(empresa_id, data_vencimento);
ALTER TABLE public.contas_receber ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios veem proprias contas_receber" ON public.contas_receber;
CREATE POLICY "usuarios veem proprias contas_receber" ON public.contas_receber FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
);

-- Trigger dias_atraso
CREATE OR REPLACE FUNCTION public.trg_contas_receber_dias_atraso()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('recebida','cancelada') THEN
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
  FOR EACH ROW EXECUTE FUNCTION public.trg_contas_receber_dias_atraso();

CREATE TABLE IF NOT EXISTS public.reguas_cobranca (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome          text NOT NULL DEFAULT 'Régua Padrão',
  ativo         boolean DEFAULT true,
  notificacoes  jsonb DEFAULT '[
    {"dias": -3, "canal": "email", "mensagem": "Lembrete: vencimento em 3 dias"},
    {"dias": -1, "canal": "email", "mensagem": "Lembrete: vencimento amanhã"},
    {"dias": 0,  "canal": "email", "mensagem": "Hoje é o dia do vencimento"},
    {"dias": 1,  "canal": "email", "mensagem": "Vencimento ontem - pagamento pendente"},
    {"dias": 5,  "canal": "email", "mensagem": "5 dias em atraso"},
    {"dias": 15, "canal": "email", "mensagem": "15 dias em atraso - contato urgente"}
  ]',
  created_at    timestamptz DEFAULT now()
);
ALTER TABLE public.reguas_cobranca ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios veem proprias reguas" ON public.reguas_cobranca;
CREATE POLICY "usuarios veem proprias reguas" ON public.reguas_cobranca FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
);

CREATE TABLE IF NOT EXISTS public.log_cobrancas (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_receber_id uuid REFERENCES public.contas_receber(id),
  empresa_id       uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  canal            text CHECK (canal IN ('email','whatsapp','sms')) NOT NULL,
  destinatario     text NOT NULL,
  mensagem         text NOT NULL,
  status           text CHECK (status IN ('enviado','erro','pendente')) DEFAULT 'pendente',
  enviado_em       timestamptz DEFAULT now()
);
ALTER TABLE public.log_cobrancas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios veem proprios logs" ON public.log_cobrancas;
CREATE POLICY "usuarios veem proprios logs" ON public.log_cobrancas FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
);

CREATE TABLE IF NOT EXISTS public.conciliacoes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  conta_id     uuid REFERENCES public.contas_bancarias(id),
  extrato_id   uuid REFERENCES public.extrato_bancario(id),
  tipo_match   text CHECK (tipo_match IN ('conta_pagar','conta_receber','despesa','transaction','manual')),
  referencia_id uuid,
  confidence   numeric(5,4) DEFAULT 1.0,
  metodo       text CHECK (metodo IN ('exato','fuzzy','manual')) DEFAULT 'exato',
  criado_em    timestamptz DEFAULT now()
);
ALTER TABLE public.conciliacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios veem proprias conciliacoes" ON public.conciliacoes;
CREATE POLICY "usuarios veem proprias conciliacoes" ON public.conciliacoes FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
);

-- ============================================================
-- 13. PATRIMÔNIO & ATIVOS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.categorias_ativo (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome                text NOT NULL,
  vida_util_anos      int NOT NULL DEFAULT 5,
  metodo_depreciacao  text CHECK (metodo_depreciacao IN ('linear','acelerada','soma_digitos')) DEFAULT 'linear',
  taxa_anual          numeric(8,4),
  created_at          timestamptz DEFAULT now(),
  UNIQUE (empresa_id, nome)
);
ALTER TABLE public.categorias_ativo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios veem proprias categorias_ativo" ON public.categorias_ativo;
CREATE POLICY "usuarios veem proprias categorias_ativo" ON public.categorias_ativo FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.seed_categorias_ativo(p_empresa_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.categorias_ativo (empresa_id, nome, vida_util_anos, taxa_anual) VALUES
    (p_empresa_id, 'Veiculos', 5, 20.0),
    (p_empresa_id, 'Moveis e Utensilios', 10, 10.0),
    (p_empresa_id, 'Equipamentos de Informatica', 5, 20.0),
    (p_empresa_id, 'Maquinas e Equipamentos', 10, 10.0),
    (p_empresa_id, 'Instalacoes', 10, 10.0),
    (p_empresa_id, 'Edificacoes', 25, 4.0),
    (p_empresa_id, 'Software', 5, 20.0),
    (p_empresa_id, 'Ferramentas', 5, 20.0),
    (p_empresa_id, 'Equipamentos de Comunicacao', 5, 20.0),
    (p_empresa_id, 'Outros', 5, 20.0)
  ON CONFLICT (empresa_id, nome) DO NOTHING;
END;
$$ SECURITY DEFINER;

-- ============================================================
-- 14. PLANO DE CONTAS & DRE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.plano_contas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  codigo     text NOT NULL,
  nome       text NOT NULL,
  tipo       text CHECK (tipo IN ('receita','deducao','custo','despesa_operacional','despesa_financeira','imposto','ativo','passivo','patrimonio')) NOT NULL,
  parent_id  uuid REFERENCES public.plano_contas(id),
  nivel      int DEFAULT 1,
  ordem      int DEFAULT 0,
  ativo      boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (empresa_id, codigo)
);
ALTER TABLE public.plano_contas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios veem proprio plano" ON public.plano_contas;
CREATE POLICY "usuarios veem proprio plano" ON public.plano_contas FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
  OR empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
  OR empresa_id = auth.uid()
);

CREATE OR REPLACE FUNCTION public.seed_plano_contas(p_empresa_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.plano_contas (empresa_id, codigo, nome, tipo, nivel, ordem) VALUES
    (p_empresa_id, '1',   'RECEITA BRUTA',               'receita',              1, 1),
    (p_empresa_id, '1.1', 'Receita de Vendas',            'receita',              2, 1),
    (p_empresa_id, '1.2', 'Receita de Serviços',          'receita',              2, 2),
    (p_empresa_id, '1.3', 'Outras Receitas',              'receita',              2, 3),
    (p_empresa_id, '2',   'DEDUÇÕES DA RECEITA',          'deducao',              1, 2),
    (p_empresa_id, '2.1', 'Impostos sobre Vendas',        'deducao',              2, 1),
    (p_empresa_id, '2.2', 'Devoluções e Abatimentos',     'deducao',              2, 2),
    (p_empresa_id, '3',   'CUSTO DOS PRODUTOS/SERVIÇOS',  'custo',                1, 3),
    (p_empresa_id, '3.1', 'CMV',                          'custo',                2, 1),
    (p_empresa_id, '3.2', 'CSP',                          'custo',                2, 2),
    (p_empresa_id, '4',   'DESPESAS OPERACIONAIS',        'despesa_operacional',  1, 4),
    (p_empresa_id, '4.1', 'Despesas Administrativas',     'despesa_operacional',  2, 1),
    (p_empresa_id, '4.2', 'Despesas Comerciais',          'despesa_operacional',  2, 2),
    (p_empresa_id, '4.3', 'Despesas com Pessoal',         'despesa_operacional',  2, 3),
    (p_empresa_id, '4.4', 'Despesas de Marketing',        'despesa_operacional',  2, 4),
    (p_empresa_id, '4.5', 'Depreciação e Amortização',    'despesa_operacional',  2, 5),
    (p_empresa_id, '5',   'RESULTADO FINANCEIRO',         'despesa_financeira',   1, 5),
    (p_empresa_id, '5.1', 'Receitas Financeiras',         'despesa_financeira',   2, 1),
    (p_empresa_id, '5.2', 'Despesas Financeiras',         'despesa_financeira',   2, 2),
    (p_empresa_id, '6',   'IMPOSTOS',                     'imposto',              1, 6),
    (p_empresa_id, '6.1', 'IR e CSLL',                    'imposto',              2, 1),
    (p_empresa_id, '6.2', 'Simples Nacional',             'imposto',              2, 2)
  ON CONFLICT (empresa_id, codigo) DO NOTHING;
END;
$$;

CREATE TABLE IF NOT EXISTS public.lancamentos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  conta_id       uuid REFERENCES public.plano_contas(id),
  descricao      text NOT NULL,
  valor          numeric(15,2) NOT NULL,
  tipo           text CHECK (tipo IN ('debito','credito')) NOT NULL,
  competencia    date NOT NULL,
  transaction_id uuid REFERENCES public.transacoes(id),
  despesa_id     uuid REFERENCES public.despesas(id),
  nota_id        uuid REFERENCES public.notas_emitidas(id),
  origem         text CHECK (origem IN ('manual','nfe','despesa','transacao','importacao')) DEFAULT 'manual',
  created_at     timestamptz DEFAULT now()
);
ALTER TABLE public.lancamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios veem proprios lancamentos" ON public.lancamentos;
CREATE POLICY "usuarios veem proprios lancamentos" ON public.lancamentos FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
  OR empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
  OR empresa_id = auth.uid()
);

CREATE TABLE IF NOT EXISTS public.metricas_financeiras (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id            uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  competencia           date NOT NULL,
  receita_bruta         numeric(15,2) DEFAULT 0,
  deducoes              numeric(15,2) DEFAULT 0,
  receita_liquida       numeric(15,2) DEFAULT 0,
  cmv                   numeric(15,2) DEFAULT 0,
  lucro_bruto           numeric(15,2) DEFAULT 0,
  despesas_operacionais numeric(15,2) DEFAULT 0,
  ebitda                numeric(15,2) DEFAULT 0,
  depreciacao           numeric(15,2) DEFAULT 0,
  ebit                  numeric(15,2) DEFAULT 0,
  resultado_financeiro  numeric(15,2) DEFAULT 0,
  lair                  numeric(15,2) DEFAULT 0,
  impostos              numeric(15,2) DEFAULT 0,
  lucro_liquido         numeric(15,2) DEFAULT 0,
  margem_bruta          numeric(8,4) DEFAULT 0,
  margem_ebitda         numeric(8,4) DEFAULT 0,
  margem_liquida        numeric(8,4) DEFAULT 0,
  roi                   numeric(8,4) DEFAULT 0,
  roic                  numeric(8,4) DEFAULT 0,
  roce                  numeric(8,4) DEFAULT 0,
  capital_investido     numeric(15,2) DEFAULT 0,
  capital_empregado     numeric(15,2) DEFAULT 0,
  updated_at            timestamptz DEFAULT now(),
  UNIQUE (empresa_id, competencia)
);
ALTER TABLE public.metricas_financeiras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios veem proprias metricas" ON public.metricas_financeiras;
CREATE POLICY "usuarios veem proprias metricas" ON public.metricas_financeiras FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
  OR empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
  OR empresa_id = auth.uid()
);

-- ============================================================
-- 15. ORÇAMENTO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.orcamentos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome            text NOT NULL,
  ano_fiscal      int NOT NULL,
  status          text CHECK (status IN ('rascunho','em_aprovacao','aprovado','ativo','encerrado')) DEFAULT 'rascunho',
  total_previsto  numeric(15,2) DEFAULT 0,
  total_realizado numeric(15,2) DEFAULT 0,
  versao          int DEFAULT 1,
  criado_por      uuid REFERENCES auth.users(id),
  aprovado_por    uuid REFERENCES auth.users(id),
  aprovado_em     timestamptz,
  observacoes     text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (empresa_id, ano_fiscal, versao)
);
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios veem proprios orcamentos" ON public.orcamentos;
CREATE POLICY "usuarios veem proprios orcamentos" ON public.orcamentos FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
);

CREATE TABLE IF NOT EXISTS public.orcamento_linhas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id    uuid REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  empresa_id      uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  categoria       text NOT NULL,
  centro_custo_id uuid REFERENCES public.centros_custo(id),
  mes             int CHECK (mes BETWEEN 1 AND 12) NOT NULL,
  ano             int NOT NULL,
  valor_previsto  numeric(15,2) NOT NULL DEFAULT 0,
  valor_realizado numeric(15,2) DEFAULT 0,
  variacao        numeric(15,2) GENERATED ALWAYS AS (valor_previsto - valor_realizado) STORED,
  variacao_pct    numeric(8,4) GENERATED ALWAYS AS (
    CASE WHEN valor_previsto > 0 THEN ((valor_previsto - valor_realizado) / valor_previsto) * 100 ELSE 0 END
  ) STORED,
  alerta_enviado  boolean DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (orcamento_id, categoria, mes, centro_custo_id)
);
ALTER TABLE public.orcamento_linhas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios veem proprias linhas" ON public.orcamento_linhas;
CREATE POLICY "usuarios veem proprias linhas" ON public.orcamento_linhas FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
);

CREATE TABLE IF NOT EXISTS public.suplementacoes (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_linha_id   uuid REFERENCES public.orcamento_linhas(id),
  empresa_id           uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  valor_solicitado     numeric(15,2) NOT NULL,
  justificativa        text NOT NULL,
  status               text CHECK (status IN ('pendente','aprovado','rejeitado')) DEFAULT 'pendente',
  solicitado_por       uuid REFERENCES auth.users(id),
  aprovado_por         uuid REFERENCES auth.users(id),
  aprovado_em          timestamptz,
  created_at           timestamptz DEFAULT now()
);
ALTER TABLE public.suplementacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios veem proprias suplementacoes" ON public.suplementacoes;
CREATE POLICY "usuarios veem proprias suplementacoes" ON public.suplementacoes FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
);

CREATE TABLE IF NOT EXISTS public.alertas_orcamento (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  orcamento_linha_id  uuid REFERENCES public.orcamento_linhas(id),
  tipo                text CHECK (tipo IN ('alerta_80','alerta_100','estouro','tendencia_estouro')) NOT NULL,
  percentual_consumido numeric(8,4),
  valor_previsto      numeric(15,2),
  valor_realizado     numeric(15,2),
  lido                boolean DEFAULT false,
  created_at          timestamptz DEFAULT now()
);
ALTER TABLE public.alertas_orcamento ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios veem proprios alertas" ON public.alertas_orcamento;
CREATE POLICY "usuarios veem proprios alertas" ON public.alertas_orcamento FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
);

-- ============================================================
-- 16. ATIVOS & DEPRECIAÇÃO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ativos (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id              uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  categoria_id            uuid REFERENCES public.categorias_ativo(id),
  nome                    text NOT NULL,
  descricao               text,
  codigo_interno          text,
  numero_serie            text,
  fornecedor              text,
  nota_fiscal             text,
  data_aquisicao          date NOT NULL,
  data_inicio_depreciacao date NOT NULL,
  valor_aquisicao         numeric(15,2) NOT NULL,
  valor_residual          numeric(15,2) DEFAULT 0,
  vida_util_anos          int NOT NULL DEFAULT 5,
  metodo_depreciacao      text CHECK (metodo_depreciacao IN ('linear','acelerada','soma_digitos')) DEFAULT 'linear',
  depreciacao_acumulada   numeric(15,2) DEFAULT 0,
  valor_contabil          numeric(15,2) GENERATED ALWAYS AS (valor_aquisicao - depreciacao_acumulada) STORED,
  localizacao             text,
  responsavel_nome        text,
  responsavel_id          uuid REFERENCES auth.users(id),
  status                  text CHECK (status IN ('ativo','em_manutencao','baixado','alienado','perdido')) DEFAULT 'ativo',
  data_baixa              date,
  motivo_baixa            text,
  valor_baixa             numeric(15,2),
  qr_code                 text UNIQUE DEFAULT gen_random_uuid()::text,
  foto_url                text,
  observacoes             text,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);
ALTER TABLE public.ativos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios veem proprios ativos" ON public.ativos;
CREATE POLICY "usuarios veem proprios ativos" ON public.ativos FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
);

CREATE TABLE IF NOT EXISTS public.depreciacoes (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ativo_id                   uuid REFERENCES public.ativos(id) ON DELETE CASCADE,
  empresa_id                 uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  competencia                date NOT NULL,
  valor_depreciacao          numeric(15,2) NOT NULL,
  valor_contabil_antes       numeric(15,2) NOT NULL,
  valor_contabil_apos        numeric(15,2) NOT NULL,
  depreciacao_acumulada_apos numeric(15,2) NOT NULL,
  lancamento_id              uuid REFERENCES public.lancamentos(id),
  created_at                 timestamptz DEFAULT now(),
  UNIQUE (ativo_id, competencia)
);
ALTER TABLE public.depreciacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios veem proprias depreciacoes" ON public.depreciacoes;
CREATE POLICY "usuarios veem proprias depreciacoes" ON public.depreciacoes FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
);

CREATE TABLE IF NOT EXISTS public.manutencoes_ativo (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ativo_id          uuid REFERENCES public.ativos(id) ON DELETE CASCADE,
  empresa_id        uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo              text CHECK (tipo IN ('preventiva','corretiva','revisao','instalacao')) NOT NULL,
  descricao         text NOT NULL,
  custo             numeric(15,2) DEFAULT 0,
  fornecedor        text,
  data_manutencao   date NOT NULL DEFAULT CURRENT_DATE,
  proxima_manutencao date,
  created_at        timestamptz DEFAULT now()
);
ALTER TABLE public.manutencoes_ativo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios veem proprias manutencoes" ON public.manutencoes_ativo;
CREATE POLICY "usuarios veem proprias manutencoes" ON public.manutencoes_ativo FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
);

-- ============================================================
-- 17. REEMBOLSOS & LIFEOS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reembolsos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  solicitante_id   uuid REFERENCES auth.users(id),
  solicitante_nome text,
  descricao        text NOT NULL,
  valor            numeric NOT NULL CHECK (valor > 0),
  categoria        text DEFAULT 'Outros',
  data_despesa     date,
  status           text DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','rejeitado','pago')),
  comprovante_url  text,
  observacao       text,
  aprovado_por     uuid,
  aprovado_em      timestamptz,
  rejeitado_motivo text,
  pago_em          timestamptz,
  transaction_id   uuid,
  created_at       timestamptz DEFAULT now()
);
ALTER TABLE public.reembolsos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reembolsos_empresa" ON public.reembolsos;
CREATE POLICY "reembolsos_empresa" ON public.reembolsos FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
);

CREATE TABLE IF NOT EXISTS public.lifeos_interacoes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  origem           text DEFAULT 'api',
  mensagem_usuario text,
  resposta_ia      text,
  created_at       timestamptz DEFAULT now()
);
ALTER TABLE public.lifeos_interacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lifeos_empresa" ON public.lifeos_interacoes;
CREATE POLICY "lifeos_empresa" ON public.lifeos_interacoes FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
);

-- ============================================================
-- 18. OCR & CARTÕES & CONTADORES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.recibos_fotografados (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id         uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id            uuid REFERENCES auth.users(id),
  imagem_url         text NOT NULL,
  status             text CHECK (status IN ('processando','extraido','classificado','lancado','erro')) DEFAULT 'processando',
  origem             text DEFAULT 'upload',
  fornecedor_extraido   text,
  cnpj_extraido         text,
  valor_extraido        numeric(15,2),
  data_extraida         date,
  categoria_sugerida    text,
  confianca_ocr         numeric(4,3),
  texto_bruto           text,
  fornecedor_confirmado text,
  valor_confirmado      numeric(15,2),
  data_confirmada       date,
  categoria_confirmada  text,
  despesa_id         uuid REFERENCES public.despesas(id) ON DELETE SET NULL,
  created_at         timestamptz DEFAULT now()
);
ALTER TABLE public.recibos_fotografados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "recibos_foto_rls" ON public.recibos_fotografados;
CREATE POLICY "recibos_foto_rls" ON public.recibos_fotografados FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
  OR empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
);

CREATE TABLE IF NOT EXISTS public.solicitacoes_cartao (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  solicitante_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  nome_cartao      text NOT NULL,
  setor            text,
  limite_sugerido  numeric(15,2) DEFAULT 0,
  status           text CHECK (status IN ('pendente','aprovado','rejeitado')) DEFAULT 'pendente',
  observacao       text,
  created_at       timestamptz DEFAULT now()
);
ALTER TABLE public.solicitacoes_cartao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "solicitacoes_cartao_rls" ON public.solicitacoes_cartao;
CREATE POLICY "solicitacoes_cartao_rls" ON public.solicitacoes_cartao FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
  OR empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
);

CREATE TABLE IF NOT EXISTS public.contadores (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome         text NOT NULL,
  email        text,
  token_acesso text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  status       text CHECK (status IN ('ativo','revogado')) DEFAULT 'ativo',
  permissoes   jsonb DEFAULT '{"ver_dre":true,"ver_lancamentos":true,"ver_notas":true,"ver_despesas":true,"exportar":true}'::jsonb,
  updated_at   timestamptz DEFAULT now(),
  created_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contadores_token   ON public.contadores(token_acesso);
CREATE INDEX IF NOT EXISTS idx_contadores_empresa  ON public.contadores(empresa_id, status);
ALTER TABLE public.contadores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contadores_rls" ON public.contadores;
CREATE POLICY "contadores_rls" ON public.contadores FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
  OR empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
);
DROP POLICY IF EXISTS "contadores_public_read" ON public.contadores;
CREATE POLICY "contadores_public_read" ON public.contadores FOR SELECT TO anon, authenticated
  USING (status = 'ativo');

-- ============================================================
-- 19. PERFIL USUÁRIO PESSOAL
-- ============================================================
CREATE TABLE IF NOT EXISTS public.perfil_usuario (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  tipo                 text CHECK (tipo IN ('empresarial','pessoal')) DEFAULT 'empresarial',
  nome_completo        text,
  cpf                  text,
  profissao            text,
  renda_mensal         numeric(15,2),
  objetivo_financeiro  text,
  created_at           timestamptz DEFAULT now()
);
ALTER TABLE public.perfil_usuario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuario ve proprio perfil" ON public.perfil_usuario;
CREATE POLICY "usuario ve proprio perfil" ON public.perfil_usuario FOR ALL USING (user_id = auth.uid());

-- ============================================================
-- 20. EXPORTAÇÕES CONTÁBEIS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.exportacoes_contabeis (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo          text CHECK (tipo IN ('sped_contabil','ecd','ecf','dre_pdf','balancete','livro_caixa','xml_nfe_lote','csv_lancamentos')) NOT NULL,
  periodo_inicio date,
  periodo_fim    date,
  arquivo_url   text,
  status        text CHECK (status IN ('gerando','pronto','erro')) DEFAULT 'gerando',
  created_at    timestamptz DEFAULT now()
);
ALTER TABLE public.exportacoes_contabeis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "empresa ve proprias exportacoes" ON public.exportacoes_contabeis;
CREATE POLICY "empresa ve proprias exportacoes" ON public.exportacoes_contabeis FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
);

-- ============================================================
-- 21. INTEGRAÇOES CONFIG
-- ============================================================
CREATE TABLE IF NOT EXISTS public.integracoes_config (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  sistema       text NOT NULL,
  status        text CHECK (status IN ('aguardando_configuracao','configurado','sincronizando','sincronizado','erro')) DEFAULT 'aguardando_configuracao',
  api_key_enc   text,
  ultimo_sync_em timestamptz,
  ultimo_erro   text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (empresa_id, sistema)
);
ALTER TABLE public.integracoes_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "empresa ve integracoes config" ON public.integracoes_config;
CREATE POLICY "empresa ve integracoes config" ON public.integracoes_config FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
);

-- ============================================================
-- 22. STORAGE BUCKETS
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('comprovantes','comprovantes',false,10485760,ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('recibos','recibos',false,10485760,ARRAY['image/jpeg','image/png','image/webp','image/gif','application/pdf'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('exportacoes','exportacoes',false)
ON CONFLICT (id) DO NOTHING;

-- Policies storage
DROP POLICY IF EXISTS "comprovantes_upload" ON storage.objects;
CREATE POLICY "comprovantes_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'comprovantes');

DROP POLICY IF EXISTS "comprovantes_read" ON storage.objects;
CREATE POLICY "comprovantes_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'comprovantes');

DROP POLICY IF EXISTS "comprovantes_delete" ON storage.objects;
CREATE POLICY "comprovantes_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'comprovantes');

DROP POLICY IF EXISTS "recibos_upload" ON storage.objects;
CREATE POLICY "recibos_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'recibos');

DROP POLICY IF EXISTS "recibos_read" ON storage.objects;
CREATE POLICY "recibos_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'recibos');

DROP POLICY IF EXISTS "recibos_delete" ON storage.objects;
CREATE POLICY "recibos_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'recibos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- 23. FUNÇÕES SEED & TRIGGERS
-- ============================================================

-- Seed categorias despesa
CREATE OR REPLACE FUNCTION public.seed_categorias_despesa_nova_empresa()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.categorias_despesa (empresa_id, nome)
  VALUES
    (NEW.id,'Alimentação'),(NEW.id,'Transporte'),(NEW.id,'Hospedagem'),
    (NEW.id,'Tecnologia/Software'),(NEW.id,'Marketing'),(NEW.id,'Fornecedores'),
    (NEW.id,'Folha de Pagamento'),(NEW.id,'Impostos/Taxas'),(NEW.id,'Aluguel/Infraestrutura'),
    (NEW.id,'Consultoria'),(NEW.id,'Material de Escritório'),(NEW.id,'Outros')
  ON CONFLICT (empresa_id, nome) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_seed_categorias_despesa ON public.empresas;
CREATE TRIGGER trg_seed_categorias_despesa AFTER INSERT ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.seed_categorias_despesa_nova_empresa();

-- Seed plano de contas
CREATE OR REPLACE FUNCTION public.trigger_seed_plano_contas()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM public.seed_plano_contas(NEW.id);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_empresa_created_plano ON public.empresas;
CREATE TRIGGER on_empresa_created_plano AFTER INSERT ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.trigger_seed_plano_contas();

-- Seed categorias ativo
CREATE OR REPLACE FUNCTION public.trigger_seed_categorias_ativo()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM public.seed_categorias_ativo(NEW.id);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_empresa_created_ativo ON public.empresas;
CREATE TRIGGER on_empresa_created_ativo AFTER INSERT ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.trigger_seed_categorias_ativo();

-- Seed orçamento anual
CREATE OR REPLACE FUNCTION public.trigger_seed_orcamento()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.orcamentos (empresa_id, nome, ano_fiscal, status, versao)
  VALUES (NEW.id, 'Orçamento ' || EXTRACT(YEAR FROM NOW())::text, EXTRACT(YEAR FROM NOW())::int, 'ativo', 1)
  ON CONFLICT (empresa_id, ano_fiscal, versao) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_empresa_created_orcamento ON public.empresas;
CREATE TRIGGER on_empresa_created_orcamento AFTER INSERT ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.trigger_seed_orcamento();

-- Auto-criar empresa + usuario ao cadastrar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  VALUES (COALESCE(NEW.raw_user_meta_data->>'company_name', v_nome), NEW.id)
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
    INSERT INTO public.reguas_cobranca (empresa_id, nome)
    VALUES (v_empresa_id, 'Régua Padrão')
    ON CONFLICT DO NOTHING;
    INSERT INTO public.contas_bancarias (empresa_id, tipo, banco_nome, banco_codigo, saldo, saldo_disponivel, is_principal, status)
    VALUES (v_empresa_id, 'conta_pj_factorone', 'FactorOne Bank', '399', 0, 0, true, 'ativa')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 24. SEED DADOS INICIAIS para empresas existentes
-- ============================================================
INSERT INTO public.categorias_despesa (empresa_id, nome)
SELECT e.id, v.nome FROM public.empresas e
CROSS JOIN (VALUES
  ('Alimentação'),('Transporte'),('Hospedagem'),('Tecnologia/Software'),
  ('Marketing'),('Fornecedores'),('Folha de Pagamento'),('Impostos/Taxas'),
  ('Aluguel/Infraestrutura'),('Consultoria'),('Material de Escritório'),('Outros')
) AS v(nome)
ON CONFLICT (empresa_id, nome) DO NOTHING;

INSERT INTO public.reguas_cobranca (empresa_id, nome)
SELECT e.id, 'Régua Padrão' FROM public.empresas e
WHERE NOT EXISTS (SELECT 1 FROM public.reguas_cobranca r WHERE r.empresa_id = e.id);

INSERT INTO public.orcamentos (empresa_id, nome, ano_fiscal, status, versao)
SELECT id, 'Orçamento ' || EXTRACT(YEAR FROM NOW())::text, EXTRACT(YEAR FROM NOW())::int, 'ativo', 1
FROM public.empresas
ON CONFLICT (empresa_id, ano_fiscal, versao) DO NOTHING;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT e.id FROM public.empresas e
    WHERE NOT EXISTS (SELECT 1 FROM public.plano_contas p WHERE p.empresa_id = e.id)
  LOOP
    PERFORM public.seed_plano_contas(r.id);
  END LOOP;
  FOR r IN SELECT e.id FROM public.empresas e LOOP
    PERFORM public.seed_categorias_ativo(r.id);
  END LOOP;
END $$;
