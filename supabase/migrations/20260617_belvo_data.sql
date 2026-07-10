-- Belvo (Open Finance): dados importados — contas, transações e faturas de cartão.
-- Staging com dedupe pelos ids da Belvo; escopo por empresa (PJ) OU usuário (PF).

-- ---------- Contas ----------
CREATE TABLE IF NOT EXISTS public.belvo_contas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  belvo_id     text NOT NULL UNIQUE,            -- account id na Belvo
  link_id      text NOT NULL,
  empresa_id   uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  nome         text,
  numero       text,
  categoria    text,
  tipo         text,
  instituicao  text,
  saldo        numeric(15,2),
  disponivel   numeric(15,2),
  limite_credito numeric(15,2),
  credit_data  jsonb,
  moeda        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT belvo_contas_owner_chk CHECK (empresa_id IS NOT NULL OR user_id IS NOT NULL)
);

-- ---------- Transações ----------
CREATE TABLE IF NOT EXISTS public.belvo_transacoes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  belvo_id       text NOT NULL UNIQUE,          -- transaction id na Belvo (dedupe)
  link_id        text NOT NULL,
  conta_belvo_id text,
  empresa_id     uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id        uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  data           date,
  descricao      text,
  categoria      text,
  estabelecimento text,
  conta          text,
  tipo           text,                          -- INFLOW | OUTFLOW
  valor          numeric(15,2),
  moeda          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT belvo_transacoes_owner_chk CHECK (empresa_id IS NOT NULL OR user_id IS NOT NULL)
);

-- ---------- Faturas de cartão ----------
CREATE TABLE IF NOT EXISTS public.belvo_bills (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  belvo_id       text NOT NULL UNIQUE,
  link_id        text NOT NULL,
  conta_belvo_id text,
  empresa_id     uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id        uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  nome           text,
  data_fechamento date,
  data_vencimento date,
  valor_total    numeric(15,2),
  valor_minimo   numeric(15,2),
  moeda          text,
  status         text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT belvo_bills_owner_chk CHECK (empresa_id IS NOT NULL OR user_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_belvo_contas_link ON public.belvo_contas(link_id);
CREATE INDEX IF NOT EXISTS idx_belvo_transacoes_link ON public.belvo_transacoes(link_id);
CREATE INDEX IF NOT EXISTS idx_belvo_transacoes_data ON public.belvo_transacoes(data DESC);
CREATE INDEX IF NOT EXISTS idx_belvo_bills_link ON public.belvo_bills(link_id);

-- ---------- RLS (empresa do usuário OU próprio usuário) ----------
ALTER TABLE public.belvo_contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.belvo_transacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.belvo_bills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "belvo_contas_own" ON public.belvo_contas;
CREATE POLICY "belvo_contas_own" ON public.belvo_contas FOR ALL
  USING ((empresa_id IS NOT NULL AND empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())) OR (user_id IS NOT NULL AND user_id = auth.uid()))
  WITH CHECK ((empresa_id IS NOT NULL AND empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())) OR (user_id IS NOT NULL AND user_id = auth.uid()));

DROP POLICY IF EXISTS "belvo_transacoes_own" ON public.belvo_transacoes;
CREATE POLICY "belvo_transacoes_own" ON public.belvo_transacoes FOR ALL
  USING ((empresa_id IS NOT NULL AND empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())) OR (user_id IS NOT NULL AND user_id = auth.uid()))
  WITH CHECK ((empresa_id IS NOT NULL AND empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())) OR (user_id IS NOT NULL AND user_id = auth.uid()));

DROP POLICY IF EXISTS "belvo_bills_own" ON public.belvo_bills;
CREATE POLICY "belvo_bills_own" ON public.belvo_bills FOR ALL
  USING ((empresa_id IS NOT NULL AND empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())) OR (user_id IS NOT NULL AND user_id = auth.uid()))
  WITH CHECK ((empresa_id IS NOT NULL AND empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())) OR (user_id IS NOT NULL AND user_id = auth.uid()));
