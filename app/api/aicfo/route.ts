import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerSupabase } from '@/lib/supabase-server'
import { erroDesconhecido } from '@/lib/transacao-types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada' }, { status: 500 })
    }

    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { message, context } = await req.json()
    if (!message) return NextResponse.json({ error: 'Mensagem obrigatória' }, { status: 400 })

    const { data: transacoes } = await supabase
      .from('transacoes')
      .select('*')
      .eq('empresa_id', user.id)
      .order('data', { ascending: false })
      .limit(40)

    const dadosJson = JSON.stringify(transacoes || [], null, 2)

    const systemPrompt = `Você é o CFO Inteligente da FactorOne para PMEs brasileiras.

Responda SEMPRE em português brasileiro com este JSON exato (sem texto fora do JSON):
{
  "resumo": "frase curta de 1 linha resumindo a situação",
  "status": "positivo" | "atencao" | "critico",
  "cards": [
    {
      "titulo": "título do card",
      "emoji": "emoji relevante",
      "linhas": [
        { "label": "nome do item", "valor": "R$ 0,00", "destaque": "positivo" | "negativo" | "neutro" }
      ]
    }
  ],
  "alertas": ["alerta 1", "alerta 2"],
  "proxima_pergunta": "sugestão de próxima pergunta"
}

Máximo 3 cards. Cada card máximo 5 linhas. Números em formato R$ 1.234,56.

DADOS DA EMPRESA:
${dadosJson}`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: message }],
    })

    const texto = response.content[0].type === 'text' ? response.content[0].text : '{}'
    
    // Tenta parsear como JSON, senão retorna como texto simples
    try {
      const json = JSON.parse(texto.replace(/```json|```/g, '').trim())
      return NextResponse.json({ response: texto, structured: json })
    } catch {
      return NextResponse.json({ response: texto, structured: null })
    }

  } catch (error: unknown) {
    console.error('Erro AI CFO:', error)
    return NextResponse.json({ error: erroDesconhecido(error) || 'Erro interno' }, { status: 500 })
  }
}
