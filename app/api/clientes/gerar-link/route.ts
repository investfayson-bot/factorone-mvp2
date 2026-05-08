import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: ur } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = ur?.empresa_id ?? user.id

  const { cliente_id } = await req.json() as { cliente_id: string }
  if (!cliente_id) return NextResponse.json({ error: 'cliente_id obrigatório' }, { status: 400 })

  const token = randomUUID()
  const expiresAt = new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString()

  const { error } = await supabase.from('cliente_links').insert({
    empresa_id: empresaId,
    cliente_id,
    token,
    expires_at: expiresAt,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const origin = req.headers.get('origin') ?? 'https://factorone-mvp2.vercel.app'
  return NextResponse.json({ token, url: `${origin}/cliente/${token}` })
}
