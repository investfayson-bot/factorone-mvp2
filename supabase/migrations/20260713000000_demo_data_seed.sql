-- Seed de dados de demonstração para teste completo do sistema
-- Popula: contas, extratos, cartões, clientes, transações, etc.

-- 1. GARANTIR QUE DEMO É ADMIN
UPDATE usuario_empresas
SET papel = 'admin'
WHERE empresa_id IN (
  SELECT id FROM empresas WHERE nome ILIKE '%demo%'
)
AND user_id IN (
  SELECT id FROM auth.users WHERE email = 'demo@factorone.com.br'
);

-- 2. CONTAS BANCÁRIAS (PJ)
INSERT INTO contas_bancarias (empresa_id, banco, agencia, conta, saldo, tipo, data_abertura, ativo)
SELECT
  e.id,
  'Banco do Brasil',
  '0001',
  '123456-7',
  45000.00,
  'corrente',
  NOW() - INTERVAL '30 days',
  true
FROM empresas e
WHERE e.nome ILIKE '%demo%'
ON CONFLICT DO NOTHING;

INSERT INTO contas_bancarias (empresa_id, banco, agencia, conta, saldo, tipo, data_abertura, ativo)
SELECT
  e.id,
  'Caixa Econômica',
  '0001',
  '234567-8',
  15000.00,
  'poupanca',
  NOW() - INTERVAL '45 days',
  true
FROM empresas e
WHERE e.nome ILIKE '%demo%'
ON CONFLICT DO NOTHING;

-- 3. EXTRATOS BANCÁRIOS
INSERT INTO extrato_bancario (empresa_id, conta_id, data_transacao, descricao, valor, tipo, saldo_posterior)
SELECT
  e.id,
  cb.id,
  NOW() - INTERVAL '5 days',
  'Venda de produtos - NF #001',
  3500.00,
  'entrada',
  45000.00
FROM empresas e
JOIN contas_bancarias cb ON e.id = cb.empresa_id
WHERE e.nome ILIKE '%demo%' AND cb.banco = 'Banco do Brasil'
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO extrato_bancario (empresa_id, conta_id, data_transacao, descricao, valor, tipo, saldo_posterior)
SELECT
  e.id,
  cb.id,
  NOW() - INTERVAL '4 days',
  'Pagamento de fornecedor',
  1200.00,
  'saida',
  43800.00
FROM empresas e
JOIN contas_bancarias cb ON e.id = cb.empresa_id
WHERE e.nome ILIKE '%demo%' AND cb.banco = 'Banco do Brasil'
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO extrato_bancario (empresa_id, conta_id, data_transacao, descricao, valor, tipo, saldo_posterior)
SELECT
  e.id,
  cb.id,
  NOW() - INTERVAL '3 days',
  'Folha de pagamento',
  8000.00,
  'saida',
  35800.00
FROM empresas e
JOIN contas_bancarias cb ON e.id = cb.empresa_id
WHERE e.nome ILIKE '%demo%' AND cb.banco = 'Banco do Brasil'
LIMIT 1
ON CONFLICT DO NOTHING;

-- 4. CARTÕES DE CRÉDITO
INSERT INTO cartoes (empresa_id, numero, bandeira, limite, saldo, data_vencimento, ativo, tipo)
SELECT
  e.id,
  '4111111111111111',
  'Visa',
  15000.00,
  3500.00,
  '2026-08-31',
  true,
  'credito'
FROM empresas e
WHERE e.nome ILIKE '%demo%'
ON CONFLICT DO NOTHING;

-- 5. TRANSAÇÕES DE CARTÃO
INSERT INTO cartao_transacoes (cartao_id, data_transacao, estabelecimento, valor, categoria, descricao, parcelado, parcelas)
SELECT
  c.id,
  NOW() - INTERVAL '2 days',
  'Supermercado ABC',
  450.50,
  'Alimentação',
  'Compras gerais',
  false,
  1
FROM cartoes c
JOIN empresas e ON c.empresa_id = e.id
WHERE e.nome ILIKE '%demo%'
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO cartao_transacoes (cartao_id, data_transacao, estabelecimento, valor, categoria, descricao, parcelado, parcelas)
SELECT
  c.id,
  NOW() - INTERVAL '1 day',
  'Combustível Shell',
  250.00,
  'Transporte',
  'Abastecimento',
  false,
  1
FROM cartoes c
JOIN empresas e ON c.empresa_id = e.id
WHERE e.nome ILIKE '%demo%'
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO cartao_transacoes (cartao_id, data_transacao, estabelecimento, valor, categoria, descricao, parcelado, parcelas)
SELECT
  c.id,
  NOW() - INTERVAL '6 days',
  'Magazine Luiza',
  2800.00,
  'Eletrônicos',
  'Compra em 12x',
  true,
  12
FROM cartoes c
JOIN empresas e ON c.empresa_id = e.id
WHERE e.nome ILIKE '%demo%'
LIMIT 1
ON CONFLICT DO NOTHING;

