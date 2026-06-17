-- Marketplace apps: Estoque e Folha de Pagamento (primeira versão real).

-- ---------- Estoque ----------
CREATE TABLE IF NOT EXISTS public.estoque_produtos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome            text NOT NULL,
  sku             text,
  categoria       text,
  quantidade      integer NOT NULL DEFAULT 0,
  estoque_minimo  integer NOT NULL DEFAULT 0,
  custo_unitario  numeric(15,2) NOT NULL DEFAULT 0,
  preco_venda     numeric(15,2) NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_estoque_empresa ON public.estoque_produtos(empresa_id);
ALTER TABLE public.estoque_produtos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "estoque_own" ON public.estoque_produtos;
CREATE POLICY "estoque_own" ON public.estoque_produtos FOR ALL
  USING (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()))
  WITH CHECK (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));

-- ---------- Folha de Pagamento ----------
CREATE TABLE IF NOT EXISTS public.folha_funcionarios (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome          text NOT NULL,
  cargo         text,
  departamento  text,
  salario       numeric(15,2) NOT NULL DEFAULT 0,
  status        text NOT NULL DEFAULT 'ativo',
  admissao      date,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_folha_empresa ON public.folha_funcionarios(empresa_id);
ALTER TABLE public.folha_funcionarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "folha_own" ON public.folha_funcionarios;
CREATE POLICY "folha_own" ON public.folha_funcionarios FOR ALL
  USING (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()))
  WITH CHECK (empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));
