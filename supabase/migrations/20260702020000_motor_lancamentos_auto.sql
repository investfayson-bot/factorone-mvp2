-- Motor de lançamentos contábeis AUTOMÁTICO (triggers).
-- Toda despesa/nota inserida gera a partida dobrada no plano de contas.
-- Idempotente (não duplica) e SECURITY DEFINER (passa pelo RLS com segurança).

-- 1) Garante o plano de contas base da empresa (idempotente por codigo)
CREATE OR REPLACE FUNCTION public.fo_garantir_plano_contas(p_empresa uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO public.plano_contas (empresa_id, codigo, nome, tipo)
  SELECT p_empresa, v.codigo, v.nome, v.tipo
  FROM (VALUES
    ('1.1.1','Caixa e Bancos','ativo'),
    ('1.1.2','Contas a Receber','ativo'),
    ('2.1.1','Contas a Pagar','passivo'),
    ('3.1.1','Receita de Vendas e Serviços','receita'),
    ('5.1.1','Impostos sobre Vendas','imposto'),
    ('4.1.01','Despesa - Alimentação','despesa_operacional'),
    ('4.1.02','Despesa - Transporte','despesa_operacional'),
    ('4.1.03','Despesa - Hospedagem','despesa_operacional'),
    ('4.1.04','Despesa - Tecnologia/Software','despesa_operacional'),
    ('4.1.05','Despesa - Marketing','despesa_operacional'),
    ('4.1.06','Despesa - Fornecedores','despesa_operacional'),
    ('4.1.07','Despesa - Folha de Pagamento','despesa_operacional'),
    ('4.1.08','Despesa - Impostos/Taxas','despesa_operacional'),
    ('4.1.09','Despesa - Aluguel/Infraestrutura','despesa_operacional'),
    ('4.1.10','Despesa - Consultoria','despesa_operacional'),
    ('4.1.11','Despesa - Material de Escritório','despesa_operacional'),
    ('4.1.12','Despesa - Outros','despesa_operacional')
  ) AS v(codigo,nome,tipo)
  WHERE p_empresa IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.plano_contas p WHERE p.empresa_id = p_empresa AND p.codigo = v.codigo);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2) Despesa -> D: conta da categoria / C: Caixa
CREATE OR REPLACE FUNCTION public.fo_lancar_despesa()
RETURNS trigger AS $$
DECLARE v_caixa uuid; v_desp uuid;
BEGIN
  IF NEW.empresa_id IS NULL OR COALESCE(NEW.valor,0) = 0 THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.lancamentos WHERE despesa_id = NEW.id) THEN RETURN NEW; END IF;
  PERFORM public.fo_garantir_plano_contas(NEW.empresa_id);
  SELECT id INTO v_caixa FROM public.plano_contas WHERE empresa_id = NEW.empresa_id AND nome = 'Caixa e Bancos' LIMIT 1;
  SELECT id INTO v_desp FROM public.plano_contas WHERE empresa_id = NEW.empresa_id AND nome = 'Despesa - ' || COALESCE(NEW.categoria,'Outros') LIMIT 1;
  IF v_desp IS NULL THEN SELECT id INTO v_desp FROM public.plano_contas WHERE empresa_id = NEW.empresa_id AND nome = 'Despesa - Outros' LIMIT 1; END IF;
  IF v_caixa IS NULL OR v_desp IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.lancamentos (empresa_id, conta_id, descricao, valor, tipo, competencia, despesa_id, origem) VALUES
    (NEW.empresa_id, v_desp,  COALESCE(NEW.descricao,'Despesa'), NEW.valor, 'debito',  COALESCE(NEW.data_despesa, CURRENT_DATE), NEW.id, 'despesa'),
    (NEW.empresa_id, v_caixa, COALESCE(NEW.descricao,'Despesa'), NEW.valor, 'credito', COALESCE(NEW.data_despesa, CURRENT_DATE), NEW.id, 'despesa');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_lancar_despesa ON public.despesas;
CREATE TRIGGER trg_lancar_despesa AFTER INSERT ON public.despesas FOR EACH ROW EXECUTE FUNCTION public.fo_lancar_despesa();

-- 3) Nota emitida -> C: Receita / D: Caixa
CREATE OR REPLACE FUNCTION public.fo_lancar_nota()
RETURNS trigger AS $$
DECLARE v_caixa uuid; v_rec uuid;
BEGIN
  IF NEW.empresa_id IS NULL OR COALESCE(NEW.valor_total,0) = 0 THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.lancamentos WHERE nota_id = NEW.id) THEN RETURN NEW; END IF;
  PERFORM public.fo_garantir_plano_contas(NEW.empresa_id);
  SELECT id INTO v_caixa FROM public.plano_contas WHERE empresa_id = NEW.empresa_id AND nome = 'Caixa e Bancos' LIMIT 1;
  SELECT id INTO v_rec   FROM public.plano_contas WHERE empresa_id = NEW.empresa_id AND nome = 'Receita de Vendas e Serviços' LIMIT 1;
  IF v_caixa IS NULL OR v_rec IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.lancamentos (empresa_id, conta_id, descricao, valor, tipo, competencia, nota_id, origem) VALUES
    (NEW.empresa_id, v_rec,   'NF ' || COALESCE(NEW.destinatario_nome,''), NEW.valor_total, 'credito', COALESCE(NEW.created_at::date, CURRENT_DATE), NEW.id, 'nfe'),
    (NEW.empresa_id, v_caixa, 'NF ' || COALESCE(NEW.destinatario_nome,''), NEW.valor_total, 'debito',  COALESCE(NEW.created_at::date, CURRENT_DATE), NEW.id, 'nfe');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_lancar_nota ON public.notas_emitidas;
CREATE TRIGGER trg_lancar_nota AFTER INSERT ON public.notas_emitidas FOR EACH ROW EXECUTE FUNCTION public.fo_lancar_nota();
