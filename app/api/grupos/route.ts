import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseUser } from '@/lib/supabase-route'

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// Lista os grupos (holdings) que o usuário logado é dono.
export async function GET(req: NextRequest) {
  const { user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const db = svc()
  const { data: grupos, error } = await db
    .from('grupos_empresariais')
    .select('id, nome, created_at')
    .eq('owner_user_id', user.id)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const comContagem = await Promise.all((grupos ?? []).map(async (g) => {
    const { count } = await db.from('grupo_membros').select('id', { count: 'exact', head: true }).eq('grupo_id', g.id as string)
    return { ...g, membros: count ?? 0 }
  }))

  return NextResponse.json({ grupos: comContagem })
}

// Cria um grupo novo, já com o dono como membro (empresa ativa dele + a
// própria PF), pra o seletor nunca aparecer vazio depois de criado.
export async function POST(req: NextRequest) {
  const { user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { nome?: string; incluir_empresa_ativa?: boolean; incluir_pf?: boolean }
  const nome = String(body.nome || '').trim()
  if (!nome) return NextResponse.json({ error: 'Nome do grupo é obrigatório' }, { status: 400 })

  const db = svc()
  const { data: grupo, error } = await db.from('grupos_empresariais').insert({ nome, owner_user_id: user.id }).select('id, nome, created_at').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (body.incluir_empresa_ativa !== false) {
    const { data: u } = await db.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    if (u?.empresa_id) {
      await db.from('grupo_membros').insert({ grupo_id: grupo.id, empresa_id: u.empresa_id }).select().maybeSingle()
    }
  }
  if (body.incluir_pf) {
    await db.from('grupo_membros').insert({ grupo_id: grupo.id, pessoa_fisica_user_id: user.id }).select().maybeSingle()
  }

  return NextResponse.json({ grupo })
}
