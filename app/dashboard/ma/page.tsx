'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'

const fmtC = (v: number) => {
  const a = Math.abs(v)
  if (a >= 1e6) return `R$ ${(v / 1e6).toFixed(2)}M`
  if (a >= 1e3) return `R$ ${(v / 1e3).toFixed(0)}K`
  return formatBRL(v)
}

// Checklist de due diligence / readiness para M&A
const CHECKLIST: { grupo: string; icon: string; itens: string[] }[] = [
  { grupo: 'Financeiro', icon: 'fa-chart-line', itens: [
    'DRE dos últimos 3 anos organizado', 'Fluxo de caixa histórico e projetado',
    'Conciliação bancária em dia', 'Contas a pagar e receber atualizadas', 'Métricas (MRR, CAC, LTV, churn) documentadas',
  ] },
  { grupo: 'Contábil & Fiscal', icon: 'fa-file-invoice-dollar', itens: [
    'Balanços fechados (idealmente auditados)', 'Impostos e obrigações em dia', 'Certidões negativas (federal, estadual, municipal, FGTS)', 'Sem passivos fiscais ocultos',
  ] },
  { grupo: 'Jurídico & Societário', icon: 'fa-scale-balanced', itens: [
    'Contrato social / estatuto atualizado', 'Cap table claro (quotas/ações)', 'Contratos relevantes assinados e organizados', 'Sem litígios materiais em aberto', 'Marca e propriedade intelectual registradas',
  ] },
  { grupo: 'Operacional', icon: 'fa-gears', itens: [
    'Processos-chave documentados', 'Dependência de fundadores mapeada', 'Time e organograma definidos',
  ] },
  { grupo: 'Comercial', icon: 'fa-handshake', itens: [
    'Contratos de clientes formalizados', 'Concentração de receita analisada (top clientes)', 'Pipeline e previsão de vendas',
  ] },
]
const TOTAL_ITENS = CHECKLIST.reduce((s, g) => s + g.itens.length, 0)

