'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { formatBRL } from '@/lib/currency-brl'
import { supabase } from '@/lib/supabase'
import { useHolding, type EscopoHolding } from '@/lib/holding-context'

type ContaLinha = { id: string; nome: string; instituicao: string; titularidade: 'pj' | 'pf'; empresa_nome: string | null; saldo: number }
type MovLinha = { id: string; descricao: string; valor: number; tipo: 'entrada' | 'saida'; titularidade: 'pj' | 'pf'; empresa_nome: string | null; data: string }
type Resumo = {
  saldo_pj: number; saldo_pf: number; investimentos_total: number; patrimonio_total: number
  variacao_mes_pj: number; variacao_mes_pf: number
  contas: ContaLinha[]; extrato_recente: MovLinha[]; serie_patrimonio: { mes: string; valor: number }[]
  pf_incluida: boolean
}

const CORES_CONTA = ['#16A34A', '#0E7A38', '#4ADE80', '#A7F3C4', '#22C55E']

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const t = data.session?.access_token
  return t ? { Authorization: `Bearer ${t}` } : {}
}

function areaPath(serie: { mes: string; valor: number }[]) {
  if (serie.length < 2) return { linha: '', area: '' }
  const w = 900, h = 130
  const vals = serie.map(s => s.valor)
  const min = Math.min(...vals, 0), max = Math.max(...vals, 1)
  const range = max - min || 1
  const pts = serie.map((s, i) => {
    const x = (i / (serie.length - 1)) * w
    const y = h - ((s.valor - min) / range) * (h - 10) - 5
    return [x, y]
  })
  const linha = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const area = `${linha} L${w} ${h} L0 ${h} Z`
  return { linha, area }
}

