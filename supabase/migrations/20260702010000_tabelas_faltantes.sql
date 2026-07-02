-- Tabelas referenciadas no código que não existiam no banco (auditoria pré-lançamento).
-- comprovantes/recibos são buckets de Storage (não tabelas) — fora daqui.

-- ── PF: investimentos pessoais (user_id) ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.investimentos_pf (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome text NOT NULL,
  tipo text,
  ticker text,
  instituicao text,
  valor_aplicado numeric(15,2) DEFAULT 0,
  valor_atual numeric(15,2) DEFAULT 0,
  data_aplicacao date,
  vencimento date,
  rentabilidade text,
  liquidez text,
  notas text,
  created_at timestamptz DEFAULT now()
);

-- ── PF: conexões Open Finance (user_id) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.open_finance_conexoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  banco text,
  status text DEFAULT 'ativo',
  ultimo_sync timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ── Hub: uso de agentes (empresa_id) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hub_uso_agentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  agente_id text,
  modelo text,
  prompt_tokens int DEFAULT 0,
  completion_tokens int DEFAULT 0,
  total_tokens int DEFAULT 0,
  custo_usd numeric(12,6) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ── Hub: conteúdo (empresa_id) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hub_projetos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text, status text DEFAULT 'ativo', descricao text, created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hub_ideias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  titulo text, status text DEFAULT 'nova', descricao text, created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hub_clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text, status text DEFAULT 'ativo', email text, created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hub_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  titulo text, data_evento date, descricao text, created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hub_conteudo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  titulo text, tipo text, status text DEFAULT 'rascunho', created_at timestamptz DEFAULT now()
);

-- ── RLS ───────────────────────────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  -- Tabelas por user_id
  FOREACH t IN ARRAY ARRAY['investimentos_pf','open_finance_conexoes'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "dono ve proprio" ON public.%I', t);
    EXECUTE format('CREATE POLICY "dono ve proprio" ON public.%I FOR ALL USING (user_id = auth.uid())', t);
  END LOOP;
  -- Tabelas por empresa_id
  FOREACH t IN ARRAY ARRAY['hub_uso_agentes','hub_projetos','hub_ideias','hub_clientes','hub_eventos','hub_conteudo'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "empresa ve proprio" ON public.%I', t);
    EXECUTE format('CREATE POLICY "empresa ve proprio" ON public.%I FOR ALL USING (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()))', t);
  END LOOP;
END $$;
