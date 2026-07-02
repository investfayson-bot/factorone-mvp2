-- Cartões estilo Clara: cartão virtual, titular/colaborador e pausa
-- Colunas aditivas em cartoes_corporativos (nullable / com default) — não quebra dados existentes.

ALTER TABLE public.cartoes_corporativos
  ADD COLUMN IF NOT EXISTS formato text DEFAULT 'fisico' CHECK (formato IN ('fisico','virtual')),
  ADD COLUMN IF NOT EXISTS titular_nome text,
  ADD COLUMN IF NOT EXISTS titular_email text,
  ADD COLUMN IF NOT EXISTS pausado boolean DEFAULT false;

-- Faturas: ciclos de fatura por cartão (aberta/fechada/paga).
CREATE TABLE IF NOT EXISTS public.faturas_cartao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  cartao_id uuid REFERENCES public.cartoes_corporativos(id) ON DELETE CASCADE,
  competencia text NOT NULL,            -- 'YYYY-MM'
  valor_total numeric(15,2) DEFAULT 0,
  status text CHECK (status IN ('aberta','fechada','paga')) DEFAULT 'aberta',
  fechamento_data date,
  vencimento_data date,
  paga_em timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE (cartao_id, competencia)
);

ALTER TABLE public.faturas_cartao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios veem proprias faturas" ON public.faturas_cartao;
CREATE POLICY "usuarios veem proprias faturas" ON public.faturas_cartao FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
);
