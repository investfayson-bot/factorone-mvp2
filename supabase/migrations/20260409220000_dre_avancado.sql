-- DRE avançado enterprise

CREATE TABLE IF NOT EXISTS public.plano_contas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  nome text NOT NULL,
  tipo text CHECK (tipo IN (
    'receita','deducao','custo','despesa_operacional',
    'despesa_financeira','imposto','ativo','passivo','patrimonio'
  )) NOT NULL,
  parent_id uuid REFERENCES public.plano_contas(id),
  nivel int DEFAULT 1,
  ordem int DEFAULT 0,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (empresa_id, codigo)
);

ALTER TABLE public.plano_contas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios veem proprio plano" ON public.plano_contas;
CREATE POLICY "usuarios veem proprio plano" ON public.plano_contas
  FOR ALL USING (
    empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
    OR empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
    OR empresa_id = auth.uid()
  );

CREATE OR REPLACE FUNCTION public.seed_plano_contas(p_empresa_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO public.plano_contas (empresa_id, codigo, nome, tipo, nivel, ordem) VALUES
    (p_empresa_id, '1', 'RECEITA BRUTA', 'receita', 1, 1),
    (p_empresa_id, '1.1', 'Receita de Vendas', 'receita', 2, 1),
    (p_empresa_id, '1.2', 'Receita de Serviços', 'receita', 2, 2),
    (p_empresa_id, '1.3', 'Outras Receitas', 'receita', 2, 3),
    (p_empresa_id, '2', 'DEDUÇÕES DA RECEITA', 'deducao', 1, 2),
    (p_empresa_id, '2.1', 'Impostos sobre Vendas', 'deducao', 2, 1),
    (p_empresa_id, '2.2', 'Devoluções e Abatimentos', 'deducao', 2, 2),
    (p_empresa_id, '3', 'CUSTO DOS PRODUTOS/SERVIÇOS', 'custo', 1, 3),
    (p_empresa_id, '3.1', 'CMV - Custo Mercadoria Vendida', 'custo', 2, 1),
    (p_empresa_id, '3.2', 'CSP - Custo Serviços Prestados', 'custo', 2, 2),
    (p_empresa_id, '4', 'DESPESAS OPERACIONAIS', 'despesa_operacional', 1, 4),
    (p_empresa_id, '4.1', 'Despesas Administrativas', 'despesa_operacional', 2, 1),
    (p_empresa_id, '4.2', 'Despesas Comerciais', 'despesa_operacional', 2, 2),
    (p_empresa_id, '4.3', 'Despesas com Pessoal', 'despesa_operacional', 2, 3),
    (p_empresa_id, '4.4', 'Despesas de Marketing', 'despesa_operacional', 2, 4),
    (p_empresa_id, '4.5', 'Depreciação e Amortização', 'despesa_operacional', 2, 5),
    (p_empresa_id, '5', 'RESULTADO FINANCEIRO', 'despesa_financeira', 1, 5),
    (p_empresa_id, '5.1', 'Receitas Financeiras', 'despesa_financeira', 2, 1),
    (p_empresa_id, '5.2', 'Despesas Financeiras', 'despesa_financeira', 2, 2),
    (p_empresa_id, '6', 'IMPOSTOS', 'imposto', 1, 6),
    (p_empresa_id, '6.1', 'IR e CSLL', 'imposto', 2, 1),
    (p_empresa_id, '6.2', 'Simples Nacional', 'imposto', 2, 2)
  ON CONFLICT (empresa_id, codigo) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.trigger_seed_plano_contas()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.seed_plano_contas(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_empresa_created_plano ON public.empresas;
CREATE TRIGGER on_empresa_created_plano
  AFTER INSERT ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.trigger_seed_plano_contas();

CREATE TABLE IF NOT EXISTS public.lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  conta_id uuid REFERENCES public.plano_contas(id),
  descricao text NOT NULL,
  valor decimal(15,2) NOT NULL,
  tipo text CHECK (tipo IN ('debito','credito')) NOT NULL,
  competencia date NOT NULL,
  transaction_id uuid REFERENCES public.transactions(id),
  despesa_id uuid REFERENCES public.despesas(id),
  nota_id uuid REFERENCES public.notas_emitidas(id),
  origem text CHECK (origem IN ('manual','nfe','despesa','transacao','importacao')) DEFAULT 'manual',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.lancamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios veem proprios lancamentos" ON public.lancamentos;
CREATE POLICY "usuarios veem proprios lancamentos" ON public.lancamentos
  FOR ALL USING (
    empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
    OR empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
    OR empresa_id = auth.uid()
  );

CREATE TABLE IF NOT EXISTS public.metricas_financeiras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  competencia date NOT NULL,
  receita_bruta decimal(15,2) DEFAULT 0,
  deducoes decimal(15,2) DEFAULT 0,
  receita_liquida decimal(15,2) DEFAULT 0,
  cmv decimal(15,2) DEFAULT 0,
  lucro_bruto decimal(15,2) DEFAULT 0,
  despesas_operacionais decimal(15,2) DEFAULT 0,
  ebitda decimal(15,2) DEFAULT 0,
  depreciacao decimal(15,2) DEFAULT 0,
  ebit decimal(15,2) DEFAULT 0,
  resultado_financeiro decimal(15,2) DEFAULT 0,
  lair decimal(15,2) DEFAULT 0,
  impostos decimal(15,2) DEFAULT 0,
  lucro_liquido decimal(15,2) DEFAULT 0,
  margem_bruta decimal(8,4) DEFAULT 0,
  margem_ebitda decimal(8,4) DEFAULT 0,
  margem_liquida decimal(8,4) DEFAULT 0,
  roi decimal(8,4) DEFAULT 0,
  roic decimal(8,4) DEFAULT 0,
  roce decimal(8,4) DEFAULT 0,
  capital_investido decimal(15,2) DEFAULT 0,
  capital_empregado decimal(15,2) DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (empresa_id, competencia)
);

ALTER TABLE public.metricas_financeiras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios veem proprias metricas" ON public.metricas_financeiras;
CREATE POLICY "usuarios veem proprias metricas" ON public.metricas_financeiras
  FOR ALL USING (
    empresa_id IN (SELECT id FROM public.empresas WHERE user_id = auth.uid())
    OR empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
    OR empresa_id = auth.uid()
  );
