-- ============================================================
-- Hub OS — tabelas do dashboard central de operações
-- Rodar no SQL Editor do Supabase (projeto FactorOne)
-- Segue padrão AGENTS.md: empresa_id + RLS + índice
-- ============================================================

-- ── Projetos do Hub ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS hub_projetos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  status TEXT DEFAULT 'ideia' CHECK (status IN ('ideia','planejamento','desenvolvimento','concluido','pausado')),
  progresso INTEGER DEFAULT 0 CHECK (progresso BETWEEN 0 AND 100),
  categoria TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Ideias ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hub_ideias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  origem TEXT DEFAULT 'manual',
  tipo TEXT DEFAULT 'feature',
  status TEXT DEFAULT 'nova',
  projeto_id UUID REFERENCES hub_projetos(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Clientes / Leads ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS hub_clientes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  segmento TEXT,
  status TEXT DEFAULT 'lead' CHECK (status IN ('lead','ativo','socio','inativo')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Eventos ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hub_eventos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT DEFAULT 'mentoria',
  data_inicio TIMESTAMPTZ,
  data_fim TIMESTAMPTZ,
  local TEXT,
  nicho TEXT,
  status TEXT DEFAULT 'planejado',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Conteúdo ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hub_conteudo (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  formato TEXT DEFAULT 'post',
  plataforma TEXT DEFAULT 'instagram',
  status TEXT DEFAULT 'ideia' CHECK (status IN ('ideia','producao','revisao','agendado','publicado')),
  data_publicacao TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── RLS ──────────────────────────────────────────────────
ALTER TABLE hub_projetos ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_ideias   ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_eventos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_conteudo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hub_projetos_empresa" ON hub_projetos;
DROP POLICY IF EXISTS "hub_ideias_empresa"   ON hub_ideias;
DROP POLICY IF EXISTS "hub_clientes_empresa" ON hub_clientes;
DROP POLICY IF EXISTS "hub_eventos_empresa"  ON hub_eventos;
DROP POLICY IF EXISTS "hub_conteudo_empresa" ON hub_conteudo;

CREATE POLICY "hub_projetos_empresa" ON hub_projetos FOR ALL USING (empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid()));
CREATE POLICY "hub_ideias_empresa"   ON hub_ideias   FOR ALL USING (empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid()));
CREATE POLICY "hub_clientes_empresa" ON hub_clientes FOR ALL USING (empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid()));
CREATE POLICY "hub_eventos_empresa"  ON hub_eventos  FOR ALL USING (empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid()));
CREATE POLICY "hub_conteudo_empresa" ON hub_conteudo FOR ALL USING (empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid()));

-- ── Índices em empresa_id (AGENTS.md regra #7) ───────────
CREATE INDEX IF NOT EXISTS idx_hub_projetos_empresa ON hub_projetos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_hub_ideias_empresa   ON hub_ideias(empresa_id);
CREATE INDEX IF NOT EXISTS idx_hub_clientes_empresa ON hub_clientes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_hub_eventos_empresa  ON hub_eventos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_hub_conteudo_empresa ON hub_conteudo(empresa_id);
