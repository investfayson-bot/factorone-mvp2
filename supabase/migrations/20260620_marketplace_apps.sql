-- Marketplace apps (1ª versão real): RH, Cobranças/Assinaturas, Contratos,
-- Propostas, Pipeline e Tax. Todas escopadas por empresa com RLS.

CREATE TABLE IF NOT EXISTS public.rh_beneficios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  funcionario text NOT NULL, tipo text, valor numeric(15,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ativo', created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assinaturas_cobranca (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  cliente text NOT NULL, plano text, valor numeric(15,2) NOT NULL DEFAULT 0,
  ciclo text DEFAULT 'mensal', status text NOT NULL DEFAULT 'ativa',
  proxima_cobranca date, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  titulo text NOT NULL, contraparte text, valor numeric(15,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'rascunho', vigencia_fim date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.propostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  cliente text NOT NULL, titulo text, valor numeric(15,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'rascunho', validade date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pipeline_oportunidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  titulo text NOT NULL, cliente text, valor numeric(15,2) NOT NULL DEFAULT 0,
  etapa text NOT NULL DEFAULT 'prospeccao', probabilidade integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tax_obrigacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL, tipo text, competencia text, vencimento date,
  valor numeric(15,2) NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS por empresa para todas.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['rh_beneficios','assinaturas_cobranca','contratos','propostas','pipeline_oportunidades','tax_obrigacoes']
  LOOP
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_empresa ON public.%I(empresa_id)', t, t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_own" ON public.%I', t, t);
    EXECUTE format($f$CREATE POLICY "%s_own" ON public.%I FOR ALL
      USING (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()))
      WITH CHECK (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()))$f$, t, t);
  END LOOP;
END $$;
