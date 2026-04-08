import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'

export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json()
  const valor = Number(body.valor || 0)
  if (!valor || valor <= 0) return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })
  const { data: u, error: userError } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  if (userError) return NextResponse.json({ error: userError.message }, { status: 400 })
  const empresaId = (u?.empresa_id as string) || user.id
  const { data: conta, error: contaError } = await supabase.from('contas_bancarias').select('id,saldo_disponivel,saldo,empresa_id').eq('id', body.conta_origem_id).eq('empresa_id', empresaId).maybeSingle()
  if (contaError) return NextResponse.json({ error: contaError.message }, { status: 400 })
  if (!conta) return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 })
  if (Number(conta.saldo_disponivel || 0) < valor) return NextResponse.json({ error: 'Saldo insuficiente' }, { status: 400 })

  const trfInsert = await supabase.from('transferencias_agendadas').insert({
    empresa_id: empresaId, conta_origem_id: body.conta_origem_id, tipo: body.tipo, valor,
    destinatario_nome: body.destinatario_nome, destinatario_documento: body.destinatario_documento,
    destinatario_banco: body.destinatario_banco, destinatario_agencia: body.destinatario_agencia,
    destinatario_conta: body.destinatario_conta, chave_pix: body.chave_pix, descricao: body.descricao,
    data_agendada: body.data_agendada, status: body.data_agendada === new Date().toISOString().slice(0, 10) ? 'concluido' : 'agendado',
  })
  if (trfInsert.error) return NextResponse.json({ error: trfInsert.error.message }, { status: 400 })
  const novoSaldo = Number(conta.saldo || 0) - valor
  const extratoInsert = await supabase.from('extrato_bancario').insert({
    conta_id: body.conta_origem_id, empresa_id: empresaId, descricao: body.descricao || `${String(body.tipo || '').toUpperCase()} enviado`,
    valor, tipo: 'debito', categoria: 'Transferências', data_transacao: new Date().toISOString(), saldo_apos: novoSaldo,
    tipo_operacao: body.tipo, contraparte_nome: body.destinatario_nome, contraparte_documento: body.destinatario_documento, contraparte_banco: body.destinatario_banco, chave_pix: body.chave_pix, conciliado: true,
  })
  if (extratoInsert.error) return NextResponse.json({ error: extratoInsert.error.message }, { status: 400 })
  const contaUpdate = await supabase.from('contas_bancarias').update({ saldo: novoSaldo, saldo_disponivel: novoSaldo }).eq('id', body.conta_origem_id)
  if (contaUpdate.error) return NextResponse.json({ error: contaUpdate.error.message }, { status: 400 })
  await supabase.from('transacoes').insert({
    empresa_id: empresaId, descricao: body.descricao || `${String(body.tipo || '').toUpperCase()} enviado`,
    tipo: 'saida', valor, categoria: 'Transferência bancária', status: 'pago', data: new Date().toISOString().slice(0, 10),
  })
  return NextResponse.json({ success: true, saldo_atual: novoSaldo })
}
