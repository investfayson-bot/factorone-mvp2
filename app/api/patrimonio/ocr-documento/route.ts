import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseUser } from '@/lib/supabase-route'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })

export async function POST(req: NextRequest) {
  try {
    const { user } = await getSupabaseUser(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const body = await req.json() as { imageBase64?: string; mediaType?: string }
    if (!body.imageBase64) return NextResponse.json({ error: 'imageBase64 obrigatório' }, { status: 400 })

    const mediaType = (body.mediaType || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: body.imageBase64 },
          },
          {
            type: 'text',
            text: `Analise este documento de patrimônio empresarial. Extraia as informações em JSON com os campos abaixo. Se um campo não existir no documento, use null.
{
  "tipo": "nota_entrada|escritura|crlv|seguro|ipva|laudo|licenca|outro",
  "nome": "nome/identificação do documento",
  "numero_documento": "número ou série",
  "data_emissao": "YYYY-MM-DD",
  "data_vencimento": "YYYY-MM-DD",
  "valor": 0.00,
  "emissor": "quem emitiu",
  "descricao": "resumo em 1 frase"
}
Responda APENAS com o JSON, sem texto adicional.`,
          },
        ],
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const match = text.match(/\{[\s\S]*\}/)
    const extracted = match ? JSON.parse(match[0]) : {}

    return NextResponse.json({ extracted })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}
