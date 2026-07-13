'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { formatBRL } from '@/lib/currency-brl'
import { supabase } from '@/lib/supabase'

type ContaPagar = { id: string; fornecedor_nome: string; descricao: string; categoria: string; data_vencimento: string; valor: number; valor_pago: number; status: string; empresa_nome?: string }
type ContaReceber = { id: string; cliente_nome: string; descricao: string; data_vencimento: string; valor: number; valor_recebido: number; status: string; dias_atraso: number }
type Previsao = { saldoAtual: number; d7: number; d30: number; d90: number }
type Aging = { pagar: Record<string, number>; receber: Record<string, number>; receber_rows: { nome: string; data_vencimento: string; valor: number }[] }
type LinhaDRE = { nome: string; valor: number; transacoes: Array<{ id: string; descricao: string; valor: number; categoria?: string; status?: string; cliente_nome?: string; fornecedor_nome?: string }> }
type DRE = { receitas: { linhas: LinhaDRE[]; total: number }; despesas: { linhas: LinhaDRE[]; total: number }; lucro: number; margem: string }

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const t = data.session?.access_token
  return t ? { Authorization: `Bearer ${t}` } : {}
}

function fmtDate(d: string) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

function diasAte(d: string): number {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const alvo = new Date(d + 'T00:00:00')
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000)
}

function chipVencimento(dias: number) {
  if (dias < 0) return <span className="chip-v2 r">Vencida</span>
  if (dias === 0) return <span className="chip-v2 r">Vence hoje</span>
  if (dias === 1) return <span className="chip-v2 r">Vence amanhã</span>
  if (dias <= 5) return <span className="chip-v2 y">Em {dias} dias</span>
  return <span className="chip-v2 g">Programado</span>
}

const HUB = [
  { href: '/dashboard/cobrancas', titulo: 'Assinaturas & Recorrências', desc: 'SaaS, aluguéis e contratos' },
  { href: '/dashboard/reembolsos', titulo: 'Reembolsos', desc: 'Solicitações da equipe' },
  { href: '/dashboard/orcamento', titulo: 'Orçamentos', desc: 'Orçado × realizado' },
  { href: '/dashboard/despesas', titulo: 'Centro de Custos', desc: 'Rateio por área e projeto' },
  { href: '/dashboard/despesas', titulo: 'Categorias', desc: 'Plano de contas + IA' },
  { href: '/dashboard/financeiro/fluxo-de-caixa', titulo: 'Forecast & Cenários', desc: 'Simulação "e se…"' },
]

