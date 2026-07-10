-- Nível de detalhe do relatório mensal automático enviado por e-mail ao
-- admin da empresa. 'resumo' = receita/despesa/saldo do mês. 'completo' =
-- resumo + quebra por categoria (mesma fonte de dado do DRE) — fica pra
-- uma segunda iteração; o cron atual só usa 'resumo'.
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS relatorio_mensal_nivel text
  CHECK (relatorio_mensal_nivel IN ('resumo', 'completo')) DEFAULT 'resumo';
