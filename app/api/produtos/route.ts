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
  if (!user) return NextResponse.json({ ok: false, produtos: [] }, { status: 401 })
  const empresa = await empresaDe(user.id)
  const { data, error } = await db().from('produtos').select('*').eq('empresa_id', empresa).order('created_at', { ascending: true })
  if (error) return NextResponse.json({ ok: false, produtos: [] }) // tabela ausente → front usa localStorage
  return NextResponse.json({ ok: true, produtos: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => ({})) as { produtos?: Record<string, unknown>[] }
  const lista = body.produtos ?? []
  const d = db()
  const empresa = await empresaDe(user.id)
  await d.from('produtos').delete().eq('empresa_id', empresa)
  if (lista.length) {
    const rows = lista.map(p => ({
      id: p.id, empresa_id: empresa,
      nome: p.nome ?? '', unidade: p.unidade ?? 'un',
      custo: Number(p.custo ?? 0), preco: Number(p.preco ?? 0),
      vendidos: Number(p.vendidos ?? 0), ativo: p.ativo !== false,
      updated_at: new Date().toISOString(),
    }))
    const { error } = await d.from('produtos').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
