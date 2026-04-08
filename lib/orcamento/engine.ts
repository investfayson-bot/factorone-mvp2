import { createClient } from '@supabase/supabase-js'

type Linha = {
  id: string
  valor_previsto: number
  valor_realizado: number
  categoria: string
}

export type AlertaOrcamento = {
  id?: string
  orcamento_linha_id: string
  tipo: 'alerta_80' | 'alerta_100' | 'estouro' | 'tendencia_estouro'
  percentual_consumido: number
  valor_previsto: number
  valor_realizado: number
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function verificarAlertas(empresaId: string, competencia: Date): Promise<AlertaOrcamento[]> {
  const supabase = adminClient()
  const mes = competencia.getMonth() + 1
  const ano = competencia.getFullYear()
  const { data: linhas } = await supabase.from('orcamento_linhas').select('id,valor_previsto,valor_realizado').eq('empresa_id', empresaId).eq('mes', mes).eq('ano', ano)
  const alertas: AlertaOrcamento[] = []
  for (const l of (linhas || []) as Array<{ id: string; valor_previsto: number; valor_realizado: number }>) {
    const previsto = Number(l.valor_previsto || 0)
    const realizado = Number(l.valor_realizado || 0)
    const pct = previsto > 0 ? (realizado / previsto) * 100 : 0
    if (pct >= 80 && pct < 100) {
      alertas.push({ orcamento_linha_id: l.id, tipo: 'alerta_80', percentual_consumido: pct, valor_previsto: previsto, valor_realizado: realizado })
    } else if (pct >= 100) {
      alertas.push({ orcamento_linha_id: l.id, tipo: 'estouro', percentual_consumido: pct, valor_previsto: previsto, valor_realizado: realizado })
    }
  }
  if (alertas.length) {
    await supabase.from('alertas_orcamento').insert(
      alertas.map((a) => ({
        empresa_id: empresaId,
        ...a,
      }))
    )
    await supabase.from('orcamento_linhas').update({ alerta_enviado: true }).in('id', alertas.map((a) => a.orcamento_linha_id))
  }
  return alertas
}

export async function atualizarRealizado(
  empresaId: string,
  categoria: string,
  mes: number,
  ano: number,
  valorAdicional: number
): Promise<void> {
  const supabase = adminClient()
  const { data: orc } = await supabase.from('orcamentos').select('id').eq('empresa_id', empresaId).eq('ano_fiscal', ano).in('status', ['ativo', 'aprovado']).order('versao', { ascending: false }).limit(1).maybeSingle()
  if (!orc) return
  const { data: linha } = await supabase
    .from('orcamento_linhas')
    .select('id,valor_realizado')
    .eq('orcamento_id', orc.id)
    .eq('categoria', categoria)
    .eq('mes', mes)
    .eq('ano', ano)
    .is('centro_custo_id', null)
    .maybeSingle()
  if (!linha) return
  const realizado = Number(linha.valor_realizado || 0) + Number(valorAdicional || 0)
  await supabase.from('orcamento_linhas').update({ valor_realizado: realizado }).eq('id', linha.id)
  await verificarAlertas(empresaId, new Date(ano, mes - 1, 1))
}

export function calcularResumoOrcamento(linhas: Linha[]) {
  const totalPrevisto = linhas.reduce((s, l) => s + Number(l.valor_previsto || 0), 0)
  const totalRealizado = linhas.reduce((s, l) => s + Number(l.valor_realizado || 0), 0)
  const percentualConsumido = totalPrevisto > 0 ? (totalRealizado / totalPrevisto) * 100 : 0
  const porCategoria = new Map<string, { previsto: number; realizado: number }>()
  for (const l of linhas) {
    const p = porCategoria.get(l.categoria) || { previsto: 0, realizado: 0 }
    p.previsto += Number(l.valor_previsto || 0)
    p.realizado += Number(l.valor_realizado || 0)
    porCategoria.set(l.categoria, p)
  }
  const categorias = Array.from(porCategoria.entries()).map(([categoria, vals]) => ({
    categoria,
    previsto: vals.previsto,
    realizado: vals.realizado,
    pct: vals.previsto > 0 ? (vals.realizado / vals.previsto) * 100 : 0,
  }))
  const categoriasMaisConsumidas = [...categorias].sort((a, b) => b.pct - a.pct).slice(0, 3)
  const categoriasEstouradas = categorias.filter((c) => c.realizado > c.previsto)
  const tendenciaFinalAno = totalRealizado * 3
  return { totalPrevisto, totalRealizado, percentualConsumido, categoriasMaisConsumidas, categoriasEstouradas, tendenciaFinalAno }
}
