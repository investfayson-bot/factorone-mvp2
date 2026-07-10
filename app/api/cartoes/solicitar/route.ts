import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'

export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const nomeCartao = String(body.nome_cartao || '').trim()
  const setor = String(body.setor || '').trim()
  const limite = Number(body.limite_sugerido || 0)
  const observacao = String(body.observacao || '').trim() || null

  if (!nomeCartao) return NextResponse.json({ error: 'Nome do cartão é obrigatório' }, { status: 400 })
  if (!Number.isFinite(limite) || limite <= 0) {
    return NextResponse.json({ error: 'Limite sugerido inválido' }, { status: 400 })
  }

  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) || user.id

  const { error } = await supabase.from('solicitacoes_cartao').insert({
    empresa_id: empresaId,
    solicitante_user_id: user.id,
    nome_cartao: nomeCartao,
    setor: setor || null,
    limite_sugerido: limite,
    observacao,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
