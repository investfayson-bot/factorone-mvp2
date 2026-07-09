-- Cartão: captura de parcela + descritor bruto do feed Belvo, e fallback de importação
-- manual de fatura (PDF/CSV/OFX) para bancos que não entregam credit_card_data.
-- Handoff: docs/handoff-cartao-parcelas-estabelecimento.md

-- ---------- Belvo: parcela + descritor bruto (nullable — nada existente quebra) ----------
ALTER TABLE public.belvo_transacoes
  ADD COLUMN IF NOT EXISTS parcela_atual   int,
  ADD COLUMN IF NOT EXISTS total_parcelas  int,
  ADD COLUMN IF NOT EXISTS descritor_bruto text;

-- ---------- Fallback: itens de fatura importados manualmente (PJ ou PF) ----------
CREATE TABLE IF NOT EXISTS public.fatura_itens_importados (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  arquivo_nome    text,
  descricao       text NOT NULL,
  descritor_bruto text,
  valor           numeric(15,2) NOT NULL,
  data            date,
  parcela_atual   int,
  total_parcelas  int,
  categoria       text DEFAULT 'Outros',
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fatura_itens_importados_owner_chk CHECK (empresa_id IS NOT NULL OR user_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_fatura_itens_importados_data ON public.fatura_itens_importados(data DESC);

ALTER TABLE public.fatura_itens_importados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fatura_itens_importados_own" ON public.fatura_itens_importados;
CREATE POLICY "fatura_itens_importados_own" ON public.fatura_itens_importados FOR ALL
  USING ((empresa_id IS NOT NULL AND empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())) OR (user_id IS NOT NULL AND user_id = auth.uid()))
  WITH CHECK ((empresa_id IS NOT NULL AND empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())) OR (user_id IS NOT NULL AND user_id = auth.uid()));