-- 6. CLIENTES
INSERT INTO clientes (empresa_id, nome, email, telefone, cpf_cnpj, tipo, data_criacao, ativo)
VALUES
  ((SELECT id FROM empresas WHERE nome ILIKE '%demo%' LIMIT 1), 'João Silva', 'joao@email.com', '11999999999', '123.456.789-00', 'pf', NOW() - INTERVAL '60 days', true),
  ((SELECT id FROM empresas WHERE nome ILIKE '%demo%' LIMIT 1), 'Empresa XYZ LTDA', 'contato@xyz.com', '1133333333', '12.345.678/0001-90', 'pj', NOW() - INTERVAL '45 days', true),
  ((SELECT id FROM empresas WHERE nome ILIKE '%demo%' LIMIT 1), 'Maria Santos', 'maria@email.com', '11988888888', '987.654.321-00', 'pf', NOW() - INTERVAL '30 days', true),
  ((SELECT id FROM empresas WHERE nome ILIKE '%demo%' LIMIT 1), 'Tech Solutions Inc', 'sales@techsol.com', '1144444444', '98.765.432/0001-10', 'pj', NOW() - INTERVAL '15 days', true)
ON CONFLICT DO NOTHING;

-- 7. LEADS (para integração com Telegram)
INSERT INTO leads (empresa_id, nome, email, telefone, origem, status, data_criacao)
VALUES
  ((SELECT id FROM empresas WHERE nome ILIKE '%demo%' LIMIT 1), 'Carlos Oliveira', 'carlos@email.com', '11987654321', 'Website', 'novo', NOW() - INTERVAL '7 days'),
  ((SELECT id FROM empresas WHERE nome ILIKE '%demo%' LIMIT 1), 'Ana Costa', 'ana@email.com', '11912345678', 'Telegram', 'contatado', NOW() - INTERVAL '5 days'),
  ((SELECT id FROM empresas WHERE nome ILIKE '%demo%' LIMIT 1), 'Roberto Lima', 'roberto@email.com', '11987654322', 'Website', 'novo', NOW() - INTERVAL '2 days'),
  ((SELECT id FROM empresas WHERE nome ILIKE '%demo%' LIMIT 1), 'Fernanda Dias', 'fernanda@email.com', '11912345679', 'Email', 'qualificado', NOW() - INTERVAL '1 day')
ON CONFLICT DO NOTHING;

-- 8. FATURAS/INVOICES (para contabilidade)
INSERT INTO notas_emitidas (empresa_id, numero_nf, cliente_id, valor_total, data_emissao, data_vencimento, status, descricao)
SELECT
  e.id,
  'NF-001/2026',
  (SELECT id FROM clientes c WHERE c.empresa_id = e.id LIMIT 1),
  3500.00,
  NOW() - INTERVAL '10 days',
  NOW() + INTERVAL '20 days',
  'emitida',
  'Venda de produtos - Lote A'
FROM empresas e
WHERE e.nome ILIKE '%demo%'
ON CONFLICT DO NOTHING;

INSERT INTO notas_emitidas (empresa_id, numero_nf, cliente_id, valor_total, data_emissao, data_vencimento, status, descricao)
SELECT
  e.id,
  'NF-002/2026',
  (SELECT id FROM clientes c WHERE c.empresa_id = e.id OFFSET 1 LIMIT 1),
  8500.00,
  NOW() - INTERVAL '5 days',
  NOW() + INTERVAL '25 days',
  'emitida',
  'Prestação de serviços - Consultoria'
FROM empresas e
WHERE e.nome ILIKE '%demo%'
ON CONFLICT DO NOTHING;

-- 9. DESPESAS
INSERT INTO despesas (empresa_id, descricao, valor, categoria, data_despesa, data_vencimento, status, forma_pagamento)
VALUES
  ((SELECT id FROM empresas WHERE nome ILIKE '%demo%' LIMIT 1), 'Aluguel do escritório', 3000.00, 'Aluguel', NOW() - INTERVAL '5 days', NOW() + INTERVAL '25 days', 'paga', 'transferencia'),
  ((SELECT id FROM empresas WHERE nome ILIKE '%demo%' LIMIT 1), 'Internet e telefone', 300.00, 'Utilidades', NOW() - INTERVAL '3 days', NOW() + INTERVAL '27 days', 'paga', 'boleto'),
  ((SELECT id FROM empresas WHERE nome ILIKE '%demo%' LIMIT 1), 'Material de escritório', 450.00, 'Suprimentos', NOW() - INTERVAL '2 days', NOW() + INTERVAL '28 days', 'pendente', 'credito'),
  ((SELECT id FROM empresas WHERE nome ILIKE '%demo%' LIMIT 1), 'Serviços contábeis', 1500.00, 'Serviços Profissionais', NOW() - INTERVAL '1 day', NOW() + INTERVAL '29 days', 'pendente', 'transferencia')
ON CONFLICT DO NOTHING;
