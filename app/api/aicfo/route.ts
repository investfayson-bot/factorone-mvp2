import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { erroDesconhecido } from '@/lib/transacao-types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada' }, { status: 500 })
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

    // Busca transações reais do usuário
    const { data: transacoes } = await supabaseUser
      .from('transacoes')
      .select('*')
      .eq('empresa_id', user.id)
      .order('data', { ascending: false })
      .limit(40)

    const dadosJson = JSON.stringify(transacoes || [], null, 2)
    const isDashboard = context === 'dashboard'

    const systemPrompt = isDashboard
      ? `Você é o CFO digital do FactorOne. Analise os dados financeiros e dê 3 insights acionáveis em português, em formato de bullet points concisos.\n\nDados financeiros recentes:\n${dadosJson}`
      : `Você é o CFO Inteligente da FactorOne — assistente financeiro especializado para PMEs brasileiras.
Responda SEMPRE em português brasileiro. Seja direto, prático e use linguagem simples.
Forneça insights acionáveis e específicos baseados nos dados da empresa.
Dados financeiros recentes da empresa:
${dadosJson}
Contexto atual: ${context || 'dashboard geral'}`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: isDashboard ? 1200 : 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: message }],
    })

    const texto = response.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .filter(Boolean)
      .join('\n')
      .trim()

    return NextResponse.json({
      response: texto || 'Sem resposta',
    })
  } catch (error: unknown) {
    console.error('Erro AI CFO:', error)
    return NextResponse.json({ error: erroDesconhecido(error) || 'Erro interno' }, { status: 500 })
  }
}
