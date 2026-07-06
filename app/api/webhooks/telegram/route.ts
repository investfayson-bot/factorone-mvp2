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
