-- Fase 3 (Extrato) — o motor de classificação da Fase 0 só tinha as colunas
-- de status em transacoes/despesas/extrato_bancario (todas PJ). Pra Extrato
-- classificar movimentação PF também (belvo_transacoes.user_id, sem
-- empresa_id), sem quebrar o isolamento PJ/PF, precisa das mesmas colunas
-- aqui. belvo_transacoes é tabela física normal (sem o problema de view que
-- transacoes teve), então ALTER TABLE direto é seguro.
ALTER TABLE public.belvo_transacoes
  ADD COLUMN IF NOT EXISTS origem_documento text CHECK (origem_documento IS NULL OR origem_documento IN ('foto','pdf','manual','open_finance')) DEFAULT 'open_finance',
  ADD COLUMN IF NOT EXISTS documento_anexo_url text,
  ADD COLUMN IF NOT EXISTS status_classificacao text CHECK (status_classificacao IS NULL OR status_classificacao IN ('sugerida','aguardando_ok','confirmada')) DEFAULT 'confirmada';
