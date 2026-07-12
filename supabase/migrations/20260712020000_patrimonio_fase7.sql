-- Fase 7 (Patrimônio com IA de documentos) — evolui imoveis_detalhes (não
-- cria do zero, conforme a spec) e adiciona o motor de alíquota de ITBI
-- "lembrada" por cidade (mesmo princípio da regra aprendida da Fase 0).

ALTER TABLE public.imoveis_detalhes
  ADD COLUMN IF NOT EXISTS valor_aquisicao decimal(15,2),
  ADD COLUMN IF NOT EXISTS data_aquisicao date,
  ADD COLUMN IF NOT EXISTS vendido boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS valor_venda decimal(15,2),
  ADD COLUMN IF NOT EXISTS data_venda date,
  ADD COLUMN IF NOT EXISTS documento_path text;

-- Alíquota de ITBI confirmada pelo usuário, por cidade — o sistema NUNCA
-- adivinha a alíquota municipal (não há base pública confiável); sugere 2%
-- e lembra a resposta pra não perguntar de novo na mesma cidade.
CREATE TABLE IF NOT EXISTS public.itbi_aliquotas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   uuid NOT NULL,
  cidade       text NOT NULL,
  uf           text,
  aliquota_pct numeric(5,2) NOT NULL CHECK (aliquota_pct >= 0 AND aliquota_pct <= 10),
  created_at   timestamptz DEFAULT now(),
  UNIQUE (empresa_id, cidade, uf)
);
ALTER TABLE public.itbi_aliquotas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "itbi_aliquotas_select" ON public.itbi_aliquotas;
CREATE POLICY "itbi_aliquotas_select" ON public.itbi_aliquotas
  FOR SELECT USING (
    empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
    OR empresa_id = auth.uid()
  );
