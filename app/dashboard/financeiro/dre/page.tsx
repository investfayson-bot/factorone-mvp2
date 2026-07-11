'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import toast from 'react-hot-toast'

type Met = Record<string, number | string>

const LINHAS: { linha: string; chave: string }[] = [
  { linha: 'Receita Bruta', chave: 'receita_bruta' },
  { linha: '(–) Deduções e Impostos', chave: 'deducoes' },
  { linha: '= Receita Líquida', chave: 'receita_liquida' },
  { linha: '(–) Custos (CMV/CPV)', chave: 'cmv' },
  { linha: '= Lucro Bruto', chave: 'lucro_bruto' },
  { linha: '(–) Despesas Operacionais', chave: 'despesas_operacionais' },
  { linha: '= EBITDA', chave: 'ebitda' },
  { linha: '(–) Depreciação/Amortização', chave: 'depreciacao' },
  { linha: '= EBIT', chave: 'ebit' },
  { linha: '(–) Resultado Financeiro', chave: 'resultado_financeiro' },
  { linha: '= Lucro Antes do IR', chave: 'lair' },
  { linha: '(–) IR/CSLL', chave: 'impostos' },
  { linha: '= Lucro Líquido', chave: 'lucro_liquido' },
]

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function DrePage() {
  const [competencia, setCompetencia] = useState(new Date().toISOString().slice(0, 7))
  const [empresaId, setEmpresaId] = useState('')
  const [metricas, setMetricas] = useState<Met | null>(null)
  const [historico, setHistorico] = useState<Met[]>([])
  const [loading, setLoading] = useState(true)
  const [exportando, setExportando] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const empresa = (u?.empresa_id as string) || user.id
    setEmpresaId(empresa)
    const compDate = new Date(`${competencia}-01T00:00:00`)
    const { data: sess } = await supabase.auth.getSession()
    await fetch('/api/dre/recalcular', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(sess.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {}) },
      body: JSON.stringify({ empresaId: empresa, competencia: compDate.toISOString() }),
    })
    const { data: met } = await supabase.from('metricas_financeiras').select('*').eq('empresa_id', empresa).eq('competencia', `${competencia}-01`).maybeSingle()
    const { data: hist } = await supabase.from('metricas_financeiras').select('*').eq('empresa_id', empresa).order('competencia', { ascending: false }).limit(6)
    setMetricas((met as Met) ?? null)
    setHistorico(((hist as Met[]) ?? []).reverse())
    setLoading(false)
  }, [competencia])

  useEffect(() => { void carregar() }, [carregar])

  const histChart = useMemo(() => historico.map(h => ({
    mes: new Date(`${String(h.competencia)}T12:00:00`).toLocaleDateString('pt-BR', { month: '2-digit', year: '2-digit' }),
    ebitda: Number(h.ebitda || 0),
    margem: Number(h.margem_ebitda || 0),
  })), [historico])

  async function exportarPdf() {
    setExportando(true)
    try {
      const { baixarArquivo } = await import('@/lib/download-arquivo')
      const r = await baixarArquivo(`/api/dre/exportar-pdf?competencia=${competencia}`, `dre_${competencia}.pdf`)
      if ('erro' in r) toast.error(r.erro)
      else toast.success('DRE exportado em PDF')
    } finally {
      setExportando(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <input type="month" className="form-input" style={{ width: 'auto' }} value={competencia} onChange={e => setCompetencia(e.target.value)} />
        <div style={{ flex: 1 }} />
        <button className="btn-v2 primary" disabled={exportando} onClick={() => void exportarPdf()}>
          {exportando ? 'Gerando…' : 'Exportar DRE em PDF'}
        </button>
      </div>

      <div className="card-v2" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="card-v2-h" style={{ padding: '14px 16px 0' }}>
          <h3>Demonstrativo de Resultado — {competencia}</h3>
        </div>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--mut)' }}>Carregando…</div>
        ) : (
          <table className="table-v2">
            <tbody>
              {LINHAS.map(l => {
                const valor = Number(metricas?.[l.chave] || 0)
                const isTotal = l.linha.startsWith('=')
                const destaque = l.chave === 'ebitda'
                const forte = l.chave === 'lucro_liquido'
                return (
                  <tr key={l.chave} style={destaque ? { background: 'var(--acc-soft)' } : forte ? { background: 'var(--bg)' } : undefined}>
                    <td style={{ padding: '9px 16px', fontWeight: isTotal ? 800 : 500, color: isTotal ? 'var(--ink)' : 'var(--mut)' }}>{l.linha}</td>
                    <td className="num" style={{ textAlign: 'right', padding: '9px 16px', fontWeight: isTotal ? 800 : 600, color: valor < 0 ? 'var(--neg)' : isTotal ? 'var(--acc-ink)' : 'var(--ink)' }}>
                      {fmtBRL(valor)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card-v2">
        <div className="card-v2-h"><h3>EBITDA — últimos 6 meses</h3></div>
        {histChart.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--mut)' }}>Sem histórico suficiente.</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={histChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
              <XAxis dataKey="mes" tick={{ fill: 'var(--mut)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'var(--mut)', fontSize: 12 }} tickFormatter={(v: number) => v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`} />
              <Tooltip formatter={(value: number, name: string) => [name === 'ebitda' ? fmtBRL(value) : `${value.toFixed(1)}%`, name === 'ebitda' ? 'EBITDA' : 'Margem']} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--line)' }} />
              <Bar dataKey="ebitda" fill="#16A34A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div style={{ fontSize: 12, color: 'var(--mut)', textAlign: 'right' }}>
        <Link href="/dashboard/relatorios" className="link-v2">Ver relatório completo (comparativo, métricas, histórico 12M, gerencial, exportações) →</Link>
      </div>
    </div>
  )
}
