import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
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
      model: 'anthropic/claude-3.5-sonnet',
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
    return NextResponse.json({ success: true, analise: JSON.parse(raw) })
  } catch (e: unknown) {
    return NextResponse.json({ error: erroDesconhecido(e) }, { status: 500 })
  }
}
