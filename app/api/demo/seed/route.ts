import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'

// Marcador para identificar linhas de demo (permite limpar só o que foi semeado).
const DEMO_TAG = '[demo]'

function d(offset: number) {
  const dt = new Date()
  dt.setDate(dt.getDate() - offset)
  return dt.toISOString().slice(0, 10)
}
function futuro(offset: number) {
  const dt = new Date()
  dt.setDate(dt.getDate() + offset)
  return dt.toISOString().slice(0, 10)
}

// tipo 'entrada'|'saida', categoria '' = a classificar
const SEED: { descricao: string; tipo: 'entrada' | 'saida'; valor: number; categoria: string; dias: number }[] = [
  // a revisar (categoria vazia)
  { descricao: 'iFood *Comida Japonesa', tipo: 'saida', valor: 184.90, categoria: '', dias: 1 },
  { descricao: 'Posto Shell BR-101', tipo: 'saida', valor: 312.00, categoria: '', dias: 1 },
  { descricao: 'AWS EMEA SARL', tipo: 'saida', valor: 742.15, categoria: '', dias: 2 },
  { descricao: 'PIX RECEBIDO — Cliente ACME Ltda', tipo: 'entrada', valor: 12500.00, categoria: '', dias: 2 },
  { descricao: 'Meta Ads (Facebook)', tipo: 'saida', valor: 1200.00, categoria: '', dias: 3 },
  { descricao: 'Tarifa pacote mensal', tipo: 'saida', valor: 49.90, categoria: '', dias: 3 },
  { descricao: 'TED — Fornecedor Aço Forte', tipo: 'saida', valor: 3800.00, categoria: '', dias: 4 },
  { descricao: 'Uber *Trip', tipo: 'saida', valor: 37.40, categoria: '', dias: 4 },
  // já classificadas
  { descricao: 'DARF — Simples Nacional', tipo: 'saida', valor: 2140.00, categoria: 'Impostos', dias: 6 },
  { descricao: 'Aluguel Sala Comercial', tipo: 'saida', valor: 4500.00, categoria: 'Aluguel', dias: 7 },
  { descricao: 'PIX RECEBIDO — Cliente Beta SA', tipo: 'entrada', valor: 8300.00, categoria: 'Receita de vendas', dias: 8 },
  { descricao: 'Folha — Salários equipe', tipo: 'saida', valor: 18400.00, categoria: 'Salários', dias: 9 },
  { descricao: 'PIX RECEBIDO — Cliente Gamma', tipo: 'entrada', valor: 6750.00, categoria: 'Receita de vendas', dias: 10 },
]

// Tabelas com dado demo, na ordem certa de limpeza (filhas antes de pais sem
// ON DELETE CASCADE). cartoes_corporativos e atendimento_conversas cascadeiam
// pros filhos sozinhos (faturas_cartao / atendimento_mensagens).
const LIMPEZA: { tabela: string; coluna: string }[] = [
  { tabela: 'crm_atividades', coluna: 'titulo' },
  { tabela: 'crm_oportunidades', coluna: 'titulo' },
  { tabela: 'clientes', coluna: 'nome' },
  { tabela: 'atendimento_conversas', coluna: 'visitante_nome' },
  { tabela: 'donna_emails_processados', coluna: 'assunto' },
  { tabela: 'cartoes_corporativos', coluna: 'nome' },
  { tabela: 'investimentos', coluna: 'nome' },
  { tabela: 'contas_bancarias', coluna: 'banco_nome' },
]