export default function MaPage() {
  const [empresaId, setEmpresaId] = useState('')
  const [receitaAnual, setReceitaAnual] = useState(0)
  const [ebitdaAnual, setEbitdaAnual] = useState(0)
  const [multReceita, setMultReceita] = useState(3)
  const [multEbitda, setMultEbitda] = useState(6)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const eid = (u?.empresa_id as string) || user.id
    setEmpresaId(eid)
    const { data: m } = await supabase.from('metricas_financeiras').select('receita_bruta,ebitda').eq('empresa_id', eid).order('competencia', { ascending: false }).limit(1).maybeSingle()
    if (m) { setReceitaAnual(Number(m.receita_bruta ?? 0) * 12); setEbitdaAnual(Number(m.ebitda ?? 0) * 12) }
    try {
      const raw = localStorage.getItem(`fo_ma_${eid}`)
      if (raw) setChecked(new Set(JSON.parse(raw) as string[]))
    } catch { /* ignore */ }
    setLoading(false)
  }, [])
  useEffect(() => { void carregar() }, [carregar])

  function toggle(item: string) {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(item)) next.delete(item); else next.add(item)
      if (empresaId) { try { localStorage.setItem(`fo_ma_${empresaId}`, JSON.stringify(Array.from(next))) } catch { /* ignore */ } }
      return next
    })
  }

  const valReceita = receitaAnual * multReceita
  const valEbitda = ebitdaAnual * multEbitda
  const referencia = ebitdaAnual > 0 ? (valReceita + valEbitda) / 2 : valReceita
  const faixaMin = Math.min(valReceita, valEbitda || valReceita) * 0.85
  const faixaMax = Math.max(valReceita, valEbitda || valReceita) * 1.15

  const prontidao = useMemo(() => Math.round((checked.size / TOTAL_ITENS) * 100), [checked])
  const corPront = prontidao >= 80 ? '#16A085' : prontidao >= 50 ? '#D97706' : '#E74C3C'

  if (loading) return <div style={{ padding: 32, color: 'var(--gray-400)', fontSize: 13 }}>Carregando…</div>

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Preparação para M&amp;A</div>
          <div className="page-sub">Valuation estimado · checklist de due diligence · prontidão</div>
        </div>
        <Link href="/dashboard/indicadores" className="btn-ghost" style={{ fontSize: 12, textDecoration: 'none' }}>
          <i className="fa-solid fa-gauge-high" style={{ marginRight: 6 }} />Indicadores
        </Link>
      </div>

      {/* Valuation */}
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 10 }}>Valuation estimado</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 12, marginBottom: 20, alignItems: 'start' }}>
        <div style={{ background: '#fff', border: '0.5px solid #E2E8E7', borderRadius: 14, padding: '18px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ fontSize: 10.5, fontWeight: 600, color: '#7A8F8E', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>Receita anual (R$)</label>
              <input className="form-input" type="number" value={Math.round(receitaAnual)} onChange={e => setReceitaAnual(Number(e.target.value) || 0)} />
            </div>
            <div>
              <label style={{ fontSize: 10.5, fontWeight: 600, color: '#7A8F8E', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>EBITDA anual (R$)</label>
              <input className="form-input" type="number" value={Math.round(ebitdaAnual)} onChange={e => setEbitdaAnual(Number(e.target.value) || 0)} />
            </div>
            <div>
              <label style={{ fontSize: 10.5, fontWeight: 600, color: '#7A8F8E', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>Múltiplo de receita (x)</label>
              <input className="form-input" type="number" step="0.5" value={multReceita} onChange={e => setMultReceita(Number(e.target.value) || 0)} />
            </div>
            <div>
              <label style={{ fontSize: 10.5, fontWeight: 600, color: '#7A8F8E', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>Múltiplo de EBITDA (x)</label>
              <input className="form-input" type="number" step="0.5" value={multEbitda} onChange={e => setMultEbitda(Number(e.target.value) || 0)} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
            <div style={{ background: '#F8FAFA', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10.5, color: '#7A8F8E', marginBottom: 4 }}>Por múltiplo de receita</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#1C2B2A', fontFamily: "'Inter', system-ui, sans-serif" }}>{fmtC(valReceita)}</div>
              <div style={{ fontSize: 10, color: '#AAB8B7' }}>{fmtC(receitaAnual)} × {multReceita}x</div>
            </div>
            <div style={{ background: '#F8FAFA', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10.5, color: '#7A8F8E', marginBottom: 4 }}>Por múltiplo de EBITDA</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#1C2B2A', fontFamily: "'Inter', system-ui, sans-serif" }}>{ebitdaAnual > 0 ? fmtC(valEbitda) : '—'}</div>
              <div style={{ fontSize: 10, color: '#AAB8B7' }}>{fmtC(ebitdaAnual)} × {multEbitda}x</div>
            </div>
          </div>
        </div>

        <div style={{ background: '#1C2B2A', borderRadius: 14, padding: '20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6EE7B7', textTransform: 'uppercase', letterSpacing: '.08em' }}>Valor de referência</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: '#fff', fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: '-.02em' }}>{fmtC(referencia)}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.6)' }}>Faixa provável: {fmtC(faixaMin)} – {fmtC(faixaMax)}</div>
          <div style={{ marginTop: 10, fontSize: 10.5, color: 'rgba(255,255,255,.4)', lineHeight: 1.6 }}>
            Estimativa por múltiplos (comps). O valor final depende de crescimento, margem, retenção e due diligence.
          </div>
        </div>
      </div>

      {/* Prontidão */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Prontidão para due diligence</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 180, height: 8, background: '#EEF2F1', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${prontidao}%`, background: corPront, borderRadius: 99, transition: 'width .3s' }} />
          </div>
          <span style={{ fontSize: 15, fontWeight: 800, color: corPront, fontFamily: "'Inter', system-ui, sans-serif" }}>{prontidao}%</span>
          <span style={{ fontSize: 11, color: '#7A8F8E' }}>{checked.size}/{TOTAL_ITENS}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
        {CHECKLIST.map(g => {
          const feitos = g.itens.filter(i => checked.has(i)).length
          return (
            <div key={g.grupo} style={{ background: '#fff', border: '0.5px solid #E2E8E7', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #E2E8E7', background: '#F8FAFA', display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className={`fa-solid ${g.icon}`} style={{ fontSize: 13, color: '#10B981' }} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1C2B2A' }}>{g.grupo}</span>
                <span style={{ marginLeft: 'auto', fontSize: 10.5, color: feitos === g.itens.length ? '#0F6E56' : '#7A8F8E', fontWeight: 600 }}>{feitos}/{g.itens.length}</span>
              </div>
              {g.itens.map(item => {
                const on = checked.has(item)
                return (
                  <button key={item} onClick={() => toggle(item)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '10px 16px', border: 'none', borderBottom: '0.5px solid #F0F4F3', background: '#fff', cursor: 'pointer' }}>
                    <span style={{ width: 18, height: 18, borderRadius: 5, border: on ? 'none' : '1.5px solid #D1D9D8', background: on ? '#16A085' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {on && <i className="fa-solid fa-check" style={{ fontSize: 10, color: '#fff' }} />}
                    </span>
                    <span style={{ fontSize: 12.5, color: on ? '#7A8F8E' : '#1C2B2A', textDecoration: on ? 'line-through' : 'none' }}>{item}</span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>

      <div style={{ fontSize: 11, color: '#AAB8B7', marginTop: 14, lineHeight: 1.6 }}>
        <i className="fa-solid fa-circle-info" style={{ color: '#10B981', marginRight: 6 }} />
        Valuation por múltiplos é uma referência de mercado — não substitui um laudo profissional. O checklist fica salvo neste navegador.
      </div>
    </>
  )
}
