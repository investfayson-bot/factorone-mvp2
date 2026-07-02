-- FIX crítico: os triggers de lançamento não podem bloquear a criação de despesa/nota.
-- Causa: plano_contas.empresa_id referencia public.empresas, mas despesas.empresa_id
-- pode ser um id de usuário (sem linha em empresas) -> FK quebrava e derrubava o insert.
-- Correção: (1) só gera contabilidade se a empresa existir em empresas;
--           (2) tudo dentro de EXCEPTION -> falha na contabilidade nunca derruba a despesa/nota.

CREATE OR REPLACE FUNCTION public.fo_lancar_despesa()
RETURNS trigger AS $$
DECLARE v_caixa uuid; v_desp uuid;
BEGIN
  BEGIN
    IF NEW.empresa_id IS NULL OR COALESCE(NEW.valor,0) = 0 THEN RETURN NEW; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = NEW.empresa_id) THEN RETURN NEW; END IF;
    IF EXISTS (SELECT 1 FROM public.lancamentos WHERE despesa_id = NEW.id) THEN RETURN NEW; END IF;
    PERFORM public.fo_garantir_plano_contas(NEW.empresa_id);
    SELECT id INTO v_caixa FROM public.plano_contas WHERE empresa_id = NEW.empresa_id AND nome = 'Caixa e Bancos' LIMIT 1;
    SELECT id INTO v_desp FROM public.plano_contas WHERE empresa_id = NEW.empresa_id AND nome = 'Despesa - ' || COALESCE(NEW.categoria,'Outros') LIMIT 1;
    IF v_desp IS NULL THEN SELECT id INTO v_desp FROM public.plano_contas WHERE empresa_id = NEW.empresa_id AND nome = 'Despesa - Outros' LIMIT 1; END IF;
    IF v_caixa IS NULL OR v_desp IS NULL THEN RETURN NEW; END IF;
    INSERT INTO public.lancamentos (empresa_id, conta_id, descricao, valor, tipo, competencia, despesa_id, origem) VALUES
      (NEW.empresa_id, v_desp,  COALESCE(NEW.descricao,'Despesa'), NEW.valor, 'debito',  COALESCE(NEW.data_despesa, CURRENT_DATE), NEW.id, 'despesa'),
      (NEW.empresa_id, v_caixa, COALESCE(NEW.descricao,'Despesa'), NEW.valor, 'credito', COALESCE(NEW.data_despesa, CURRENT_DATE), NEW.id, 'despesa');
  EXCEPTION WHEN OTHERS THEN
    NULL; -- nunca bloqueia a criação da despesa
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.fo_lancar_nota()
RETURNS trigger AS $$
DECLARE v_caixa uuid; v_rec uuid;
BEGIN
  BEGIN
    IF NEW.empresa_id IS NULL OR COALESCE(NEW.valor_total,0) = 0 THEN RETURN NEW; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = NEW.empresa_id) THEN RETURN NEW; END IF;
    IF EXISTS (SELECT 1 FROM public.lancamentos WHERE nota_id = NEW.id) THEN RETURN NEW; END IF;
    PERFORM public.fo_garantir_plano_contas(NEW.empresa_id);
    SELECT id INTO v_caixa FROM public.plano_contas WHERE empresa_id = NEW.empresa_id AND nome = 'Caixa e Bancos' LIMIT 1;
    SELECT id INTO v_rec   FROM public.plano_contas WHERE empresa_id = NEW.empresa_id AND nome = 'Receita de Vendas e Serviços' LIMIT 1;
    IF v_caixa IS NULL OR v_rec IS NULL THEN RETURN NEW; END IF;
    INSERT INTO public.lancamentos (empresa_id, conta_id, descricao, valor, tipo, competencia, nota_id, origem) VALUES
      (NEW.empresa_id, v_rec,   'NF ' || COALESCE(NEW.destinatario_nome,''), NEW.valor_total, 'credito', COALESCE(NEW.created_at::date, CURRENT_DATE), NEW.id, 'nfe'),
      (NEW.empresa_id, v_caixa, 'NF ' || COALESCE(NEW.destinatario_nome,''), NEW.valor_total, 'debito',  COALESCE(NEW.created_at::date, CURRENT_DATE), NEW.id, 'nfe');
  EXCEPTION WHEN OTHERS THEN
    NULL; -- nunca bloqueia a criação da nota
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
