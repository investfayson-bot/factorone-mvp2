import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { registrarAcaoAgente } from '@/lib/agentes-log'
import { encontrarRegra, type Regra } from '@/lib/donna/regras'
import { processarMensagemVisitante } from '@/lib/donna/site-agent'
import { checkRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
}

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// Telegram manda esse header quando o webhook é registrado com secret_token.
// Sem secret configurado = rejeita tudo (mesmo padrão do webhook do LifeOS).
function autenticar(req: NextRequest): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!secret) return false
  return req.headers.get('x-telegram-bot-api-secret-token') === secret
}

async function sendTelegram(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
}

export async function GET() {
  return NextResponse.json({ status: 'ok', servico: 'FactorOne Telegram Webhook' })
}

const TIPOS_ATIVIDADE = ['reuniao', 'ligacao', 'email', 'tarefa', 'visita', 'whatsapp', 'outro'] as const

type ExtracaoAgendamento = {
  eh_agendamento: boolean
  cliente: string | null
  data: string | null
  hora_inicio: string | null
  tipo: typeof TIPOS_ATIVIDADE[number]
  titulo: string
}

// Extrai a intenção de agendamento da mensagem (sem gravar nada ainda).
async function extrairAgendamento(texto: string): Promise<ExtracaoAgendamento | null> {
  const hoje = new Date()
  const hojeStr = hoje.toISOString().slice(0, 10)
  const diaSemana = hoje.toLocaleDateString('pt-BR', { weekday: 'long' })
  try {
    const completion = await getAnthropic().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: `Você extrai dados de agendamento de mensagens em português do Brasil. Hoje é ${hojeStr} (${diaSemana}).
Responda APENAS com um JSON válido, sem markdown, sem texto antes ou depois, no formato exato:
{"eh_agendamento": boolean, "cliente": string|null, "data": "YYYY-MM-DD"|null, "hora_inicio": "HH:MM"|null, "tipo": "reuniao"|"ligacao"|"email"|"tarefa"|"visita"|"whatsapp"|"outro", "titulo": string}
Use "eh_agendamento": false se a mensagem não for um pedido claro de marcar/agendar algo, ou se não conseguir identificar a data com confiança.
Resolva datas relativas (amanhã, sexta, dia 15) usando a data de hoje acima.`,
      messages: [{ role: 'user', content: texto }],
    })
    const raw = completion.content[0]?.type === 'text' ? completion.content[0].text : ''
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return null
    const extraido = JSON.parse(match[0]) as ExtracaoAgendamento
    if (!extraido.eh_agendamento || !extraido.data) return null
    return extraido
  } catch {
    return null
  }
}

