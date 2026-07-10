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
--
-- ATENÇÃO: `transacoes` foi renomeada pra `transactions` numa migration
-- anterior (20260409_master_consolidation.sql) em alguns ambientes — hoje
-- `public.transacoes` pode ser só uma VIEW de leitura sobre `transactions`,
-- e ALTER TABLE ADD COLUMN falha em view. Este bloco acha a tabela FÍSICA
-- de verdade (relkind='r') entre os dois nomes possíveis e altera ela.
DO $$
DECLARE
  tbl_fisica text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'transacoes' AND c.relkind = 'r') THEN
    tbl_fisica := 'transacoes';
  ELSIF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'transactions' AND c.relkind = 'r') THEN
    tbl_fisica := 'transactions';
  ELSE
    RAISE EXCEPTION 'Nenhuma tabela física encontrada entre public.transacoes e public.transactions';
  END IF;

  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS origem_documento text', tbl_fisica);
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS documento_anexo_url text', tbl_fisica);
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS status_classificacao text', tbl_fisica);

  -- CHECK constraints separados (ADD COLUMN ... CHECK inline não é
  -- idempotente do jeito IF NOT EXISTS acima; roda à parte, protegido).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transacoes_origem_documento_chk') THEN
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT transacoes_origem_documento_chk CHECK (origem_documento IS NULL OR origem_documento IN (%L,%L,%L,%L))', tbl_fisica, 'foto', 'pdf', 'manual', 'open_finance');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transacoes_status_classificacao_chk') THEN
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT transacoes_status_classificacao_chk CHECK (status_classificacao IS NULL OR status_classificacao IN (%L,%L,%L))', tbl_fisica, 'sugerida', 'aguardando_ok', 'confirmada');
  END IF;
  EXECUTE format('ALTER TABLE public.%I ALTER COLUMN origem_documento SET DEFAULT %L', tbl_fisica, 'manual');
  EXECUTE format('ALTER TABLE public.%I ALTER COLUMN status_classificacao SET DEFAULT %L', tbl_fisica, 'confirmada');
END $$;

-- despesas e extrato_bancario não têm histórico de rename encontrado nas
-- migrations — mas usa o mesmo cinto-de-segurança (relkind='r') depois do
-- susto acima, pra não travar a migration inteira se algo parecido existir.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'despesas' AND c.relkind = 'r') THEN
    ALTER TABLE public.despesas
      ADD COLUMN IF NOT EXISTS origem_documento text,
      ADD COLUMN IF NOT EXISTS status_classificacao text;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'despesas_origem_documento_chk') THEN
      ALTER TABLE public.despesas ADD CONSTRAINT despesas_origem_documento_chk CHECK (origem_documento IS NULL OR origem_documento IN ('foto','pdf','manual','open_finance'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'despesas_status_classificacao_chk') THEN
      ALTER TABLE public.despesas ADD CONSTRAINT despesas_status_classificacao_chk CHECK (status_classificacao IS NULL OR status_classificacao IN ('sugerida','aguardando_ok','confirmada'));
    END IF;
    ALTER TABLE public.despesas ALTER COLUMN origem_documento SET DEFAULT 'manual';
    ALTER TABLE public.despesas ALTER COLUMN status_classificacao SET DEFAULT 'confirmada';
  ELSE
    RAISE NOTICE 'public.despesas não é tabela física (relkind != r) — pulei essa parte, confira manualmente';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'extrato_bancario' AND c.relkind = 'r') THEN
    ALTER TABLE public.extrato_bancario
      ADD COLUMN IF NOT EXISTS origem_documento text,
      ADD COLUMN IF NOT EXISTS status_classificacao text;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'extrato_bancario_origem_documento_chk') THEN
      ALTER TABLE public.extrato_bancario ADD CONSTRAINT extrato_bancario_origem_documento_chk CHECK (origem_documento IS NULL OR origem_documento IN ('foto','pdf','manual','open_finance'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'extrato_bancario_status_classificacao_chk') THEN
      ALTER TABLE public.extrato_bancario ADD CONSTRAINT extrato_bancario_status_classificacao_chk CHECK (status_classificacao IS NULL OR status_classificacao IN ('sugerida','aguardando_ok','confirmada'));
    END IF;
    ALTER TABLE public.extrato_bancario ALTER COLUMN origem_documento SET DEFAULT 'open_finance';
    ALTER TABLE public.extrato_bancario ALTER COLUMN status_classificacao SET DEFAULT 'confirmada';
  ELSE
    RAISE NOTICE 'public.extrato_bancario não é tabela física (relkind != r) — pulei essa parte, confira manualmente';
  END IF;
END $$;
