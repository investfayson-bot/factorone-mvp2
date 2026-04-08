-- Emissão NF-e / NFS-e (NFe.io) + integração financeira
-- empresa_id alinhado ao restante do FactorOne (auth.users)

CREATE TABLE IF NOT EXISTS public.notas_emitidas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('nfe', 'nfse')),
  numero TEXT,
  serie TEXT DEFAULT '1',
  chave_acesso TEXT UNIQUE,
  nfeio_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'processando' CHECK (
    status IN ('processando', 'autorizada', 'rejeitada', 'cancelada')
  ),
  destinatario_nome TEXT NOT NULL,
  destinatario_cnpj_cpf TEXT NOT NULL,
  destinatario_email TEXT,
  valor_total DECIMAL(15, 2) NOT NULL,
  valor_impostos DECIMAL(15, 2) DEFAULT 0,
  xml_url TEXT,
  pdf_url TEXT,
  transacao_id UUID REFERENCES public.transacoes (id) ON DELETE SET NULL,
  competencia DATE,
  cancelada_em TIMESTAMPTZ,
  cancelada_motivo TEXT,
  sefaz_motivo TEXT,
  raw_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notas_emitidas_empresa ON public.notas_emitidas (empresa_id);
CREATE INDEX IF NOT EXISTS idx_notas_emitidas_status ON public.notas_emitidas (status);
CREATE INDEX IF NOT EXISTS idx_notas_emitidas_created ON public.notas_emitidas (created_at DESC);

CREATE TABLE IF NOT EXISTS public.notas_email_envios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  nota_emitida_id UUID NOT NULL REFERENCES public.notas_emitidas (id) ON DELETE CASCADE,
  email_para TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'enviado',
  resend_id TEXT,
  erro TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notas_emitidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_email_envios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notas_emitidas_own" ON public.notas_emitidas;
CREATE POLICY "notas_emitidas_own" ON public.notas_emitidas FOR ALL
  USING (auth.uid() = empresa_id)
  WITH CHECK (auth.uid() = empresa_id);

DROP POLICY IF EXISTS "notas_email_own" ON public.notas_email_envios;
CREATE POLICY "notas_email_own" ON public.notas_email_envios FOR ALL
  USING (auth.uid() = empresa_id)
  WITH CHECK (auth.uid() = empresa_id);
