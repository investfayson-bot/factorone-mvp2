import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseUser } from '@/lib/supabase-route'

export const runtime = 'nodejs'

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY || '',
})

type OcrResult = {
  fornecedor: string
  cnpj: string | null
  valor: number
  data: string
  categoria: string
  confianca: number
  itens: Array<{ descricao: string; valor: number }>
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function extractJson(raw: string): OcrResult | null {
  const tryParse = (text: string) => {
    try {
      return JSON.parse(text) as OcrResult
    } catch {
      return null
    }
  }
  const direct = tryParse(raw)
  if (direct) return direct
  const i = raw.indexOf('{')
  const j = raw.lastIndexOf('}')
  if (i === -1 || j <= i) return null
  return tryParse(raw.slice(i, j + 1))
}

function normalize(v: Partial<OcrResult>): OcrResult {
  const valor = Number(v.valor || 0)
  const confianca = Number(v.confianca ?? 0.5)
  const data = typeof v.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.data) ? v.data : toIsoDate(new Date())
  return {
    fornecedor: String(v.fornecedor || 'Fornecedor não identificado').trim(),
    cnpj: v.cnpj ? String(v.cnpj) : null,
    valor: Number.isFinite(valor) ? valor : 0,
    data,
    categoria: String(v.categoria || 'Outros').trim() || 'Outros',
    confianca: Math.max(0, Math.min(1, Number.isFinite(confianca) ? confianca : 0.5)),
    itens: Array.isArray(v.itens) ? v.itens : [],
  }
}

function makePath(userId: string, name: string) {
  const safe = name.replace(/[^\w.\-]/g, '_')
  return `${userId}/${Date.now()}_${safe}`
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'OPENROUTER_API_KEY não configurada' }, { status: 500 })
    }

    const { user, supabase } = await getSupabaseUser(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: 'Arquivo é obrigatório' }, { status: 400 })

    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const empresaId = (u?.empresa_id as string) || user.id

    const service =
      process.env.SUPABASE_SERVICE_ROLE_KEY
        ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
        : supabase

    const path = makePath(user.id, file.name || 'recibo.jpg')
    const buffer = Buffer.from(await file.arrayBuffer())

    const upload = await service.storage.from('recibos').upload(path, buffer, {
      contentType: file.type || 'image/jpeg',
      upsert: false,
    })
    if (upload.error) return NextResponse.json({ error: upload.error.message }, { status: 400 })

    const { data: signed } = await service.storage.from('recibos').createSignedUrl(path, 60 * 60)
    const imagemUrl = signed?.signedUrl || path

    const insertRecibo = await service
      .from('recibos_fotografados')
      .insert({
        empresa_id: empresaId,
        user_id: user.id,
        imagem_url: path,
        status: 'processando',
        origem: 'upload',
      })
      .select('id')
      .single()
    if (insertRecibo.error) return NextResponse.json({ error: insertRecibo.error.message }, { status: 400 })

    const base64 = buffer.toString('base64')
    const mime = file.type || 'image/jpeg'
    const ocrPrompt = `Analise este recibo/nota fiscal e extraia:
- fornecedor: nome da empresa/estabelecimento
- cnpj: CNPJ se visível (formato XX.XXX.XXX/XXXX-XX)
- valor: valor total pago (número decimal)
- data: data da compra/emissão (formato YYYY-MM-DD)
- categoria: classifique em uma das opções:
  Alimentação, Transporte, Hospedagem,
  Tecnologia/Software, Marketing, Fornecedores,
  Folha de Pagamento, Impostos/Taxas,
  Aluguel/Infraestrutura, Consultoria,
  Material de Escritório, Outros
- confianca: número de 0 a 1 indicando certeza
- itens: array de {descricao, valor} se visíveis

Responda SOMENTE em JSON válido, sem markdown.`

    const completion = await openrouter.chat.completions.create({
      model: 'anthropic/claude-3-5-sonnet',
      max_tokens: 600,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
            { type: 'text', text: ocrPrompt },
          ],
        },
      ],
    })

    const parsed = extractJson(completion.choices[0]?.message?.content ?? '{}')
    const ocr = normalize(parsed || {})

    const statusRecibo = ocr.confianca >= 0.8 ? 'lancado' : 'extraido'

    let despesaId: string | null = null
    if (ocr.confianca >= 0.8) {
      const despesaInsert = await service
        .from('despesas')
        .insert({
          empresa_id: empresaId,
          descricao: ocr.fornecedor,
          valor: ocr.valor,
          categoria: ocr.categoria,
          data: ocr.data,
          data_despesa: ocr.data,
          status: 'aprovado',
          tipo_pagamento: 'outro',
          comprovante_url: path,
          observacao: 'Lançamento automático via OCR de recibo',
        })
        .select('id')
        .single()
      if (!despesaInsert.error) despesaId = despesaInsert.data?.id ?? null

      await service.from('transacoes').insert({
        empresa_id: empresaId,
        data: ocr.data,
        descricao: `Despesa OCR: ${ocr.fornecedor}`,
        categoria: ocr.categoria,
        tipo: 'saida',
        valor: ocr.valor,
        status: 'confirmada',
      })

      const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')?.trim()
      if (token) {
        try {
          await fetch(new URL('/api/dre/recalcular', req.url), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ empresaId, competencia: `${ocr.data}T00:00:00.000Z` }),
          })
        } catch {
          // não bloqueia retorno
        }
      }
    }

    await service
      .from('recibos_fotografados')
      .update({
        status: statusRecibo,
        fornecedor_extraido: ocr.fornecedor,
        cnpj_extraido: ocr.cnpj,
        valor_extraido: ocr.valor,
        data_extraida: ocr.data,
        categoria_sugerida: ocr.categoria,
        confianca_ocr: ocr.confianca,
        texto_bruto: completion.choices[0]?.message?.content ?? null,
        despesa_id: despesaId,
      })
      .eq('id', insertRecibo.data.id)

    return NextResponse.json({
      recibo_id: insertRecibo.data.id,
      dados_extraidos: {
        fornecedor: ocr.fornecedor,
        valor: ocr.valor,
        data: ocr.data,
        categoria: ocr.categoria,
        confianca: ocr.confianca,
      },
      imagem_url: imagemUrl,
      lancado_automaticamente: ocr.confianca >= 0.8,
      requer_revisao: ocr.confianca < 0.8,
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

