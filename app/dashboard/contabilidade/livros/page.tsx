'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'
import toast from 'react-hot-toast'

type Conta = { codigo: string; nome: string; tipo: string } | null
type Lanc = { id: string; descricao: string; valor: number | string; tipo: 'debito' | 'credito'; competencia: string; origem: string | null; plano_contas: Conta }

const chaveConta = (l: Lanc) => l.plano_contas ? `${l.plano_contas.codigo} · ${l.plano_contas.nome}` : 'Sem conta contábil'
const num = (v: number | string) => Number(v || 0)

export default function LivrosContabeisPage() {
  const [lancs, setLancs] = useState<Lanc[]>([])
  const [meses, setMeses] = useState(12)
  const [contaSel, setContaSel] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [gerando, setGerando] = useState(false)
  const [vista, setVista] = useState<'balancete' | 'balanco' | 'fechamento'>('balancete')
  const [fechados, setFechados] = useState<Set<string>>(new Set())
  const [busyComp, setBusyComp] = useState<string | null>(null)

  const carregarFechados = useCallback(async () => {
    const { data: sess } = await supabase.auth.getSession()
    const token = sess.session?.access_token
    try {
      const res = await fetch('/api/contabilidade/fechamento', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      const d = await res.json()
      if (res.ok) setFechados(new Set((d.fechados ?? []) as string[]))
    } catch { /* ignore */ }
  }, [])
  useEffect(() => { void carregarFechados() }, [carregarFechados])

  async function fecharComp(comp: string, fechar: boolean) {
    setBusyComp(comp)
    const { data: sess } = await supabase.auth.getSession()
    const token = sess.session?.access_token
    const res = await fetch('/api/contabilidade/fechamento', {
      method: fechar ? 'POST' : 'DELETE',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ competencia: comp }),
    })
    setBusyComp(null)
    if (res.ok) { toast.success(`Competência ${comp} ${fechar ? 'fechada' : 'reaberta'}`); void carregarFechados() }
    else toast.error('Falha ao atualizar fechamento')
  }

  async function gerar() {
    setGerando(true)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const token = sess.session?.access_token
      const res = await fetch('/api/contabilidade/gerar-lancamentos', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {} })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Falha ao gerar')
      toast.success(d.gerados > 0 ? `${d.gerados} lançamentos gerados (${d.despesas} despesas · ${d.notas} notas)` : 'Nada novo para lançar — livros em dia')
      await carregar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao gerar')
    } finally { setGerando(false) }
  }

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

  // ── Balanço Patrimonial: agrupa por natureza da conta ────
  const balanco = useMemo(() => {
    const soma = (tipos: string[], natureza: 'devedora' | 'credora') => {
      let t = 0
      for (const l of lancs) {
        const tipo = l.plano_contas?.tipo
        if (!tipo || !tipos.includes(tipo)) continue
        const signed = l.tipo === 'debito' ? num(l.valor) : -num(l.valor) // saldo devedor
        t += natureza === 'devedora' ? signed : -signed
      }
      return t
    }
    const ativo = soma(['ativo'], 'devedora')
    const passivo = soma(['passivo'], 'credora')
    const receita = soma(['receita'], 'credora')
    const despesas = soma(['deducao', 'custo', 'despesa_operacional', 'despesa_financeira', 'imposto'], 'devedora')
    const resultado = receita - despesas
    const patrimonioContas = soma(['patrimonio'], 'credora')
    const pl = patrimonioContas + resultado
    return { ativo, passivo, receita, despesas, resultado, patrimonioContas, pl, diferenca: ativo - (passivo + pl) }
  }, [lancs])

  const competencias = useMemo(
    () => Array.from(new Set(lancs.map(l => l.competencia?.slice(0, 7)).filter(Boolean) as string[])).sort().reverse(),
    [lancs],
  )

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
          <button className="btn-action" style={{ fontSize: 12 }} onClick={() => void gerar()} disabled={gerando} title="Gera os lançamentos (partida dobrada) das despesas e notas">
            <i className="fa-solid fa-wand-magic-sparkles" style={{ marginRight: 6 }} />{gerando ? 'Gerando…' : 'Gerar lançamentos'}
          </button>
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

      {/* Alternador de vista */}
      <div style={{ display: 'flex', gap: 2, background: '#F1ECE1', padding: 3, borderRadius: 10, width: 'fit-content', marginBottom: 16, flexWrap: 'wrap' }}>
        {([
          { k: 'balancete', label: 'Balancete', icon: 'fa-scale-balanced' },
          { k: 'balanco', label: 'Balanço patrimonial', icon: 'fa-layer-group' },
          { k: 'fechamento', label: 'Fechamento', icon: 'fa-lock' },
        ] as { k: typeof vista; label: string; icon: string }[]).map(t => (
          <button key={t.k} onClick={() => { setVista(t.k); setContaSel(null) }} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: vista === t.k ? 700 : 500, padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', background: vista === t.k ? '#fff' : 'transparent', color: vista === t.k ? '#13201D' : '#7B8C88' }}>
            <i className={`fa-solid ${t.icon}`} style={{ fontSize: 10 }} />{t.label}
          </button>
        ))}
      </div>

      {vista === 'balancete' && (loading ? (
        <div style={{ padding: 32, color: 'var(--gray-400)', fontSize: 13 }}>Carregando livros…</div>
      ) : lancs.length === 0 ? (
        <div style={{ background: '#fff', border: '1.5px dashed #D1D9D8', borderRadius: 16, padding: '48px 24px', textAlign: 'center' }}>
          <i className="fa-solid fa-book" style={{ fontSize: 30, color: '#D1D9D8', display: 'block', marginBottom: 12 }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: '#13201D', marginBottom: 6 }}>Sem lançamentos contábeis no período</div>
          <div style={{ fontSize: 12, color: '#7B8C88' }}>Os lançamentos são gerados das notas, despesas e conciliação. Categorize e concilie para o balancete se formar.</div>
        </div>
      ) : !contaSel ? (
        <>
          {/* KPIs do balancete */}
          <div className="kpis" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 14 }}>
            <div className="kpi"><div className="kpi-lbl">Total débitos</div><div className="kpi-val">{formatBRL(totalDeb)}</div></div>
            <div className="kpi"><div className="kpi-lbl">Total créditos</div><div className="kpi-val">{formatBRL(totalCred)}</div></div>
            <div className="kpi" style={{ borderTop: `3px solid ${Math.abs(totalDeb - totalCred) < 0.01 ? '#3D7A6E' : '#B08A3E'}` }}>
              <div className="kpi-lbl">Diferença (deve fechar em 0)</div>
              <div className="kpi-val" style={{ color: Math.abs(totalDeb - totalCred) < 0.01 ? '#3D7A6E' : '#B08A3E' }}>{formatBRL(totalDeb - totalCred)}</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Balancete de verificação · {balancete.length} contas</div>
            <button className="btn-ghost" style={{ fontSize: 12 }} onClick={exportarBalancete}><i className="fa-solid fa-file-csv" style={{ marginRight: 6 }} />Baixar CSV</button>
          </div>

          <div style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 130px', padding: '10px 16px', background: '#FBF8F1', borderBottom: '0.5px solid #E4DCCC' }}>
              {['Conta', 'Débito', 'Crédito', 'Saldo'].map((h, i) => <div key={h} style={{ fontSize: 10, fontWeight: 600, color: '#7B8C88', textTransform: 'uppercase', letterSpacing: '.06em', textAlign: i === 0 ? 'left' : 'right' }}>{h}</div>)}
            </div>
            {balancete.map((r, i) => (
              <button key={r.conta} onClick={() => setContaSel(r.conta)} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 130px', padding: '11px 16px', borderBottom: i < balancete.length - 1 ? '0.5px solid #EFE9DC' : 'none', width: '100%', border: 'none', background: '#fff', cursor: 'pointer', alignItems: 'center' }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#13201D', textAlign: 'left' }}>{r.conta}</div>
                <div style={{ fontSize: 12, textAlign: 'right', color: '#374151', fontFamily: "var(--font-sans)" }}>{r.debito ? formatBRL(r.debito) : '—'}</div>
                <div style={{ fontSize: 12, textAlign: 'right', color: '#374151', fontFamily: "var(--font-sans)" }}>{r.credito ? formatBRL(r.credito) : '—'}</div>
                <div style={{ fontSize: 12.5, textAlign: 'right', fontWeight: 700, color: r.saldo >= 0 ? '#13201D' : '#B0413E', fontFamily: "var(--font-sans)" }}>{formatBRL(r.saldo)}</div>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setContaSel(null)}><i className="fa-solid fa-arrow-left" style={{ marginRight: 6 }} />Balancete</button>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#13201D' }}>Razão · {contaSel}</div>
            <span style={{ fontSize: 12, color: '#7B8C88', marginLeft: 'auto' }}>{razao.length} lançamentos</span>
          </div>
          <div style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 110px 110px 120px', padding: '10px 16px', background: '#FBF8F1', borderBottom: '0.5px solid #E4DCCC' }}>
              {['Compet.', 'Histórico', 'Débito', 'Crédito', 'Saldo'].map((h, i) => <div key={h} style={{ fontSize: 10, fontWeight: 600, color: '#7B8C88', textTransform: 'uppercase', letterSpacing: '.06em', textAlign: i < 2 ? 'left' : 'right' }}>{h}</div>)}
            </div>
            {razao.map((l, i) => (
              <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 110px 110px 120px', padding: '10px 16px', borderBottom: i < razao.length - 1 ? '0.5px solid #EFE9DC' : 'none', alignItems: 'center' }}>
                <div style={{ fontSize: 11, color: '#7B8C88', fontFamily: "var(--font-sans)" }}>{l.competencia?.slice(0, 7)}</div>
                <div style={{ fontSize: 12.5, color: '#13201D' }}>{l.descricao} <span style={{ fontSize: 10, color: '#A6B0AC' }}>· {l.origem}</span></div>
                <div style={{ fontSize: 12, textAlign: 'right', color: l.tipo === 'debito' ? '#374151' : '#C4CFCE', fontFamily: "var(--font-sans)" }}>{l.tipo === 'debito' ? formatBRL(num(l.valor)) : '—'}</div>
                <div style={{ fontSize: 12, textAlign: 'right', color: l.tipo === 'credito' ? '#374151' : '#C4CFCE', fontFamily: "var(--font-sans)" }}>{l.tipo === 'credito' ? formatBRL(num(l.valor)) : '—'}</div>
                <div style={{ fontSize: 12.5, textAlign: 'right', fontWeight: 700, color: l.saldo >= 0 ? '#13201D' : '#B0413E', fontFamily: "var(--font-sans)" }}>{formatBRL(l.saldo)}</div>
              </div>
            ))}
          </div>
        </>
      ))}

      {/* BALANÇO PATRIMONIAL */}
      {vista === 'balanco' && (
        <>
          <div className="kpis" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 14 }}>
            <div className="kpi" style={{ borderTop: '3px solid #13201D' }}><div className="kpi-lbl">Ativo</div><div className="kpi-val">{formatBRL(balanco.ativo)}</div><div className="kpi-delta">bens e direitos</div></div>
            <div className="kpi" style={{ borderTop: '3px solid #B08A3E' }}><div className="kpi-lbl">Passivo</div><div className="kpi-val">{formatBRL(balanco.passivo)}</div><div className="kpi-delta">obrigações</div></div>
            <div className="kpi" style={{ borderTop: '3px solid #3D7A6E' }}><div className="kpi-lbl">Patrimônio líquido</div><div className="kpi-val" style={{ color: balanco.pl >= 0 ? '#13201D' : '#B0413E' }}>{formatBRL(balanco.pl)}</div><div className="kpi-delta">capital + resultado</div></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', background: '#FBF8F1', borderBottom: '0.5px solid #E4DCCC', fontSize: 12, fontWeight: 700, color: '#13201D' }}>ATIVO</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 16px' }}>
                <span style={{ fontSize: 12.5, color: '#374151', fontWeight: 700 }}>Total do ativo</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#13201D', fontFamily: "var(--font-sans)" }}>{formatBRL(balanco.ativo)}</span>
              </div>
            </div>
            <div style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', background: '#FBF8F1', borderBottom: '0.5px solid #E4DCCC', fontSize: 12, fontWeight: 700, color: '#13201D' }}>PASSIVO + PATRIMÔNIO LÍQUIDO</div>
              {[
                { nome: 'Passivo (obrigações)', valor: balanco.passivo, bold: false },
                { nome: 'Receitas', valor: balanco.receita, bold: false },
                { nome: '(−) Despesas', valor: -balanco.despesas, bold: false },
                { nome: 'Resultado do exercício', valor: balanco.resultado, bold: true },
                { nome: 'Patrimônio líquido', valor: balanco.pl, bold: true },
              ].map((r, i, arr) => (
                <div key={r.nome} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderBottom: i < arr.length - 1 ? '0.5px solid #EFE9DC' : 'none' }}>
                  <span style={{ fontSize: 12.5, color: '#374151', fontWeight: r.bold ? 700 : 400 }}>{r.nome}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: r.valor >= 0 ? '#13201D' : '#B0413E', fontFamily: "var(--font-sans)" }}>{formatBRL(r.valor)}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 12, background: Math.abs(balanco.diferenca) < 0.01 ? 'rgba(61,122,110,.08)' : 'rgba(176,138,62,.08)', border: `1px solid ${Math.abs(balanco.diferenca) < 0.01 ? 'rgba(61,122,110,.25)' : 'rgba(176,138,62,.25)'}`, fontSize: 12.5, color: '#13201D', display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className={`fa-solid ${Math.abs(balanco.diferenca) < 0.01 ? 'fa-circle-check' : 'fa-triangle-exclamation'}`} style={{ color: Math.abs(balanco.diferenca) < 0.01 ? '#3D7A6E' : '#B08A3E' }} />
            <span>Ativo = Passivo + PL — diferença <strong>{formatBRL(balanco.diferenca)}</strong> {Math.abs(balanco.diferenca) < 0.01 ? '(fecha ✓)' : '(gere os lançamentos p/ equilibrar)'}</span>
          </div>
        </>
      )}

      {/* FECHAMENTO MENSAL */}
      {vista === 'fechamento' && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 10 }}>Fechamento mensal · {competencias.length} competências</div>
          {competencias.length === 0 ? (
            <div style={{ background: '#fff', border: '1.5px dashed #D1D9D8', borderRadius: 14, padding: '40px', textAlign: 'center', color: '#7B8C88', fontSize: 12 }}>Sem competências com lançamentos ainda.</div>
          ) : (
            <div style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 14, overflow: 'hidden' }}>
              {competencias.map((c, i) => {
                const fech = fechados.has(c)
                const [y, mm] = c.split('-')
                const label = new Date(Number(y), Number(mm) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
                return (
                  <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < competencias.length - 1 ? '0.5px solid #EFE9DC' : 'none' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: fech ? '#F1ECE1' : '#E9F0ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className={`fa-solid ${fech ? 'fa-lock' : 'fa-lock-open'}`} style={{ fontSize: 14, color: fech ? '#7B8C88' : '#3D7A6E' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#13201D', textTransform: 'capitalize' }}>{label}</div>
                      <div style={{ fontSize: 10.5, color: fech ? '#7B8C88' : '#2B564D' }}>{fech ? 'Período fechado' : 'Período aberto'}</div>
                    </div>
                    <button onClick={() => void fecharComp(c, !fech)} disabled={busyComp === c} style={{ fontSize: 11.5, fontWeight: 700, padding: '6px 14px', borderRadius: 8, border: fech ? '0.5px solid #E4DCCC' : 'none', background: fech ? '#fff' : '#13201D', color: fech ? '#3C4A46' : '#fff', cursor: 'pointer' }}>
                      {busyComp === c ? '...' : fech ? 'Reabrir' : 'Fechar mês'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      <div style={{ fontSize: 11, color: '#A6B0AC', marginTop: 14, lineHeight: 1.6 }}>
        <i className="fa-solid fa-circle-info" style={{ color: '#3D7A6E', marginRight: 6 }} />
        Balancete, razão e balanço gerados dos lançamentos (notas, despesas, conciliação). O fechamento registra a competência como fechada.
      </div>
    </>
  )
}
