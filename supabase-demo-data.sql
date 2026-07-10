-- Cole este SQL DEPOIS de criar a conta demo no app
-- Substitua 'EMPRESA_ID_AQUI' pelo ID real da empresa (veja na tabela empresas)

-- Para pegar o ID: 
-- SELECT id FROM empresas LIMIT 1;

-- Depois cole com o ID real:
UPDATE metricas SET
  saldo = 487320,
  mrr = 284500,
  burn_rate = 42300,
  runway = 8,
  receita_mes = 312000,
  despesas_mes = 194000,
  lucro_mes = 118000,
  a_receber = 156800,
  a_pagar = 94200
WHERE empresa_id = (SELECT id FROM empresas LIMIT 1);

INSERT INTO despesas (empresa_id, descricao, valor, categoria, data, status) 
SELECT id, 'AWS — Infraestrutura Cloud', 8420, 'Tecnologia', current_date - 2, 'pago' FROM empresas LIMIT 1;

INSERT INTO despesas (empresa_id, descricao, valor, categoria, data, status)
SELECT id, 'Meta Ads — Campanha Q1', 15800, 'Marketing', current_date - 3, 'pago' FROM empresas LIMIT 1;

INSERT INTO despesas (empresa_id, descricao, valor, categoria, data, status)
SELECT id, 'Folha de Pagamento', 42000, 'RH', current_date - 5, 'pago' FROM empresas LIMIT 1;

INSERT INTO despesas (empresa_id, descricao, valor, categoria, data, status)
SELECT id, 'HubSpot CRM', 2100, 'Software', current_date - 6, 'pago' FROM empresas LIMIT 1;

INSERT INTO despesas (empresa_id, descricao, valor, categoria, data, status)
SELECT id, 'Assessoria Jurídica', 4500, 'Jurídico', current_date - 7, 'aprovacao' FROM empresas LIMIT 1;

INSERT INTO invoices (empresa_id, numero, cliente_nome, valor, vencimento, status)
SELECT id, 'INV-2024', 'TechStart Ltda', 18500, current_date - 2, 'vencida' FROM empresas LIMIT 1;

INSERT INTO invoices (empresa_id, numero, cliente_nome, valor, vencimento, status)
SELECT id, 'INV-2025', 'Agência Boom', 9200, current_date + 6, 'pendente' FROM empresas LIMIT 1;

INSERT INTO invoices (empresa_id, numero, cliente_nome, valor, vencimento, status)
SELECT id, 'INV-2026', 'E-commerce Pro', 34000, current_date + 11, 'enviada' FROM empresas LIMIT 1;
