import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { differenceInCalendarDays } from 'date-fns'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseUser } from '@/lib/supabase-route'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

function montarMensagem(
  conta: { cliente_nome: string; valor: number; data_vencimento: string; chave_pix_cobranca?: string | null },
  base: string
) {
  return `Olá ${conta.cliente_nome}, ${base}. Valor: R$ ${Number(conta.valor || 0).toFixed(2)}. Vencimento: ${conta.data_vencimento}. ${conta.chave_pix_cobranca ? `Chave PIX: ${conta.chave_pix_cobranca}` : ''}`.trim()
}

async function enviarUmaCobranca(
  supabase: SupabaseClient,
  empresaId: string,
  contaReceberId: string
): Promise<{ success: boolean; status?: string; error?: string }> {
  const { data: conta } = await supabase
    .from('contas_receber')
    .select('*')
    .eq('id', contaReceberId)
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (!conta) return { success: false, error: 'Conta não encontrada' }

  const { data: regua } = await supabase
    .from('reguas_cobranca')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('ativo', true)
    .limit(1)
    .maybeSingle()

  const dias = differenceInCalendarDays(new Date(), new Date(conta.data_vencimento))
  const notifs = (regua?.notificacoes as Array<{ dias: number; canal: string; mensagem: string }>) || []
  const regra = notifs.find((n) => Number(n.dias) === dias) || { mensagem: 'cobrança pendente', canal: 'email' }
  const msg = montarMensagem(conta, regra.mensagem)
  let status: string = 'pendente'
  if (resend && conta.cliente_email) {
    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM || 'no-reply@factorone.com.br',
        to: conta.cliente_email,
        subject: `Cobrança - ${conta.descricao}`,
        html: `<p>${msg}</p>`,
      })
      status = 'enviado'
    } catch {
      status = 'erro'
    }
  }
  await supabase.from('log_cobrancas').insert({
    conta_receber_id: conta.id,
    empresa_id: empresaId,
    canal: 'email',
    destinatario: conta.cliente_email || conta.cliente_nome,
    mensagem: msg,
    status,
  })
  return { success: true, status }
}

export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json()
  const action = body.action || 'enviar'
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) || user.id

  if (action === 'enviar') {
    const r = await enviarUmaCobranca(supabase, empresaId, body.conta_receber_id as string)
    if (!r.success) return NextResponse.json({ error: r.error || 'Falha' }, { status: 404 })
    return NextResponse.json({ success: true, status: r.status })
  }

  if (action === 'automatica') {
    const { data: contas } = await supabase
      .from('contas_receber')
      .select('id')
      .eq('empresa_id', empresaId)
      .in('status', ['pendente', 'vencida'])
    const hoje = new Date().toISOString().slice(0, 10)
    const detalhes: Array<{ id: string; status?: string; skipped?: boolean }> = []
    for (const c of contas || []) {
      const { data: ja } = await supabase
        .from('log_cobrancas')
        .select('id')
        .eq('conta_receber_id', c.id)
        .gte('enviado_em', `${hoje}T00:00:00`)
        .limit(1)
        .maybeSingle()
      if (ja) {
        detalhes.push({ id: c.id, skipped: true })
        continue
      }
      const r = await enviarUmaCobranca(supabase, empresaId, c.id)
      detalhes.push({ id: c.id, status: r.status })
    }
    return NextResponse.json({ success: true, processadas: detalhes.filter((d) => !d.skipped).length, detalhes })
  }

  return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
}
