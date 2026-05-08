import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseUser } from '@/lib/supabase-route'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const { user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const buffer = await file.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  const mediaType = (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: base64 },
        },
        {
          type: 'text',
          text: `Você é um sistema OCR de romaneio de carga. Extraia as informações deste documento e retorne SOMENTE um JSON válido com os campos abaixo (null se não encontrado):
{
  "origem": "cidade/estado de origem",
  "destino": "cidade/estado de destino",
  "motorista": "nome do motorista",
  "carga": "descrição da carga",
  "peso_kg": "peso em kg (só número)",
  "valor_frete": "valor do frete em reais (só número com vírgula decimal)",
  "placa": "placa do veículo",
  "data_saida": "data de saída no formato YYYY-MM-DD"
}
Responda APENAS com o JSON, sem explicações.`,
        },
      ],
    }],
  })

  try {
    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({})
    const result = JSON.parse(jsonMatch[0])
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({})
  }
}
