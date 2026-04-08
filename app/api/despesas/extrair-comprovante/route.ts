import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { PDFParse } from 'pdf-parse'
import { getSupabaseUser } from '@/lib/supabase-route'
import { erroDesconhecido } from '@/lib/transacao-types'
import { sugerirCategoriaDespesa } from '@/lib/despesas-categorizacao'

export const runtime = 'nodejs'

type Extracao = {
  merchant: string
  amount: number | null
  issue_date: string | null
  due_date: string | null
  description: string
  confidence: number
}

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY || '',
})

function extrairJson(texto: string): Record<string, unknown> | null {
  try {
    return JSON.parse(texto) as Record<string, unknown>
  } catch {
    const ini = texto.indexOf('{')
    const fim = texto.lastIndexOf('}')
    if (ini === -1 || fim === -1 || fim <= ini) return null
    try {
      return JSON.parse(texto.slice(ini, fim + 1)) as Record<string, unknown>
    } catch {
      return null
    }
  }
}

function normalizarData(valor: unknown): string | null {
  if (typeof valor !== 'string' || !valor.trim()) return null
  const v = valor.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
    const [d, m, y] = v.split('/')
    return `${y}-${m}-${d}`
  }
  return null
}

function normalizarValor(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v !== 'string') return null
  const cleaned = v.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  const n = Number.parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

async function extrairImagem(file: File): Promise<Extracao> {
  const buf = Buffer.from(await file.arrayBuffer())
  const base64 = buf.toString('base64')
  const mime = file.type || 'image/jpeg'
  const prompt = `Extraia os dados do comprovante/extrato e retorne SOMENTE JSON válido com as chaves:
merchant (string), amount (number), issue_date (YYYY-MM-DD|null), due_date (YYYY-MM-DD|null), description (string), confidence (0 a 1).`

  const completion = await openrouter.chat.completions.create({
    model: 'google/gemini-2.0-flash-001',
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
        ],
      },
    ],
  })

  const raw = completion.choices[0]?.message?.content ?? '{}'
  const parsed = extrairJson(raw) ?? {}
  return {
    merchant: String(parsed.merchant ?? '').trim(),
    amount: normalizarValor(parsed.amount),
    issue_date: normalizarData(parsed.issue_date),
    due_date: normalizarData(parsed.due_date),
    description: String(parsed.description ?? '').trim(),
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence ?? 0.5))),
  }
}

async function extrairPdf(file: File): Promise<Extracao> {
  const buf = Buffer.from(await file.arrayBuffer())
  const parser = new PDFParse({ data: buf })
  const parsedPdf = await parser.getText().finally(async () => {
    await parser.destroy()
  })
  const text = parsedPdf.text?.slice(0, 15000) || ''
  const prompt = `Com base no texto de extrato/comprovante abaixo, retorne SOMENTE JSON válido com:
merchant (string), amount (number), issue_date (YYYY-MM-DD|null), due_date (YYYY-MM-DD|null), description (string), confidence (0 a 1).

Texto:
${text}`

  const completion = await openrouter.chat.completions.create({
    model: 'anthropic/claude-3.5-sonnet',
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }],
  })
  const raw = completion.choices[0]?.message?.content ?? '{}'
  const parsed = extrairJson(raw) ?? {}
  return {
    merchant: String(parsed.merchant ?? '').trim(),
    amount: normalizarValor(parsed.amount),
    issue_date: normalizarData(parsed.issue_date),
    due_date: normalizarData(parsed.due_date),
    description: String(parsed.description ?? '').trim(),
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence ?? 0.5))),
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'OPENROUTER_API_KEY não configurada' }, { status: 500 })
    }
    const { user } = await getSupabaseUser(req)
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Arquivo obrigatório' }, { status: 400 })
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'Arquivo muito grande (máx. 8MB)' }, { status: 400 })
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    const isImage = file.type.startsWith('image/')
    if (!isPdf && !isImage) {
      return NextResponse.json({ error: 'Formato suportado: imagem ou PDF' }, { status: 400 })
    }

    const extracted = isPdf ? await extrairPdf(file) : await extrairImagem(file)
    const textoBase = `${extracted.merchant} ${extracted.description}`.trim()
    const categoria = sugerirCategoriaDespesa(textoBase)

    return NextResponse.json({
      success: true,
      extracted: {
        ...extracted,
        suggested_category: categoria,
      },
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: erroDesconhecido(e) }, { status: 500 })
  }
}
