import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

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

// Detecta se a mensagem é um pedido de agendamento e, se for, cria a atividade
// de verdade em crm_atividades — o "agente que age", não só responde.
async function tentarAgendar(
  supabase: ReturnType<typeof db>,
  empresaId: string,
  texto: string
): Promise<string | null> {
  const hoje = new Date()
  const hojeStr = hoje.toISOString().slice(0, 10)
  const diaSemana = hoje.toLocaleDateString('pt-BR', { weekday: 'long' })

  let extraido: ExtracaoAgendamento | null = null
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
    if (match) extraido = JSON.parse(match[0]) as ExtracaoAgendamento
  } catch {
    return null
  }

  if (!extraido || !extraido.eh_agendamento || !extraido.data) return null

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
    titulo: extraido.titulo || texto.slice(0, 80),
    descricao: texto,
    data: extraido.data,
    hora_inicio: extraido.hora_inicio,
    status: 'pendente',
    lembrete: true,
  })
  if (error) return 'Entendi o pedido, mas não consegui salvar no CRM agora. Tenta de novo?'

  const dataFmt = new Date(`${extraido.data}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
  const horaFmt = extraido.hora_inicio ? ` às ${extraido.hora_inicio}` : ''
  const quemFmt = extraido.cliente ? ` com ${extraido.cliente}` : ''
  return `Feito! Agendei ${tipo}${quemFmt} pra ${dataFmt}${horaFmt}. Já está no seu CRM (aba Agenda).`
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

    // Conta ainda não vinculada a este chat — tenta parear por código ou orienta.
    if (!usuario) {
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

    // Conta vinculada. Se parecer um pedido de agendamento, tenta agir de verdade
    // (cria em crm_atividades) em vez de só responder em texto.
    if (/\b(marca|marque|agend|reuni[ãa]o|visita|compromisso|lembr|liga[çc][ãa]o|ligar para)\b/i.test(texto)) {
      const acao = await tentarAgendar(supabase, usuario.empresa_id as string, texto)
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
