import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'
import { calcularDAS, type AnexoSimples } from '@/lib/fiscal/simples-nacional'

export async function GET(req: NextRequest) {
  try {
    const { user, supabase } = await getSupabaseUser(req)
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { data: usrRow } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const empresaId = usrRow?.empresa_id ?? user.id

    const { searchParams } = new URL(req.url)
    const anexo = (searchParams.get('anexo') || 'III') as AnexoSimples
    const agora = new Date()
    const comp = searchParams.get('competencia') || `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`

    const [ano, mes] = comp.split('-').map(Number)
    const inicioMes = `${ano}-${String(mes).padStart(2, '0')}-01`
    const fimMes = new Date(ano, mes, 0).toISOString().slice(0, 10)

    // Receita do mês (entradas)
    const { data: txMes } = await supabase
      .from('transacoes')
      .select('valor')
      .eq('empresa_id', empresaId)
      .eq('tipo', 'entrada')
      .gte('data', inicioMes)
      .lte('data', fimMes)

    const receitaMes = (txMes ?? []).reduce((s, t) => s + Number(t.valor || 0), 0)

    // RBT12: receita dos últimos 12 meses
    const doze = new Date(agora)
    doze.setMonth(doze.getMonth() - 12)
    const inicio12 = doze.toISOString().slice(0, 10)

    const { data: tx12 } = await supabase
      .from('transacoes')
      .select('valor')
      .eq('empresa_id', empresaId)
      .eq('tipo', 'entrada')
      .gte('data', inicio12)

    const rbt12 = (tx12 ?? []).reduce((s, t) => s + Number(t.valor || 0), 0)

    const resultado = calcularDAS(receitaMes, rbt12, anexo, comp)

    return NextResponse.json(resultado)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
