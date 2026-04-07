import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY || '',
})

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'OPENROUTER_API_KEY não configurada' }, { status: 500 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: { user } } = await supabase.auth.getUser()

    const { message, context } = await req.json()
    if (!message) return NextResponse.json({ error: 'Mensagem obrigatória' }, { status: 400 })

    const { data: transacoes } = user ? await supabase
      .from('transacoes')
      .select('*')
      .eq('empresa_id', user.id)
      .order('data', { ascending: false })
      .limit(20) : { data: [] }

    const systemPrompt = `Você é o CFO Inteligente da FactorOne — assistente financeiro especializado para PMEs brasileiras.
Responda SEMPRE em português brasileiro. Seja direto, prático e use linguagem simples.
Forneça insights acionáveis e específicos baseados nos dados da empresa.

Dados financeiros recentes da empresa:
${JSON.stringify(transacoes || [], null, 2)}

Contexto atual: ${context || 'dashboard geral'}`

    const response = await openrouter.chat.completions.create({
      model: 'anthropic/claude-3-haiku',
      max_tokens: 1500,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
    })

    return NextResponse.json({
      response: response.choices[0]?.message?.content || 'Sem resposta'
    })
  } catch (error: any) {
    console.error('Erro AI CFO:', error)
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 })
  }
}
