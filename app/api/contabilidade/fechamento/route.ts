import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser, bloquearSeLeitura } from '@/lib/supabase-route'
import { erroDesconhecido } from '@/lib/transacao-types'

export const runtime = 'nodejs'

async function empresaDe(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return { user: null, supabase, empresaId: '' as string }
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  return { user, supabase, empresaId: (u?.empresa_id as string) || user.id }
}

/** GET: competências fechadas. */
export async function GET(req: NextRequest) {
  try {
    const { user, supabase, empresaId } = await empresaDe(req)
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    const { data } = await supabase.from('fechamentos_contabeis').select('competencia,status,fechado_em').eq('empresa_id', empresaId).eq('status', 'fechado')
    return NextResponse.json({ fechados: (data ?? []).map(f => f.competencia as string) })
  } catch (e: unknown) { return NextResponse.json({ error: erroDesconhecido(e) }, { status: 500 }) }
}

/** POST { competencia }: fecha a competência. */
export async function POST(req: NextRequest) {
  try {
    const { user, supabase, empresaId } = await empresaDe(req)
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    const bloqueio = await bloquearSeLeitura(supabase, user.id)
    if (bloqueio) return NextResponse.json({ error: `Papel ${bloqueio} é somente leitura` }, { status: 403 })
    const { competencia } = (await req.json()) as { competencia?: string }
    if (!competencia || !/^\d{4}-\d{2}$/.test(competencia)) return NextResponse.json({ error: 'competência inválida (YYYY-MM)' }, { status: 400 })
    const { error } = await supabase.from('fechamentos_contabeis').upsert(
      { empresa_id: empresaId, competencia, status: 'fechado', fechado_em: new Date().toISOString(), fechado_por: user.id },
      { onConflict: 'empresa_id,competencia' },
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) { return NextResponse.json({ error: erroDesconhecido(e) }, { status: 500 }) }
}

/** DELETE { competencia }: reabre a competência. */
export async function DELETE(req: NextRequest) {
  try {
    const { user, supabase, empresaId } = await empresaDe(req)
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    const bloqueio = await bloquearSeLeitura(supabase, user.id)
    if (bloqueio) return NextResponse.json({ error: `Papel ${bloqueio} é somente leitura` }, { status: 403 })
    const { competencia } = (await req.json()) as { competencia?: string }
    if (!competencia) return NextResponse.json({ error: 'competência obrigatória' }, { status: 400 })
    const { error } = await supabase.from('fechamentos_contabeis').update({ status: 'reaberto' }).eq('empresa_id', empresaId).eq('competencia', competencia)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) { return NextResponse.json({ error: erroDesconhecido(e) }, { status: 500 }) }
}
