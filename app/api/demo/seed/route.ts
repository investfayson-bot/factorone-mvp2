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
  { tabela: 'propostas', coluna: 'cliente' },
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

  // ── Conta bancária (Open Finance simulado) + extrato ────────────────────
  const { data: conta, error: errConta } = await db.from('contas_bancarias').insert({
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
  }).select('id').single()
  if (errConta) return NextResponse.json({ error: `contas_bancarias: ${errConta.message}`, parcial: resultado }, { status: 500 })
  resultado.contas_bancarias = 1
  const contaId = (conta as { id: string }).id

  // Extrato (Banco > Extrato) é alimentado por extrato_bancario, tabela
  // separada de `transacoes` (Visão Geral) — sem isso a tela fica vazia
  // mesmo com transações semeadas. Duas pendentes de classificação, pra
  // testar o fluxo de "aguardando OK".
  const extratoRows: { descricao: string; valor: number; tipo: 'credito' | 'debito'; categoria: string | null; status_classificacao: 'sugerida' | 'confirmada'; dias: number }[] = [
    { descricao: `Netflix.com`, valor: 55.90, tipo: 'debito', categoria: null, status_classificacao: 'sugerida', dias: 1 },
    { descricao: `Disney Plus`, valor: 37.90, tipo: 'debito', categoria: null, status_classificacao: 'sugerida', dias: 2 },
    { descricao: `PIX RECEBIDO — Cliente ACME Ltda`, valor: 12500.00, tipo: 'credito', categoria: 'Receita de vendas', status_classificacao: 'confirmada', dias: 2 },
    { descricao: `Aluguel Sala Comercial`, valor: 4500.00, tipo: 'debito', categoria: 'Aluguel/Infraestrutura', status_classificacao: 'confirmada', dias: 5 },
  ]
  const { error: errExtrato } = await db.from('extrato_bancario').insert(extratoRows.map(e => ({
    conta_id: contaId, empresa_id: empresaId, descricao: `${e.descricao} ${DEMO_TAG}`, valor: e.valor, tipo: e.tipo,
    categoria: e.categoria, status_classificacao: e.status_classificacao, data_transacao: d(e.dias),
  })))
  if (errExtrato) return NextResponse.json({ error: `extrato_bancario: ${errExtrato.message}`, parcial: resultado }, { status: 500 })
  resultado.extrato = extratoRows.length

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

  // ── CRM: vários clientes em etapas diferentes do pipeline, com follow-up,
  // ofertas, timeline e propostas — pra Clientes & Vendas não ficar com um
  // cenário só. Cobre visão-geral, pipeline, ofertas, propostas, pós-venda
  // e agendamento (cada um lê uma combinação diferente dessas tabelas).
  const CLIENTES_SEED = [
    { nome: 'Construtora Horizonte Ltda', tipo: 'pj' as const, email: 'contato@horizonte-demo.com.br', telefone: '(11) 98888-1234', segmento: 'Construção civil', status: 'ativo', origem: 'Indicação' },
    { nome: 'Studio Betoni Arquitetura', tipo: 'pj' as const, email: 'ola@betoni-demo.com.br', telefone: '(11) 97777-4321', segmento: 'Arquitetura', status: 'prospect', origem: 'Site' },
    { nome: 'Mercado Bom Preço', tipo: 'pj' as const, email: 'compras@bompreco-demo.com.br', telefone: '(21) 96666-8899', segmento: 'Varejo alimentício', status: 'ativo', origem: 'Indicação' },
    { nome: 'Clínica Vitalis', tipo: 'pj' as const, email: 'financeiro@vitalis-demo.com.br', telefone: '(31) 95555-2200', segmento: 'Saúde', status: 'churned', origem: 'Evento' },
  ]
  const { data: clientesInseridos, error: errCliente } = await db.from('clientes').insert(
    CLIENTES_SEED.map(c => ({ empresa_id: empresaId, nome: `${c.nome} ${DEMO_TAG}`, tipo: c.tipo, email: c.email, telefone: c.telefone, segmento: c.segmento, status: c.status, origem: c.origem }))
  ).select('id,nome')
  if (errCliente) return NextResponse.json({ error: `clientes: ${errCliente.message}`, parcial: resultado }, { status: 500 })
  resultado.clientes = clientesInseridos!.length
  const cid = (nomeParcial: string) => (clientesInseridos as { id: string; nome: string }[]).find(c => c.nome.startsWith(nomeParcial))!.id

  const OPORTUNIDADES_SEED = [
    { cliente: 'Construtora Horizonte', titulo: 'Proposta reforma comercial', valor: 84000, etapa: 'negociacao', probabilidade: 60, dataFechamento: futuro(12), descricao: 'Cliente pediu revisão de escopo — aguardando retorno.' },
    { cliente: 'Studio Betoni', titulo: 'Consultoria de projeto residencial', valor: 18500, etapa: 'qualificado', probabilidade: 30, dataFechamento: futuro(25), descricao: 'Primeira reunião feita, aguardando briefing detalhado.' },
    { cliente: 'Mercado Bom Preço', titulo: 'Contrato anual de manutenção', valor: 45600, etapa: 'proposta', probabilidade: 50, dataFechamento: futuro(8), descricao: 'Proposta enviada, cliente comparando com concorrente.' },
    { cliente: 'Mercado Bom Preço', titulo: 'Expansão loja 2 — mobiliário', valor: 132000, etapa: 'fechado_ganho', probabilidade: 100, dataFechamento: d(5), descricao: 'Contrato assinado, início da obra na próxima semana.' },
    { cliente: 'Clínica Vitalis', titulo: 'Reforma sala de espera', valor: 27300, etapa: 'fechado_perdido', probabilidade: 0, dataFechamento: d(20), descricao: null, motivoPerda: 'Cliente fechou com concorrente por preço.' },
  ]
  const { data: opsInseridas, error: errOp } = await db.from('crm_oportunidades').insert(
    OPORTUNIDADES_SEED.map(o => ({
      empresa_id: empresaId, cliente_id: cid(o.cliente), titulo: `${o.titulo} ${DEMO_TAG}`, valor: o.valor, etapa: o.etapa,
      probabilidade: o.probabilidade, data_fechamento: o.dataFechamento, responsavel_nome: 'Ana Ferreira',
      descricao: o.descricao, motivo_perda: o.motivoPerda ?? null,
    }))
  ).select('id,titulo,etapa')
  if (errOp) return NextResponse.json({ error: `crm_oportunidades: ${errOp.message}`, parcial: resultado }, { status: 500 })
  resultado.oportunidades = opsInseridas!.length
  const opsPorTitulo = opsInseridas as { id: string; titulo: string; etapa: string }[]
  const opId = (tituloParcial: string) => opsPorTitulo.find(o => o.titulo.startsWith(tituloParcial))!.id
  const opGanha = opsPorTitulo.find(o => o.etapa === 'fechado_ganho')!.id
  const opNegociacao = opId('Proposta reforma comercial')
  const opProposta = opId('Contrato anual de manutenção')

  const ATIVIDADES_SEED = [
    { cliente: 'Construtora Horizonte', op: opNegociacao, tipo: 'ligacao', titulo: 'Follow-up proposta Horizonte', descricao: 'Ligar pra saber se aprovaram o orçamento revisado.', data: futuro(1), status: 'pendente', lembrete: true },
    { cliente: 'Studio Betoni', op: null, tipo: 'reuniao', titulo: 'Reunião de briefing Betoni', descricao: 'Alinhar escopo do projeto residencial.', data: futuro(3), status: 'pendente', lembrete: true },
    { cliente: 'Mercado Bom Preço', op: opProposta, tipo: 'email', titulo: 'Reenviar proposta com desconto', descricao: 'Cliente pediu revisão de valor — mandar nova versão.', data: d(1), status: 'pendente', lembrete: false },
    { cliente: 'Mercado Bom Preço', op: opGanha, tipo: 'visita', titulo: 'Visita técnica loja 2', descricao: 'Medir espaço antes da entrega do mobiliário.', data: d(3), status: 'realizada', lembrete: false },
    { cliente: 'Clínica Vitalis', op: null, tipo: 'tarefa', titulo: 'Enviar pesquisa de motivo de perda', descricao: null, data: d(10), status: 'realizada', lembrete: false },
  ]
  const { error: errAtiv } = await db.from('crm_atividades').insert(
    ATIVIDADES_SEED.map(a => ({
      empresa_id: empresaId, cliente_id: cid(a.cliente), oportunidade_id: a.op, tipo: a.tipo,
      titulo: `${a.titulo} ${DEMO_TAG}`, descricao: a.descricao, data: a.data, status: a.status,
      responsavel_nome: 'Ana Ferreira', lembrete: a.lembrete,
    }))
  )
  if (errAtiv) return NextResponse.json({ error: `crm_atividades: ${errAtiv.message}`, parcial: resultado }, { status: 500 })
  resultado.atividades = ATIVIDADES_SEED.length

  const { error: errOfertas } = await db.from('crm_ofertas').insert([
    { empresa_id: empresaId, oportunidade_id: opProposta, desconto_pct: 8, status: 'aguardando', canal: 'e-mail', automatica: false },
    { empresa_id: empresaId, oportunidade_id: opGanha, desconto_pct: 5, status: 'aceita', canal: 'whatsapp', automatica: true },
    { empresa_id: empresaId, oportunidade_id: opNegociacao, desconto_pct: 12, status: 'recusada', canal: 'e-mail', automatica: false },
  ])
  if (errOfertas) return NextResponse.json({ error: `crm_ofertas: ${errOfertas.message}`, parcial: resultado }, { status: 500 })
  resultado.ofertas = 3

  await db.from('crm_negociacao_eventos').insert([
    { empresa_id: empresaId, oportunidade_id: opNegociacao, origem: 'humano', titulo: 'Proposta enviada por e-mail', detalhe: 'Valor: R$ 84.000, condições em 3x.' },
    { empresa_id: empresaId, oportunidade_id: opNegociacao, origem: 'ia', titulo: 'Cliente pediu desconto de 12%', detalhe: 'Acima da alçada automática — transferido pra você.' },
    { empresa_id: empresaId, oportunidade_id: opGanha, origem: 'humano', titulo: 'Contrato assinado', detalhe: 'Assinatura via DocuSign em ' + d(5) + '.' },
  ])

  const { error: errProp } = await db.from('propostas').insert([
    { empresa_id: empresaId, cliente: `Construtora Horizonte Ltda ${DEMO_TAG}`, titulo: 'Reforma comercial — 3 pavimentos', valor: 84000, status: 'enviada', validade: futuro(15) },
    { empresa_id: empresaId, cliente: `Mercado Bom Preço ${DEMO_TAG}`, titulo: 'Contrato anual de manutenção', valor: 45600, status: 'enviada', validade: futuro(7) },
    { empresa_id: empresaId, cliente: `Mercado Bom Preço ${DEMO_TAG}`, titulo: 'Expansão loja 2 — mobiliário', valor: 132000, status: 'aceita', validade: d(2) },
    { empresa_id: empresaId, cliente: `Clínica Vitalis ${DEMO_TAG}`, titulo: 'Reforma sala de espera', valor: 27300, status: 'recusada', validade: d(15) },
  ])
  if (errProp) return NextResponse.json({ error: `propostas: ${errProp.message}`, parcial: resultado }, { status: 500 })
  resultado.propostas = 4

  // ── Conversa (Agentes IA — widget do site, aguardando humano) ────────────
  const { data: conversa, error: errConv } = await db.from('atendimento_conversas').insert({
    empresa_id: empresaId,
    visitante_nome: `Rafael Souza ${DEMO_TAG}`,
    visitante_email: 'rafael.souza@exemplo.com',
    status: 'aguardando_humano',
    motivo: 'Cliente pediu desconto acima do limite da IA — precisa de aprovação humana.',
    canal: 'site',
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
