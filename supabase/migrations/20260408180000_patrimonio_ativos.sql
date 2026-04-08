CREATE TABLE IF NOT EXISTS public.categorias_ativo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  vida_util_anos int NOT NULL DEFAULT 5,
  metodo_depreciacao text CHECK (metodo_depreciacao IN ('linear', 'acelerada', 'soma_digitos')) DEFAULT 'linear',
  taxa_anual numeric(8,4),
  created_at timestamptz DEFAULT now(),
  UNIQUE (empresa_id, nome)
);

ALTER TABLE public.categorias_ativo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios veem proprias categorias_ativo" ON public.categorias_ativo;
CREATE POLICY "usuarios veem proprias categorias_ativo"
  ON public.categorias_ativo FOR ALL USING (
    empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.seed_categorias_ativo(p_empresa_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO public.categorias_ativo (empresa_id, nome, vida_util_anos, taxa_anual) VALUES
    (p_empresa_id, 'Veiculos', 5, 20.0),
    (p_empresa_id, 'Moveis e Utensilios', 10, 10.0),
    (p_empresa_id, 'Equipamentos de Informatica', 5, 20.0),
    (p_empresa_id, 'Maquinas e Equipamentos', 10, 10.0),
    (p_empresa_id, 'Instalacoes', 10, 10.0),
    (p_empresa_id, 'Edificacoes', 25, 4.0),
    (p_empresa_id, 'Software', 5, 20.0),
    (p_empresa_id, 'Ferramentas', 5, 20.0),
    (p_empresa_id, 'Equipamentos de Comunicacao', 5, 20.0),
    (p_empresa_id, 'Outros', 5, 20.0)
  ON CONFLICT (empresa_id, nome) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.trigger_seed_categorias_ativo()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.seed_categorias_ativo(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_empresa_created_ativo ON public.empresas;
CREATE TRIGGER on_empresa_created_ativo
AFTER INSERT ON public.empresas
FOR EACH ROW EXECUTE FUNCTION public.trigger_seed_categorias_ativo();

CREATE TABLE IF NOT EXISTS public.ativos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  categoria_id uuid REFERENCES public.categorias_ativo(id),
  nome text NOT NULL,
  descricao text,
  codigo_interno text,
  numero_serie text,
  fornecedor text,
  nota_fiscal text,
  data_aquisicao date NOT NULL,
  data_inicio_depreciacao date NOT NULL,
  valor_aquisicao numeric(15,2) NOT NULL,
  valor_residual numeric(15,2) DEFAULT 0,
  vida_util_anos int NOT NULL DEFAULT 5,
  metodo_depreciacao text CHECK (metodo_depreciacao IN ('linear', 'acelerada', 'soma_digitos')) DEFAULT 'linear',
  depreciacao_acumulada numeric(15,2) DEFAULT 0,
  valor_contabil numeric(15,2) GENERATED ALWAYS AS (valor_aquisicao - depreciacao_acumulada) STORED,
  localizacao text,
  responsavel_nome text,
  responsavel_id uuid REFERENCES auth.users(id),
  status text CHECK (status IN ('ativo', 'em_manutencao', 'baixado', 'alienado', 'perdido')) DEFAULT 'ativo',
  data_baixa date,
  motivo_baixa text,
  valor_baixa numeric(15,2),
  qr_code text UNIQUE DEFAULT gen_random_uuid()::text,
  foto_url text,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.ativos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios veem proprios ativos" ON public.ativos;
CREATE POLICY "usuarios veem proprios ativos"
  ON public.ativos FOR ALL USING (
    empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS public.depreciacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ativo_id uuid REFERENCES public.ativos(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  competencia date NOT NULL,
  valor_depreciacao numeric(15,2) NOT NULL,
  valor_contabil_antes numeric(15,2) NOT NULL,
  valor_contabil_apos numeric(15,2) NOT NULL,
  depreciacao_acumulada_apos numeric(15,2) NOT NULL,
  lancamento_id uuid REFERENCES public.lancamentos(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE (ativo_id, competencia)
);

ALTER TABLE public.depreciacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios veem proprias depreciacoes" ON public.depreciacoes;
CREATE POLICY "usuarios veem proprias depreciacoes"
  ON public.depreciacoes FOR ALL USING (
    empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS public.manutencoes_ativo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ativo_id uuid REFERENCES public.ativos(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo text CHECK (tipo IN ('preventiva', 'corretiva', 'revisao', 'instalacao')) NOT NULL,
  descricao text NOT NULL,
  custo numeric(15,2) DEFAULT 0,
  fornecedor text,
  data_manutencao date NOT NULL DEFAULT CURRENT_DATE,
  proxima_manutencao date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.manutencoes_ativo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios veem proprias manutencoes" ON public.manutencoes_ativo;
CREATE POLICY "usuarios veem proprias manutencoes"
  ON public.manutencoes_ativo FOR ALL USING (
    empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
  );

SELECT public.seed_categorias_ativo(id) FROM public.empresas;
