import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseUser } from '@/lib/supabase-route'

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function ehDonoDoGrupo(db: ReturnType<typeof svc>, grupoId: string, userId: string): Promise<boolean> {
  const { data } = await db.from('grupos_empresariais').select('id').eq('id', grupoId).eq('owner_user_id', userId).maybeSingle()
  return !!data
}

// Adiciona uma empresa (que o usuário administra) ou a própria PF ao grupo.
// Só o dono do grupo pode adicionar membro — evita alguém juntar empresa de
// outro dono ao próprio grupo sem permissão.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: grupoId } = await params
  const { user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const db = svc()
  if (!(await ehDonoDoGrupo(db, grupoId, user.id))) {
    return NextResponse.json({ error: 'Grupo não encontrado' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({})) as { empresa_id?: string; pessoa_fisica?: boolean }

  if (body.pessoa_fisica) {
    const { data, error } = await db.from('grupo_membros').insert({ grupo_id: grupoId, pessoa_fisica_user_id: user.id }).select('*').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ membro: data })
  }

  const empresaId = String(body.empresa_id || '')
  if (!empresaId) return NextResponse.json({ error: 'empresa_id obrigatório' }, { status: 400 })

  // Só entra no grupo empresa em que o usuário tem membership de verdade —
  // mesma fonte autoritativa que o resto do sistema usa pra acesso por empresa.
  const { data: membership } = await db.from('usuario_empresas').select('empresa_id').eq('user_id', user.id).eq('empresa_id', empresaId).maybeSingle()
  if (!membership) return NextResponse.json({ error: 'Você não tem acesso a essa empresa' }, { status: 403 })

  const { data, error } = await db.from('grupo_membros').insert({ grupo_id: grupoId, empresa_id: empresaId }).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ membro: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: grupoId } = await params
  const { user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const db = svc()
  if (!(await ehDonoDoGrupo(db, grupoId, user.id))) {
    return NextResponse.json({ error: 'Grupo não encontrado' }, { status: 404 })
  }

  const { searchParams } = new URL(req.url)
  const membroId = searchParams.get('membro_id')
  if (!membroId) return NextResponse.json({ error: 'membro_id obrigatório' }, { status: 400 })

  const { error } = await db.from('grupo_membros').delete().eq('id', membroId).eq('grupo_id', grupoId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
