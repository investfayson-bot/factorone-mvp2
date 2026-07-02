'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'

type Conta = { codigo: string; nome: string; tipo: string } | null
type Lanc = { id: string; descricao: string; valor: number | string; tipo: 'debito' | 'credito'; competencia: string; origem: string | null; plano_contas: Conta }

const chaveConta = (l: Lanc) => l.plano_contas ? `${l.plano_contas.codigo} · ${l.plano_contas.nome}` : 'Sem conta contábil'
const num = (v: number | string) => Number(v || 0)

export default function LivrosContabeisPage() {
  const [lancs, setLancs] = useState<Lanc[]>([])
  const [meses, setMeses] = useState(12)
  const [contaSel, setContaSel] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const eid = (u?.empresa_id as string) || user.id
    const start = new Date(); start.setMonth(start.getMonth() - meses); start.setDate(1)
    const { data } = await supabase
      .from('lancamentos')
      .select('id, descricao, valor, tipo, competencia, origem, plano_contas(codigo, nome, tipo)')
      .eq('empresa_id', eid)
      .gte('competencia', start.toISOString().slice(0, 10))
      .order('competencia', { ascending: false })
      .limit(3000)
    setLancs((data ?? []) as unknown as Lanc[])
    setLoading(false)
  }, [meses])
  useEffect(() => { void carregar() }, [carregar])

  // ── Balancete: agrupa por conta ──────────────────────────
  const balancete = useMemo(() => {
    const m = new Map<string, { debito: number; credito: number; codigo: string }>()
    for (const l of lancs) {
      const k = chaveConta(l)
      const cur = m.get(k) ?? { debito: 0, credito: 0, codigo: l.plano_contas?.codigo ?? 'zzz' }
      if (l.tipo === 'debito') cur.debito += num(l.valor); else cur.credito += num(l.valor)
      m.set(k, cur)
    }
    return Array.from(m.entries())
      .map(([conta, v]) => ({ conta, ...v, saldo: v.debito - v.credito }))
      .sort((a, b) => a.codigo.localeCompare(b.codigo))
  }, [lancs])

  const totalDeb = balancete.reduce((s, r) => s + r.debito, 0)
  const totalCred = balancete.reduce((s, r) => s + r.credito, 0)

  // ── Razão: lançamentos de uma conta, com saldo corrente ──
  const razao = useMemo(() => {
    if (!contaSel) return []
    const doConta = lancs.filter(l => chaveConta(l) === contaSel)
      .sort((a, b) => a.competencia.localeCompare(b.competencia))
    let saldo = 0
    return doConta.map(l => { saldo += l.tipo === 'debito' ? num(l.valor) : -num(l.valor); return { ...l, saldo } })
  }, [lancs, contaSel])

  function exportarBalancete() {
    const linhas = ['Conta;Débito;Crédito;Saldo', ...balancete.map(r => `"${r.conta}";${r.debito.toFixed(2)};${r.credito.toFixed(2)};${r.saldo.toFixed(2)}`)]
    const blob = new Blob(['﻿' + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'balancete.csv'; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Livros contábeis</div>
          <div className="page-sub">Balancete · Livro razão · fechamento — visão do contador</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="form-input" style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }} value={meses} onChange={e => setMeses(Number(e.target.value))}>
            <option value={3}>Últimos 3 meses</option>
            <option value={6}>Últimos 6 meses</option>
            <option value={12}>Últimos 12 meses</option>
            <option value={36}>Últimos 3 anos</option>
          </select>
          <Link href="/dashboard/contadores" className="btn-ghost" style={{ fontSize: 12, textDecoration: 'none' }}>
            <i className="fa-solid fa-user-tie" style={{ marginRight: 6 }} />Contador
          </Link>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 32, color: 'var(--gray-400)', fontSize: 13 }}>Carregando livros…</div>
      ) : lancs.length === 0 ? (
        <div style={{ background: '#fff', border: '1.5px dashed #D1D9D8', borderRadius: 16, padding: '48px 24px', textAlign: 'center' }}>
          <i className="fa-solid fa-book" style={{ fontSize: 30, color: '#D1D9D8', display: 'block', marginBottom: 12 }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1C2B2A', marginBottom: 6 }}>Sem lançamentos contábeis no período</div>
          <div style={{ fontSize: 12, color: '#7A8F8E' }}>Os lançamentos são gerados das notas, despesas e conciliação. Categorize e concilie para o balancete se formar.</div>
        </div>
      ) : !contaSel ? (
        <>
          {/* KPIs do balancete */}
          <div className="kpis" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 14 }}>
            <div className="kpi"><div className="kpi-lbl">Total débitos</div><div className="kpi-val">{formatBRL(totalDeb)}</div></div>
            <div className="kpi"><div className="kpi-lbl">Total créditos</div><div className="kpi-val">{formatBRL(totalCred)}</div></div>
            <div className="kpi" style={{ borderTop: `3px solid ${Math.abs(totalDeb - totalCred) < 0.01 ? '#16A085' : '#D97706'}` }}>
              <div className="kpi-lbl">Diferença (deve fechar em 0)</div>
              <div className="kpi-val" style={{ color: Math.abs(totalDeb - totalCred) < 0.01 ? '#16A085' : '#D97706' }}>{formatBRL(totalDeb - totalCred)}</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Balancete de verificação · {balancete.length} contas</div>
            <button className="btn-ghost" style={{ fontSize: 12 }} onClick={exportarBalancete}><i className="fa-solid fa-file-csv" style={{ marginRight: 6 }} />Baixar CSV</button>
          </div>

          <div style={{ background: '#fff', border: '0.5px solid #E2E8E7', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 130px', padding: '10px 16px', background: '#F8FAFA', borderBottom: '0.5px solid #E2E8E7' }}>
              {['Conta', 'Débito', 'Crédito', 'Saldo'].map((h, i) => <div key={h} style={{ fontSize: 10, fontWeight: 600, color: '#7A8F8E', textTransform: 'uppercase', letterSpacing: '.06em', textAlign: i === 0 ? 'left' : 'right' }}>{h}</div>)}
            </div>
            {balancete.map((r, i) => (
              <button key={r.conta} onClick={() => setContaSel(r.conta)} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 130px', padding: '11px 16px', borderBottom: i < balancete.length - 1 ? '0.5px solid #F0F4F3' : 'none', width: '100%', border: 'none', background: '#fff', cursor: 'pointer', alignItems: 'center' }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1C2B2A', textAlign: 'left' }}>{r.conta}</div>
                <div style={{ fontSize: 12, textAlign: 'right', color: '#374151', fontFamily: "'Inter', system-ui, sans-serif" }}>{r.debito ? formatBRL(r.debito) : '—'}</div>
                <div style={{ fontSize: 12, textAlign: 'right', color: '#374151', fontFamily: "'Inter', system-ui, sans-serif" }}>{r.credito ? formatBRL(r.credito) : '—'}</div>
                <div style={{ fontSize: 12.5, textAlign: 'right', fontWeight: 700, color: r.saldo >= 0 ? '#1C2B2A' : '#E74C3C', fontFamily: "'Inter', system-ui, sans-serif" }}>{formatBRL(r.saldo)}</div>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setContaSel(null)}><i className="fa-solid fa-arrow-left" style={{ marginRight: 6 }} />Balancete</button>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#1C2B2A' }}>Razão · {contaSel}</div>
            <span style={{ fontSize: 12, color: '#7A8F8E', marginLeft: 'auto' }}>{razao.length} lançamentos</span>
          </div>
          <div style={{ background: '#fff', border: '0.5px solid #E2E8E7', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 110px 110px 120px', padding: '10px 16px', background: '#F8FAFA', borderBottom: '0.5px solid #E2E8E7' }}>
              {['Compet.', 'Histórico', 'Débito', 'Crédito', 'Saldo'].map((h, i) => <div key={h} style={{ fontSize: 10, fontWeight: 600, color: '#7A8F8E', textTransform: 'uppercase', letterSpacing: '.06em', textAlign: i < 2 ? 'left' : 'right' }}>{h}</div>)}
            </div>
            {razao.map((l, i) => (
              <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 110px 110px 120px', padding: '10px 16px', borderBottom: i < razao.length - 1 ? '0.5px solid #F0F4F3' : 'none', alignItems: 'center' }}>
                <div style={{ fontSize: 11, color: '#7A8F8E', fontFamily: "'Inter', system-ui, sans-serif" }}>{l.competencia?.slice(0, 7)}</div>
                <div style={{ fontSize: 12.5, color: '#1C2B2A' }}>{l.descricao} <span style={{ fontSize: 10, color: '#AAB8B7' }}>· {l.origem}</span></div>
                <div style={{ fontSize: 12, textAlign: 'right', color: l.tipo === 'debito' ? '#374151' : '#C4CFCE', fontFamily: "'Inter', system-ui, sans-serif" }}>{l.tipo === 'debito' ? formatBRL(num(l.valor)) : '—'}</div>
                <div style={{ fontSize: 12, textAlign: 'right', color: l.tipo === 'credito' ? '#374151' : '#C4CFCE', fontFamily: "'Inter', system-ui, sans-serif" }}>{l.tipo === 'credito' ? formatBRL(num(l.valor)) : '—'}</div>
                <div style={{ fontSize: 12.5, textAlign: 'right', fontWeight: 700, color: l.saldo >= 0 ? '#1C2B2A' : '#E74C3C', fontFamily: "'Inter', system-ui, sans-serif" }}>{formatBRL(l.saldo)}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ fontSize: 11, color: '#AAB8B7', marginTop: 14, lineHeight: 1.6 }}>
        <i className="fa-solid fa-circle-info" style={{ color: '#5E8C87', marginRight: 6 }} />
        Balancete e razão gerados dos lançamentos (notas, despesas, conciliação). Clique numa conta para abrir o razão. O débito total deve bater com o crédito total (partida dobrada).
      </div>
    </>
  )
}
