import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function empresaDe(userId: string) {
  const { data } = await db().from('usuarios').select('empresa_id').eq('id', userId).maybeSingle()
  return (data?.empresa_id as string) ?? userId
}
function slugify(s: string) {
  return (s || 'meu-site').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'site'
}

export async function GET(req: NextRequest) {
  const { user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ ok: false, site: null }, { status: 401 })
  const empresa = await empresaDe(user.id)
  const { data, error } = await db().from('sites').select('*').eq('empresa_id', empresa).maybeSingle()
  if (error) return NextResponse.json({ ok: false, site: null }) // tabela não existe
  return NextResponse.json({ ok: true, site: data ?? null })
}

export async function POST(req: NextRequest) {
  const { user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const b = await req.json().catch(() => ({})) as Record<string, unknown>
  const d = db()
  const empresa = await empresaDe(user.id)

  const { data: ex } = await d.from('sites').select('slug').eq('empresa_id', empresa).maybeSingle()
  let slug = ex?.slug as string | undefined
  if (!slug) {
    const base = slugify(String(b.nome ?? 'meu-site'))
    slug = base
    // garante unicidade
    for (let i = 0; i < 5; i++) {
      const { data: dup } = await d.from('sites').select('id').eq('slug', slug).maybeSingle()
      if (!dup) break
      slug = `${base}-${Math.floor(Math.random() * 900 + 100)}`
    }
  }

  const row = {
    empresa_id: empresa, slug,
    nome: b.nome ?? null, slogan: b.slogan ?? null, ramo: b.ramo ?? null,
    template: b.template ?? 'moderno', cor: b.cor ?? '#3D7A6E',
    sobre: b.sobre ?? null, servicos: b.servicos ?? [],
    whatsapp: b.whatsapp ?? null, email: b.email ?? null, telefone: b.telefone ?? null,
    publicado: b.publicado ?? true, updated_at: new Date().toISOString(),
  }
  const { error } = await d.from('sites').upsert(row, { onConflict: 'empresa_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, slug })
}
