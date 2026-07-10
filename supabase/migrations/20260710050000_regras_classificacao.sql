-- Fase 0 (Parte B) — Motor de classificação de transações estilo QuickBooks.
-- Primeira vez que um estabelecimento aparece: IA sugere categoria (baixa
-- confiança, precisa correção/confirmação). Da segunda vez em diante: já
-- classifica sozinha, só esperando "OK" em lote. Regra nunca vaza entre
-- titularidades (PJ da empresa A não se aplica a PJ da empresa B nem à PF).

CREATE TABLE IF NOT EXISTS public.regras_classificacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  pessoa_fisica_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  estabelecimento_normalizado text NOT NULL,
  categoria text NOT NULL,
  confianca int NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT regras_classificacao_um_tipo_chk CHECK (
    (empresa_id IS NOT NULL AND pessoa_fisica_user_id IS NULL) OR
    (empresa_id IS NULL AND pessoa_fisica_user_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_regras_classificacao_empresa_unica
  ON public.regras_classificacao(empresa_id, estabelecimento_normalizado) WHERE empresa_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_regras_classificacao_pf_unica
  ON public.regras_classificacao(pessoa_fisica_user_id, estabelecimento_normalizado) WHERE pessoa_fisica_user_id IS NOT NULL;

ALTER TABLE public.regras_classificacao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "regras_classificacao_own" ON public.regras_classificacao;
CREATE POLICY "regras_classificacao_own" ON public.regras_classificacao FOR ALL
  USING (
    (empresa_id IS NOT NULL AND empresa_id IN (SELECT empresa_id FROM public.usuario_empresas WHERE user_id = auth.uid()))
    OR pessoa_fisica_user_id = auth.uid()
  )
  WITH CHECK (
    (empresa_id IS NOT NULL AND empresa_id IN (SELECT empresa_id FROM public.usuario_empresas WHERE user_id = auth.uid()))
    OR pessoa_fisica_user_id = auth.uid()
  );

-- Metadado de origem do lançamento + gancho pro OCR da Fase 3 (schema pronto
-- agora, preenchimento entra depois — evita alterar schema de novo então).
-- status_classificacao: 'sugerida' (IA chutou, baixa confiança, precisa
-- correção) | 'aguardando_ok' (regra aprendida aplicada, só falta confirmar
-- em lote) | 'confirmada' (usuário já bateu o OK, ou lançamento manual).
ALTER TABLE public.transacoes
  ADD COLUMN IF NOT EXISTS origem_documento text CHECK (origem_documento IS NULL OR origem_documento IN ('foto','pdf','manual','open_finance')) DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS documento_anexo_url text,
  ADD COLUMN IF NOT EXISTS status_classificacao text CHECK (status_classificacao IS NULL OR status_classificacao IN ('sugerida','aguardando_ok','confirmada')) DEFAULT 'confirmada';

ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS origem_documento text CHECK (origem_documento IS NULL OR origem_documento IN ('foto','pdf','manual','open_finance')) DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS status_classificacao text CHECK (status_classificacao IS NULL OR status_classificacao IN ('sugerida','aguardando_ok','confirmada')) DEFAULT 'confirmada';

ALTER TABLE public.extrato_bancario
  ADD COLUMN IF NOT EXISTS origem_documento text CHECK (origem_documento IS NULL OR origem_documento IN ('foto','pdf','manual','open_finance')) DEFAULT 'open_finance',
  ADD COLUMN IF NOT EXISTS status_classificacao text CHECK (status_classificacao IS NULL OR status_classificacao IN ('sugerida','aguardando_ok','confirmada')) DEFAULT 'confirmada';
