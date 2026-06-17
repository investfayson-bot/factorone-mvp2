import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'

/** GET: lista os app_id instalados do escopo (RLS aplica empresa/usuário). */
export async function GET(req: NextRequest) {
  try {
    const { user, supabase } = await getSupabaseUser(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { data } = await supabase.from('apps_instalados').select('app_id')
    return NextResponse.json({ apps: (data ?? []).map(r => r.app_id as string) })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

/** POST { app_id }: instala (idempotente — ignora duplicado). */
export async function POST(req: NextRequest) {
  try {
    const { user, supabase } = await getSupabaseUser(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { app_id } = (await req.json()) as { app_id?: string }
    if (!app_id) return NextResponse.json({ error: 'app_id obrigatório' }, { status: 400 })

    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const empresaId = (u?.empresa_id as string) || null

    const { error } = await supabase.from('apps_instalados').insert({ app_id, empresa_id: empresaId, user_id: user.id })
    // 23505 = unique_violation → já instalado, tudo certo.
    if (error && (error as { code?: string }).code !== '23505') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}

/** DELETE { app_id }: desinstala (RLS garante o escopo). */
export async function DELETE(req: NextRequest) {
  try {
    const { user, supabase } = await getSupabaseUser(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { app_id } = (await req.json()) as { app_id?: string }
    if (!app_id) return NextResponse.json({ error: 'app_id obrigatório' }, { status: 400 })

    const { error } = await supabase.from('apps_instalados').delete().eq('app_id', app_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno' }, { status: 500 })
  }
}
