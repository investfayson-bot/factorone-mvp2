import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseUser } from '@/lib/supabase-route'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })

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

    const { data: transacoes } = await supabase
      .from('transacoes')
      .select('tipo,valor,categoria,data')
      .eq('empresa_id', empresaId)
      .order('data', { ascending: false })
      .limit(20)

    const hoje = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: `Você é o CFO IA da FactorOne. Hoje é ${hoje}.

Gere UM insight proativo e urgente em JSON (sem texto fora do JSON):
{
  "tipo": "alerta" | "oportunidade" | "tributario" | "fluxo",
  "titulo": "título curto (max 6 palavras, sem emoji)",
  "mensagem": "insight acionável em 2 frases. Seja específico com números quando possível.",
  "acao": "texto do botão de ação (ex: Ver detalhes, Ajustar agora, Saiba mais)",
  "urgencia": "alta" | "media" | "baixa"
}

Varie entre insights financeiros dos dados da empresa e atualizações tributárias relevantes.
Se os dados estiverem vazios, gere um insight sobre boas práticas financeiras para PMEs brasileiras.
DADOS DA EMPRESA: ${JSON.stringify(transacoes || [])}`,
      messages: [{ role: 'user', content: 'Gere um insight proativo agora.' }],
    })

    const texto = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const json = JSON.parse(texto.replace(/```json|```/g, '').trim())
    return NextResponse.json(json)
  } catch (error) {
    console.error('Insight error:', error)
    return NextResponse.json({ tipo: 'fluxo', titulo: 'Dica financeira', mensagem: 'Registre suas primeiras transações para ativar os insights do FactorOne IA.', acao: 'Registrar transação', urgencia: 'baixa' })
  }
}
