import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseUser } from '@/lib/supabase-route'
import { erroDesconhecido } from '@/lib/transacao-types'

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada' }, { status: 500 })
    }

    const { user, supabase } = await getSupabaseUser(req)
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    // Resolver empresa corretamente
    const { data: usrRow } = await supabase
      .from('usuarios')
      .select('empresa_id')
      .eq('id', user.id)
      .maybeSingle()
    const empresaId = usrRow?.empresa_id ?? user.id

    const { message, context } = (await req.json()) as {
      message?: string
      context?: string
    }
    if (!message) return NextResponse.json({ error: 'Mensagem obrigatória' }, { status: 400 })

    // Buscar dados financeiros reais para contexto
    const [txRes, despRes, contasRes] = await Promise.all([
      supabase
        .from('transacoes')
        .select('tipo,valor,categoria,data,descricao')
        .eq('empresa_id', empresaId)
        .order('data', { ascending: false })
        .limit(60),
      supabase
        .from('despesas')
        .select('valor,status,categoria,data_despesa,descricao')
        .eq('empresa_id', empresaId)
        .in('status', ['pendente_aprovacao', 'aprovado'])
        .limit(20),
      supabase
        .from('contas_bancarias')
        .select('banco,saldo_disponivel,saldo')
        .eq('empresa_id', empresaId)
        .limit(5),
    ])

    const dadosContexto = {
      transacoes: txRes.data ?? [],
      despesas_pendentes: despRes.data ?? [],
      contas: contasRes.data ?? [],
      contexto_adicional: context ?? null,
    }

    const systemPrompt = `Você é o CFO Inteligente da FactorOne para PMEs brasileiras.

Responda SEMPRE em português brasileiro com este JSON exato (sem texto fora do JSON):
{
  "resumo": "frase curta de 1 linha resumindo a situação",
  "status": "positivo" | "atencao" | "critico",
  "cards": [
    {
      "titulo": "título do card",
      "linhas": [
        { "label": "nome do item", "valor": "R$ 0,00", "destaque": "positivo" | "negativo" | "neutro" }
      ]
    }
  ],
  "alertas": ["alerta 1", "alerta 2"],
  "proxima_pergunta": "sugestão de próxima pergunta"
}

REGRAS:
- Não use emojis em nenhuma parte da resposta
- Máximo 3 cards. Cada card máximo 5 linhas
- Números em formato R$ 1.234,56
- Seja direto e prático como um CFO real
- Se dados estiverem zerados, oriente o usuário a registrar transações

DADOS FINANCEIROS DA EMPRESA:
${JSON.stringify(dadosContexto, null, 2)}`

    const response = await getAnthropic().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: message }],
    })

    const texto = response.content[0].type === 'text' ? response.content[0].text : '{}'

    try {
      const json = JSON.parse(texto.replace(/```json|```/g, '').trim())
      return NextResponse.json({ response: texto, structured: json })
    } catch {
      return NextResponse.json({ response: texto, structured: null })
    }
  } catch (error: unknown) {
    console.error('Erro AI CFO:', error)
    return NextResponse.json(
      { error: erroDesconhecido(error) || 'Erro interno' },
      { status: 500 }
    )
  }
}
