import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Gate: só a conta demo pode popular dados de demo
  if (user.email !== 'demo@factorone.com.br') {
    return NextResponse.json({ error: 'Apenas a conta demo pode usar este endpoint' }, { status: 403 })
  }

  const { data: usuarioData } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = usuarioData?.empresa_id || user.id

  try {
    // Verificar se já tem dados (idempotência)
    const { count: contaCount } = await supabase.from('contas_bancarias').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId)
    if (contaCount && contaCount > 0) {
      return NextResponse.json({ ok: true, message: 'Dados já existem. Pulando seed.' })
    }

    // 1. Contas bancárias
    const { data: contas } = await supabase.from('contas_bancarias').insert([
      {
        empresa_id: empresaId,
        banco: 'Banco do Brasil',
        agencia: '0001',
        conta: '123456-7',
        saldo: 45000,
        tipo: 'corrente',
        ativo: true,
      },
      {
        empresa_id: empresaId,
        banco: 'Caixa Econômica',
        agencia: '0001',
        conta: '234567-8',
        saldo: 15000,
        tipo: 'poupanca',
        ativo: true,
      },
    ]).select()

    // 2. Extratos
    if (contas && contas.length > 0) {
      await supabase.from('extrato_bancario').insert([
        {
          empresa_id: empresaId,
          conta_id: contas[0].id,
          data_transacao: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          descricao: 'Venda de produtos - NF #001',
          valor: 3500,
          tipo: 'entrada',
          saldo_posterior: 45000,
        },
        {
          empresa_id: empresaId,
          conta_id: contas[0].id,
          data_transacao: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          descricao: 'Pagamento de fornecedor',
          valor: 1200,
          tipo: 'saida',
          saldo_posterior: 43800,
        },
        {
          empresa_id: empresaId,
          conta_id: contas[0].id,
          data_transacao: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          descricao: 'Folha de pagamento',
          valor: 8000,
          tipo: 'saida',
          saldo_posterior: 35800,
        },
      ])
    }

    // 3. Cartão
    const { data: cartoes } = await supabase.from('cartoes').insert([
      {
        empresa_id: empresaId,
        numero: '4111111111111111',
        bandeira: 'Visa',
        limite: 15000,
        saldo: 3500,
        data_vencimento: '2026-08-31',
        ativo: true,
        tipo: 'credito',
      },
    ]).select()

    // 4. Transações de cartão
    if (cartoes && cartoes.length > 0) {
      await supabase.from('cartao_transacoes').insert([
        {
          cartao_id: cartoes[0].id,
          data_transacao: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          estabelecimento: 'Supermercado ABC',
          valor: 450.50,
          categoria: 'Alimentação',
          descricao: 'Compras gerais',
          parcelado: false,
          parcelas: 1,
        },
        {
          cartao_id: cartoes[0].id,
          data_transacao: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          estabelecimento: 'Magazine Luiza',
          valor: 2800,
          categoria: 'Eletrônicos',
          descricao: 'Compra em 12x',
          parcelado: true,
          parcelas: 12,
        },
      ])
    }

    // 5. Clientes
    await supabase.from('clientes').insert([
      {
        empresa_id: empresaId,
        nome: 'João Silva',
        email: 'joao@email.com',
        telefone: '11999999999',
        cpf_cnpj: '123.456.789-00',
        tipo: 'pf',
        ativo: true,
      },
      {
        empresa_id: empresaId,
        nome: 'Empresa XYZ LTDA',
        email: 'contato@xyz.com',
        telefone: '1133333333',
        cpf_cnpj: '12.345.678/0001-90',
        tipo: 'pj',
        ativo: true,
      },
    ])

    // 6. Leads
    await supabase.from('leads').insert([
      {
        empresa_id: empresaId,
        nome: 'Carlos Oliveira',
        email: 'carlos@email.com',
        telefone: '11987654321',
        origem: 'Website',
        status: 'novo',
      },
      {
        empresa_id: empresaId,
        nome: 'Ana Costa',
        email: 'ana@email.com',
        telefone: '11912345678',
        origem: 'Telegram',
        status: 'contatado',
      },
    ])

    return NextResponse.json({ ok: true, message: 'Dados de demo populados com sucesso!' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
