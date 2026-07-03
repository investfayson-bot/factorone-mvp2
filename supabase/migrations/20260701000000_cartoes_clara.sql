-- Cartões corporativos (estilo Clara / Conta Simples)
-- A tabela cartoes_corporativos nunca existiu no banco (a página a usava sem backing table).
-- Criamos completa, já com os campos do modelo Clara: cartão virtual, titular/colaborador e pausa.

CREATE TABLE IF NOT EXISTS public.cartoes_corporativos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  bandeira text DEFAULT 'Visa',
  limite numeric(15,2) DEFAULT 0,
  limite_disponivel numeric(15,2) DEFAULT 0,
  vencimento_dia int DEFAULT 10,
  fechamento_dia int DEFAULT 1,
  cor text DEFAULT '#1C2B2A',
  status text DEFAULT 'ativo',
  tipo text DEFAULT 'credito',
  formato text DEFAULT 'fisico' CHECK (formato IN ('fisico','virtual')),
  titular_nome text,
  titular_email text,
  pausado boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Idempotente: se a tabela já existir em outro ambiente sem os campos novos, adiciona.
ALTER TABLE public.cartoes_corporativos
  ADD COLUMN IF NOT EXISTS formato text DEFAULT 'fisico',
  ADD COLUMN IF NOT EXISTS titular_nome text,
  ADD COLUMN IF NOT EXISTS titular_email text,
  ADD COLUMN IF NOT EXISTS pausado boolean DEFAULT false;

ALTER TABLE public.cartoes_corporativos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios veem proprios cartoes" ON public.cartoes_corporativos;
CREATE POLICY "usuarios veem proprios cartoes" ON public.cartoes_corporativos FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
);

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
