-- Fechamento contábil mensal: registra competências fechadas (trava lógica).
CREATE TABLE IF NOT EXISTS public.fechamentos_contabeis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  competencia text NOT NULL,                 -- 'YYYY-MM'
  status text DEFAULT 'fechado' CHECK (status IN ('fechado','reaberto')),
  fechado_em timestamptz DEFAULT now(),
  fechado_por uuid,
  UNIQUE (empresa_id, competencia)
);

ALTER TABLE public.fechamentos_contabeis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "empresa ve proprio fechamento" ON public.fechamentos_contabeis;
CREATE POLICY "empresa ve proprio fechamento" ON public.fechamentos_contabeis FOR ALL USING (
  empresa_id = auth.uid()
  OR empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
);
