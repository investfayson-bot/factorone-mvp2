import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

export const runtime = 'nodejs'
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Público: dados do site + token de captação (pro formulário virar lead no funil).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const d = db()
  const { data: site } = await d.from('sites').select('*').eq('slug', slug).eq('publicado', true).maybeSingle()
  if (!site) return NextResponse.json({ error: 'Site não encontrado' }, { status: 404 })
  const { data: tk } = await d.from('inbound_tokens').select('token').eq('empresa_id', site.empresa_id).maybeSingle()
  let token = tk?.token as string | undefined
  if (!token) { token = 'fo_' + randomUUID().replace(/-/g, ''); await d.from('inbound_tokens').insert({ empresa_id: site.empresa_id, token }) }
  return NextResponse.json({ site, token })
}
