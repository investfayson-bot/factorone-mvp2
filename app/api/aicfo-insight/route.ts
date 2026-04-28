import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerSupabase } from '@/lib/supabase-server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { data: transacoes } = await supabase
      .from('transacoes').select('*').eq('empresa_id', user.id)
      .order('data', { ascending: false }).limit(20)

    const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    const dadosJson = JSON.stringify(transacoes || [], null, 2)

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      system: `Você é o CFO IA da FactorOne. Hoje é ${hoje}.

Você tem acesso às últimas notícias tributárias e fiscais do Brasil (Simples Nacional, IRPJ, CSLL, PIS/COFINS, mudanças do Bacen, alterações do eSocial, etc).

Gere UM insight proativo e urgente em JSON:
{
  "tipo": "alerta" | "oportunidade" | "tributario" | "fluxo",
  "titulo": "título curto (max 6 palavras)",
  "mensagem": "insight acionável em 2 frases. Seja específico com números quando possível.",
  "acao": "texto do botão de ação (ex: Ver detalhes, Ajustar agora, Saiba mais)",
  "urgencia": "alta" | "media" | "baixa"
}

Varie entre insights financeiros dos dados da empresa E atualizações tributárias relevantes.
DADOS DA EMPRESA: ${dadosJson}`,
      messages: [{ role: 'user', content: 'Gere um insight proativo agora.' }],
    })

    const texto = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const json = JSON.parse(texto.replace(/```json|```/g, '').trim())
    return NextResponse.json(json)

  } catch (error) {
    console.error('Insight error:', error)
    return NextResponse.json({ error: 'Erro ao gerar insight' }, { status: 500 })
  }
}
