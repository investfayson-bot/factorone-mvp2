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

  const { data } = await supabase
    .from('transacoes')
    .select('id,tipo,descricao,valor,categoria,data,status,created_at')
    .eq('empresa_id', empresaId)
    .gte('data', inicio)
    .lte('data', fim)
    .order('data', { ascending: false })

  const rows = (data || []).map((t) => ({
    Data: String(t.data || ''),
    Tipo: String(t.tipo || ''),
    Descrição: String(t.descricao || ''),
    Categoria: String(t.categoria || ''),
    Valor: String(Number(t.valor || 0).toFixed(2).replace('.', ',')),
    Status: String(t.status || ''),
    'Criado em': String(t.created_at || ''),
  }))

  const csv = toCSV(rows)
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="transacoes_${inicio}_${fim}.csv"`,
    },
  })
}
