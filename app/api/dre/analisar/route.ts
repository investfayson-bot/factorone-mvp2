import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { erroDesconhecido } from '@/lib/transacao-types'
import { getSupabaseUser } from '@/lib/supabase-route'

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY || '',
})

export async function POST(req: NextRequest) {
  try {
    const { user } = await getSupabaseUser(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'OPENROUTER_API_KEY não configurada' }, { status: 500 })
    }
    const body = (await req.json()) as { metricasAtuais: unknown; historico3Meses: unknown[] }
    const prompt = `Analise este DRE e responda em JSON com a estrutura:
{
  "resumo_executivo": string,
  "pontos_positivos": string[],
  "pontos_atencao": string[],
  "recomendacoes": [{ "acao": string, "impacto": string, "prioridade": "alta|media|baixa" }],
  "projecao_proximo_mes": string,
  "score_saude": number
}

Dados atuais: ${JSON.stringify(body.metricasAtuais)}
Historico: ${JSON.stringify(body.historico3Meses)}`

    const completion = await openrouter.chat.completions.create({
      model: 'anthropic/claude-sonnet-4.5',
      response_format: { type: 'json_object' },
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'Você é o CFO Digital do FactorOne, especialista em análise financeira de PMEs brasileiras. Seja objetivo e acionável.',
        },
        { role: 'user', content: prompt },
      ],
    })

    const raw = completion.choices[0]?.message?.content || '{}'
    // Alguns modelos envolvem o JSON em cercas markdown (```json ... ```); extrai o objeto.
    const match = raw.match(/\{[\s\S]*\}/)
    const analise = JSON.parse(match ? match[0] : raw)
    return NextResponse.json({ success: true, analise })
  } catch (e: unknown) {
    return NextResponse.json({ error: erroDesconhecido(e) }, { status: 500 })
  }
}
