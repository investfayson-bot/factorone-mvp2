import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const { data: demoDemographics } = await supabase
      .from('empresas')
      .select('id')
      .ilike('nome', '%demo%')
      .limit(1)
      .single()

    if (!demoDemographics) throw new Error('Demo empresa não encontrada')

    const empresaId = demoDemographics.id

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
    ]).select()

    if (contas?.length) {
      await supabase.from('extrato_bancario').insert([
        {
          empresa_id: empresaId,
          conta_id: contas[0].id,
          descricao: 'Venda produto NF-001',
          valor: 3500,
          tipo: 'entrada',
        },
        {
          empresa_id: empresaId,
          conta_id: contas[0].id,
          descricao: 'Pagamento fornecedor',
          valor: 1200,
          tipo: 'saida',
        },
      ])
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
