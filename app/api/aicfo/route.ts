import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY não configurada no servidor' },
        { status: 500 }
      )
    }

    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { message, context } = await req.json()

    const { data: transacoes } = await supabase
      .from('transacoes')
      .select('*')
      .eq('empresa_id', user.id)
      .order('data', { ascending: false })
      .limit(20)

    const systemPrompt = `Você é o CFO Inteligente da FactorOne — assistente financeiro para PMEs brasileiras.
Responda sempre em português brasileiro. Seja direto, prático e use linguagem simples.
Forneça insights acionáveis baseados nos dados reais da empresa.

Dados financeiros recentes:
${JSON.stringify(transacoes || [], null, 2)}

Contexto da pergunta: ${context || 'geral'}`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: message }]
    })

    return NextResponse.json({
      response: response.content[0].type === 'text' ? response.content[0].text : ''
    })
  } catch (error: any) {
    console.error('Erro AI CFO:', error)
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 })
  }
}
