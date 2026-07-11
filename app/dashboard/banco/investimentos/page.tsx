'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { formatBRL } from '@/lib/currency-brl'
import { supabase } from '@/lib/supabase'
import { useHolding } from '@/lib/holding-context'
import TickerMercado from '@/components/banco/TickerMercado'

type Alocacao = { classe: string; label: string; valor: number; pct: number }
type Instituicao = { nome: string; valor: number }
type Posicao = {
  id: string; nome: string; classe: string; origem: 'pj' | 'pf'; origem_label: string
  titularidade_label: string; valor_aplicado: number; valor_atual: number; rentabilidade_pct: number
}
type Provento = { id: string; descricao: string; valor: number; data: string }
type Dados = {
  patrimonio_investido: number; rentabilidade_media_pct: number; instituicoes_count: number
  proventos_mes: number; proventos_recentes: Provento[]
  alocacao: Alocacao[]; instituicoes: Instituicao[]; posicoes: Posicao[]
}

const CORES_CLASSE: Record<string, string> = { renda_fixa: '#16A34A', acoes_fiis: '#4ADE80', fundos: '#F59E0B', outros: '#4F46E5' }
const CORES_INST = ['#16A34A', '#4ADE80', '#F59E0B', '#4F46E5', '#93A09A']

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const t = data.session?.access_token
  return t ? { Authorization: `Bearer ${t}` } : {}
}

function donutPaths(alocacao: Alocacao[]) {
  const total = alocacao.reduce((s, a) => s + a.valor, 0)
  if (total <= 0) return []
  const circ = 2 * Math.PI * 50
  let acumulado = 0
  return alocacao.map(a => {
    const frac = a.valor / total
    const dasharray = `${(frac * circ).toFixed(1)} ${circ.toFixed(1)}`
    const dashoffset = -(acumulado * circ).toFixed(1)
    acumulado += frac
    return { ...a, dasharray, dashoffset, cor: CORES_CLASSE[a.classe] ?? '#93A09A' }
  })
}