// Grava de verdade em crm_atividades e devolve a mensagem de confirmação —
// o "agente que age", não só responde. Só é chamada quando a autonomia
// (donna_regras, canal telegram) autoriza ação automática, ou depois que o
// usuário confirmou um rascunho.
async function commitAgendamento(
  supabase: ReturnType<typeof db>,
  empresaId: string,
  extraido: ExtracaoAgendamento,
  textoOriginal: string
): Promise<string> {
  let clienteId: string | null = null
  if (extraido.cliente) {
    const { data: cliente } = await supabase
      .from('clientes')
      .select('id, nome')
      .eq('empresa_id', empresaId)
      .ilike('nome', `%${extraido.cliente}%`)
      .limit(1)
      .maybeSingle()
    clienteId = (cliente?.id as string) ?? null
  }

  const tipo = TIPOS_ATIVIDADE.includes(extraido.tipo) ? extraido.tipo : 'tarefa'
  const { error } = await supabase.from('crm_atividades').insert({
    empresa_id: empresaId,
    cliente_id: clienteId,
    tipo,
    titulo: extraido.titulo || textoOriginal.slice(0, 80),
    descricao: textoOriginal,
    data: extraido.data,
    hora_inicio: extraido.hora_inicio,
    status: 'pendente',
    lembrete: true,
  })
  if (error) return 'Entendi o pedido, mas não consegui salvar no CRM agora. Tenta de novo?'

  await registrarAcaoAgente(supabase, empresaId, 'donna', `Agendou ${tipo}${extraido.cliente ? ` com ${extraido.cliente}` : ''} via Telegram`, { detalhe: extraido.titulo })

  const dataFmt = new Date(`${extraido.data}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
  const horaFmt = extraido.hora_inicio ? ` às ${extraido.hora_inicio}` : ''
  const quemFmt = extraido.cliente ? ` com ${extraido.cliente}` : ''
  return `Feito! Agendei ${tipo}${quemFmt} pra ${dataFmt}${horaFmt}. Já está no seu CRM (aba Agenda).`
}

// Bot de atendimento a cliente via deep link (t.me/<bot>?start=<empresaId>):
// o dono do negócio divulga esse link pros próprios clientes, que ficam
// numa conversa de cliente (atendimento_conversas, canal telegram) —
// completamente separada do assistente pessoal (usuarios.telegram_chat_id).
// É um bot global (1 token pra todo o FactorOne) — o mesmo chatId PODE ser
// cliente de mais de uma empresa ao mesmo tempo, de propósito (cada empresa
// tem seu próprio link). A unicidade de verdade é por empresa (índice único
// empresa_id+canal+canal_identificador), não global.
async function abrirConversaCliente(supabase: ReturnType<typeof db>, empresaId: string, chatId: string): Promise<string> {
  const { data, error } = await supabase
    .from('atendimento_conversas')
    .upsert(
      { empresa_id: empresaId, canal: 'telegram', canal_identificador: chatId, visitante_nome: 'Contato via Telegram', status: 'aberta' },
      { onConflict: 'empresa_id,canal,canal_identificador', ignoreDuplicates: true }
    )
    .select('id')
    .maybeSingle()
  if (data) return data.id as string
  if (error) throw error

  // ignoreDuplicates não devolve a linha existente — busca de novo.
  const { data: existente } = await supabase
    .from('atendimento_conversas')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('canal', 'telegram')
    .eq('canal_identificador', chatId)
    .single()
  return existente!.id as string
}

async function atenderClienteTelegram(supabase: ReturnType<typeof db>, empresaId: string, conversaId: string, chatId: string, texto: string): Promise<void> {
  await supabase.from('atendimento_mensagens').insert({ conversa_id: conversaId, empresa_id: empresaId, autor: 'visitante', texto })
  const { data: regrasData } = await supabase.from('donna_regras').select('*').eq('empresa_id', empresaId).eq('ativa', true)
  await processarMensagemVisitante(supabase, empresaId, conversaId, texto, (regrasData ?? []) as Regra[], 'telegram', t => sendTelegram(chatId, t))
}

const ACAO_PENDENTE = 'aguardando_confirmacao_agendamento'
const AFIRMATIVO = /^(sim|s|ss|confirma|confirmado|pode|pode sim|ok|okay|beleza|isso|exato|correto|manda)\b/i

// Se a regra da Donna pra Telegram exigir aprovação, ela pergunta antes de
// agendar; a confirmação do usuário no próximo turno é resolvida aqui,
// olhando o último "pedido pendente" registrado no log de ações.
async function tentarConfirmarPendente(
  supabase: ReturnType<typeof db>,
  empresaId: string,
  texto: string
): Promise<string | null> {
  if (!AFIRMATIVO.test(texto.trim())) return null
  const dezMinAtras = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { data: pendente } = await supabase
    .from('agentes_acoes')
    .select('id, detalhe')
    .eq('empresa_id', empresaId)
    .eq('agente_id', 'donna')
    .eq('acao', ACAO_PENDENTE)
    .gt('created_at', dezMinAtras)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!pendente?.detalhe) return null

  await supabase.from('agentes_acoes').delete().eq('id', pendente.id)
  try {
    const { extraido, textoOriginal } = JSON.parse(pendente.detalhe) as { extraido: ExtracaoAgendamento; textoOriginal: string }
    return await commitAgendamento(supabase, empresaId, extraido, textoOriginal)
  } catch {
    return null
  }
}

// Ponto de entrada: extrai, casa a regra de autonomia do canal 'telegram' e
// decide entre agendar direto ou pedir confirmação antes.
async function tentarAgendar(
  supabase: ReturnType<typeof db>,
  empresaId: string,
  texto: string
): Promise<string | null> {
  const extraido = await extrairAgendamento(texto)
  if (!extraido) return null

  const { data: regrasData } = await supabase.from('donna_regras').select('*').eq('empresa_id', empresaId).eq('ativa', true)
  const regra = encontrarRegra((regrasData ?? []) as Regra[], 'telegram', texto)
  // Sem regra que capture isso, mantém o comportamento histórico (agenda direto)
  // pra não regredir quem já usa — só vira "pergunta antes" com regra explícita.
  const autonomia = regra?.autonomia ?? 'automatico'

  if (autonomia === 'automatico') {
    return commitAgendamento(supabase, empresaId, extraido, texto)
  }

  await registrarAcaoAgente(supabase, empresaId, 'donna', ACAO_PENDENTE, { detalhe: JSON.stringify({ extraido, textoOriginal: texto }) })
  const dataFmt = new Date(`${extraido.data}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
  const horaFmt = extraido.hora_inicio ? ` às ${extraido.hora_inicio}` : ''
  const quemFmt = extraido.cliente ? ` com ${extraido.cliente}` : ''
  return `Posso marcar ${extraido.tipo}${quemFmt} pra ${dataFmt}${horaFmt}? Responde "sim" que eu confirmo.`
}

export async function POST(req: NextRequest) {
  if (!autenticar(req)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const body = await req.json().catch(() => ({})) as { message?: { chat?: { id?: number }; text?: string } }
    const message = body.message
    const chatId = message?.chat?.id != null ? String(message.chat.id) : ''
    const texto = (message?.text ?? '').trim()
    if (!chatId || !texto) return NextResponse.json({ ok: true })

    const supabase = db()
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('id, empresa_id, nome')
      .eq('telegram_chat_id', chatId)
      .maybeSingle()

    // Conta ainda não vinculada a este chat como dono — pode ser: deep link de
    // cliente (/start <empresaId>), continuação de uma conversa de cliente já
    // aberta, pareamento por código (dono), ou desconhecido.
    if (!usuario) {
      const deepLinkMatch = texto.match(/^\/start\s+([0-9a-f-]{36})$/i)
      if (deepLinkMatch) {
        if (!checkRateLimit(`tg-start:${chatId}`, 5, 60_000).allowed) return NextResponse.json({ ok: true })
        const empresaId = deepLinkMatch[1]
        const { data: donoValido } = await supabase.from('usuarios').select('id').eq('empresa_id', empresaId).limit(1).maybeSingle()
        if (!donoValido) {
          await sendTelegram(chatId, 'Esse link não parece válido. Confere com quem te mandou.')
          return NextResponse.json({ ok: true })
        }
        await abrirConversaCliente(supabase, empresaId, chatId)
        await sendTelegram(chatId, 'Oi! Pode mandar sua dúvida que eu já te ajudo.')
        return NextResponse.json({ ok: true })
      }

      // O mesmo chatId pode ter uma atendimento_conversas em mais de uma
      // empresa (bot global, várias empresas divulgando o próprio link) —
      // sem jeito de saber qual empresa essa mensagem solta é "pra". Rotear
      // pra conversa mais recentemente ativa é a melhor aproximação (é o que
      // qualquer app de chat faria); nunca escolher arbitrariamente.
      const { data: conversasCliente } = await supabase
        .from('atendimento_conversas')
        .select('id, empresa_id')
        .eq('canal', 'telegram')
        .eq('canal_identificador', chatId)
        .order('updated_at', { ascending: false })
        .limit(1)
      const conversaCliente = conversasCliente?.[0]
      if (conversaCliente) {
        if (!checkRateLimit(`tg-cliente:${chatId}`, 15, 60_000).allowed || !checkRateLimit(`tg-empresa:${conversaCliente.empresa_id}`, 60, 3_600_000).allowed) {
          return NextResponse.json({ ok: true })
        }
        await atenderClienteTelegram(supabase, conversaCliente.empresa_id as string, conversaCliente.id as string, chatId, texto)
        return NextResponse.json({ ok: true })
      }

      if (texto === '/start') {
        await sendTelegram(chatId, 'Oi! Sou o assistente do FactorOne. Pra te reconhecer, gere um código em /dashboard/integracoes (Telegram) e me manda o código aqui.')
        return NextResponse.json({ ok: true })
      }

      const codigo = texto.replace(/\D/g, '')
      if (codigo.length === 6) {
        const { data: pendente } = await supabase
          .from('usuarios')
          .select('id')
          .eq('telegram_link_code', codigo)
          .gt('telegram_link_code_exp', new Date().toISOString())
          .maybeSingle()

        if (pendente) {
          const { error } = await supabase
            .from('usuarios')
            .update({ telegram_chat_id: chatId, telegram_link_code: null, telegram_link_code_exp: null })
            .eq('id', pendente.id)
          if (error) {
            await sendTelegram(chatId, 'Esse Telegram já está vinculado a outra conta FactorOne.')
          } else {
            await sendTelegram(chatId, 'Conta vinculada! Pode perguntar sobre suas finanças a qualquer hora — saldo, contas a vencer, DAS, o que quiser.')
          }
          return NextResponse.json({ ok: true })
        }
      }

      await sendTelegram(chatId, 'Não te reconheço ainda. Gere um código em /dashboard/integracoes (Telegram) e manda esse código aqui pra vincular sua conta.')
      return NextResponse.json({ ok: true })
    }

    // Conta vinculada. Uma resposta curta afirmativa pode estar confirmando um
    // agendamento que a Donna deixou pendente (regra 'rascunho') — checa isso
    // independente de bater a palavra-chave de agendamento.
    const empresaIdTg = usuario.empresa_id as string
    const confirmacaoPendente = await tentarConfirmarPendente(supabase, empresaIdTg, texto)
    if (confirmacaoPendente) {
      await sendTelegram(chatId, confirmacaoPendente)
      return NextResponse.json({ ok: true })
    }

    // Se parecer um pedido de agendamento, tenta agir de verdade (cria em
    // crm_atividades, ou pergunta antes conforme a regra de autonomia) em vez
    // de só responder em texto.
    if (/\b(marca|marque|agend|reuni[ãa]o|visita|compromisso|lembr|liga[çc][ãa]o|ligar para)\b/i.test(texto)) {
      const acao = await tentarAgendar(supabase, empresaIdTg, texto)
      if (acao) {
        await sendTelegram(chatId, acao)
        return NextResponse.json({ ok: true })
      }
      // confiança baixa na extração — segue pro fluxo normal de resposta
    }

    // Conta vinculada — busca contexto financeiro real e responde.
    const empresaId = usuario.empresa_id as string
    const hoje = new Date()
    const inicioMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
    const em7 = new Date(hoje.getTime() + 7 * 86400000).toISOString().slice(0, 10)

    const [txRes, contasRes, pagarRes] = await Promise.all([
      supabase.from('transacoes').select('tipo,valor,categoria,data').eq('empresa_id', empresaId).order('data', { ascending: false }).limit(30),
      supabase.from('contas_bancarias').select('banco,saldo_disponivel,saldo').eq('empresa_id', empresaId).limit(3),
      supabase.from('contas_pagar').select('descricao,valor,data_vencimento').eq('empresa_id', empresaId).neq('status', 'pago').lte('data_vencimento', em7).limit(10),
    ])

    const transacoes = txRes.data ?? []
    const contas = contasRes.data ?? []
    const receitaMes = transacoes.filter(t => t.tipo === 'entrada' && t.data >= inicioMes).reduce((s, t) => s + Number(t.valor || 0), 0)
    const gastoMes = transacoes.filter(t => t.tipo === 'saida' && t.data >= inicioMes).reduce((s, t) => s + Number(t.valor || 0), 0)
    const saldoTotal = contas.reduce((s, c) => s + Number(c.saldo_disponivel || c.saldo || 0), 0)

    const contexto = {
      nome: usuario.nome,
      saldo_total: saldoTotal,
      receita_mes: receitaMes,
      gasto_mes: gastoMes,
      contas_pagar_proximos_7d: pagarRes.data ?? [],
      transacoes_recentes: transacoes.slice(0, 15),
    }

    let resposta = 'Não consegui processar sua mensagem agora.'
    try {
      const completion = await getAnthropic().messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: `Você é o assistente financeiro FactorOne via Telegram. Responda em português, de forma MUITO concisa (máx 3 parágrafos curtos). Sem emojis em excesso. Seja direto como um CFO.

DADOS DA EMPRESA:
${JSON.stringify(contexto)}`,
        messages: [{ role: 'user', content: texto }],
      })
      resposta = completion.content[0]?.type === 'text' ? completion.content[0].text : resposta
    } catch { /* mantém resposta padrão */ }

    await sendTelegram(chatId, resposta)
    await supabase.from('lifeos_interacoes').insert({ empresa_id: empresaId, origem: 'telegram', mensagem_usuario: texto, resposta_ia: resposta }).then(() => {})

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Telegram webhook error:', e)
    return NextResponse.json({ ok: true }) // sempre 200 pro Telegram não ficar reenviando
  }
}
