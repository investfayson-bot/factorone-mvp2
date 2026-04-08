import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'
import { conciliarExtrato } from '@/lib/financeiro/conciliacao'

export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json()
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) || user.id
  const contaId = body.conta_id as string
  const result = await conciliarExtrato(empresaId, contaId)
  return NextResponse.json(result)
}

export async function GET(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) || user.id
  const [concRows, naoRows] = await Promise.all([
    supabase.from('extrato_bancario').select('valor').eq('empresa_id', empresaId).eq('conciliado', true),
    supabase.from('extrato_bancario').select('valor').eq('empresa_id', empresaId).eq('conciliado', false),
  ])
  const valConc = (concRows.data || []).reduce((s, x) => s + Math.abs(Number(x.valor || 0)), 0)
  const valNao = (naoRows.data || []).reduce((s, x) => s + Math.abs(Number(x.valor || 0)), 0)
  const nConc = concRows.data?.length || 0
  const nNao = naoRows.data?.length || 0
  const total = nConc + nNao
  return NextResponse.json({
    percentual: total > 0 ? (nConc / total) * 100 : 0,
    conciliados: nConc,
    nao_conciliados: nNao,
    valor_conciliado: valConc,
    valor_nao_conciliado: valNao,
  })
}
