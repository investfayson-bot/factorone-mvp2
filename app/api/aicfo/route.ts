import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import { erroDesconhecido } from '@/lib/transacao-types'

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY || '',
})

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'OPENROUTER_API_KEY não configurada' }, { status: 500 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace(/^Bearer\s+/i, '')?.trim()

    const supabaseUser = createClient(url, anonKey, {
      global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    })

    const {
      data: { user },
    } = await supabaseUser.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { message, context } = await req.json()
    if (!message) return NextResponse.json({ error: 'Mensagem obrigatória' }, { status: 400 })

    const { data: transacoes } = await supabaseUser
      .from('transacoes')
      .select('*')
      .eq('empresa_id', user.id)
      .order('data', { ascending: false })
      .limit(40)

    const isDashboard = context === 'dashboard'

    const dadosJson = JSON.stringify(transacoes || [], null, 2)

    const systemDashboard =
      'Você é o CFO digital do FactorOne. Analise os dados financeiros e dê 3 insights acionáveis em português, em formato de bullet points concisos.'

    const systemGeral = `Você é o CFO Inteligente da FactorOne — assistente financeiro especializado para PMEs brasileiras.
Responda SEMPRE em português brasileiro. Seja direto, prático e use linguagem simples.
Forneça insights acionáveis e específicos baseados nos dados da empresa.

Dados financeiros recentes da empresa:
${dadosJson}

Contexto atual: ${context || 'dashboard geral'}`

    const systemPrompt = isDashboard
      ? `${systemDashboard}\n\nDados financeiros recentes da empresa:\n${dadosJson}`
      : systemGeral

    const model = isDashboard ? 'anthropic/claude-3.5-sonnet' : 'anthropic/claude-3-haiku'

    const response = await openrouter.chat.completions.create({
      model,
      max_tokens: isDashboard ? 1200 : 1500,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
    })

    return NextResponse.json({
      response: response.choices[0]?.message?.content || 'Sem resposta',
    })
  } catch (error: unknown) {
    console.error('Erro AI CFO:', error)
    return NextResponse.json({ error: erroDesconhecido(error) || 'Erro interno' }, { status: 500 })
  }
}
