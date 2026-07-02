'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'
import { baixarArquivo } from '@/lib/download-arquivo'
import toast from 'react-hot-toast'
import OrcamentoWizard from '@/components/orcamento/OrcamentoWizard'
import EditarLinhaModal from '@/components/orcamento/EditarLinhaModal'
import SuplementacaoModal from '@/components/orcamento/SuplementacaoModal'
import { calcularResumoOrcamento } from '@/lib/orcamento/engine'

type Orcamento = { id: string; nome: string; ano_fiscal: number; status: string; versao: number }
type Linha = { id: string; categoria: string; centro_custo_id: string | null; mes: number; ano: number; valor_previsto: number; valor_realizado: number; variacao: number; variacao_pct: number }
type Alerta = { id: string; tipo: string; valor_previsto: number; valor_realizado: number; percentual_consumido: number; lido: boolean; created_at: string; orcamento_linha_id: string }
type Suplementacao = { id: string; status: string; valor_solicitado: number; justificativa: string; created_at: string; orcamento_linha_id: string }

const CATS_PADRAO = ['Alimentação', 'Transporte', 'Hospedagem', 'Tecnologia/Software', 'Marketing', 'Fornecedores', 'Folha de Pagamento', 'Impostos/Taxas', 'Aluguel/Infraestrutura', 'Consultoria', 'Material de Escritório', 'Outros']

const TAB_LABELS: [string, string][] = [
  ['geral', 'Visão Geral'],
  ['categoria', 'Por Categoria'],
  ['centro', 'Por Centro'],
  ['mensal', 'Mensal'],
  ['alertas', 'Alertas'],
  ['suplementacoes', 'Suplementações'],
]

function progressColor(pct: number) {
  if (pct > 100) return 'var(--red)'
  if (pct >= 80) return 'var(--gold)'
  return 'var(--teal)'
}

