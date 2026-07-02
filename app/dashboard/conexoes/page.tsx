'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ConnectBank } from '@/components/ui/Illustration'

type Conta = {
  id: string
  nome: string | null
  numero: string | null
  categoria: string | null
  tipo: string | null
  saldo: number | null
  disponivel?: number | null
  limite_credito?: number | null
  moeda: string | null
  instituicao: string | null
}
type Transacao = {
  id: string
  data: string | null
  descricao: string | null
  categoria: string | null
  estabelecimento: string | null
  conta: string | null
  tipo: string | null
  valor: number | null
  moeda: string | null
}
type Fatura = {
  id: string
  nome: string | null
  fechamento: string | null
  vencimento: string | null
  total: number | null
  minimo: number | null
  moeda: string | null
  status: string | null
}
type Link = { id: string; link_id: string; institution: string | null; created_at: string }

type BelvoSDK = {
  createWidget: (accessToken: string, config: Record<string, unknown>) => { build: () => void }
}
declare global {
  interface Window { belvoSDK?: BelvoSDK }
}

const WIDGET_SRC = 'https://cdn.belvo.io/belvo-widget-1-stable.js'
const PERIODOS = [
  { label: '90 dias', dias: 90 },
  { label: '6 meses', dias: 180 },
  { label: '12 meses', dias: 365 },
]

function fmtBRL(v: number | null | undefined, moeda: string | null) {
  if (v == null) return '—'
  try { return v.toLocaleString('pt-BR', { style: 'currency', currency: moeda || 'BRL' }) }
  catch { return `${v}` }
}

