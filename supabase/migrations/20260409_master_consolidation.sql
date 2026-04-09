-- Master consolidation (base)
-- 1) perfil_usuario
-- 2) despesas_pessoais
-- 3) contadores
-- 4) recibos_fotografados
-- 5) exportacoes_contabeis
-- 6) correcao segura transacoes -> transactions
-- 7) buckets de storage

CREATE TABLE IF NOT EXISTS public.perfil_usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  tipo text CHECK (tipo IN ('empresarial', 'pessoal')) DEFAULT 'empresarial',
  nome_completo text,
  cpf text,
  profissao text,
  renda_mensal decimal(15,2),
  objetivo_financeiro text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.perfil_usuario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuario ve proprio perfil" ON public.perfil_usuario;
CREATE POLICY "usuario ve proprio perfil" ON public.perfil_usuario
  FOR ALL USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.despesas_pessoais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  valor decimal(15,2) NOT NULL,
  categoria text NOT NULL DEFAULT 'Outros',
  data_despesa date NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento date,
  recorrente boolean DEFAULT false,
  recorrencia_tipo text CHECK (recorrencia_tipo IN ('semanal','mensal','trimestral','anual')),
  status text CHECK (status IN ('pendente','pago','vencido')) DEFAULT 'pendente',
  tipo_pagamento text,
  comprovante_url text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.despesas_pessoais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuario ve proprias despesas pessoais" ON public.despesas_pessoais;
CREATE POLICY "usuario ve proprias despesas pessoais" ON public.despesas_pessoais
  FOR ALL USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.contadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  email text NOT NULL UNIQUE,
  crc text,
  telefone text,
  status text CHECK (status IN ('convidado','ativo','suspenso')) DEFAULT 'convidado',
  token_acesso text UNIQUE DEFAULT gen_random_uuid()::text,
  permissoes jsonb DEFAULT '{
    "ver_lancamentos": true,
    "ver_comprovantes": true,
    "baixar_xmls": true,
    "corrigir_categorias": true,
    "exportar_sped": true,
    "ver_saldo": false,
    "mover_dinheiro": false,
    "ver_cartoes": false
  }'::jsonb,
  ultimo_acesso timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.contadores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "empresa ve seus contadores" ON public.contadores;
CREATE POLICY "empresa ve seus contadores" ON public.contadores
  FOR ALL USING (
    empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS public.recibos_fotografados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  imagem_url text NOT NULL,
  status text CHECK (status IN ('processando','extraido','classificado','lancado','erro')) DEFAULT 'processando',
  fornecedor_extraido text,
  cnpj_extraido text,
  valor_extraido decimal(15,2),
  data_extraida date,
  categoria_sugerida text,
  confianca_ocr decimal(5,4),
  texto_bruto text,
  fornecedor_confirmado text,
  valor_confirmado decimal(15,2),
  data_confirmada date,
  categoria_confirmada text,
  despesa_id uuid REFERENCES public.despesas(id),
  origem text CHECK (origem IN ('app','email','whatsapp','upload')) DEFAULT 'upload',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.recibos_fotografados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuario ve proprios recibos" ON public.recibos_fotografados;
CREATE POLICY "usuario ve proprios recibos" ON public.recibos_fotografados
  FOR ALL USING (
    empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS public.exportacoes_contabeis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo text CHECK (tipo IN (
    'sped_contabil','ecd','ecf','dre_pdf','balancete',
    'livro_caixa','xml_nfe_lote','csv_lancamentos'
  )) NOT NULL,
  periodo_inicio date,
  periodo_fim date,
  arquivo_url text,
  status text CHECK (status IN ('gerando','pronto','erro')) DEFAULT 'gerando',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.exportacoes_contabeis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "empresa ve proprias exportacoes" ON public.exportacoes_contabeis;
CREATE POLICY "empresa ve proprias exportacoes" ON public.exportacoes_contabeis
  FOR ALL USING (
    empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_name = 'transacoes'
      AND table_schema = 'public'
  ) AND NOT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_name = 'transactions'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.transacoes RENAME TO transactions;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_name = 'transacoes'
      AND table_schema = 'public'
  ) AND EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_name = 'transactions'
      AND table_schema = 'public'
  ) THEN
    EXECUTE 'CREATE VIEW public.transacoes AS SELECT * FROM public.transactions';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.contas_pagar') IS NOT NULL THEN
    BEGIN
      ALTER TABLE public.contas_pagar
      DROP CONSTRAINT IF EXISTS contas_pagar_transaction_id_fkey;
      ALTER TABLE public.contas_pagar
      ADD CONSTRAINT contas_pagar_transaction_id_fkey
      FOREIGN KEY (transaction_id) REFERENCES public.transactions(id);
    EXCEPTION WHEN undefined_table THEN
      NULL;
    END;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.contas_receber') IS NOT NULL THEN
    BEGIN
      ALTER TABLE public.contas_receber
      DROP CONSTRAINT IF EXISTS contas_receber_transaction_id_fkey;
      ALTER TABLE public.contas_receber
      ADD CONSTRAINT contas_receber_transaction_id_fkey
      FOREIGN KEY (transaction_id) REFERENCES public.transactions(id);
    EXCEPTION WHEN undefined_table THEN
      NULL;
    END;
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public)
SELECT 'recibos', 'recibos', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'recibos');

INSERT INTO storage.buckets (id, name, public)
SELECT 'comprovantes', 'comprovantes', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'comprovantes');

INSERT INTO storage.buckets (id, name, public)
SELECT 'exportacoes', 'exportacoes', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'exportacoes');

CREATE TABLE IF NOT EXISTS public.solicitacoes_cartao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  solicitante_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  nome_cartao text NOT NULL,
  setor text,
  limite_sugerido numeric(15,2) NOT NULL DEFAULT 0,
  status text CHECK (status IN ('pendente','aprovado','rejeitado')) DEFAULT 'pendente',
  observacao text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.solicitacoes_cartao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "empresa ve solicitacoes cartao" ON public.solicitacoes_cartao;
CREATE POLICY "empresa ve solicitacoes cartao" ON public.solicitacoes_cartao
  FOR ALL USING (
    empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS public.integracoes_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  sistema text NOT NULL,
  status text CHECK (status IN ('aguardando_configuracao','configurado','sincronizando','sincronizado','erro')) DEFAULT 'aguardando_configuracao',
  api_key_enc text,
  ultimo_sync_em timestamptz,
  ultimo_erro text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (empresa_id, sistema)
);
ALTER TABLE public.integracoes_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "empresa ve integracoes config" ON public.integracoes_config;
CREATE POLICY "empresa ve integracoes config" ON public.integracoes_config
  FOR ALL USING (
    empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
  );
