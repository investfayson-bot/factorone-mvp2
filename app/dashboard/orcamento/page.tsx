'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'
import OrcamentoWizard from '@/components/orcamento/OrcamentoWizard'
import EditarLinhaModal from '@/components/orcamento/EditarLinhaModal'
import SuplementacaoModal from '@/components/orcamento/SuplementacaoModal'
import { calcularResumoOrcamento } from '@/lib/orcamento/engine'

type Orcamento = { id: string; nome: string; ano_fiscal: number; status: string; versao: number }
type Linha = { id: string; categoria: string; centro_custo_id: string | null; mes: number; ano: number; valor_previsto: number; valor_realizado: number; variacao: number; variacao_pct: number }
type Alerta = { id: string; tipo: string; valor_previsto: number; valor_realizado: number; percentual_consumido: number; lido: boolean; created_at: string; orcamento_linha_id: string }
type Suplementacao = { id: string; status: string; valor_solicitado: number; justificativa: string; created_at: string; orcamento_linha_id: string }

const CATS_PADRAO = ['Alimentação', 'Transporte', 'Hospedagem', 'Tecnologia/Software', 'Marketing', 'Fornecedores', 'Folha de Pagamento', 'Impostos/Taxas', 'Aluguel/Infraestrutura', 'Consultoria', 'Material de Escritório', 'Outros']

