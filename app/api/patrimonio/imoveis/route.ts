import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function empresaDe(userId: string) {
  const { data } = await db().from('usuarios').select('empresa_id').eq('id', userId).maybeSingle()
  return (data?.empresa_id as string) ?? userId
}

export async function GET(req: NextRequest) {
  const { user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ ok: false, imoveis: [] }, { status: 401 })
  const empresa = await empresaDe(user.id)
  const { data, error } = await db().from('imoveis').select('*').eq('empresa_id', empresa).order('created_at', { ascending: true })
  if (error) return NextResponse.json({ ok: false, imoveis: [] }) // tabela ainda não existe → fallback local
  return NextResponse.json({ ok: true, imoveis: data ?? [] })
}

// Substituição em lote (casa com o persistir(array) da página).
export async function POST(req: NextRequest) {
  const { user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => ({})) as { imoveis?: Record<string, unknown>[] }
  const lista = body.imoveis ?? []
  const d = db()
  const empresa = await empresaDe(user.id)
  await d.from('imoveis').delete().eq('empresa_id', empresa)
  if (lista.length) {
    const rows = lista.map(i => ({ ...i, empresa_id: empresa, updated_at: new Date().toISOString() }))
    const { error } = await d.from('imoveis').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
