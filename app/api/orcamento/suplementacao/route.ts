import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'

export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = (await req.json()) as { orcamento_linha_id: string; valor_solicitado: number; justificativa: string }
  if ((body.justificativa || '').trim().length < 20) return NextResponse.json({ error: 'Justificativa mínima de 20 caracteres' }, { status: 400 })
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) || user.id
  const { data, error } = await supabase.from('suplementacoes').insert({
    orcamento_linha_id: body.orcamento_linha_id,
    empresa_id: empresaId,
    valor_solicitado: body.valor_solicitado,
    justificativa: body.justificativa,
    solicitado_por: user.id,
  }).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}

export async function PUT(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = (await req.json()) as { id: string; status: 'aprovado' | 'rejeitado' }
  const { data: sup, error: supErr } = await supabase.from('suplementacoes').update({
    status: body.status,
    aprovado_por: user.id,
    aprovado_em: new Date().toISOString(),
  }).eq('id', body.id).select('*').single()
  if (supErr) return NextResponse.json({ error: supErr.message }, { status: 400 })
  if (body.status === 'aprovado') {
    const { data: linha } = await supabase.from('orcamento_linhas').select('id,valor_previsto').eq('id', sup.orcamento_linha_id).maybeSingle()
    if (linha) {
      await supabase.from('orcamento_linhas').update({ valor_previsto: Number(linha.valor_previsto || 0) + Number(sup.valor_solicitado || 0) }).eq('id', linha.id)
    }
  }
  return NextResponse.json({ data: sup })
}
