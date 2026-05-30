-- Hub OS — tabela de consumo por agente de IA
-- Roda no SQL Editor do Supabase (projeto FactorOne)

CREATE TABLE IF NOT EXISTS hub_uso_agentes (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id       UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  agente_id        TEXT NOT NULL,
  modelo           TEXT NOT NULL,
  prompt_tokens    INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens     INTEGER DEFAULT 0,
  custo_usd        NUMERIC(12, 8) DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE hub_uso_agentes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hub_uso_agentes_empresa" ON hub_uso_agentes;
CREATE POLICY "hub_uso_agentes_empresa" ON hub_uso_agentes
  FOR ALL USING (empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_hub_uso_agentes_empresa   ON hub_uso_agentes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_hub_uso_agentes_agente    ON hub_uso_agentes(empresa_id, agente_id);
CREATE INDEX IF NOT EXISTS idx_hub_uso_agentes_created   ON hub_uso_agentes(empresa_id, created_at DESC);
