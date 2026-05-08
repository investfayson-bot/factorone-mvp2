-- Sprint 7 — Receitas PJ
-- Rode no SQL Editor do Supabase

CREATE TABLE IF NOT EXISTS public.receitas_pj (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL,
  descricao     text NOT NULL,
  categoria     text NOT NULL DEFAULT 'Serviço',
  valor         decimal(15,2) NOT NULL,
  data          date NOT NULL DEFAULT CURRENT_DATE,
  tipo          text CHECK (tipo IN ('recorrente','pontual','projeto')) DEFAULT 'pontual',
  cliente       text,
  centro_custo  text,
  nota_fiscal   text,
  status        text CHECK (status IN ('confirmada','prevista','cancelada')) DEFAULT 'confirmada',
  created_at    timestamptz DEFAULT now()
);
ALTER TABLE public.receitas_pj ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "receitas_pj_rls" ON public.receitas_pj;
CREATE POLICY "receitas_pj_rls" ON public.receitas_pj FOR ALL
  USING (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_receitas_pj_empresa ON public.receitas_pj(empresa_id);
CREATE INDEX IF NOT EXISTS idx_receitas_pj_data ON public.receitas_pj(data);