export default function BancoVisaoGeral() {
  const { grupoAtivoId, escopo, setEscopo, grupos } = useHolding()
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ativo = true
    async function carregar() {
      setLoading(true)
      const h = await authHeaders()
      const qs = new URLSearchParams({ escopo })
      if (grupoAtivoId) qs.set('grupoId', grupoAtivoId)
      const r = await fetch(`/api/banco/visao-geral?${qs}`, { headers: h }).then(x => x.json()).catch(() => null)
      if (!ativo) return
      setResumo(r && !r.error ? r : null)
      setLoading(false)
    }
    void carregar()
    return () => { ativo = false }
  }, [grupoAtivoId, escopo])

  const { linha, area } = useMemo(() => areaPath(resumo?.serie_patrimonio ?? []), [resumo])

  if (loading) return <div style={{ padding: '24px 0', color: 'var(--mut)', fontSize: 13 }}>Carregando…</div>
  if (!resumo) return <div style={{ padding: '24px 0', color: 'var(--mut)', fontSize: 13 }}>Não foi possível carregar a visão geral.</div>

  const semNadaConectado = resumo.contas.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div className="seg-v2">
          {(['consolidado', 'empresas', 'pf'] as EscopoHolding[]).map(e => (
            <span key={e} className={escopo === e ? 'on' : ''} onClick={() => setEscopo(e)}>
              {e === 'consolidado' ? 'Consolidado (PJ+PF)' : e === 'empresas' ? 'Só empresas' : 'Só pessoa física'}
            </span>
          ))}
        </div>
        <small style={{ color: 'var(--mut)', fontWeight: 700, fontSize: 11 }}>
          Classificação sempre separada por titularidade · saldo e investimentos somados aqui
          {grupos.length === 0 && ' · sem Holding criada, mostrando sua empresa'}
        </small>
      </div>

      {semNadaConectado ? (
        <div className="card-v2" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 6 }}>Nenhuma conta conectada</div>
          <div style={{ fontSize: 12.5, color: 'var(--mut)', marginBottom: 14 }}>Conecte pelo Open Finance — saldo e extrato entram sozinhos.</div>
          <Link href="/dashboard/conexoes" className="btn-v2 primary" style={{ textDecoration: 'none', display: 'inline-block' }}>Conectar banco</Link>
        </div>
      ) : (
        <>
          <div className="patri-v2">
            <div className="patri-card-v2">
              <span className="patri-tag-v2 pj"><i className="fa-solid fa-building" /> {resumo.contas.filter(c => c.titularidade === 'pj').length} conta(s)</span>
              <small>Saldo em contas PJ</small>
              <div className="v">{formatBRL(resumo.saldo_pj)}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: resumo.variacao_mes_pj >= 0 ? 'var(--acc-ink)' : 'var(--neg)' }}>
                {resumo.variacao_mes_pj >= 0 ? '↑' : '↓'} {formatBRL(Math.abs(resumo.variacao_mes_pj))} no mês
              </div>
            </div>
            <div className="patri-card-v2">
              <span className="patri-tag-v2 pf"><i className="fa-solid fa-user" /> Pessoa física</span>
              <small>Saldo em conta PF</small>
              <div className="v">{formatBRL(resumo.saldo_pf)}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: resumo.variacao_mes_pf >= 0 ? 'var(--acc-ink)' : 'var(--neg)' }}>
                {resumo.variacao_mes_pf >= 0 ? '↑' : '↓'} {formatBRL(Math.abs(resumo.variacao_mes_pf))} no mês
              </div>
            </div>
            <div className="patri-card-v2">
              <span className="patri-tag-v2 inv"><i className="fa-solid fa-chart-line" /> Todas as origens</span>
              <small>Investimentos (PJ+PF)</small>
              <div className="v">{formatBRL(resumo.investimentos_total)}</div>
              <Link href="/dashboard/banco/investimentos" className="link-v2" style={{ fontSize: 11 }}>ver detalhe →</Link>
            </div>
          </div>

          <div className="card-v2">
            <div className="card-v2-h">
              <h3>Patrimônio Total Consolidado</h3>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20 }}>{formatBRL(resumo.patrimonio_total)}</span>
            </div>
            <svg width="100%" height="130" viewBox="0 0 900 130" preserveAspectRatio="none">
              <path d={linha} fill="none" stroke="#16A34A" strokeWidth="2.4" strokeLinecap="round" />
              <path d={area} fill="url(#patriGrad)" />
              <defs><linearGradient id="patriGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#22C55E" stopOpacity=".22" /><stop offset="1" stopColor="#22C55E" stopOpacity="0" /></linearGradient></defs>
            </svg>
            <p style={{ fontSize: 10.5, color: 'var(--mut2)', fontWeight: 600, marginTop: 4 }}>Estimativa a partir do resultado mensal — não é um histórico de saldo bancário armazenado.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="card-v2">
              <div className="card-v2-h"><h3>Contas por titularidade</h3></div>
              {resumo.contas.map((c, i) => (
                <div key={c.id} className="acc-row-v2">
                  <div className="acc-ic-v2" style={{ background: c.titularidade === 'pf' ? '#4F46E5' : CORES_CONTA[i % CORES_CONTA.length] }}>
                    <i className={`fa-solid ${c.titularidade === 'pf' ? 'fa-user' : 'fa-building'}`} style={{ color: '#fff', fontSize: 13 }} />
                  </div>
                  <div>
                    <b>{c.empresa_nome ?? 'Pessoa física'}</b>
                    <small>{c.instituicao} · {c.titularidade === 'pj' ? 'PJ' : 'Pessoa física'}</small>
                  </div>
                  <div className="v">{formatBRL(c.saldo)}</div>
                </div>
              ))}
            </div>
            <div className="card-v2">
              <div className="card-v2-h"><h3>Extrato recente</h3><Link href="/dashboard/banco/extrato" className="link-v2">Ver extrato →</Link></div>
              {resumo.extrato_recente.length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--mut)' }}>Sem movimentações recentes.</div>
              ) : resumo.extrato_recente.map(m => (
                <div key={m.id} className="feed-v2">
                  <div className="fic" style={{ background: m.tipo === 'entrada' ? 'var(--acc-soft)' : 'var(--neg-soft)' }}>
                    {m.tipo === 'entrada' ? '↓' : '↑'}
                  </div>
                  <div className="desc">
                    {m.descricao}
                    <small>{m.titularidade === 'pj' ? `Conta PJ · ${m.empresa_nome ?? ''}` : 'Conta PF'} · {new Date(m.data + 'T12:00:00').toLocaleDateString('pt-BR')}</small>
                  </div>
                  <div className={`val ${m.tipo === 'entrada' ? 'in' : 'out'}`}>{m.tipo === 'entrada' ? '+' : '–'}{formatBRL(m.valor)}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
