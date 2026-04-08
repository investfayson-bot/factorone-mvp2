CREATE TABLE IF NOT EXISTS public.orcamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ano_fiscal int NOT NULL,
  status text CHECK (status IN ('rascunho','em_aprovacao','aprovado','ativo','encerrado')) DEFAULT 'rascunho',
  total_previsto numeric(15,2) DEFAULT 0,
  total_realizado numeric(15,2) DEFAULT 0,
  versao int DEFAULT 1,
  criado_por uuid REFERENCES auth.users(id),
  aprovado_por uuid REFERENCES auth.users(id),
  aprovado_em timestamptz,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (empresa_id, ano_fiscal, versao)
);
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios veem proprios orcamentos" ON public.orcamentos;
CREATE POLICY "usuarios veem proprios orcamentos" ON public.orcamentos
FOR ALL USING (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.orcamento_linhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  categoria text NOT NULL,
  centro_custo_id uuid REFERENCES public.centros_custo(id),
  mes int CHECK (mes BETWEEN 1 AND 12) NOT NULL,
  ano int NOT NULL,
  valor_previsto numeric(15,2) NOT NULL DEFAULT 0,
  valor_realizado numeric(15,2) DEFAULT 0,
  variacao numeric(15,2) GENERATED ALWAYS AS (valor_previsto - valor_realizado) STORED,
  variacao_pct numeric(8,4) GENERATED ALWAYS AS (
    CASE WHEN valor_previsto > 0
    THEN ((valor_previsto - valor_realizado) / valor_previsto) * 100
    ELSE 0 END
  ) STORED,
  alerta_enviado boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (orcamento_id, categoria, mes, centro_custo_id)
);
ALTER TABLE public.orcamento_linhas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios veem proprias linhas" ON public.orcamento_linhas;
CREATE POLICY "usuarios veem proprias linhas" ON public.orcamento_linhas
FOR ALL USING (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.suplementacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_linha_id uuid REFERENCES public.orcamento_linhas(id),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  valor_solicitado numeric(15,2) NOT NULL,
  justificativa text NOT NULL,
  status text CHECK (status IN ('pendente','aprovado','rejeitado')) DEFAULT 'pendente',
  solicitado_por uuid REFERENCES auth.users(id),
  aprovado_por uuid REFERENCES auth.users(id),
  aprovado_em timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.suplementacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios veem proprias suplementacoes" ON public.suplementacoes;
CREATE POLICY "usuarios veem proprias suplementacoes" ON public.suplementacoes
FOR ALL USING (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.alertas_orcamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  orcamento_linha_id uuid REFERENCES public.orcamento_linhas(id),
  tipo text CHECK (tipo IN ('alerta_80','alerta_100','estouro','tendencia_estouro')) NOT NULL,
  percentual_consumido numeric(8,4),
  valor_previsto numeric(15,2),
  valor_realizado numeric(15,2),
  lido boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.alertas_orcamento ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios veem proprios alertas" ON public.alertas_orcamento;
CREATE POLICY "usuarios veem proprios alertas" ON public.alertas_orcamento
FOR ALL USING (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));

INSERT INTO public.orcamentos (empresa_id, nome, ano_fiscal, status, versao)
SELECT id, 'Orçamento ' || EXTRACT(YEAR FROM NOW())::text, EXTRACT(YEAR FROM NOW())::int, 'ativo', 1
FROM public.empresas
ON CONFLICT (empresa_id, ano_fiscal, versao) DO NOTHING;
