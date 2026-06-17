'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Conta = {
  id: string
  nome: string | null
  numero: string | null
  categoria: string | null
  tipo: string | null
  saldo: number | null
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
type Link = { id: string; link_id: string; institution: string | null; created_at: string }

// Tipagem mínima do SDK do widget Belvo (carregado via CDN)
type BelvoSDK = {
  createWidget: (
    accessToken: string,
    config: Record<string, unknown>
  ) => { build: () => void }
}
declare global {
  interface Window { belvoSDK?: BelvoSDK }
}

const WIDGET_SRC = 'https://cdn.belvo.io/belvo-widget-1-stable.js'

function fmtBRL(v: number | null, moeda: string | null) {
  if (v == null) return '—'
  try {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: moeda || 'BRL' })
  } catch { return `${v}` }
}

export default function ConexoesPage() {
  const [loading, setLoading] = useState(false)
  const [contas, setContas] = useState<Conta[]>([])
  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [links, setLinks] = useState<Link[]>([])
  const [erro, setErro] = useState('')
  const [status, setStatus] = useState('')

  const authHeaders = useCallback(async () => {
    const { data: sess } = await supabase.auth.getSession()
    return {
      'Content-Type': 'application/json',
      ...(sess.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {}),
    }
  }, [])

  const carregarLinks = useCallback(async () => {
    const headers = await authHeaders()
    const res = await fetch('/api/belvo/accounts', { headers })
    const d = await res.json()
    if (res.ok) setLinks(d.links ?? [])
  }, [authHeaders])

  useEffect(() => { void carregarLinks() }, [carregarLinks])

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
      setStatus('Buscando contas…')
      const resC = await fetch('/api/belvo/accounts', {
        method: 'POST', headers, body: JSON.stringify({ link, institution }),
      })
      const dC = await resC.json()
      if (!resC.ok) throw new Error(dC.error || 'Falha ao buscar contas')
      setContas(dC.contas ?? [])

      setStatus('Buscando transações (últimos 90 dias)…')
      const resT = await fetch('/api/belvo/transactions', {
        method: 'POST', headers, body: JSON.stringify({ link }),
      })
      const dT = await resT.json()
      if (!resT.ok) throw new Error(dT.error || 'Falha ao buscar transações')
      setTransacoes(dT.transacoes ?? [])

      setStatus('')
      void carregarLinks()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao buscar dados')
      setStatus('')
    } finally {
      setLoading(false)
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
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--navy)', margin: 0 }}>Conexões bancárias</h1>
        <p style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: 4 }}>
          Conecte uma conta via Open Finance (Belvo) para importar saldos e contas.
        </p>
      </div>

      <button onClick={conectar} disabled={loading} className="btn-action" style={{ borderRadius: 8, padding: '10px 18px' }}>
        {loading ? 'Conectando…' : '+ Conectar banco'}
      </button>

      {status && (
        <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: '#EFF6F5', color: 'var(--navy)', fontSize: 13 }}>
          {status}
        </div>
      )}

      {erro && (
        <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: '#FEE2E2', color: '#991B1B', fontSize: 13 }}>
          {erro}
        </div>
      )}

      {/* Container onde o widget Belvo é montado */}
      <div id="belvo" style={{ marginTop: 16 }} />

      {contas.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>Contas encontradas</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {contas.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 10, padding: '12px 16px' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>{c.nome || c.categoria || 'Conta'}</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{[c.instituicao, c.numero, c.tipo].filter(Boolean).join(' · ') || '—'}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>{fmtBRL(c.saldo, c.moeda)}</div>
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
                    <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>
                      {[t.data, t.categoria, t.conta].filter(Boolean).join(' · ')}
                    </div>
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
