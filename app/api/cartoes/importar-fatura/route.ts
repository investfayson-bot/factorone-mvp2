import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import OpenAI from 'openai'
import { PDFParse } from 'pdf-parse'
import { getSupabaseUser } from '@/lib/supabase-route'
import { erroDesconhecido } from '@/lib/transacao-types'
import { parseLinhasPlanilha, parseOfx, extrairParcela, type ItemFaturaImportado } from '@/lib/fatura-import'

export const runtime = 'nodejs'

/**
 * Importação de fatura (caminho B, independente da Belvo — handoff
 * docs/handoff-cartao-parcelas-estabelecimento.md). Suporta CSV/XLSX, OFX e PDF
 * (best-effort via IA, formato de fatura varia muito banco a banco).
 * Fluxo preview → confirm igual ao /api/importar/despesas.
 */

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY || '',
})

function extrairJson(texto: string): unknown[] {
  try {
    const parsed = JSON.parse(texto) as unknown
    if (Array.isArray(parsed)) return parsed
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { itens?: unknown[] }).itens)) {
      return (parsed as { itens: unknown[] }).itens
    }
    return []
  } catch {
    return []
  }
}

async function parsePdf(file: File): Promise<ItemFaturaImportado[]> {
  const buf = Buffer.from(await file.arrayBuffer())
  const parser = new PDFParse({ data: buf })
  const parsedPdf = await parser.getText().finally(async () => { await parser.destroy() })
  const texto = parsedPdf.text?.slice(0, 20000) || ''

  const prompt = `Extraia as LINHAS de compra desta fatura de cartão de crédito brasileira. Retorne SOMENTE JSON no formato {"itens": [...]}, onde cada item tem:
descricao (string, nome do estabelecimento como aparece na fatura), valor (number, positivo), data (YYYY-MM-DD ou null), parcela_atual (number ou null, se a linha indicar parcelamento tipo "PARC 03/10"), total_parcelas (number ou null).
Ignore linhas de resumo/total/cabeçalho. Só linhas de compra individuais.

Texto da fatura:
${texto}`

  const completion = await openrouter.chat.completions.create({
    model: 'anthropic/claude-sonnet-4.5',
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }],
  })
  const raw = completion.choices[0]?.message?.content ?? '{}'
  const itens = extrairJson(raw)

  return itens.map(i => {
    const it = i as Record<string, unknown>
    const descricao = String(it.descricao ?? '').trim()
    const valor = Number(it.valor ?? 0)
    const data = typeof it.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(it.data) ? it.data : null
    const parcelaIA = { atual: Number(it.parcela_atual), total: Number(it.total_parcelas) }
    const parcelaRegex = extrairParcela(descricao)
    const temParcelaIA = Number.isFinite(parcelaIA.atual) && Number.isFinite(parcelaIA.total) && parcelaIA.total > 0
    return {
      descricao,
      valor: Number.isFinite(valor) ? Math.abs(valor) : 0,
      data,
      parcela_atual: temParcelaIA ? parcelaIA.atual : (parcelaRegex?.atual ?? null),
      total_parcelas: temParcelaIA ? parcelaIA.total : (parcelaRegex?.total ?? null),
    }
  }).filter(i => i.descricao && i.valor > 0)
}

export async function POST(req: NextRequest) {
  try {
    const { user, supabase } = await getSupabaseUser(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const form = await req.formData()
    const file = form.get('file')
    const confirm = String(form.get('confirm') || 'false') === 'true'
    if (!(file instanceof File)) return NextResponse.json({ error: 'Arquivo obrigatório' }, { status: 400 })
    if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: 'Arquivo muito grande (máx. 8MB)' }, { status: 400 })

    const nome = file.name.toLowerCase()
    const isOfx = nome.endsWith('.ofx') || nome.endsWith('.qfx')
    const isPdf = file.type === 'application/pdf' || nome.endsWith('.pdf')
    const isCsvOuXlsx = nome.endsWith('.csv') || nome.endsWith('.xlsx') || nome.endsWith('.xls')

    if (!isOfx && !isPdf && !isCsvOuXlsx) {
      return NextResponse.json({ error: 'Formato suportado: CSV, XLSX, OFX ou PDF' }, { status: 400 })
    }

    let itens: ItemFaturaImportado[]
    if (isOfx) {
      const texto = await file.text()
      itens = parseOfx(texto)
    } else if (isPdf) {
      if (!process.env.OPENROUTER_API_KEY) return NextResponse.json({ error: 'OPENROUTER_API_KEY não configurada' }, { status: 500 })
      itens = await parsePdf(file)
    } else {
      const bytes = Buffer.from(await file.arrayBuffer())
      const wb = XLSX.read(bytes, { type: 'buffer' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
      itens = parseLinhasPlanilha(rows)
    }

    if (!confirm) {
      return NextResponse.json({ preview: itens, total: itens.length })
    }

    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const empresaId = (u?.empresa_id as string) || null

    const payload = itens.map(i => ({
      empresa_id: empresaId,
      user_id: empresaId ? null : user.id,
      arquivo_nome: file.name,
      descricao: i.descricao,
      descritor_bruto: i.descricao,
      valor: i.valor,
      data: i.data,
      parcela_atual: i.parcela_atual,
      total_parcelas: i.total_parcelas,
    }))

    if (payload.length === 0) {
      return NextResponse.json({ error: 'Nenhuma linha reconhecida no arquivo' }, { status: 400 })
    }

    const { error } = await supabase.from('fatura_itens_importados').insert(payload)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true, importados: payload.length })
  } catch (e: unknown) {
    return NextResponse.json({ error: erroDesconhecido(e) }, { status: 500 })
  }
}
