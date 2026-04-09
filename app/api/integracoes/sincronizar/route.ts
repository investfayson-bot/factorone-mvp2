import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'

export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const sistema = String(body.sistema || '').trim()
  if (!sistema) return NextResponse.json({ error: 'Sistema é obrigatório' }, { status: 400 })

  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) || user.id

  const { data: cfg } = await supabase
    .from('integracoes_config')
    .select('id,api_key_enc')
    .eq('empresa_id', empresaId)
    .eq('sistema', sistema)
    .maybeSingle()
  if (!cfg?.id || !cfg.api_key_enc) {
    return NextResponse.json({ error: 'Integração sem API key configurada' }, { status: 400 })
  }

  await supabase
    .from('integracoes_config')
    .update({ status: 'sincronizando', updated_at: new Date().toISOString() })
    .eq('id', cfg.id)

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('integracoes_config')
    .update({ status: 'sincronizado', ultimo_sync_em: now, ultimo_erro: null, updated_at: now })
    .eq('id', cfg.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true, synced_at: now })
}