export default function ConexoesPage() {
  const [loading, setLoading] = useState(false)
  const [contas, setContas] = useState<Conta[]>([])
  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [faturas, setFaturas] = useState<Fatura[]>([])
  const [links, setLinks] = useState<Link[]>([])
  const [erro, setErro] = useState('')
  const [status, setStatus] = useState('')
  const [periodoDias, setPeriodoDias] = useState(365)
  const [sincronizando, setSincronizando] = useState(false)
  const [okSync, setOkSync] = useState('')

  const authHeaders = useCallback(async () => {
    const { data: sess } = await supabase.auth.getSession()
    return {
      'Content-Type': 'application/json',
      ...(sess.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {}),
    }
  }, [])

  const carregarPersistido = useCallback(async () => {
    const headers = await authHeaders()
    const [rc, rt, rb] = await Promise.all([
      fetch('/api/belvo/accounts', { headers }),
      fetch('/api/belvo/transactions', { headers }),
      fetch('/api/belvo/bills', { headers }),
    ])
    const [dc, dt, db] = await Promise.all([rc.json(), rt.json(), rb.json()])
    if (rc.ok) { setLinks(dc.links ?? []); setContas(dc.contas ?? []) }
    if (rt.ok) setTransacoes(dt.transacoes ?? [])
    if (rb.ok) setFaturas(db.faturas ?? [])
  }, [authHeaders])

  useEffect(() => { void carregarPersistido() }, [carregarPersistido])

  async function getToken(): Promise<string> {
    const headers = await authHeaders()
    const res = await fetch('/api/belvo/token', { method: 'POST', headers })
    const d = await res.json()
    if (!res.ok) throw new Error(d.error || 'Falha ao gerar token Belvo')
    return d.access as string
  }

  function loadScript(): Promise<void> {
    if (window.belvoSDK) return Promise.resolve()
    return new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = WIDGET_SRC
      s.onload = () => resolve()
      s.onerror = () => reject(new Error('Falha ao carregar o widget da Belvo'))
      document.body.appendChild(s)
    })
  }

  async function retrieve(link: string, institution: string) {
    try {
      const headers = await authHeaders()
      const df = new Date(Date.now() - periodoDias * 864e5).toISOString().slice(0, 10)

      setStatus('Buscando contas…')
      const resC = await fetch('/api/belvo/accounts', { method: 'POST', headers, body: JSON.stringify({ link, institution }) })
      const dC = await resC.json()
      if (!resC.ok) throw new Error(dC.error || 'Falha ao buscar contas')
      setContas(dC.contas ?? [])

      setStatus(`Buscando transações (${PERIODOS.find(p => p.dias === periodoDias)?.label})…`)
      const resT = await fetch('/api/belvo/transactions', { method: 'POST', headers, body: JSON.stringify({ link, date_from: df }) })
      const dT = await resT.json()
      if (!resT.ok) throw new Error(dT.error || 'Falha ao buscar transações')
      setTransacoes(dT.transacoes ?? [])

      setStatus('Buscando faturas de cartão…')
      const resB = await fetch('/api/belvo/bills', { method: 'POST', headers, body: JSON.stringify({ link }) })
      const dB = await resB.json()
      if (resB.ok) setFaturas(dB.faturas ?? []) // bills pode não existir para alguns bancos

      setStatus('')
      void carregarPersistido()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao buscar dados')
      setStatus('')
    } finally {
      setLoading(false)
    }
  }

  async function sincronizar() {
    setErro(''); setOkSync(''); setSincronizando(true)
    try {
      const headers = await authHeaders()
      const res = await fetch('/api/belvo/sync', { method: 'POST', headers })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Falha ao sincronizar')
      const destino = d.destino === 'extrato_bancario' ? 'extrato bancário' : 'finanças pessoais'
      setOkSync(`${d.sincronizadas} transação(ões) sincronizadas para ${destino}.`)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao sincronizar')
    } finally {
      setSincronizando(false)
    }
  }

  async function conectar() {
    setErro(''); setLoading(true)
    try {
      const access = await getToken()
      await loadScript()
      if (!window.belvoSDK) throw new Error('SDK Belvo indisponível')
      window.belvoSDK.createWidget(access, {
        locale: 'pt',
        country_codes: ['BR'],
        callback: (link: string, institution: string) => { void retrieve(link, institution) },
        onExit: () => setLoading(false),
        onEvent: () => {},
      }).build()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao conectar')
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 880, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--navy)', margin: 0 }}>Integrações bancárias</h1>
        <p style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: 4 }}>
          Em breve: novas integrações para conectar seus bancos e importar saldos, transações e faturas automaticamente.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={conectar} disabled={loading} className="btn-action" style={{ borderRadius: 8, padding: '10px 18px' }}>
          {loading ? 'Conectando…' : '+ Conectar banco'}
        </button>
        <label style={{ fontSize: 12, color: 'var(--gray-500)' }}>
          Período:{' '}
          <select value={periodoDias} onChange={e => setPeriodoDias(Number(e.target.value))} className="form-input" style={{ padding: '6px 10px', borderRadius: 8 }}>
            {PERIODOS.map(p => <option key={p.dias} value={p.dias}>{p.label}</option>)}
          </select>
        </label>
        {transacoes.length > 0 && (
          <button onClick={sincronizar} disabled={sincronizando} className="btn-action btn-ghost" style={{ borderRadius: 8, padding: '10px 16px' }}>
            {sincronizando ? 'Importando…' : 'Importar para o FactorOne'}
          </button>
        )}
      </div>

      {okSync && <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: 'rgba(45,155,111,.1)', color: '#2D9B6F', fontSize: 13 }}>{okSync}</div>}
      {status && <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: '#EFF6F5', color: 'var(--navy)', fontSize: 13 }}>{status}</div>}
      {erro && <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: '#FEE2E2', color: '#991B1B', fontSize: 13 }}>{erro}</div>}

      <div id="belvo" style={{ marginTop: 16 }} />

      {links.length === 0 && contas.length === 0 && transacoes.length === 0 && !status && (
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: '32px 20px', marginTop: 16, textAlign: 'center' }}>
          <ConnectBank width={240} />
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginTop: 8 }}>Novas integrações em breve</div>
          <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 4 }}>Estamos preparando conexões automáticas com o seu banco. Muito em breve por aqui.</div>
        </div>
      )}

      {contas.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>Contas</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {contas.map(c => {
              const isCard = (c.categoria || '').toUpperCase().includes('CREDIT')
              return (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 10, padding: '12px 16px' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>{c.nome || c.categoria || 'Conta'}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{[c.instituicao, c.numero, c.tipo].filter(Boolean).join(' · ') || '—'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>{fmtBRL(c.saldo, c.moeda)}</div>
                    {isCard && c.limite_credito != null && (
                      <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>Limite: {fmtBRL(c.limite_credito, c.moeda)}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {faturas.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>Faturas de cartão</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {faturas.map(f => (
              <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 10, padding: '12px 16px' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>{f.nome || 'Fatura'}</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>
                    {[f.vencimento && `vence ${f.vencimento}`, f.status].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>{fmtBRL(f.total, f.moeda)}</div>
                  {f.minimo != null && <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>mín. {fmtBRL(f.minimo, f.moeda)}</div>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {transacoes.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>
            Transações <span style={{ color: 'var(--gray-400)', fontWeight: 500 }}>({transacoes.length})</span>
          </h2>
          <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 10, overflow: 'hidden' }}>
            {transacoes.map(t => {
              const outflow = (t.tipo || '').toUpperCase() === 'OUTFLOW' || (t.valor ?? 0) < 0
              return (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--gray-50, #f3f4f6)' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--navy)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t.descricao || t.estabelecimento || '—'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{[t.data, t.categoria, t.conta].filter(Boolean).join(' · ')}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: outflow ? '#C0504A' : '#2D9B6F', whiteSpace: 'nowrap', marginLeft: 12 }}>
                    {fmtBRL(t.valor, t.moeda)}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {links.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>Bancos conectados</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {links.map(l => (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--gray-500)', background: 'var(--gray-50, #f9fafb)', borderRadius: 8, padding: '8px 12px' }}>
                <span>{l.institution || l.link_id}</span>
                <span>{new Date(l.created_at).toLocaleDateString('pt-BR')}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
