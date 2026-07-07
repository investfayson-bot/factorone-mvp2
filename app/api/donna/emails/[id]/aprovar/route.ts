import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'
import { decifrar } from '@/lib/cofre-crypto'
import { renovarAccessToken } from '@/lib/google-oauth'
import { enviarResposta, marcarComoLida } from '@/lib/gmail-client'
import { registrarAcaoAgente } from '@/lib/agentes-log'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) || user.id

  const body = await req.json().catch(() => ({})) as { corpo?: string }

  const { data: item } = await supabase.from('donna_emails_processados').select('*').eq('id', id).eq('empresa_id', empresaId).maybeSingle()
  if (!item) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  if (item.status !== 'pendente_aprovacao') return NextResponse.json({ error: 'Este item já foi tratado' }, { status: 400 })

  const { data: conta } = await supabase.from('google_contas').select('email,refresh_token_cifrado').eq('empresa_id', empresaId).maybeSingle()
  if (!conta) return NextResponse.json({ error: 'Google não conectado' }, { status: 400 })

  const corpo = (body.corpo ?? item.corpo_resposta ?? '').trim()
  if (!corpo) return NextResponse.json({ error: 'Rascunho vazio' }, { status: 400 })

  try {
    const refreshToken = decifrar(conta.refresh_token_cifrado as string)
    const { access_token } = await renovarAccessToken(refreshToken)
    await enviarResposta(access_token, { to: item.remetente as string, from: conta.email as string, subject: item.assunto as string, bodyText: corpo, threadId: item.gmail_thread_id as string, messageIdHeader: item.gmail_message_id as string })
    try { await marcarComoLida(access_token, item.gmail_message_id as string) } catch { /* não crítico */ }
  } catch {
    return NextResponse.json({ error: 'Falha ao enviar pelo Gmail' }, { status: 500 })
  }

  await supabase.from('donna_emails_processados').update({ status: 'aprovado', corpo_resposta: corpo, acao: 'respondido' }).eq('id', id)
  await registrarAcaoAgente(supabase, empresaId, 'donna', `Você aprovou e enviou a resposta pro e-mail "${item.assunto}"`, { detalhe: item.remetente as string })

  return NextResponse.json({ ok: true })
}
