import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseUser } from '@/lib/supabase-route'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// Aceita um convite de equipe — substitui o upsert direto do client em
// usuarios.empresa_id (que dependia de uma policy hoje fechada). Valida o
// token server-side e usa service role pra escrever. Também registra a nova
// empresa em usuario_empresas, então quem aceita não perde acesso à própria
// empresa (se tiver uma) — pode alternar entre as duas depois.
export async function POST(req: NextRequest) {
  const { user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const token = String(body.token || '')
  if (!token) return NextResponse.json({ error: 'Token ausente' }, { status: 400 })

  const svc = db()
  const { data: convite } = await svc.from('membros_equipe').select('empresa_id,role,status,expires_at').eq('token', token).maybeSingle()
  if (!convite) return NextResponse.json({ error: 'Convite inválido' }, { status: 404 })
  if (convite.expires_at && new Date(convite.expires_at as string) < new Date()) return NextResponse.json({ error: 'Convite expirado' }, { status: 400 })

  // Nunca deixa um convite rebaixar quem já é DONO da empresa (empresas.user_id).
  // Bug real que aconteceu: o próprio dono se convidou como 'contador' pra
  // testar o fluxo, o convite foi aceito, e sobrescreveu o papel dele de
  // 'admin' pra 'contador' na PRÓPRIA empresa — perdeu acesso ao próprio
  // sidebar completo até alguém corrigir na mão no banco.
  const { data: empresaAlvo } = await svc.from('empresas').select('user_id').eq('id', convite.empresa_id as string).maybeSingle()
  if (empresaAlvo?.user_id === user.id) {
    return NextResponse.json({ error: 'Você é o dono desta empresa — não é possível aceitar um convite que rebaixaria seu próprio acesso.' }, { status: 400 })
  }

  const { error: eConv } = await svc.from('membros_equipe').update({ status: 'ativo', user_id: user.id, updated_at: new Date().toISOString() }).eq('token', token)
  if (eConv) return NextResponse.json({ error: eConv.message }, { status: 500 })

  const { error: eMemb } = await svc.from('usuario_empresas').upsert({ user_id: user.id, empresa_id: convite.empresa_id, papel: convite.role || 'viewer' }, { onConflict: 'user_id,empresa_id' })
  if (eMemb) return NextResponse.json({ error: eMemb.message }, { status: 500 })

  const { error: eUser } = await svc.from('usuarios').update({ empresa_id: convite.empresa_id }).eq('id', user.id)
  if (eUser) return NextResponse.json({ error: eUser.message }, { status: 500 })

  return NextResponse.json({ ok: true, empresa_id: convite.empresa_id })
}
