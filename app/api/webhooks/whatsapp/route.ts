import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { calcularDAS } from '@/lib/fiscal/simples-nacional'

export const runtime = 'nodejs'

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
}

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// WhatsApp Business API verification (GET)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? '', { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}

// Incoming WhatsApp message (POST)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Parse WhatsApp webhook payload
    const entry = body?.entry?.[0]
    const change = entry?.changes?.[0]
    const value = change?.value
    const message = value?.messages?.[0]

    if (!message) return NextResponse.json({ status: 'no_message' })

    const from = message.from as string  // phone number
    const msgType = message.type as string
    const msgText: string = msgType === 'text' ? (message.text?.body ?? '') : ''
    const businessPhoneId = value?.metadata?.phone_number_id as string

    if (!msgText.trim()) {
      await sendWhatsApp(businessPhoneId, from, 'Desculpe, só entendo mensagens de texto por enquanto. Envie sua pergunta financeira!')
      return NextResponse.json({ status: 'ok' })
    }

    // Find user by WhatsApp phone
    const supabase = db()
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('id, empresa_id')
      .eq('whatsapp', from)
      .maybeSingle()

    if (!usuario) {
      await sendWhatsApp(businessPhoneId, from,
        'Olá! Seu número não está vinculado a nenhuma conta FactorOne. Acesse a plataforma e vincule seu WhatsApp nas configurações.')
      return NextResponse.json({ status: 'user_not_found' })
    }

    const empresaId = usuario.empresa_id || usuario.id
    const hoje = new Date()
    const inicioMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
    const doze = new Date(hoje); doze.setMonth(doze.getMonth() - 12)
    const em7Str = new Date(hoje.getTime() + 7 * 86400000).toISOString().slice(0, 10)

    const [txRes, contasRes, pagarRes, tx12Res] = await Promise.all([
      supabase.from('transacoes').select('tipo,valor,categoria,data').eq('empresa_id', empresaId).order('data', { ascending: false }).limit(30),
      supabase.from('contas_bancarias').select('banco,saldo_disponivel,saldo').eq('empresa_id', empresaId).limit(3),
      supabase.from('contas_pagar').select('descricao,valor,data_vencimento').eq('empresa_id', empresaId).neq('status', 'pago').lte('data_vencimento', em7Str).limit(10),
      supabase.from('transacoes').select('valor').eq('empresa_id', empresaId).eq('tipo', 'entrada').gte('data', doze.toISOString().slice(0, 10)),
    ])

    const transacoes = txRes.data ?? []
    const contas = contasRes.data ?? []
    const receitaMes = transacoes.filter(t => t.tipo === 'entrada' && t.data >= inicioMes).reduce((s, t) => s + Number(t.valor || 0), 0)
    const rbt12 = (tx12Res.data ?? []).reduce((s, t) => s + Number(t.valor || 0), 0)
    const das = calcularDAS(receitaMes, rbt12)
    const saldoTotal = contas.reduce((s, c) => s + Number(c.saldo_disponivel || c.saldo || 0), 0)

    const contexto = {
      saldo_total: saldoTotal,
      receita_mes: receitaMes,
      das: { valor: das.valorDAS, vencimento: das.vencimento, alertas: das.alertas },
      contas_pagar_proximos_7d: pagarRes.data ?? [],
      transacoes_recentes: transacoes.slice(0, 15),
    }

    const response = await getAnthropic().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: `Você é o assistente financeiro FactorOne via WhatsApp. Responda em português, de forma MUITO concisa (máx 3 parágrafos curtos). Sem emojis em excesso. Seja direto como um CFO.

DADOS DA EMPRESA:
${JSON.stringify(contexto)}`,
      messages: [{ role: 'user', content: msgText }],
    })

    const resposta = response.content[0].type === 'text' ? response.content[0].text : 'Não consegui processar sua pergunta.'
    await sendWhatsApp(businessPhoneId, from, resposta)

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('WhatsApp webhook error:', error)
    return NextResponse.json({ status: 'error' }, { status: 200 }) // always 200 to WhatsApp
  }
}

async function sendWhatsApp(phoneNumberId: string, to: string, text: string) {
  if (!process.env.WHATSAPP_TOKEN) return
  await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    }),
  })
}
