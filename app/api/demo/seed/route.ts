import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: usuarioData } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const empresaId = usuarioData?.empresa_id || user.id

    const { data: contas } = await supabase.from('contas_bancarias').insert([
      { empresa_id: empresaId, banco: 'Banco do Brasil', agencia: '0001', conta: '123456-7', saldo: 45000, tipo: 'corrente', data_abertura: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), ativo: true },
      { empresa_id: empresaId, banco: 'Caixa Econômica', agencia: '0001', conta: '234567-8', saldo: 15000, tipo: 'poupanca', data_abertura: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), ativo: true },
    ]).select()

    if (contas && contas.length > 0) {
      await supabase.from('extrato_bancario').insert([
        { empresa_id: empresaId, conta_id: contas[0].id, data_transacao: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), descricao: 'Venda de produtos', valor: 3500, tipo: 'entrada', saldo_posterior: 45000 },
        { empresa_id: empresaId, conta_id: contas[0].id, data_transacao: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), descricao: 'Pagamento fornecedor', valor: 1200, tipo: 'saida', saldo_posterior: 43800 },
      ])
    }

    const { data: cartoes } = await supabase.from('cartoes').insert([
      { empresa_id: empresaId, numero: '4111111111111111', bandeira: 'Visa', limite: 15000, saldo: 3500, data_vencimento: '2026-08-31', ativo: true, tipo: 'credito' },
    ]).select()

    if (cartoes && cartoes.length > 0) {
      await supabase.from('cartao_transacoes').insert([
        { cartao_id: cartoes[0].id, data_transacao: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), estabelecimento: 'Supermercado ABC', valor: 450.50, categoria: 'Alimentação', descricao: 'Compras', parcelado: false, parcelas: 1 },
        { cartao_id: cartoes[0].id, data_transacao: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), estabelecimento: 'Magazine Luiza', valor: 2800, categoria: 'Eletrônicos', descricao: 'Compra em 12x', parcelado: true, parcelas: 12 },
      ])
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
