'use client'

import { Fragment, useCallback, useEffect, useMemo, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { formatBRL } from '@/lib/currency-brl'
import { supabase } from '@/lib/supabase'
import NovaContaReceberModal from '@/components/financeiro/NovaContaReceberModal'

type ContaReceber = {
  id: string; cliente_nome: string; descricao: string; data_vencimento: string
  valor: number; valor_recebido: number; status: string; dias_atraso: number
  cliente_email?: string | null
}

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

function StatusChip({ status, dias }: { status: string; dias: number }) {
  if (status === 'recebida') return <span className="chip-v2 g">Recebida</span>
  if (status === 'vencida' || dias < 0) return <span className="chip-v2 r">Vencida</span>
  if (dias <= 5) return <span className="chip-v2 y">A vencer</span>
  return <span className="chip-v2 g">Programada</span>
}

function riscoDoCliente(c: ContaReceber): { cor: string; titulo: string } {
  if (c.status === 'recebida') return { cor: 'var(--acc)', titulo: 'Recebida' }
  const atraso = c.dias_atraso || Math.max(0, -diasAte(c.data_vencimento))
  if (atraso > 15) return { cor: 'var(--neg)', titulo: 'Risco alto — atraso > 15 dias' }
  if (atraso > 0) return { cor: 'var(--warn)', titulo: 'Risco médio — em atraso' }
  return { cor: 'var(--acc)', titulo: 'Em dia' }
}

const STATUS_FILTROS = [
  { key: 'todas', label: 'Todas' },
  { key: 'a_vencer', label: 'A vencer' },
  { key: 'vencida', label: 'Vencidas' },
  { key: 'recebida', label: 'Recebidas' },
] as const

function ContasAReceberInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [contas, setContas] = useState<ContaReceber[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState<typeof STATUS_FILTROS[number]['key']>('todas')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [modalAberto, setModalAberto] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const h = await authHeaders()
      const r = await fetch('/api/financeiro/receber?status=todas', { headers: h }).then(x => x.json()).catch(() => ({ data: [] }))
      setContas((r.data || []) as ContaReceber[])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void carregar() }, [carregar])

  useEffect(() => {
    if (searchParams.get('novo') === '1') {
      setModalAberto(true)
      router.replace('/dashboard/financeiro/contas-a-receber')
    }
  }, [searchParams, router])

  const filtradas = useMemo(() => {
    return contas.filter(c => {
      const dias = diasAte(c.data_vencimento)
      if (filtroStatus === 'todas') return true
      if (filtroStatus === 'recebida') return c.status === 'recebida'
      if (filtroStatus === 'vencida') return c.status === 'vencida' || (c.status !== 'recebida' && dias < 0)
      if (filtroStatus === 'a_vencer') return c.status !== 'recebida' && dias >= 0
      return true
    }).sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))
  }, [contas, filtroStatus])

  const kpis = useMemo(() => {
    const aberto = contas.filter(c => c.status !== 'recebida')
    const totalAReceber = aberto.reduce((s, c) => s + Number(c.valor || 0) - Number(c.valor_recebido || 0), 0)
    const aVencer7 = aberto.filter(c => diasAte(c.data_vencimento) >= 0 && diasAte(c.data_vencimento) <= 7)
    const totalAVencer7 = aVencer7.reduce((s, c) => s + Number(c.valor || 0) - Number(c.valor_recebido || 0), 0)
    const inadimplente = aberto.filter(c => diasAte(c.data_vencimento) < 0)
    const totalInadimplente = inadimplente.reduce((s, c) => s + Number(c.valor || 0) - Number(c.valor_recebido || 0), 0)
    return { totalAReceber, totalAVencer7, totalInadimplente }
  }, [contas])

  async function receber(id: string, valor: number, vencida: boolean) {
    setActionLoading(id)
    try {
      const h = await authHeaders()
      await fetch(`/api/financeiro/receber/${id}/receber`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...h },
        body: JSON.stringify({ data_recebimento: new Date().toISOString().slice(0, 10), valor_recebido: valor, cobrar_juros: vencida }),
      })
      await carregar()
    } finally { setActionLoading(null) }
  }

  async function cobrar(id: string) {
    setActionLoading(id)
    try {
      const h = await authHeaders()
      await fetch('/api/financeiro/cobranca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...h },
        body: JSON.stringify({ action: 'enviar', conta_receber_id: id }),
      })
      const { default: toast } = await import('react-hot-toast')
      toast.success('Cobrança enviada')
    } finally { setActionLoading(null) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        <div className="kpi-v2"><div className="l">Total a receber (mês)</div><div className="v">{formatBRL(kpis.totalAReceber)}</div></div>
        <div className="kpi-v2 warn"><div className="l">A vencer em 7 dias</div><div className="v">{formatBRL(kpis.totalAVencer7)}</div></div>
        <div className="kpi-v2 neg"><div className="l">Inadimplente</div><div className="v" style={{ color: kpis.totalInadimplente > 0 ? 'var(--neg)' : undefined }}>{formatBRL(kpis.totalInadimplente)}</div></div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="pill-sel-v2">
          {STATUS_FILTROS.map(f => (
            <span key={f.key} className={filtroStatus === f.key ? 'on' : ''} onClick={() => setFiltroStatus(f.key)}>{f.label}</span>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: 'var(--mut)', fontWeight: 600 }}>{filtradas.length} título{filtradas.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="card-v2" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table-v2">
          <thead>
            <tr>
              <th style={{ padding: '10px 16px' }}>Cliente</th>
              <th>Vencimento</th>
              <th style={{ textAlign: 'right' }}>Valor</th>
              <th>Status</th>
              <th style={{ textAlign: 'right', padding: '10px 16px' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--mut)' }}>Carregando…</td></tr>
            ) : filtradas.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--mut)' }}>Nenhuma conta a receber neste filtro.</td></tr>
            ) : filtradas.map(c => {
              const risco = riscoDoCliente(c)
              return (
                <Fragment key={c.id}>
                  <tr>
                    <td style={{ padding: '9px 16px', fontWeight: 700, color: 'var(--ink)' }}>
                      <span title={risco.titulo} style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: risco.cor, marginRight: 7 }} />
                      {c.cliente_nome || c.descricao}
                    </td>
                    <td>{fmtDate(c.data_vencimento)}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{formatBRL(Number(c.valor || 0))}</td>
                    <td><StatusChip status={c.status} dias={diasAte(c.data_vencimento)} /></td>
                    <td style={{ textAlign: 'right', padding: '9px 16px' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        {c.status !== 'recebida' && (
                          <>
                            <button
                              onClick={() => void receber(c.id, Number(c.valor || 0) - Number(c.valor_recebido || 0), c.status === 'vencida')}
                              disabled={actionLoading === c.id}
                              className="btn-v2 primary"
                              style={{ padding: '4px 10px', fontSize: 11.5 }}
                            >
                              {actionLoading === c.id ? '...' : 'Receber'}
                            </button>
                            <button
                              onClick={() => void cobrar(c.id)}
                              disabled={actionLoading === c.id}
                              className="btn-v2"
                              style={{ padding: '4px 10px', fontSize: 11.5 }}
                            >
                              Cobrar
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      <NovaContaReceberModal open={modalAberto} onClose={() => setModalAberto(false)} onSaved={carregar} />
    </div>
  )
}

export default function ContasAReceberPage() {
  return (
    <Suspense fallback={<div style={{ padding: '24px 0', color: 'var(--mut)' }}>Carregando…</div>}>
      <ContasAReceberInner />
    </Suspense>
  )
}
