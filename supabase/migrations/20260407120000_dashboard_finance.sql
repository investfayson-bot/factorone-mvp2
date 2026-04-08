-- Colunas para vencimentos e competência (compatível com app existente)
ALTER TABLE public.transacoes ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE public.transacoes ADD COLUMN IF NOT EXISTS competencia DATE;

-- Status estendido: app aceita pendente | pago | cancelado | confirmada (legado)
-- Sem CHECK rígido na tabela legada para não quebrar dados existentes

-- View "transactions" (leitura) — mapeia entrada/saida → receita/despesa
CREATE OR REPLACE VIEW public.transactions AS
SELECT
  t.id,
  t.empresa_id,
  t.descricao,
  t.categoria,
  t.valor,
  CASE WHEN t.tipo = 'entrada' THEN 'receita' ELSE 'despesa' END::text AS tipo,
  CASE
    WHEN t.status IN ('confirmada', 'pago') THEN 'pago'
    WHEN t.status = 'cancelado' THEN 'cancelado'
    ELSE COALESCE(NULLIF(TRIM(t.status), ''), 'pendente')
  END::text AS status,
  t.due_date,
  COALESCE(t.competencia, t.data)::date AS competencia,
  t.data,
  t.created_at
FROM public.transacoes t;

COMMENT ON VIEW public.transactions IS 'Alias de leitura sobre transacoes; INSERT/UPDATE via tabela transacoes.';

-- Tabela empresas: o projeto pode já ter definição em supabase-schema.sql / produção.
-- Não recriamos aqui para evitar conflito de colunas com instalações existentes.
