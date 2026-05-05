import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'
import { createClient } from '@supabase/supabase-js'

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  const lines = [
    headers.join(';'),
    ...rows.map((r) =>
      headers.map((h) => {
        const v = String(r[h] ?? '')
        return v.includes(';') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v
      }).join(';')
    ),
  ]
  return '﻿' + lines.join('\r\n')
}

export async function GET(req: NextRequest) {
  const { user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) || user.id

  const url = new URL(req.url)
  const inicio = url.searchParams.get('inicio') || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  const fim = url.searchParams.get('fim') || new Date().toISOString().slice(0, 10)
  const status = url.searchParams.get('status') || ''

  let q = supabase
    .from('despesas')
    .select('id,descricao,fornecedor,categoria,valor,data_vencimento,data_pagamento,status,forma_pagamento,centro_custo,observacoes,created_at')
    .eq('empresa_id', empresaId)
    .gte('data_vencimento', inicio)
    .lte('data_vencimento', fim)
    .order('data_vencimento', { ascending: false })

  if (status) q = q.eq('status', status)

  const { data } = await q

  const rows = (data || []).map((d) => ({
    'Vencimento': String(d.data_vencimento || ''),
    'Pagamento': String(d.data_pagamento || ''),
    'Descrição': String(d.descricao || ''),
    'Fornecedor': String(d.fornecedor || ''),
    'Categoria': String(d.categoria || ''),
    'Centro de Custo': String(d.centro_custo || ''),
    'Valor': String(Number(d.valor || 0).toFixed(2).replace('.', ',')),
    'Status': String(d.status || ''),
    'Forma de Pagamento': String(d.forma_pagamento || ''),
    'Observações': String(d.observacoes || ''),
    'Criado em': String(d.created_at || ''),
  }))

  const csv = toCSV(rows)
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="despesas_${inicio}_${fim}.csv"`,
    },
  })
}
