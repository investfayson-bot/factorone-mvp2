-- Fase 6 (Clientes & Vendas) — temperatura + alçada de negociação no
-- pipeline, auditoria por negócio e ofertas de desconto agregáveis.
--
-- crm_oportunidades já existe (sprint9) — só ganha colunas. Tabelas novas
-- seguem o padrão endurecido: SELECT client-side escopado por empresa,
-- escrita via API (service role + gate de papel), sem policy de escrita.

ALTER TABLE public.crm_oportunidades
  ADD COLUMN IF NOT EXISTS temperatura text CHECK (temperatura IN ('frio','morno','quente')),
  ADD COLUMN IF NOT EXISTS ia_negociando boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS desconto_max_pct numeric(5,2),
  ADD COLUMN IF NOT EXISTS canal_negociacao text,
  ADD COLUMN IF NOT EXISTS ultimo_contato_em timestamptz;

-- Registro de auditoria da negociação (spec: cada evento com timestamp e
-- origem IA/humano — imutável, sem UPDATE/DELETE nem pra admin via client).
CREATE TABLE IF NOT EXISTS public.crm_negociacao_eventos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       uuid NOT NULL,
  oportunidade_id  uuid NOT NULL REFERENCES public.crm_oportunidades(id) ON DELETE CASCADE,
  origem           text NOT NULL CHECK (origem IN ('ia','humano')),
  titulo           text NOT NULL,
  detalhe          text,
  created_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crm_neg_ev_op ON public.crm_negociacao_eventos (oportunidade_id, created_at DESC);
ALTER TABLE public.crm_negociacao_eventos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crm_negociacao_eventos_select" ON public.crm_negociacao_eventos;
CREATE POLICY "crm_negociacao_eventos_select" ON public.crm_negociacao_eventos
  FOR SELECT USING (
    empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
    OR empresa_id = auth.uid()
  );

-- Ofertas/descontos oferecidos (pela IA ou manualmente) — alimenta o
-- Dashboard de Ofertas e o rodapé do card de alçada.
CREATE TABLE IF NOT EXISTS public.crm_ofertas (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       uuid NOT NULL,
  oportunidade_id  uuid NOT NULL REFERENCES public.crm_oportunidades(id) ON DELETE CASCADE,
  desconto_pct     numeric(5,2) NOT NULL,
  status           text NOT NULL CHECK (status IN ('aguardando','aceita','recusada','expirada')) DEFAULT 'aguardando',
  canal            text,
  automatica       boolean DEFAULT false,
  created_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crm_ofertas_empresa ON public.crm_ofertas (empresa_id, created_at DESC);
ALTER TABLE public.crm_ofertas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crm_ofertas_select" ON public.crm_ofertas;
CREATE POLICY "crm_ofertas_select" ON public.crm_ofertas
  FOR SELECT USING (
    empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
    OR empresa_id = auth.uid()
  );
