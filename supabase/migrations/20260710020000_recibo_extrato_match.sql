-- Liga um recibo fotografado à linha de extrato bancário correspondente,
-- uma vez que o matching automático encontra a movimentação certa.
-- Evita tentar casar o mesmo recibo duas vezes.
ALTER TABLE public.recibos_fotografados
  ADD COLUMN IF NOT EXISTS extrato_bancario_id uuid REFERENCES public.extrato_bancario(id);

CREATE INDEX IF NOT EXISTS idx_recibos_extrato_pendente
  ON public.recibos_fotografados(empresa_id)
  WHERE extrato_bancario_id IS NULL;