export async function POST(req: NextRequest) {
  const { user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: u } = await db.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) ?? user.id

  const body = await req.json().catch(() => ({})) as { action?: string }
  const action = body.action ?? 'seed'

  // ZERAR TUDO: apaga transações + extrato e zera os saldos (começar do zero).
  if (action === 'reset') {
    await db.from('transacoes').delete().eq('empresa_id', empresaId)
    await db.from('extrato_bancario').delete().eq('empresa_id', empresaId)
    await db.from('contas_bancarias').update({ saldo: 0, saldo_disponivel: 0 }).eq('empresa_id', empresaId)
    for (const { tabela, coluna } of LIMPEZA) {
      await db.from(tabela).delete().eq('empresa_id', empresaId).ilike(coluna, `%${DEMO_TAG}%`)
    }
    return NextResponse.json({ ok: true, reset: true })
  }

  // Limpa sempre as linhas de demo antes (idempotente); 'clear' só limpa.
  await db.from('transacoes').delete().eq('empresa_id', empresaId).ilike('descricao', `%${DEMO_TAG}%`)
  for (const { tabela, coluna } of LIMPEZA) {
    await db.from(tabela).delete().eq('empresa_id', empresaId).ilike(coluna, `%${DEMO_TAG}%`)
  }
  if (action === 'clear') return NextResponse.json({ ok: true, cleared: true })

  const resultado: Record<string, number> = {}

  // ── Transações (a classificar + já classificadas) ──────────────────────
  const rows = SEED.map(s => ({
    empresa_id: empresaId,
    descricao: `${s.descricao} ${DEMO_TAG}`,
    tipo: s.tipo,
    valor: s.valor,
    categoria: s.categoria,
    status: 'pago',
    data: d(s.dias),
  }))
  const { error: errTx } = await db.from('transacoes').insert(rows)
  if (errTx) return NextResponse.json({ error: `transacoes: ${errTx.message}` }, { status: 500 })
  resultado.transacoes = rows.length

  // ── Conta bancária (Open Finance simulado) ──────────────────────────────
  const { error: errConta } = await db.from('contas_bancarias').insert({
    empresa_id: empresaId,
    tipo: 'corrente',
    banco_nome: `Banco Simulado S.A. ${DEMO_TAG}`,
    banco_codigo: '999',
    agencia: '0001',
    numero_conta: '123456',
    digito: '7',
    saldo: 48250.30,
    saldo_disponivel: 46800.30,
    is_principal: false,
    open_finance_id: `demo-${randomUUID()}`,
    status: 'ativa',
  })
  if (errConta) return NextResponse.json({ error: `contas_bancarias: ${errConta.message}`, parcial: resultado }, { status: 500 })
  resultado.contas_bancarias = 1

  // ── Cartão corporativo + fatura do mês ───────────────────────────────────
  const { data: cartao, error: errCartao } = await db.from('cartoes_corporativos').insert({
    empresa_id: empresaId,
    nome: `Cartão Equipe Comercial ${DEMO_TAG}`,
    bandeira: 'Mastercard',
    limite: 15000,
    limite_disponivel: 9350,
    vencimento_dia: 10,
    fechamento_dia: 1,
    cor: '#2B564D',
    status: 'ativo',
    tipo: 'credito',
    formato: 'fisico',
    titular_nome: 'Ana Ferreira',
    titular_email: 'ana@empresa-demo.com.br',
    pausado: false,
  }).select('id').single()
  if (errCartao) return NextResponse.json({ error: `cartoes_corporativos: ${errCartao.message}`, parcial: resultado }, { status: 500 })
  resultado.cartoes = 1

  const competencia = new Date().toISOString().slice(0, 7)
  await db.from('faturas_cartao').insert({
    empresa_id: empresaId,
    cartao_id: (cartao as { id: string }).id,
    competencia,
    valor_total: 5650.00,
    status: 'aberta',
    fechamento_data: futuro(15),
    vencimento_data: futuro(24),
  })

  // ── Investimentos ────────────────────────────────────────────────────────
  const investimentos = [
    { tipo: 'cdb', nome: `CDB Banco XP 118% CDI ${DEMO_TAG}`, valor_aplicado: 50000, valor_atual: 52340, percentual_cdi: 118, data_aplicacao: d(120) },
    { tipo: 'tesouro_direto', nome: `Tesouro Selic 2029 ${DEMO_TAG}`, valor_aplicado: 20000, valor_atual: 20890, percentual_cdi: 100, data_aplicacao: d(200) },
  ]
  const { error: errInv } = await db.from('investimentos').insert(investimentos.map(i => ({
    empresa_id: empresaId, tipo: i.tipo, nome: i.nome, valor_aplicado: i.valor_aplicado, valor_atual: i.valor_atual,
    percentual_cdi: i.percentual_cdi, data_aplicacao: i.data_aplicacao, status: 'ativo',
  })))
  if (errInv) return NextResponse.json({ error: `investimentos: ${errInv.message}`, parcial: resultado }, { status: 500 })
  resultado.investimentos = investimentos.length

  // ── CRM: cliente + oportunidade (pipeline) + atividade (follow-up) ──────
  const { data: cliente, error: errCliente } = await db.from('clientes').insert({
    empresa_id: empresaId,
    nome: `Construtora Horizonte Ltda ${DEMO_TAG}`,
    tipo: 'pj',
    email: 'contato@horizonte-demo.com.br',
    telefone: '(11) 98888-1234',
    segmento: 'Construção civil',
    status: 'ativo',
    origem: 'Indicação',
  }).select('id').single()
  if (errCliente) return NextResponse.json({ error: `clientes: ${errCliente.message}`, parcial: resultado }, { status: 500 })
  resultado.clientes = 1
  const clienteId = (cliente as { id: string }).id

  const { data: oportunidade, error: errOp } = await db.from('crm_oportunidades').insert({
    empresa_id: empresaId,
    cliente_id: clienteId,
    titulo: `Proposta reforma comercial ${DEMO_TAG}`,
    valor: 84000,
    etapa: 'negociacao',
    probabilidade: 60,
    data_fechamento: futuro(12),
    responsavel_nome: 'Ana Ferreira',
    descricao: 'Cliente pediu revisão de escopo — aguardando retorno.',
  }).select('id').single()
  if (errOp) return NextResponse.json({ error: `crm_oportunidades: ${errOp.message}`, parcial: resultado }, { status: 500 })
  resultado.oportunidades = 1

  await db.from('crm_atividades').insert({
    empresa_id: empresaId,
    cliente_id: clienteId,
    oportunidade_id: (oportunidade as { id: string }).id,
    tipo: 'ligacao',
    titulo: `Follow-up proposta Horizonte ${DEMO_TAG}`,
    descricao: 'Ligar pra saber se aprovaram o orçamento revisado.',
    data: futuro(1),
    status: 'pendente',
    responsavel_nome: 'Ana Ferreira',
    lembrete: true,
  })
  resultado.atividades = 1

  // ── Conversa (Agentes IA — widget do site, aguardando humano) ────────────
  // NOTA: colunas `motivo` e `canal` (migrations 20260711010000/020000) ainda
  // não existem no banco remoto — ver aviso separado. Omitidas aqui até serem
  // aplicadas, senão o insert falha inteiro.
  const { data: conversa, error: errConv } = await db.from('atendimento_conversas').insert({
    empresa_id: empresaId,
    visitante_nome: `Rafael Souza ${DEMO_TAG}`,
    visitante_email: 'rafael.souza@exemplo.com',
    status: 'aguardando_humano',
  }).select('id').single()
  if (errConv) return NextResponse.json({ error: `atendimento_conversas: ${errConv.message}`, parcial: resultado }, { status: 500 })
  resultado.conversas = 1

  await db.from('atendimento_mensagens').insert([
    { conversa_id: (conversa as { id: string }).id, empresa_id: empresaId, autor: 'visitante', texto: 'Oi, vocês fazem desconto pra pagamento à vista?' },
    { conversa_id: (conversa as { id: string }).id, empresa_id: empresaId, autor: 'donna', texto: 'Consigo até 5% de desconto à vista. Você quer fechar assim?' },
    { conversa_id: (conversa as { id: string }).id, empresa_id: empresaId, autor: 'visitante', texto: 'Consegue 10%? É um projeto grande.' },
  ])

  // ── E-mail (Donna — pendente de aprovação, aparece em "Precisamos de você") ─
  await db.from('donna_emails_processados').insert({
    empresa_id: empresaId,
    gmail_message_id: `demo-${randomUUID()}`,
    remetente: 'financeiro@fornecedor-demo.com.br',
    assunto: `Cobrança em atraso — fatura #4021 ${DEMO_TAG}`,
    snippet: 'Identificamos que a fatura #4021 venceu há 3 dias. Poderiam confirmar o pagamento?',
    autonomia_aplicada: 'rascunho',
    acao: 'rascunho_criado',
    corpo_resposta: 'Olá! Peço desculpas pelo atraso, o pagamento será feito ainda hoje. Qualquer dúvida, seguimos à disposição.',
    status: 'pendente_aprovacao',
  })
  resultado.emails = 1

  return NextResponse.json({ ok: true, inseridas: resultado })
}
