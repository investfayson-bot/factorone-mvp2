-- Belvo → tabelas nativas: coluna de dedupe (belvo_tx_id) para sincronização idempotente.
-- Permite reimportar sem duplicar lançamentos no fluxo de caixa / DRE.

ALTER TABLE public.extrato_bancario  ADD COLUMN IF NOT EXISTS belvo_tx_id text;
ALTER TABLE public.despesas_pessoais ADD COLUMN IF NOT EXISTS belvo_tx_id text;
ALTER TABLE public.receitas_pessoais ADD COLUMN IF NOT EXISTS belvo_tx_id text;

-- Unicidade só quando preenchido (linhas manuais ficam livres).
CREATE UNIQUE INDEX IF NOT EXISTS uq_extrato_belvo_tx   ON public.extrato_bancario(belvo_tx_id)  WHERE belvo_tx_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_despesas_belvo_tx  ON public.despesas_pessoais(belvo_tx_id) WHERE belvo_tx_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_receitas_belvo_tx  ON public.receitas_pessoais(belvo_tx_id) WHERE belvo_tx_id IS NOT NULL;