export default function OrcamentoPage() {
  const [ano, setAno] = useState(new Date().getFullYear())
  const [exportando, setExportando] = useState(false)
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
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Orçamento Anual {ano}</div>
          <div className="page-sub">Status: <strong>{orcamento?.status || 'sem orçamento'}</strong></div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select className="form-input" style={{ width: 'auto', padding: '6px 12px' }} value={ano} onChange={(e) => setAno(Number(e.target.value))}>
            {anoOptions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <button className="btn-ghost" onClick={() => setOpenWizard(true)}>+ Novo Orçamento</button>
          {orcamento?.status === 'em_aprovacao' && (
            <button className="btn-action" onClick={() => void aprovarOrcamento()}>Aprovar</button>
          )}
          <button
            className="btn-ghost"
            disabled={exportando}
            onClick={async () => {
              setExportando(true)
              const r = await baixarArquivo(`/api/orcamento/exportar?ano=${ano}`, `orcamento_${ano}.pdf`)
              if (!r.ok && 'erro' in r) toast.error(r.erro)
              else toast.success('Relatório de orçamento baixado')
              setExportando(false)
            }}
          >
            {exportando ? 'Gerando...' : 'Exportar'}
          </button>
        </div>
      </div>

      <div className="kpis" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="kpi" style={{ borderTop: '3px solid #5E8C87' }}>
          <div className="kpi-lbl">Total previsto
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#EAF5F3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-chart-pie" style={{ fontSize: 12, color: '#5E8C87' }} />
            </div>
          </div>
          <div className="kpi-val">{formatBRL(resumo.totalPrevisto)}</div>
          <div className="kpi-delta">orçado para {ano}</div>
        </div>
        <div className="kpi" style={{ borderTop: '3px solid #2563eb' }}>
          <div className="kpi-lbl">Total realizado
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-check-circle" style={{ fontSize: 12, color: '#2563eb' }} />
            </div>
          </div>
          <div className="kpi-val">{formatBRL(resumo.totalRealizado)}</div>
          <div className="kpi-delta up">executado até agora</div>
        </div>
        <div className="kpi" style={{ borderTop: `3px solid ${resumo.percentualConsumido > 90 ? '#E74C3C' : resumo.percentualConsumido > 70 ? '#D97706' : '#5E8C87'}` }}>
          <div className="kpi-lbl">% Consumido
            <div style={{ width: 28, height: 28, borderRadius: 8, background: resumo.percentualConsumido > 90 ? '#FEE2E2' : resumo.percentualConsumido > 70 ? '#FEF3C7' : '#EAF5F3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-gauge-high" style={{ fontSize: 12, color: resumo.percentualConsumido > 90 ? '#E74C3C' : resumo.percentualConsumido > 70 ? '#D97706' : '#5E8C87' }} />
            </div>
          </div>
          <div className="kpi-val">{resumo.percentualConsumido.toFixed(1)}%</div>
          <div className={`kpi-delta ${resumo.percentualConsumido > 90 ? 'dn' : 'up'}`}>{resumo.percentualConsumido > 90 ? '⚠ quase no limite' : '✓ saudável'}</div>
        </div>
        <div className="kpi" style={{ borderTop: `3px solid ${alertasAtivos > 0 ? '#D97706' : '#5E8C87'}` }}>
          <div className="kpi-lbl">Alertas ativos
            <div style={{ width: 28, height: 28, borderRadius: 8, background: alertasAtivos > 0 ? '#FEF3C7' : '#EAF5F3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-bell" style={{ fontSize: 12, color: alertasAtivos > 0 ? '#D97706' : '#5E8C87' }} />
            </div>
          </div>
          <div className="kpi-val">{alertasAtivos}</div>
          <div className={`kpi-delta ${alertasAtivos > 0 ? 'warn' : 'up'}`}>{alertasAtivos > 0 ? 'categorias acima de 80%' : '✓ nenhum alerta'}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, background: '#E8EDEC', padding: 3, borderRadius: 10, width: 'fit-content', marginBottom: 14 }}>
        {TAB_LABELS.map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k as typeof tab)}
            style={{
              padding: '6px 13px', borderRadius: 8, fontSize: 11, fontWeight: tab === k ? 700 : 500,
              cursor: 'pointer', border: 'none',
              background: tab === k ? '#fff' : 'transparent',
              color: tab === k ? '#1C2B2A' : '#7A8F8E',
              transition: 'all .15s',
            }}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === 'geral' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {porCategoria.slice(0, 6).map((c) => (
            <div key={c.categoria} style={{ background: '#fff', border: '0.5px solid #E2E8E7', borderRadius: 12, padding: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#1C2B2A', marginBottom: 4 }}>{c.categoria}</div>
              <div style={{ fontSize: 12, color: '#7A8F8E', marginBottom: 8 }}>
                {formatBRL(c.realizado)} / {formatBRL(c.previsto)} · {c.pct.toFixed(1)}%
              </div>
              <div style={{ height: 6, borderRadius: 4, background: '#EEF2F1' }}>
                <div style={{ height: 6, borderRadius: 4, width: `${Math.min(c.pct, 100)}%`, background: progressColor(c.pct) }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'categoria' && (
        <div style={{ background: '#fff', border: '0.5px solid #E2E8E7', borderRadius: 12, overflow: 'hidden' }}>
          <div className="expenses-table">
            <table>
              <thead>
                <tr>
                  <th>Categoria</th>
                  <th style={{ textAlign: 'right' }}>Previsto</th>
                  <th style={{ textAlign: 'right' }}>Realizado</th>
                  <th style={{ textAlign: 'right' }}>Variação</th>
                  <th style={{ textAlign: 'right' }}>%</th>
                  <th style={{ textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {porCategoria.map((c) => (
                  <tr key={c.categoria}>
                    <td style={{ fontWeight: 600 }}>{c.categoria}</td>
                    <td style={{ textAlign: 'right', fontFamily: "'Inter', sans-serif" }}>{formatBRL(c.previsto)}</td>
                    <td style={{ textAlign: 'right', fontFamily: "'Inter', sans-serif" }}>{formatBRL(c.realizado)}</td>
                    <td style={{ textAlign: 'right', fontFamily: "'Inter', sans-serif", color: c.previsto - c.realizado < 0 ? 'var(--red)' : 'var(--teal)', fontWeight: 700 }}>{formatBRL(c.previsto - c.realizado)}</td>
                    <td style={{ textAlign: 'right', color: progressColor(c.pct), fontWeight: 700 }}>{c.pct.toFixed(1)}%</td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => { const l = linhas.find((x) => x.categoria === c.categoria); if (l) setEditLinha(l) }}>Editar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'centro' && (
        <div style={{ background: '#fff', border: '0.5px solid #E2E8E7', borderRadius: 12, padding: '20px 16px', fontSize: 13, color: '#7A8F8E' }}>
          Visão por centro de custo usa os mesmos dados de linhas com <code>centro_custo_id</code>.
        </div>
      )}

      {tab === 'mensal' && (
        <div style={{ background: '#fff', border: '0.5px solid #E2E8E7', borderRadius: 12, overflow: 'hidden' }}>
          <div className="expenses-table">
            <table>
              <thead>
                <tr>
                  <th>Mês</th>
                  <th style={{ textAlign: 'right' }}>Realizado</th>
                  <th style={{ textAlign: 'right' }}>Previsto</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 12 }).map((_, i) => {
                  const m = i + 1
                  const mesLinhas = linhas.filter((l) => l.mes === m)
                  const p = mesLinhas.reduce((s, l) => s + Number(l.valor_previsto || 0), 0)
                  const r = mesLinhas.reduce((s, l) => s + Number(l.valor_realizado || 0), 0)
                  return (
                    <tr key={m}>
                      <td style={{ fontFamily: "'Inter', sans-serif" }}>{m.toString().padStart(2, '0')}/{ano}</td>
                      <td style={{ textAlign: 'right', fontFamily: "'Inter', sans-serif", color: '#5E8C87', fontWeight: 700 }}>{formatBRL(r)}</td>
                      <td style={{ textAlign: 'right', fontFamily: "'Inter', sans-serif" }}>{formatBRL(p)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'alertas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {alertas.length === 0 && (
            <div style={{ background: '#fff', border: '0.5px solid #E2E8E7', borderRadius: 12, padding: '32px 16px', textAlign: 'center', color: '#7A8F8E', fontSize: 13 }}>
              Nenhum alerta ativo.
            </div>
          )}
          {alertas.map((a) => (
            <div key={a.id} style={{ background: '#fff', border: `0.5px solid ${a.lido ? '#E2E8E7' : '#F59E0B'}`, borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span className={`tag ${a.lido ? 'gray' : 'green'}`}>{a.tipo}</span>
                <span style={{ fontSize: 12, color: '#7A8F8E' }}>{a.percentual_consumido?.toFixed(1)}% consumido</span>
              </div>
              <div style={{ fontSize: 12, color: '#7A8F8E', marginBottom: 8 }}>
                Previsto: {formatBRL(Number(a.valor_previsto || 0))} · Realizado: {formatBRL(Number(a.valor_realizado || 0))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {!a.lido && (
                  <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => void marcarAlertaLido(a.id)}>Marcar como lido</button>
                )}
                <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => { const l = linhas.find((x) => x.id === a.orcamento_linha_id); if (l) setSupLinha(l) }}>Solicitar suplementação</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'suplementacoes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {suplementacoes.length === 0 && (
            <div style={{ background: '#fff', border: '0.5px solid #E2E8E7', borderRadius: 12, padding: '32px 16px', textAlign: 'center', color: '#7A8F8E', fontSize: 13 }}>
              Nenhuma suplementação registrada.
            </div>
          )}
          {suplementacoes.map((s) => (
            <div key={s.id} style={{ background: '#fff', border: '0.5px solid #E2E8E7', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#1C2B2A', fontFamily: "'Inter', sans-serif" }}>{formatBRL(Number(s.valor_solicitado || 0))}</span>
                <span className={`tag ${s.status === 'aprovado' ? 'green' : s.status === 'rejeitado' ? 'red' : 'gray'}`}>{s.status}</span>
              </div>
              <div style={{ fontSize: 12, color: '#7A8F8E', marginBottom: s.status === 'pendente' ? 10 : 0 }}>{s.justificativa}</div>
              {s.status === 'pendente' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-action" style={{ padding: '4px 12px', fontSize: 11 }} onClick={() => void decidirSuplementacao(s.id, 'aprovado')}>Aprovar</button>
                  <button className="btn-ghost" style={{ padding: '4px 12px', fontSize: 11 }} onClick={() => void decidirSuplementacao(s.id, 'rejeitado')}>Rejeitar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <OrcamentoWizard open={openWizard} onClose={() => setOpenWizard(false)} onSaved={carregar} categorias={CATS_PADRAO} />
      <EditarLinhaModal open={Boolean(editLinha)} onClose={() => setEditLinha(null)} linha={editLinha} onSaved={carregar} />
      <SuplementacaoModal open={Boolean(supLinha)} onClose={() => setSupLinha(null)} linha={supLinha ? { id: supLinha.id, categoria: supLinha.categoria, valor_previsto: Number(supLinha.valor_previsto || 0), valor_realizado: Number(supLinha.valor_realizado || 0) } : null} onSaved={carregar} />
    </>
  )
}
