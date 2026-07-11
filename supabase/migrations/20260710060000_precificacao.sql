-- Fase 2 (reskin) — Precificação & Margem: calculadora de preço de venda por
-- unidade (kg/L/m/item/hora), com produtos/serviços salvos para comparação.
CREATE TABLE IF NOT EXISTS public.precificacao_produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  unidade text NOT NULL DEFAULT 'item' CHECK (unidade IN ('kg', 'L', 'm', 'item', 'hora')),
  custo_insumo numeric NOT NULL DEFAULT 0,
  mao_obra numeric NOT NULL DEFAULT 0,
  despesas_fixas_rateadas numeric NOT NULL DEFAULT 0,
  producao_mensal_estimada numeric NOT NULL DEFAULT 1,
  impostos_pct numeric NOT NULL DEFAULT 0,
  comissao_pct numeric NOT NULL DEFAULT 0,
  margem_pct numeric NOT NULL DEFAULT 0,
  preco_sugerido numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.precificacao_produtos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios veem propria precificacao" ON public.precificacao_produtos;
CREATE POLICY "usuarios veem propria precificacao" ON public.precificacao_produtos
FOR ALL USING (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()))
WITH CHECK (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));
