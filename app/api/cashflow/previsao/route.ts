import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseUser } from '@/lib/supabase-route'

export async function GET(req: NextRequest) {
  const { user } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: u } = await db.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const eid = u?.empresa_id ?? user.id

  const today = new Date()
  const today0 = today.toISOString().slice(0, 10)
  const end90 = new Date(today); end90.setDate(end90.getDate() + 90)
  const end90str = end90.toISOString().slice(0, 10)
  const start90 = new Date(today); start90.setDate(start90.getDate() - 90)
  const start90str = start90.toISOString().slice(0, 10)

  const [contasRes, pagarRes, receberRes, histRes] = await Promise.all([
    db.from('contas_bancarias').select('saldo_disponivel, saldo').eq('empresa_id', eid),
    db.from('contas_pagar').select('data_vencimento, valor, descricao')
      .eq('empresa_id', eid).gte('data_vencimento', today0).lte('data_vencimento', end90str)
      .not('status', 'eq', 'pago'),
    db.from('contas_receber').select('data_vencimento, valor, valor_recebido, status')
      .eq('empresa_id', eid).gte('data_vencimento', today0).lte('data_vencimento', end90str)
      .not('status', 'eq', 'recebido'),
    db.from('transacoes').select('tipo, valor').eq('empresa_id', eid)
      .gte('data', start90str).lte('data', today0),
  ])

  const saldoAtual = (contasRes.data ?? []).reduce(
    (s, c) => s + Number(c.saldo_disponivel ?? c.saldo ?? 0), 0
  )

  type DayEvent = { saida: number; entrada: number }
  const dayMap: Record<string, DayEvent> = {}
  const getDay = (d: string) => {
    if (!dayMap[d]) dayMap[d] = { saida: 0, entrada: 0 }
    return dayMap[d]
  }

  for (const p of pagarRes.data ?? []) {
    getDay(p.data_vencimento).saida += Number(p.valor ?? 0)
  }
  for (const r of receberRes.data ?? []) {
    const pending = Number(r.valor ?? 0) - Number(r.valor_recebido ?? 0)
    if (pending > 0) getDay(r.data_vencimento).entrada += pending
  }

  const hist = histRes.data ?? []
  const histDays = 90
  const avgBurnDaily = hist.filter(t => t.tipo === 'saida').reduce((s, t) => s + Number(t.valor ?? 0), 0) / histDays
  const avgReceiveDaily = hist.filter(t => t.tipo === 'entrada').reduce((s, t) => s + Number(t.valor ?? 0), 0) / histDays

  const dias: Array<{ data: string; saldo: number; saida: number; entrada: number }> = []
  let saldo = saldoAtual

  for (let i = 0; i < 90; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    const dStr = d.toISOString().slice(0, 10)
    const day = dayMap[dStr]
    const saida = (day?.saida ?? 0) + avgBurnDaily
    const entrada = (day?.entrada ?? 0) + avgReceiveDaily
    saldo = Math.round((saldo + entrada - saida) * 100) / 100
    dias.push({
      data: dStr,
      saldo,
      saida: Math.round(saida * 100) / 100,
      entrada: Math.round(entrada * 100) / 100,
    })
  }

  return NextResponse.json({
    saldoAtual,
    d7: dias[6]?.saldo ?? saldoAtual,
    d30: dias[29]?.saldo ?? saldoAtual,
    d90: dias[89]?.saldo ?? saldoAtual,
    avgBurnDaily,
    avgReceiveDaily,
    dias,
  })
}
