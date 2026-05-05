-- Sprint 5 — Fixes: storage buckets, tabelas, RLS
-- Rode no SQL Editor do Supabase

-- 1. Bucket 'recibos' para OCR de recibos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'recibos',
  'recibos',
  false,
  10485760,  -- 10MB
  ARRAY['image/jpeg','image/png','image/webp','image/gif','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Policies do bucket recibos
DROP POLICY IF EXISTS "recibos_upload" ON storage.objects;
CREATE POLICY "recibos_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'recibos');

DROP POLICY IF EXISTS "recibos_read" ON storage.objects;
CREATE POLICY "recibos_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'recibos');

DROP POLICY IF EXISTS "recibos_delete" ON storage.objects;
CREATE POLICY "recibos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'recibos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 2. Tabela recibos_fotografados (se não existir)
CREATE TABLE IF NOT EXISTS public.recibos_fotografados (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id         uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id            uuid REFERENCES auth.users(id),
  imagem_url         text NOT NULL,
  status             text CHECK (status IN ('processando','extraido','classificado','lancado','erro')) DEFAULT 'processando',
  origem             text DEFAULT 'upload',
  fornecedor_extraido text,
  cnpj_extraido      text,
  valor_extraido     decimal(15,2),
  data_extraida      date,
  categoria_sugerida text,
  confianca_ocr      decimal(4,3),
  texto_bruto        text,
  despesa_id         uuid REFERENCES public.despesas(id) ON DELETE SET NULL,
  created_at         timestamptz DEFAULT now()
);
ALTER TABLE public.recibos_fotografados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "recibos_foto_rls" ON public.recibos_fotografados;
CREATE POLICY "recibos_foto_rls" ON public.recibos_fotografados
  FOR ALL USING (
    empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
    OR empresa_id = auth.uid()
  );

-- 3. Tabela solicitacoes_cartao (para o módulo Cartões)
CREATE TABLE IF NOT EXISTS public.solicitacoes_cartao (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome_cartao      text NOT NULL,
  setor            text,
  limite_sugerido  decimal(15,2) DEFAULT 0,
  status           text CHECK (status IN ('pendente','aprovado','rejeitado')) DEFAULT 'pendente',
  created_at       timestamptz DEFAULT now()
);
ALTER TABLE public.solicitacoes_cartao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "solicitacoes_cartao_rls" ON public.solicitacoes_cartao;
CREATE POLICY "solicitacoes_cartao_rls" ON public.solicitacoes_cartao
  FOR ALL USING (
    empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
    OR empresa_id = auth.uid()
  );

-- 4. Tabela contadores (para Portal Contador)
CREATE TABLE IF NOT EXISTS public.contadores (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome          text NOT NULL,
  email         text,
  token_acesso  text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  status        text CHECK (status IN ('ativo','revogado')) DEFAULT 'ativo',
  permissoes    jsonb DEFAULT '{"ver_dre":true,"ver_lancamentos":true,"ver_notas":true,"ver_despesas":true,"exportar":true}'::jsonb,
  created_at    timestamptz DEFAULT now()
);
ALTER TABLE public.contadores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contadores_rls" ON public.contadores;
CREATE POLICY "contadores_rls" ON public.contadores
  FOR ALL USING (
    empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
    OR empresa_id = auth.uid()
  );
-- leitura pública por token (para portal externo)
DROP POLICY IF EXISTS "contadores_public_read" ON public.contadores;
CREATE POLICY "contadores_public_read" ON public.contadores
  FOR SELECT TO anon, authenticated
  USING (status = 'ativo');

-- 5. Coluna forma_pagamento em despesas (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='despesas' AND column_name='forma_pagamento'
  ) THEN
    ALTER TABLE public.despesas ADD COLUMN forma_pagamento text DEFAULT 'outro';
  END IF;
END $$;

-- 6. Índices de performance
CREATE INDEX IF NOT EXISTS idx_transacoes_empresa_data ON public.transacoes(empresa_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_despesas_empresa_status ON public.despesas(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_empresa_venc ON public.contas_pagar(empresa_id, data_vencimento);
CREATE INDEX IF NOT EXISTS idx_contas_receber_empresa_venc ON public.contas_receber(empresa_id, data_vencimento);
