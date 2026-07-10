-- Sprint 8 Items 5+6 — Conta PJ onboarding + Links fornecedor
-- Rode no SQL Editor do Supabase

-- abertura_conta_pj: progresso do onboarding bancário
CREATE TABLE IF NOT EXISTS public.abertura_conta_pj (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL,
  cnpj        text,
  razao_social text,
  cnae        text,
  data_abertura date,
  socios      jsonb DEFAULT '[]',
  documentos  jsonb DEFAULT '{}',
  banco_escolhido text,
  etapa_atual int DEFAULT 1,
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(empresa_id)
);
ALTER TABLE public.abertura_conta_pj ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "abertura_conta_pj_rls" ON public.abertura_conta_pj;
CREATE POLICY "abertura_conta_pj_rls" ON public.abertura_conta_pj FOR ALL
  USING (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));

-- fornecedor_links: links únicos para fornecedores preencherem dados
CREATE TABLE IF NOT EXISTS public.fornecedor_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL,
  token       text NOT NULL UNIQUE,
  descricao   text,
  valor_sugerido decimal(15,2),
  data_vencimento_sugerida date,
  categoria   text DEFAULT 'Fornecedores',
  expires_at  timestamptz NOT NULL,
  status      text CHECK (status IN ('ativo','utilizado','expirado')) DEFAULT 'ativo',
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE public.fornecedor_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fornecedor_links_rls" ON public.fornecedor_links;
CREATE POLICY "fornecedor_links_rls" ON public.fornecedor_links FOR ALL
  USING (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));

-- Leitura pública por token (para o portal do fornecedor)
DROP POLICY IF EXISTS "fornecedor_links_public_read" ON public.fornecedor_links;
CREATE POLICY "fornecedor_links_public_read" ON public.fornecedor_links FOR SELECT
  USING (true);

-- Coluna origem em contas_pagar (para rastrear fonte) — deve vir ANTES da policy
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS origem text;

-- Escrita pública por token (fornecedor envia dados sem login)
DROP POLICY IF EXISTS "contas_pagar_portal_insert" ON public.contas_pagar;
CREATE POLICY "contas_pagar_portal_insert" ON public.contas_pagar FOR INSERT
  WITH CHECK (origem = 'portal_fornecedor');

CREATE INDEX IF NOT EXISTS idx_fornecedor_links_token ON public.fornecedor_links(token);
CREATE INDEX IF NOT EXISTS idx_fornecedor_links_empresa ON public.fornecedor_links(empresa_id);
