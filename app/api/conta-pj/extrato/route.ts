import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'

export async function GET(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const tipo = searchParams.get('tipo')
  const operacao = searchParams.get('operacao')
  const page = Number(searchParams.get('page') || '1')
  const pageSize = 20
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) || user.id
  let q = supabase.from('extrato_bancario').select('*', { count: 'exact' }).eq('empresa_id', empresaId).order('data_transacao', { ascending: false }).range(from, to)
  if (startDate) q = q.gte('data_transacao', startDate)
  if (endDate) q = q.lte('data_transacao', endDate)
  if (tipo) q = q.eq('tipo', tipo)
  if (operacao) q = q.eq('tipo_operacao', operacao)
  const { data, error, count } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true, data: data || [], pagination: { page, pageSize, total: count || 0 } })
}
