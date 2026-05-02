import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getSupabaseUser } from '@/lib/supabase-route'

type ParsedRow = {
  Data: string
  Descricao: string
  Valor: number
  Categoria: string
  Fornecedor?: string
  CentroCusto?: string
}

function toIsoDate(v: unknown): string | null {
  if (typeof v === 'string') {
    const s = v.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
      const [d, m, y] = s.split('/')
      return `${y}-${m}-${d}`
    }
  }
  return null
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'))
    if (Number.isFinite(n)) return n
  }
  return null
}

export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const form = await req.formData()
  const file = form.get('file')
  const confirm = String(form.get('confirm') || 'false') === 'true'
  if (!(file instanceof File)) return NextResponse.json({ error: 'Arquivo é obrigatório' }, { status: 400 })

  const bytes = Buffer.from(await file.arrayBuffer())
  const wb = XLSX.read(bytes, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

  const parsed = rows.map((r, idx) => {
    const data = toIsoDate(r.Data ?? r.data)
    const descricao = String(r.Descrição ?? r.Descricao ?? r.descricao ?? '').trim()
    const valor = num(r.Valor ?? r.valor)
    const categoria = String(r.Categoria ?? r.categoria ?? 'Outros').trim() || 'Outros'
    const fornecedor = String(r.Fornecedor ?? r.fornecedor ?? '').trim()
    const centroCusto = String(r['Centro Custo'] ?? r.CentroCusto ?? r.centro_custo ?? '').trim()
    const errors: string[] = []
    if (!data) errors.push('Data inválida')
    if (!descricao) errors.push('Descrição obrigatória')
    if (!valor || valor <= 0) errors.push('Valor inválido')
    return {
      line: idx + 2,
      valid: errors.length === 0,
      errors,
      row: {
        Data: data || '',
        Descricao: descricao,
        Valor: valor || 0,
        Categoria: categoria,
        Fornecedor: fornecedor || undefined,
        CentroCusto: centroCusto || undefined,
      } as ParsedRow,
    }
  })

  const validRows = parsed.filter((p) => p.valid).map((p) => p.row)

  if (!confirm) {
    return NextResponse.json({
      preview: parsed,
      valid_count: validRows.length,
      error_count: parsed.length - validRows.length,
      total: parsed.length,
    })
  }

  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) || user.id

  const payload = validRows.map((r) => ({
    empresa_id: empresaId,
    descricao: r.Fornecedor ? `${r.Fornecedor} - ${r.Descricao}` : r.Descricao,
    valor: r.Valor,
    categoria: r.Categoria,
    data: r.Data,
    data_despesa: r.Data,
    status: 'pendente_aprovacao',
    tipo_pagamento: 'outro',
  }))
  const { error } = await supabase.from('despesas').insert(payload)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({
    success: true,
    imported: payload.length,
    errors: parsed.length - payload.length,
  })
}

