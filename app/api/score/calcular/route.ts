import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseUser } from '@/lib/supabase-route'

function clamp(v: number, min: number, max: number) { return Math.min(max, Math.max(min, v)) }

export async function GET(req: NextRequest) {
  const { user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: u } = await db.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const eid = u?.empresa_id ?? user.id

  const now = new Date()
  const mesAtual0 = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const mesAnt0 = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10)
  const mesAnt1 = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10)
  const d90 = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)

  const [contasRes, txAtualRes, txAntRes, pagarRes] = await Promise.all([
    db.from('contas_bancarias').select('saldo_disponivel, saldo').eq('empresa_id', eid),
    db.from('transacoes').select('tipo, valor').eq('empresa_id', eid).gte('data', mesAtual0),
    db.from('transacoes').select('tipo, valor').eq('empresa_id', eid).gte('data', mesAnt0).lte('data', mesAnt1),
    db.from('contas_pagar').select('status, data_vencimento').eq('empresa_id', eid).gte('data_vencimento', d90),
  ])

  const saldo = (contasRes.data ?? []).reduce((s, c) => s + Number(c.saldo_disponivel ?? c.saldo ?? 0), 0)
  const txA = txAtualRes.data ?? []
  const txB = txAntRes.data ?? []
  const pagar = pagarRes.data ?? []

  const recAtual = txA.filter(t => t.tipo === 'entrada').reduce((s, t) => s + Number(t.valor), 0)
  const despAtual = txA.filter(t => t.tipo === 'saida').reduce((s, t) => s + Number(t.valor), 0)
  const recAnt = txB.filter(t => t.tipo === 'entrada').reduce((s, t) => s + Number(t.valor), 0)
  const despAnt = txB.filter(t => t.tipo === 'saida').reduce((s, t) => s + Number(t.valor), 0)

  // 1. Runway (0-200): days of reserve at current burn rate
  const burnDia = despAtual > 0 ? despAtual / 30 : despAnt / 30 || 1
  const runway = burnDia > 0 ? saldo / burnDia : 999
  const runwayScore = clamp(Math.round((Math.min(runway, 180) / 180) * 200), 0, 200)

  // 2. Margem líquida (0-200): net profit margin vs 30% target
  const margem = recAtual > 0 ? (recAtual - despAtual) / recAtual : 0
  const margemScore = clamp(Math.round((margem / 0.3) * 200), 0, 200)

  // 3. Crescimento receita MoM (0-200): 10% MoM = 200pts
  const crescimento = recAnt > 0 ? (recAtual - recAnt) / recAnt : 0
  const crescScore = recAnt === 0 ? 100 : clamp(Math.round(100 + (crescimento / 0.1) * 100), 0, 200)

  // 4. Pontualidade pagamentos (0-200)
  const pgPago = pagar.filter(p => p.status === 'pago').length
  const pgVencida = pagar.filter(p => p.status === 'vencida').length
  const pgTotal = pagar.length
  const pontualidade = pgTotal > 0 ? pgPago / pgTotal : 1
  const pontScore = clamp(Math.round(pontualidade * 200 - pgVencida * 20), 0, 200)

  // 5. Reserva de caixa (0-200): 3x monthly expenses = 200pts
  const despMes = Math.max(despAtual, despAnt, 1)
  const nivelCaixa = saldo / despMes
  const caixaScore = clamp(Math.round((Math.min(nivelCaixa, 3) / 3) * 200), 0, 200)

  const total = runwayScore + margemScore + crescScore + pontScore + caixaScore
  const grade = total >= 800 ? 'A+' : total >= 700 ? 'A' : total >= 600 ? 'B+' : total >= 500 ? 'B' : total >= 400 ? 'C' : 'D'

  return NextResponse.json({
    total,
    grade,
    componentes: [
      {
        nome: 'Runway',
        pontos: runwayScore,
        max: 200,
        descricao: runway < 999 ? `${Math.round(runway)} dias de reserva` : '+180 dias',
        detalhe: runway >= 180 ? 'Excelente' : runway >= 90 ? 'Ok' : 'Atenção',
      },
      {
        nome: 'Margem Líquida',
        pontos: margemScore,
        max: 200,
        descricao: `${(margem * 100).toFixed(1)}% de margem`,
        detalhe: margem >= 0.2 ? 'Saudável' : margem >= 0 ? 'Ok' : 'Negativa',
      },
      {
        nome: 'Crescimento',
        pontos: crescScore,
        max: 200,
        descricao: recAnt > 0 ? `${crescimento >= 0 ? '+' : ''}${(crescimento * 100).toFixed(1)}% MoM` : '1º mês',
        detalhe: crescimento >= 0.1 ? 'Forte' : crescimento >= 0 ? 'Estável' : 'Queda',
      },
      {
        nome: 'Pontualidade',
        pontos: pontScore,
        max: 200,
        descricao: `${pgTotal > 0 ? Math.round(pontualidade * 100) : 100}% em dia`,
        detalhe: pgVencida === 0 ? 'Sem atrasos' : `${pgVencida} vencida${pgVencida > 1 ? 's' : ''}`,
      },
      {
        nome: 'Reserva',
        pontos: caixaScore,
        max: 200,
        descricao: `${nivelCaixa.toFixed(1)}x despesa mensal`,
        detalhe: nivelCaixa >= 3 ? 'Ótimo' : nivelCaixa >= 1 ? 'Ok' : 'Baixo',
      },
    ],
  })
}
