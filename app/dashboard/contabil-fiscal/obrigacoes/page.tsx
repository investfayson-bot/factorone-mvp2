'use client'

// Obrigações (Fase 5, Bloco 3) — calendário fiscal mensal + lista detalhada
// com link Gov.br por tipo (tabela links_governamentais) e ações reais
// (marcar como paga, anexar comprovante no Cofre Fiscal). Respeita o mesmo
// escopo Consolidado/Só empresas do resto do produto (useHolding) — cada
// obrigação sempre pertence a uma empresa, então o consolidado mostra todas
// com etiqueta de qual é qual, como pede a spec.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'
import { useHolding, type EscopoHolding } from '@/lib/holding-context'

type Obrigacao = {
  id: string; nome: string; tipo: string | null; competencia: string | null
  vencimento: string | null; valor: number | null; status: string
  empresa_id: string; empresa_nome: string
  link_nome: string | null; link_url: string | null
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

function ehPago(status: string) { return status === 'entregue' || status === 'pago' }

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const t = data.session?.access_token
  return t ? { Authorization: `Bearer ${t}` } : {}
}

export default function ObrigacoesPage() {
  const { grupoAtivoId, escopo, setEscopo, grupos } = useHolding()
  const [obrigacoes, setObrigacoes] = useState<Obrigacao[]>([])
  const [loading, setLoading] = useState(true)
  const [mesAtual, setMesAtual] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [acaoEm, setAcaoEm] = useState<string | null>(null)
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ escopo })
      if (grupoAtivoId) qs.set('grupoId', grupoAtivoId)
      const res = await fetch(`/api/fiscal/obrigacoes?${qs}`, { headers: await authHeaders() })
      const d = await res.json() as { obrigacoes?: Obrigacao[]; error?: string }
      setObrigacoes(res.ok ? (d.obrigacoes ?? []) : [])
    } catch { setObrigacoes([]) }
    finally { setLoading(false) }
  }, [escopo, grupoAtivoId])
  useEffect(() => { void carregar() }, [carregar])

  const ano = mesAtual.getFullYear(), mes = mesAtual.getMonth()
  const porDia = useMemo(() => {
    const mapa = new Map<number, Obrigacao[]>()
    for (const o of obrigacoes) {
      if (!o.vencimento) continue
      const dt = new Date(o.vencimento + 'T12:00:00')
      if (dt.getFullYear() === ano && dt.getMonth() === mes) {
        const dia = dt.getDate()
        mapa.set(dia, [...(mapa.get(dia) ?? []), o])
      }
    }
    return mapa
  }, [obrigacoes, ano, mes])

  const doMes = useMemo(() => obrigacoes.filter(o => {
    if (!o.vencimento) return false
    const dt = new Date(o.vencimento + 'T12:00:00')
    return dt.getFullYear() === ano && dt.getMonth() === mes
  }).sort((a, b) => (a.vencimento ?? '').localeCompare(b.vencimento ?? '')), [obrigacoes, ano, mes])

  const pendentesMes = doMes.filter(o => !ehPago(o.status))

  const primeiroDiaSemana = new Date(ano, mes, 1).getDay()
  const diasNoMes = new Date(ano, mes + 1, 0).getDate()
  const celulas: (number | null)[] = [...Array(primeiroDiaSemana).fill(null), ...Array.from({ length: diasNoMes }, (_, i) => i + 1)]
  const hoje = new Date()

  async function marcarPaga(o: Obrigacao) {
    setAcaoEm(o.id)
    try {
      const res = await fetch(`/api/fiscal/obrigacoes/${o.id}/status`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ status: 'pago', empresaId: o.empresa_id }),
      })
      const d = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || !d.ok) throw new Error(d.error || 'Falha ao atualizar')
      toast.success('Marcada como paga')
      void carregar()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro') }
    finally { setAcaoEm(null) }
  }

  async function anexarComprovante(o: Obrigacao, file: File) {
    setAcaoEm(o.id)
    try {
      const fd = new FormData()
      fd.set('tipo', 'guia')
      fd.set('nome', `Comprovante — ${o.nome}`)
      fd.set('descricao', `Anexado a partir de Obrigações · ${o.empresa_nome}`)
      fd.set('competencia', o.competencia ?? (o.vencimento ? o.vencimento.slice(0, 7) : ''))
      fd.set('empresaId', o.empresa_id)
      fd.set('file', file)
      const res = await fetch('/api/cofre-fiscal', { method: 'POST', headers: await authHeaders(), body: fd })
      const d = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || !d.ok) throw new Error(d.error || 'Falha ao anexar')
      await fetch(`/api/fiscal/obrigacoes/${o.id}/status`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ status: 'pago', empresaId: o.empresa_id }),
      })
      toast.success('Comprovante guardado no Cofre Fiscal e obrigação marcada como paga')
      void carregar()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro ao anexar') }
    finally { setAcaoEm(null) }
  }

  return (
    <div style={{ maxWidth: 1040, paddingBottom: 30 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <div className="seg-v2">
          {(['consolidado', 'empresas', 'pf'] as EscopoHolding[]).map(e => (
            <span key={e} className={escopo === e ? 'on' : ''} onClick={() => setEscopo(e)}>
              {e === 'consolidado' ? 'Consolidado' : e === 'empresas' ? 'Só empresas' : 'Só pessoa física'}
            </span>
          ))}
        </div>
        {pendentesMes.length > 0 && <span className="chip-v2 y">{pendentesMes.length} pendente{pendentesMes.length === 1 ? '' : 's'} em {MESES[mes]}</span>}
      </div>

      {/* Calendário */}
      <div className="card-v2" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)' }}>{MESES[mes]} de {ano}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn-v2" style={{ padding: '5px 10px' }} onClick={() => setMesAtual(new Date(ano, mes - 1, 1))}><i className="fa-solid fa-chevron-left" style={{ fontSize: 11 }} /></button>
            <button className="btn-v2" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => setMesAtual(new Date(hoje.getFullYear(), hoje.getMonth(), 1))}>Hoje</button>
            <button className="btn-v2" style={{ padding: '5px 10px' }} onClick={() => setMesAtual(new Date(ano, mes + 1, 1))}><i className="fa-solid fa-chevron-right" style={{ fontSize: 11 }} /></button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6, marginBottom: 4 }}>
          {DIAS_SEMANA.map((d, i) => <div key={i} style={{ fontSize: 9.5, textTransform: 'uppercase', color: 'var(--mut)', fontWeight: 800, textAlign: 'center', paddingBottom: 4 }}>{d}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
          {celulas.map((dia, i) => {
            const itens = dia ? (porDia.get(dia) ?? []) : []
            const ehHoje = !!dia && hoje.getFullYear() === ano && hoje.getMonth() === mes && hoje.getDate() === dia
            return (
              <div key={i} style={{
                border: `1px solid ${ehHoje ? 'var(--acc)' : 'var(--line)'}`, borderRadius: 8, minHeight: 62, padding: 5,
                fontSize: 10, fontWeight: 700, color: 'var(--mut)', background: dia ? 'transparent' : 'var(--bg)',
              }}>
                {dia && <>
                  <div>{dia}</div>
                  {itens.slice(0, 2).map(o => (
                    <div key={o.id} title={o.nome} style={{
                      background: ehPago(o.status) ? 'var(--acc-soft)' : '#F3ECDA', color: ehPago(o.status) ? 'var(--acc-ink)' : '#B08A3E',
                      borderRadius: 5, padding: '2px 5px', fontSize: 9, fontWeight: 800, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{o.nome}</div>
                  ))}
                  {itens.length > 2 && <div style={{ fontSize: 9, color: 'var(--mut)', marginTop: 2 }}>+{itens.length - 2}</div>}
                </>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Lista detalhada do mês */}
      <div className="card-v2" style={{ overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>
          Obrigações de {MESES[mes]}
        </div>
        {loading ? (
          <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--mut)', fontSize: 13 }}>Carregando…</div>
        ) : doMes.length === 0 ? (
          <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--mut)', fontSize: 13 }}>
            Nenhuma obrigação vencendo em {MESES[mes]}. Calcule e registre o DAS em <Link href="/dashboard/contabil-fiscal/impostos-regime" style={{ color: 'var(--acc)', fontWeight: 600 }}>Impostos &amp; Regime</Link>.
          </div>
        ) : doMes.map(o => {
          const pago = ehPago(o.status)
          const dias = o.vencimento ? Math.ceil((new Date(o.vencimento + 'T12:00:00').getTime() - Date.now()) / 86400000) : null
          const ocupado = acaoEm === o.id
          return (
            <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: '1px solid var(--line)', opacity: ocupado ? .6 : 1 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: pago ? 'var(--acc-soft)' : '#F3ECDA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={`fa-solid ${pago ? 'fa-check' : 'fa-clock'}`} style={{ fontSize: 14, color: pago ? 'var(--acc)' : '#B08A3E' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>
                  {o.nome}
                  {(escopo !== 'empresas' || grupos.length > 0) && <span className="chip-v2" style={{ marginLeft: 8, fontSize: 10 }}>{o.empresa_nome}</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--mut)' }}>
                  {o.vencimento ? `Vence ${new Date(o.vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}` : 'Sem vencimento'}
                  {!pago && dias != null && ` · ${dias > 0 ? `em ${dias} dia${dias === 1 ? '' : 's'}` : 'vencida'}`}
                </div>
              </div>
              {o.valor != null && <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{formatBRL(Number(o.valor))}</div>}
              <span className={`chip-v2 ${pago ? 'g' : 'y'}`}>{pago ? 'Paga' : 'Pendente'}</span>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {o.link_url && (
                  <a href={o.link_url} target="_blank" rel="noopener noreferrer" title={o.link_nome ?? 'Abrir no Gov.br'} className="btn-v2" style={{ padding: '5px 9px' }}>
                    <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: 12 }} />
                  </a>
                )}
                {!pago && (
                  <button title="Marcar como paga" className="btn-v2" style={{ padding: '5px 9px' }} disabled={ocupado} onClick={() => void marcarPaga(o)}>
                    <i className="fa-solid fa-check" style={{ fontSize: 12 }} />
                  </button>
                )}
                <input ref={el => { fileInputs.current[o.id] = el }} type="file" accept=".pdf,image/*" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void anexarComprovante(o, f) }} />
                <button title="Anexar comprovante" className="btn-v2" style={{ padding: '5px 9px' }} disabled={ocupado} onClick={() => fileInputs.current[o.id]?.click()}>
                  <i className="fa-solid fa-paperclip" style={{ fontSize: 12 }} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Link href="/dashboard/fiscal" style={{ textDecoration: 'none' }}>
          <div className="card-v2" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <i className="fa-solid fa-landmark" style={{ fontSize: 18, color: 'var(--acc)' }} />
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>Portais do Governo</div>
              <div style={{ fontSize: 12, color: 'var(--mut)' }}>Gov.br, SEFAZ, eSocial e outros — acesso rápido</div>
            </div>
            <i className="fa-solid fa-arrow-right" style={{ marginLeft: 'auto', color: 'var(--mut)', fontSize: 12 }} />
          </div>
        </Link>
        <Link href="/dashboard/tax" style={{ textDecoration: 'none' }}>
          <div className="card-v2" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <i className="fa-solid fa-file-invoice-dollar" style={{ fontSize: 18, color: 'var(--acc)' }} />
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>Tax Compliance</div>
              <div style={{ fontSize: 12, color: 'var(--mut)' }}>Registrar pagamento de imposto no fluxo de caixa</div>
            </div>
            <i className="fa-solid fa-arrow-right" style={{ marginLeft: 'auto', color: 'var(--mut)', fontSize: 12 }} />
          </div>
        </Link>
      </div>
    </div>
  )
}