export default function BancoInvestimentos() {
  const { grupoAtivoId, escopo } = useHolding()
  const [dados, setDados] = useState<Dados | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ativo = true
    async function carregar() {
      setLoading(true)
      const h = await authHeaders()
      const qs = new URLSearchParams({ escopo })
      if (grupoAtivoId) qs.set('grupoId', grupoAtivoId)
      const r = await fetch(`/api/banco/investimentos?${qs}`, { headers: h }).then(x => x.json()).catch(() => null)
      if (!ativo) return
      setDados(r && !r.error ? r : null)
      setLoading(false)
    }
    void carregar()
    return () => { ativo = false }
  }, [grupoAtivoId, escopo])

  const fatias = useMemo(() => donutPaths(dados?.alocacao ?? []), [dados])

  if (loading) return <div style={{ padding: '24px 0', color: 'var(--mut)', fontSize: 13 }}>Carregando…</div>
  if (!dados) return <div style={{ padding: '24px 0', color: 'var(--mut)', fontSize: 13 }}>Não foi possível carregar os investimentos.</div>

  const concentracao = dados.alocacao.find(a => a.pct >= 50)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 24 }}>
      <TickerMercado />

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        {/* Cadastro de ativo continua nas telas de origem (PJ/PF) — esta tela unifica a
            leitura das duas, ver TODO de dívida técnica em lib/banco/posicoes.ts */}
        <Link href="/dashboard/conta-pj/investimentos" className="btn-v2" style={{ textDecoration: 'none' }}>+ Ativo PJ</Link>
        <Link href="/dashboard-pessoal/investimentos" className="btn-v2" style={{ textDecoration: 'none' }}>+ Ativo PF</Link>
      </div>

      {dados.posicoes.length === 0 ? (
        <div className="card-v2" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 6 }}>Nenhum investimento cadastrado</div>
          <div style={{ fontSize: 12.5, color: 'var(--mut)' }}>Conecte via Open Finance ou adicione um ativo manual pra começar a acompanhar aqui.</div>
        </div>
      ) : (
        <>
          <div className="kpis4-v2">
            <div className="kpi-v2">
              <div className="l">Patrimônio investido</div>
              <div className="v">{formatBRL(dados.patrimonio_investido)}</div>
              <div className="c" style={{ color: 'var(--mut)' }}>{dados.instituicoes_count} banco(s)/corretora(s)</div>
            </div>
            <div className="kpi-v2">
              <div className="l">Rentabilidade acumulada</div>
              <div className="v">{dados.rentabilidade_media_pct >= 0 ? '+' : ''}{dados.rentabilidade_media_pct.toFixed(1)}%</div>
              <div className="c" style={{ color: 'var(--mut)' }}>Média ponderada por posição, desde a aplicação</div>
            </div>
            <div className="kpi-v2">
              <div className="l">Posições ativas</div>
              <div className="v">{dados.posicoes.length}</div>
              <div className="c" style={{ color: 'var(--mut)' }}>{dados.alocacao.length} classe(s) de ativo</div>
            </div>
            <div className="kpi-v2 ink">
              <div className="l">Proventos recebidos (mês)</div>
              <div className="v">{formatBRL(dados.proventos_mes)}</div>
              <div className="c" style={{ color: 'var(--mut)' }}>Dividendos + juros + cupons já classificados</div>
            </div>
          </div>

          <div className="split" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 14, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="card-v2">
                <div className="card-v2-h"><h3>Alocação por classe</h3></div>
                <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                  <svg width="126" height="126" viewBox="0 0 128 128" style={{ flexShrink: 0 }}>
                    <g transform="rotate(-90 64 64)">
                      {fatias.map(f => (
                        <circle key={f.classe} cx="64" cy="64" r="50" fill="none" stroke={f.cor} strokeWidth="17" strokeDasharray={f.dasharray} strokeDashoffset={f.dashoffset} />
                      ))}
                    </g>
                    <text x="64" y="60" textAnchor="middle" fontFamily="Space Grotesk" fontWeight="700" fontSize="13" fill="#111C16">
                      {(dados.patrimonio_investido / 1_000_000 >= 1) ? `${(dados.patrimonio_investido / 1_000_000).toFixed(2)}M` : `${(dados.patrimonio_investido / 1000).toFixed(0)}k`}
                    </text>
                    <text x="64" y="76" textAnchor="middle" fontFamily="Manrope" fontWeight="700" fontSize="9" fill="#93A09A">TOTAL</text>
                  </svg>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    {dados.alocacao.map(a => (
                      <div key={a.classe} className="alloc-row-v2">
                        <div className="alloc-dot-v2" style={{ background: CORES_CLASSE[a.classe] ?? '#93A09A' }} />
                        <div><b>{a.label}</b></div>
                        <div className="v">{a.pct.toFixed(0)}% <small>{formatBRL(a.valor)}</small></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="card-v2">
                <div className="card-v2-h"><h3>Posições</h3></div>
                <table className="table-v2">
                  <thead><tr><th>Ativo</th><th>Origem</th><th style={{ textAlign: 'right' }}>Posição</th><th style={{ textAlign: 'right' }}>Rent.</th><th>Ações</th></tr></thead>
                  <tbody>
                    {dados.posicoes.map(p => (
                      <tr key={p.id}>
                        <td><b>{p.nome}</b><br /><small style={{ color: 'var(--mut2)', fontWeight: 600 }}>{p.titularidade_label}</small></td>
                        <td><span className="origin-v2 man">{p.origem_label}</span></td>
                        <td className="num" style={{ textAlign: 'right' }}>{formatBRL(p.valor_atual)}</td>
                        <td className="num" style={{ textAlign: 'right', color: p.rentabilidade_pct >= 0 ? 'var(--acc-ink)' : 'var(--neg)' }}>{p.rentabilidade_pct >= 0 ? '+' : ''}{p.rentabilidade_pct.toFixed(1)}%</td>
                        <td>
                          <div className="buysell-v2">
                            <span className="buy" title="Abre o site da instituição em nova aba — não executa ordem aqui" onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(p.origem_label + ' área do cliente')}`, '_blank')}>Comprar</span>
                            <span className="sell" title="Abre o site da instituição em nova aba — não executa ordem aqui" onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(p.origem_label + ' área do cliente')}`, '_blank')}>{p.classe === 'renda_fixa' ? 'Resgatar' : 'Vender'}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p style={{ fontSize: 10.5, color: 'var(--mut2)', fontWeight: 600, marginTop: 8 }}>
                  Ordens de compra/venda não são executadas aqui — os botões abrem a instituição de origem em nova aba pra você operar por lá.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="insights-v2">
                <span style={{ fontSize: 9.5, fontWeight: 800, background: 'var(--acc2)', color: '#06130C', padding: '2px 7px', borderRadius: 5, letterSpacing: '.05em', fontFamily: "'Space Grotesk', sans-serif" }}>FACTORONE AI</span>
                {concentracao ? (
                  <>
                    <h3 style={{ color: '#fff', fontSize: 13.5, margin: '9px 0 6px' }}>Concentração alta em {concentracao.label}</h3>
                    <p style={{ fontSize: 12, lineHeight: 1.6, color: '#C4D4CB' }}>
                      <b style={{ color: '#fff' }}>{concentracao.pct.toFixed(0)}%</b> do seu patrimônio investido está em {concentracao.label}. Diversificar reduz o risco de um único ativo/classe pesar demais no resultado.
                    </p>
                  </>
                ) : (
                  <>
                    <h3 style={{ color: '#fff', fontSize: 13.5, margin: '9px 0 6px' }}>Alocação equilibrada</h3>
                    <p style={{ fontSize: 12, lineHeight: 1.6, color: '#C4D4CB' }}>Nenhuma classe concentra mais de metade do seu patrimônio investido no momento.</p>
                  </>
                )}
              </div>

              <div className="card-v2">
                <div className="card-v2-h"><h3>Por instituição</h3></div>
                {dados.instituicoes.map((b, i) => (
                  <div key={b.nome} className="bank-tag-v2">
                    <i style={{ background: CORES_INST[i % CORES_INST.length] }} />{b.nome}
                    <b style={{ marginLeft: 'auto', fontFamily: "'Space Grotesk', sans-serif" }}>{formatBRL(b.valor)}</b>
                  </div>
                ))}
              </div>

              <div className="card-v2">
                <div className="card-v2-h"><h3>Proventos recentes</h3></div>
                {dados.proventos_recentes.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--mut)' }}>Nenhum provento classificado neste mês ainda.</div>
                ) : dados.proventos_recentes.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12, fontWeight: 600 }}>
                    <span>{p.descricao}</span>
                    <b style={{ color: 'var(--acc-ink)' }}>+{formatBRL(p.valor)}</b>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
