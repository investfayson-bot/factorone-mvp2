-- Cofre Fiscal (Fase 5, Bloco 2) — arquivo permanente de documentos
-- fiscais por empresa: guia paga, declaração protocolada, contrato,
-- procuração. É o "histórico de tudo que o contador fez" da spec.
--
-- Escrita SÓ via API (/api/cofre-fiscal, service role + gate de papel) —
-- sem policy de INSERT/UPDATE/DELETE pro client, seguindo o endurecimento
-- do Bloco 1. Leitura client-side escopada por empresa, mesmo padrão de
-- usuario/empresa das outras tabelas.

CREATE TABLE IF NOT EXISTS public.cofre_fiscal_documentos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL,
  tipo          text NOT NULL CHECK (tipo IN ('guia','declaracao','contrato','procuracao','outro')),
  nome          text NOT NULL,
  descricao     text,
  competencia   text CHECK (competencia IS NULL OR competencia ~ '^\d{4}-\d{2}$'),
  arquivo_path  text,
  criado_por    uuid,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cofre_fiscal_empresa ON public.cofre_fiscal_documentos (empresa_id, competencia);

ALTER TABLE public.cofre_fiscal_documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cofre_fiscal_select" ON public.cofre_fiscal_documentos;
CREATE POLICY "cofre_fiscal_select" ON public.cofre_fiscal_documentos
  FOR SELECT USING (
    empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
    OR empresa_id = auth.uid()
  );