export default function OrcamentoPage() {
  const [ano, setAno] = useState(new Date().getFullYear())
  const [orcamento, setOrcamento] = useState<Orcamento | null>(null)
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [suplementacoes, setSuplementacoes] = useState<Suplementacao[]>([])
  const [tab, setTab] = useState<'geral' | 'categoria' | 'centro' | 'mensal' | 'alertas' | 'suplementacoes'>('geral')
  const [openWizard, setOpenWizard] = useState(false)
  const [editLinha, setEditLinha] = useState<Linha | null>(null)
  const [supLinha, setSupLinha] = useState<Linha | null>(null)

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const u = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const empresaId = (u.data?.empresa_id as string) || user.id
    const o = await supabase.from('orcamentos').select('*').eq('empresa_id', empresaId).eq('ano_fiscal', ano).order('versao', { ascending: false }).limit(1).maybeSingle()
    setOrcamento((o.data || null) as Orcamento | null)
    if (o.data) {
      const [l, a, s] = await Promise.all([
        supabase.from('orcamento_linhas').select('*').eq('orcamento_id', o.data.id).order('categoria'),
        supabase.from('alertas_orcamento').select('*').eq('empresa_id', empresaId).order('created_at', { ascending: false }),
        supabase.from('suplementacoes').select('*').eq('empresa_id', empresaId).order('created_at', { ascending: false }),
      ])
      setLinhas((l.data || []) as Linha[])
      setAlertas((a.data || []) as Alerta[])
      setSuplementacoes((s.data || []) as Suplementacao[])
    } else {
      setLinhas([]); setAlertas([]); setSuplementacoes([])
    }
  }, [ano])
  useEffect(() => { void carregar() }, [carregar])
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab')
    if (t === 'geral' || t === 'categoria' || t === 'centro' || t === 'mensal' || t === 'alertas' || t === 'suplementacoes') setTab(t)
  }, [])

  const resumo = useMemo(() => calcularResumoOrcamento(linhas.map((l) => ({ id: l.id, valor_previsto: Number(l.valor_previsto || 0), valor_realizado: Number(l.valor_realizado || 0), categoria: l.categoria }))), [linhas])
  const alertasAtivos = alertas.filter((a) => !a.lido).length
  const anoOptions = [2024, 2025, 2026, 2027]

  const porCategoria = useMemo(() => {
    const map = new Map<string, { previsto: number; realizado: number }>()
    for (const l of linhas) {
      const p = map.get(l.categoria) || { previsto: 0, realizado: 0 }
      p.previsto += Number(l.valor_previsto || 0)
      p.realizado += Number(l.valor_realizado || 0)
      map.set(l.categoria, p)
    }
    return Array.from(map.entries()).map(([categoria, v]) => ({ categoria, ...v, pct: v.previsto > 0 ? (v.realizado / v.previsto) * 100 : 0 }))
  }, [linhas])

  async function aprovarOrcamento() {
    if (!orcamento) return
    await supabase.from('orcamentos').update({ status: 'ativo', aprovado_em: new Date().toISOString() }).eq('id', orcamento.id)
    await carregar()
  }

  async function marcarAlertaLido(id: string) {
    await fetch('/api/orcamento/alertas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alertaId: id, lido: true }) })
    await carregar()
  }

  async function decidirSuplementacao(id: string, status: 'aprovado' | 'rejeitado') {
    await fetch('/api/orcamento/suplementacao', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })
    await carregar()
  }

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Orçamento Anual {ano}</h1>
          <p className="text-sm text-slate-500">Status: <span className="font-medium">{orcamento?.status || 'sem orçamento'}</span></p>
        </div>
        <div className="flex gap-2">
          <select className="rounded-xl border px-3 py-2" value={ano} onChange={(e) => setAno(Number(e.target.value))}>{anoOptions.map((a) => <option key={a} value={a}>{a}</option>)}</select>
          <button className="rounded-xl border px-3 py-2" onClick={() => setOpenWizard(true)}>+ Novo Orçamento</button>
          {orcamento?.status === 'em_aprovacao' && <button className="rounded-xl bg-emerald-600 px-3 py-2 text-white" onClick={() => void aprovarOrcamento()}>Aprovar</button>}
          <a href={`/api/orcamento/exportar?ano=${ano}`} target="_blank" className="rounded-xl border px-3 py-2">Exportar</a>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-500">Total previsto</p><p className="text-2xl font-bold">{formatBRL(resumo.totalPrevisto)}</p></div>
        <div className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-500">Total realizado</p><p className="text-2xl font-bold">{formatBRL(resumo.totalRealizado)}</p></div>
        <div className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-500">% Consumido</p><p className="text-2xl font-bold">{resumo.percentualConsumido.toFixed(1)}%</p></div>
        <div className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-500">Alertas ativos</p><p className="text-2xl font-bold">{alertasAtivos}</p></div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          ['geral', 'Visão Geral'],
          ['categoria', 'Por Categoria'],
          ['centro', 'Por Centro de Custo'],
          ['mensal', 'Mensal'],
          ['alertas', 'Alertas'],
          ['suplementacoes', 'Suplementações'],
        ].map(([k, l]) => (
          <button key={k} className={`rounded-xl px-3 py-2 text-sm ${tab === k ? 'bg-blue-700 text-white' : 'border bg-white'}`} onClick={() => setTab(k as 'geral' | 'categoria' | 'centro' | 'mensal' | 'alertas' | 'suplementacoes')}>{l}</button>
        ))}
      </div>

      {tab === 'geral' && (
        <div className="grid gap-3 md:grid-cols-2">
          {porCategoria.slice(0, 6).map((c) => (
            <div key={c.categoria} className="rounded-2xl border bg-white p-4">
              <p className="font-semibold">{c.categoria}</p>
              <p className="text-sm text-slate-500">{formatBRL(c.realizado)} / {formatBRL(c.previsto)} • {c.pct.toFixed(1)}%</p>
              <div className="mt-2 h-2 rounded bg-slate-100"><div className={`h-2 rounded ${c.pct > 100 ? 'bg-red-500' : c.pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(c.pct, 100)}%` }} /></div>
            </div>
          ))}
        </div>
      )}

      {tab === 'categoria' && (
        <div className="overflow-x-auto rounded-2xl border bg-white">
          <table className="min-w-full text-sm"><thead><tr className="border-b bg-slate-50"><th className="p-2 text-left">Categoria</th><th className="p-2 text-right">Previsto</th><th className="p-2 text-right">Realizado</th><th className="p-2 text-right">Variação</th><th className="p-2 text-right">%</th><th className="p-2">Ações</th></tr></thead>
            <tbody>{porCategoria.map((c) => <tr key={c.categoria} className="border-b"><td className="p-2">{c.categoria}</td><td className="p-2 text-right">{formatBRL(c.previsto)}</td><td className="p-2 text-right">{formatBRL(c.realizado)}</td><td className="p-2 text-right">{formatBRL(c.previsto - c.realizado)}</td><td className="p-2 text-right">{c.pct.toFixed(1)}%</td><td className="p-2 text-center"><button className="rounded border px-2 py-1 text-xs" onClick={() => { const l = linhas.find((x) => x.categoria === c.categoria); if (l) setEditLinha(l) }}>Editar</button></td></tr>)}</tbody>
          </table>
        </div>
      )}

      {tab === 'centro' && <div className="rounded-2xl border bg-white p-4 text-sm text-slate-600">Visão por centro de custo usa os mesmos dados de linhas com `centro_custo_id`.</div>}

      {tab === 'mensal' && (
        <div className="rounded-2xl border bg-white p-4">
          <div className="space-y-1 text-sm">{Array.from({ length: 12 }).map((_, i) => {
            const m = i + 1
            const mesLinhas = linhas.filter((l) => l.mes === m)
            const p = mesLinhas.reduce((s, l) => s + Number(l.valor_previsto || 0), 0)
            const r = mesLinhas.reduce((s, l) => s + Number(l.valor_realizado || 0), 0)
            return <div key={m} className="flex justify-between border-b py-1"><span>{m.toString().padStart(2, '0')}/{ano}</span><span>{formatBRL(r)} / {formatBRL(p)}</span></div>
          })}</div>
        </div>
      )}

      {tab === 'alertas' && (
        <div className="space-y-2">
          {alertas.map((a) => (
            <div key={a.id} className="rounded-2xl border bg-white p-4 text-sm">
              <p><strong>{a.tipo}</strong> • {a.percentual_consumido?.toFixed(1)}% • Prev {formatBRL(Number(a.valor_previsto || 0))} • Real {formatBRL(Number(a.valor_realizado || 0))}</p>
              <div className="mt-2 flex gap-2">
                {!a.lido && <button className="rounded border px-2 py-1 text-xs" onClick={() => void marcarAlertaLido(a.id)}>Marcar como lido</button>}
                <button className="rounded border px-2 py-1 text-xs" onClick={() => { const l = linhas.find((x) => x.id === a.orcamento_linha_id); if (l) setSupLinha(l) }}>Solicitar suplementação</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'suplementacoes' && (
        <div className="space-y-2">
          {suplementacoes.map((s) => (
            <div key={s.id} className="rounded-2xl border bg-white p-4 text-sm">
              <p><strong>{formatBRL(Number(s.valor_solicitado || 0))}</strong> • {s.status}</p>
              <p className="text-slate-600">{s.justificativa}</p>
              {s.status === 'pendente' && <div className="mt-2 flex gap-2"><button className="rounded border px-2 py-1 text-xs" onClick={() => void decidirSuplementacao(s.id, 'aprovado')}>Aprovar</button><button className="rounded border px-2 py-1 text-xs" onClick={() => void decidirSuplementacao(s.id, 'rejeitado')}>Rejeitar</button></div>}
            </div>
          ))}
        </div>
      )}

      <OrcamentoWizard open={openWizard} onClose={() => setOpenWizard(false)} onSaved={carregar} categorias={CATS_PADRAO} />
      <EditarLinhaModal open={Boolean(editLinha)} onClose={() => setEditLinha(null)} linha={editLinha} onSaved={carregar} />
      <SuplementacaoModal open={Boolean(supLinha)} onClose={() => setSupLinha(null)} linha={supLinha ? { id: supLinha.id, categoria: supLinha.categoria, valor_previsto: Number(supLinha.valor_previsto || 0), valor_realizado: Number(supLinha.valor_realizado || 0) } : null} onSaved={carregar} />
    </div>
  )
}
