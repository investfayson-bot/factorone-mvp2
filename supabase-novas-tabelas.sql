CREATE TABLE IF NOT EXISTS transacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  descricao TEXT,
  categoria TEXT,
  tipo TEXT CHECK (tipo IN ('entrada','saida')) NOT NULL,
  valor DECIMAL(15,2) NOT NULL,
  status TEXT DEFAULT 'confirmada',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notas_fiscais (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  numero TEXT,
  emitente_cnpj TEXT,
  emitente_nome TEXT,
  data_emissao DATE,
  valor_total DECIMAL(15,2),
  impostos JSONB DEFAULT '{}',
  itens JSONB DEFAULT '[]',
  classificacao TEXT,
  adequado_para_factoring BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pendente',
  dados_completos JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS abertura_conta_pj (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  cnpj TEXT,
  razao_social TEXT,
  nome_fantasia TEXT,
  socios JSONB DEFAULT '[]',
  documentos JSONB DEFAULT '[]',
  banco_escolhido TEXT,
  status TEXT DEFAULT 'em_andamento',
  etapa_atual INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE transacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notas_fiscais ENABLE ROW LEVEL SECURITY;
ALTER TABLE abertura_conta_pj ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_own_data" ON transacoes;
DROP POLICY IF EXISTS "user_own_data" ON notas_fiscais;
DROP POLICY IF EXISTS "user_own_data" ON abertura_conta_pj;

CREATE POLICY "user_own_data" ON transacoes FOR ALL USING (auth.uid() = empresa_id);
CREATE POLICY "user_own_data" ON notas_fiscais FOR ALL USING (auth.uid() = empresa_id);
CREATE POLICY "user_own_data" ON abertura_conta_pj FOR ALL USING (auth.uid() = empresa_id);
