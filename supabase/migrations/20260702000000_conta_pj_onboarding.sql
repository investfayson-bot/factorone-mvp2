-- conta_pj_onboarding: tabela do wizard "Abrir Conta PJ" (/dashboard/conta-pj/abrir)
-- Estava faltando no banco -> o submit do wizard falhava. Colunas conforme o upsert da página.

CREATE TABLE IF NOT EXISTS public.conta_pj_onboarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  cnpj text,
  razao_social text,
  nome_fantasia text,
  email text,
  telefone text,
  faturamento_mensal numeric(15,2),
  socio_nome text,
  socio_cpf text,
  socio_email text,
  socio_percentual numeric(5,2),
  status text DEFAULT 'em_analise',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.conta_pj_onboarding ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios veem proprio onboarding" ON public.conta_pj_onboarding;
CREATE POLICY "usuarios veem proprio onboarding" ON public.conta_pj_onboarding FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
);
