import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'

function encodeApiKey(raw: string): string {
  return Buffer.from(raw, 'utf-8').toString('base64')
}

export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const sistema = String(body.sistema || '').trim()
  const apiKey = String(body.api_key || '').trim()
  if (!sistema) return NextResponse.json({ error: 'Sistema é obrigatório' }, { status: 400 })
  if (!apiKey) return NextResponse.json({ error: 'API key é obrigatória' }, { status: 400 })

  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) || user.id

  const { error } = await supabase.from('integracoes_config').upsert(
    {
      empresa_id: empresaId,
      sistema,
      api_key_enc: encodeApiKey(apiKey),
      status: 'configurado',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'empresa_id,sistema' }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