export default function VisaoGeralFinanceiro() {
  const [pagar, setPagar] = useState<ContaPagar[]>([])
  const [receber, setReceber] = useState<ContaReceber[]>([])
  const [previsao, setPrevisao] = useState<Previsao | null>(null)
  const [aging, setAging] = useState<Aging | null>(null)
  const [dre, setDre] = useState<DRE | null>(null)
  const [linhaSelecionada, setLinhaSelecionada] = useState<LinhaDRE | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ativo = true
    async function carregar() {
      const h = await authHeaders()
      const [p, r, prev, ag, dreData] = await Promise.all([
        fetch('/api/financeiro/pagar?status=todas', { headers: h }).then(x => x.json()).catch(() => ({ data: [] })),
        fetch('/api/financeiro/receber?status=todas', { headers: h }).then(x => x.json()).catch(() => ({ data: [] })),
        fetch('/api/cashflow/previsao', { headers: h }).then(x => x.json()).catch(() => null),
        fetch('/api/financeiro/aging', { headers: h }).then(x => x.json()).catch(() => null),
        fetch('/api/financeiro/dre', { headers: h }).then(x => x.json()).catch(() => null),
      ])
      if (!ativo) return
      setPagar((p.data || []) as ContaPagar[])
      setReceber((r.data || []) as ContaReceber[])
      setPrevisao(prev)
      setAging(ag)
      setDre(dreData)
      setLoading(false)
    }
    void carregar()
    return () => { ativo = false }
  }, [])

  const kpis = useMemo(() => {
    const abertoPagar = pagar.filter(x => x.status !== 'paga')
    const abertoReceber = receber.filter(x => x.status !== 'recebida')
    const pagar7 = abertoPagar.filter(x => diasAte(x.data_vencimento) <= 7)
    const receber7 = abertoReceber.filter(x => diasAte(x.data_vencimento) <= 7)
    const totalPagar7 = pagar7.reduce((s, x) => s + Number(x.valor || 0) - Number(x.valor_pago || 0), 0)
    const totalReceber7 = receber7.reduce((s, x) => s + Number(x.valor || 0) - Number(x.valor_recebido || 0), 0)
    const venceAmanha = pagar7.filter(x => diasAte(x.data_vencimento) === 1).length
    const emDia = receber.length ? Math.round((receber.filter(x => x.status !== 'vencida').length / receber.length) * 100) : 100
    const totalReceberGeral = receber.reduce((s, x) => s + Number(x.valor || 0), 0)
    const totalVencidoReceber = receber.filter(x => x.status === 'vencida').reduce((s, x) => s + Number(x.valor || 0), 0)
    const inadimplencia = totalReceberGeral > 0 ? (totalVencidoReceber / totalReceberGeral) * 100 : 0
    return { totalPagar7, totalReceber7, venceAmanha, emDia, pagar7Count: pagar7.length, receber7Count: receber7.length, inadimplencia }
  }, [pagar, receber])

  const vencendoAgora = useMemo(() => {
    return pagar
      .filter(x => x.status !== 'paga')
      .slice()
      .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))
      .slice(0, 5)
  }, [pagar])

  const riscoInadimplencia = useMemo(() => {
    if (!aging) return []
    return aging.receber_rows
      .slice()
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 3)
      .map(r => {
        const dias = -diasAte(r.data_vencimento)
        const score = Math.max(5, Math.min(95, Math.round((dias / 45) * 100)))
        const cor = score >= 60 ? '#DE4B4B' : score >= 30 ? '#F59E0B' : '#16A34A'
        return { nome: r.nome, score, cor }
      })
  }, [aging])

  const insight = useMemo(() => {
    const vencidas = receber.filter(x => x.status === 'vencida').sort((a, b) => Number(b.valor) - Number(a.valor)).slice(0, 2)
    if (vencidas.length === 0) return null
    const total = vencidas.reduce((s, x) => s + Number(x.valor || 0), 0)
    const nomes = vencidas.map(v => `${v.cliente_nome} (${formatBRL(Number(v.valor))})`).join(' e ')
    return { total, nomes, count: vencidas.length }
  }, [receber])

  if (loading) return <div style={{ padding: '24px 0', color: 'var(--mut)', fontSize: 13 }}>Carregando…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        <div className="kpi-v2 neg">
          <div className="l">A pagar (7 dias)</div>
          <div className="v">{formatBRL(kpis.totalPagar7)}</div>
          <div className="c" style={{ color: 'var(--neg)' }}>{kpis.pagar7Count} títulos{kpis.venceAmanha > 0 ? ` · ${kpis.venceAmanha} vencem amanhã` : ''}</div>
        </div>
        <div className="kpi-v2">
          <div className="l">A receber (7 dias)</div>
          <div className="v">{formatBRL(kpis.totalReceber7)}</div>
          <div className="c" style={{ color: 'var(--acc-ink)' }}>{kpis.receber7Count} títulos · {kpis.emDia}% em dia</div>
        </div>
        <div className="kpi-v2 ink">
          <div className="l">Saldo projetado (30d)</div>
          <div className="v">{previsao ? formatBRL(previsao.d30) : '—'}</div>
          <div className="c" style={{ color: previsao && previsao.d30 < 0 ? 'var(--neg)' : 'var(--mut)' }}>
            {previsao && previsao.d30 < 0 ? '⚠ negativo no período' : 'Baseado no fluxo previsto'}
          </div>
        </div>
        <div className="kpi-v2 warn">
          <div className="l">Inadimplência</div>
          <div className="v">{kpis.inadimplencia.toFixed(1)}%</div>
          <div className="c" style={{ color: 'var(--mut)' }}>Sobre o total a receber</div>
        </div>
      </div>

      {dre && (
        <div className="card-v2">
          <div className="card-v2-h">
            <h3>Demonstração de Resultado (DRE)</h3>
            <span style={{ fontSize: 12, color: 'var(--mut)' }}>clique em qualquer linha para detalhes</span>
          </div>
          <table className="table-v2" style={{ width: '100%' }}>
            <tbody>
              {dre.receitas.linhas.map((l, i) => (
                <tr key={`r-${i}`} onClick={() => setLinhaSelecionada(l)} style={{ cursor: 'pointer', transition: 'background .2s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--cream)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px', fontSize: 13, fontWeight: 600 }}>{l.nome}</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontSize: 13, color: 'var(--acc-ink)', fontWeight: 600 }}>{formatBRL(l.valor)}</td>
                </tr>
              ))}
              <tr style={{ background: 'var(--cream)', fontWeight: 700, borderTop: '1px solid var(--line)' }}>
                <td style={{ padding: '12px', fontSize: 13 }}>Receita Total</td>
                <td style={{ padding: '12px', textAlign: 'right', fontSize: 14, color: 'var(--acc-ink)' }}>{formatBRL(dre.receitas.total)}</td>
              </tr>
              <tr style={{ height: 8 }}></tr>
              {dre.despesas.linhas.map((l, i) => (
                <tr key={`d-${i}`} onClick={() => setLinhaSelecionada(l)} style={{ cursor: 'pointer', transition: 'background .2s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--cream)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px', fontSize: 13, fontWeight: 600 }}>{l.nome}</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontSize: 13, color: 'var(--neg)', fontWeight: 600 }}>({formatBRL(l.valor)})</td>
                </tr>
              ))}
              <tr style={{ background: 'var(--cream)', fontWeight: 700, borderTop: '1px solid var(--line)' }}>
                <td style={{ padding: '12px', fontSize: 13 }}>Despesa Total</td>
                <td style={{ padding: '12px', textAlign: 'right', fontSize: 14, color: 'var(--neg)' }}>({formatBRL(dre.despesas.total)})</td>
              </tr>
              <tr style={{ height: 8 }}></tr>
              <tr style={{ background: dre.lucro >= 0 ? 'var(--acc-soft)' : 'var(--neg-soft)', fontWeight: 800, borderTop: '2px solid var(--line)' }}>
                <td style={{ padding: '12px', fontSize: 14 }}>Lucro Líquido</td>
                <td style={{ padding: '12px', textAlign: 'right', fontSize: 16, color: dre.lucro >= 0 ? 'var(--acc-ink)' : 'var(--neg)' }}>{formatBRL(dre.lucro)}</td>
              </tr>
              <tr style={{ background: 'transparent' }}>
                <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--mut)' }}>Margem</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 12, color: 'var(--mut)' }}>{dre.margem}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {linhaSelecionada && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }} onClick={() => setLinhaSelecionada(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', width: '100%', maxWidth: 500, borderRadius: '16px 16px 0 0', padding: 24, maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800 }}>{linhaSelecionada.nome}</h2>
              <button onClick={() => setLinhaSelecionada(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ background: 'var(--cream)', padding: 16, borderRadius: 8, marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: 'var(--mut)', marginBottom: 4 }}>Total</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)' }}>{formatBRL(linhaSelecionada.valor)}</div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Transações ({linhaSelecionada.transacoes.length})</div>
              {linhaSelecionada.transacoes.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--mut)' }}>Nenhuma transação nesta categoria.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {linhaSelecionada.transacoes.map(t => (
                    <div key={t.id} className="feed-v2">
                      <div className="desc">
                        <b>{t.descricao || t.cliente_nome || t.fornecedor_nome || '(sem descrição)'}</b>
                        {t.categoria && <small style={{ display: 'block' }}>Categoria: {t.categoria}</small>}
                      </div>
                      <div className="val" style={{ color: 'inherit' }}>{formatBRL(t.valor)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => setLinhaSelecionada(null)} className="btn-v2" style={{ width: '100%' }}>Fechar</button>
          </div>
        </div>
      )}

      <div className="split" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 14, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card-v2">
            <div className="card-v2-h">
              <h3>Vencendo agora</h3>
              <Link href="/dashboard/financeiro/contas-a-pagar" className="link-v2">Ir para Contas a Pagar →</Link>
            </div>
            {vencendoAgora.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--mut)', padding: '8px 0' }}>Nada vencendo nos próximos dias.</div>
            ) : (
              <table className="table-v2">
                <thead><tr><th>Fornecedor</th><th>Vencimento</th><th style={{ textAlign: 'right' }}>Valor</th><th>Status</th></tr></thead>
                <tbody>
                  {vencendoAgora.map(c => (
                    <tr key={c.id}>
                      <td>{c.fornecedor_nome || c.descricao}</td>
                      <td>{fmtDate(c.data_vencimento)}</td>
                      <td className="num" style={{ textAlign: 'right' }}>{formatBRL(Number(c.valor || 0))}</td>
                      <td>{chipVencimento(diasAte(c.data_vencimento))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <h3 style={{ fontSize: 13, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 }}>Tudo do Financeiro</h3>
            </div>
            <div className="hub-v2">
              {HUB.map(h => (
                <Link key={h.titulo} href={h.href} className="hub-c-v2">
                  <div className="hub-ic-v2">•</div>
                  <div><b>{h.titulo}</b><small>{h.desc}</small></div>
                </Link>
              ))}
              <Link href="/dashboard/financeiro/precificacao" className="hub-c-v2" style={{ borderColor: 'var(--warn)', background: 'var(--warn-soft)' }}>
                <div className="hub-ic-v2" style={{ background: '#fff', color: 'var(--warn)' }}>•</div>
                <div><b>Precificação & Margem</b><small>Custo por kg/L/item, ponto de equilíbrio</small></div>
              </Link>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="insights-v2">
            <span style={{ fontSize: 9.5, fontWeight: 700, background: 'var(--acc2)', color: '#06130C', padding: '2px 7px', borderRadius: 5, letterSpacing: '.05em', fontFamily: "'Space Grotesk', sans-serif" }}>FACTORONE AI</span>
            {insight ? (
              <>
                <h3 style={{ color: '#fff', fontSize: 13.5, margin: '9px 0 6px' }}>Fique de olho nas duplicatas atrasadas</h3>
                <p style={{ fontSize: 12, lineHeight: 1.6, color: '#C4D4CB' }}>
                  <b style={{ color: '#fff' }}>{insight.nomes}</b> {insight.count > 1 ? 'estão' : 'está'} vencidas, somando <span style={{ color: '#FBBF24', fontWeight: 800 }}>{formatBRL(insight.total)}</span> parado no seu caixa.
                </p>
                <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
                  <Link href="/dashboard/financeiro/contas-a-receber" style={{ fontSize: 11, fontWeight: 800, background: '#22C55E', borderRadius: 7, padding: '6px 11px', color: '#06130C', textDecoration: 'none' }}>Cobrar duplicatas</Link>
                  <Link href="/dashboard/financeiro/fluxo-de-caixa" style={{ fontSize: 11, fontWeight: 800, border: '1px solid rgba(255,255,255,.2)', borderRadius: 7, padding: '6px 11px', color: '#fff', textDecoration: 'none' }}>Simular cenário</Link>
                </div>
              </>
            ) : (
              <>
                <h3 style={{ color: '#fff', fontSize: 13.5, margin: '9px 0 6px' }}>Nenhuma duplicata vencida</h3>
                <p style={{ fontSize: 12, lineHeight: 1.6, color: '#C4D4CB' }}>Seus recebíveis estão em dia — sem sinais de risco no momento.</p>
              </>
            )}
          </div>

          <div className="card-v2">
            <div className="card-v2-h"><h3>Risco de inadimplência</h3><span className="chip-v2 y">Preditivo</span></div>
            {riscoInadimplencia.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--mut)' }}>Sem títulos em atraso para avaliar.</div>
            ) : riscoInadimplencia.map(r => (
              <div key={r.nome} className="bar-row-v2">
                <span>{r.nome}</span>
                <div className="tr"><i style={{ width: `${r.score}%`, background: r.cor }} /></div>
                <b>{r.score}%</b>
              </div>
            ))}
            <p style={{ fontSize: 11, color: 'var(--mut)', marginTop: 8, fontWeight: 600 }}>Baseado nos dias de atraso de cada cliente hoje.</p>
          </div>

          <div className="card-v2">
            <div className="card-v2-h"><h3>Régua de cobrança</h3><Link href="/dashboard/financeiro/contas-a-receber" className="link-v2">Configurar</Link></div>
            <div className="pend-v2"><span className="n2" style={{ background: 'var(--acc-soft)', color: 'var(--acc-ink)' }}>D-3</span>Lembrete amigável por e-mail + WhatsApp</div>
            <div className="pend-v2"><span className="n2" style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}>D+1</span>Cobrança com 2ª via do boleto/PIX</div>
            <div className="pend-v2"><span className="n2" style={{ background: 'var(--neg-soft)', color: 'var(--neg)' }}>D+7</span>Escalada: IA liga o alerta pro Acessor</div>
          </div>
        </div>
      </div>
    </div>
  )
}
