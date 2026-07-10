'use client'

// Cockpit do Contador — o escritório contábil vê TODOS os clientes num lugar só.
// Consome /api/empresas (lista segura por user_id) e /api/empresas/trocar (valida
// membership antes de trocar). Não abre nenhuma query de dado nova: toda leitura
// de empresa passa pelos endpoints já auditados. O contador entra numa empresa e
// cai no dashboard dela com o contexto trocado no servidor.

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

type Empresa = { id: string; nome: string | null; cnpj: string | null; plano: string | null; papel: string; ativa: boolean }

function iniciais(nome: string | null): string {
  const s = (nome || '?').trim()
  const partes = s.split(/\s+/).filter(Boolean)
  return ((partes[0]?.[0] ?? '?') + (partes[1]?.[0] ?? '')).toUpperCase()
}

function fmtCnpj(cnpj: string | null): string {
  const d = (cnpj || '').replace(/\D/g, '')
  if (d.length !== 14) return cnpj || 'Sem CNPJ'
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

export default function EscritorioContadorPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [entrando, setEntrando] = useState<string | null>(null)

  async function auth() {
    const { data: sess } = await supabase.auth.getSession()
    const tk = sess.session?.access_token ?? ''
    return tk ? { Authorization: `Bearer ${tk}` } : {}
  }

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/empresas', { headers: await auth() })
      const j = await r.json()
      if (r.ok) setEmpresas(j.empresas ?? [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void carregar() }, [carregar])

  async function entrar(id: string, destino: string) {
    if (entrando) return
    setEntrando(id)
    try {
      const r = await fetch('/api/empresas/trocar', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await auth()) }, body: JSON.stringify({ empresa_id: id }) })
      if (!r.ok) throw new Error((await r.json()).error || 'Falha ao entrar na empresa')
      window.location.href = destino
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro'); setEntrando(null) }
  }

  // Clientes do escritório = onde o login é contador. Empresas próprias (admin) vão à parte.
  const clientes = useMemo(() => empresas.filter(e => e.papel === 'contador'), [empresas])
  const proprias = useMemo(() => empresas.filter(e => e.papel !== 'contador'), [empresas])
  const filtrar = useCallback((lista: Empresa[]) => {
    const q = busca.trim().toLowerCase()
    if (!q) return lista
    return lista.filter(e => (e.nome || '').toLowerCase().includes(q) || (e.cnpj || '').replace(/\D/g, '').includes(q.replace(/\D/g, '')))
  }, [busca])

  const clientesFiltrados = filtrar(clientes)
  const propriasFiltradas = filtrar(proprias)

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '4px 2px 40px' }}>
      {/* Faixa verde (mesma linguagem visual dos cards de destaque) */}
      <div style={{
        background: 'linear-gradient(135deg, #1C2E29 0%, #13201D 55%, #0F1918 100%)',
        borderRadius: 16, padding: '22px 26px', color: '#EAF5F3', marginBottom: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fa-solid fa-calculator" style={{ fontSize: 20, color: '#7FD1BE' }} />
          </div>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.01em' }}>Escritório Contábil</div>
            <div style={{ fontSize: 13.5, color: '#9FC3BB', marginTop: 2 }}>Todos os seus clientes num lugar só — entre em cada empresa com um clique.</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 30, fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{clientes.length}</div>
          <div style={{ fontSize: 12, color: '#9FC3BB', marginTop: 3 }}>cliente{clientes.length === 1 ? '' : 's'}</div>
        </div>
      </div>

      {/* Busca */}
      <div style={{ position: 'relative', marginBottom: 18 }}>
        <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-mut)', fontSize: 14 }} />
        <input
          className="form-input"
          style={{ paddingLeft: 38, height: 44 }}
          placeholder="Buscar cliente por nome ou CNPJ…"
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-mut)' }}>Carregando seus clientes…</div>
      ) : (
        <>
          {clientes.length === 0 && proprias.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <Secao titulo="Clientes" lista={clientesFiltrados} total={clientes.length} entrar={entrar} entrando={entrando} vazio="Nenhum cliente ainda. Peça ao seu cliente para te convidar como contador." />
              {proprias.length > 0 && (
                <Secao titulo="Minhas empresas" lista={propriasFiltradas} total={proprias.length} entrar={entrar} entrando={entrando} vazio="—" />
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

function Secao({ titulo, lista, total, entrar, entrando, vazio }: {
  titulo: string; lista: Empresa[]; total: number; vazio: string
  entrar: (id: string, destino: string) => void; entrando: string | null
}) {
  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-mut)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>
        {titulo} <span style={{ color: 'var(--sage-deep)' }}>· {total}</span>
      </div>
      {lista.length === 0 ? (
        <div style={{ padding: '18px 16px', fontSize: 14, color: 'var(--ink-mut)', background: 'var(--surface)', border: '1px dashed var(--line)', borderRadius: 12 }}>{vazio}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 12 }}>
          {lista.map(e => (
            <div key={e.id} style={{
              background: 'var(--surface)', border: `1px solid ${e.ativa ? 'var(--sage)' : 'var(--line)'}`, borderRadius: 14,
              padding: 16, boxShadow: 'var(--shadow-card)', display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 11, background: 'var(--sage-tint)', color: 'var(--sage-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, flexShrink: 0 }}>{iniciais(e.nome)}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.nome || 'Sem nome'}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-mut)', fontVariantNumeric: 'tabular-nums' }}>{fmtCnpj(e.cnpj)}</div>
                </div>
                {e.ativa && <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: 'var(--sage-deep)', background: 'var(--sage-tint)', padding: '3px 8px', borderRadius: 100, whiteSpace: 'nowrap' }}>ativa</span>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn-action"
                  style={{ flex: 1, fontSize: 13.5, padding: '9px 10px', opacity: entrando === e.id ? 0.6 : 1 }}
                  disabled={!!entrando}
                  onClick={() => entrar(e.id, '/dashboard/contabilidade')}
                >
                  {entrando === e.id ? 'Entrando…' : <><i className="fa-solid fa-arrow-right-to-bracket" style={{ marginRight: 6 }} />Abrir contabilidade</>}
                </button>
                <button
                  title="Ver DRE / exportar"
                  style={{ padding: '9px 12px', fontSize: 13.5, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', cursor: entrando ? 'default' : 'pointer' }}
                  disabled={!!entrando}
                  onClick={() => entrar(e.id, '/dashboard/relatorios')}
                >
                  <i className="fa-solid fa-chart-bar" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{ padding: '48px 20px', textAlign: 'center', background: 'var(--surface)', border: '1px dashed var(--line)', borderRadius: 14 }}>
      <i className="fa-solid fa-user-group" style={{ fontSize: 32, color: 'var(--sage)', marginBottom: 14 }} />
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Nenhuma empresa ainda</div>
      <div style={{ fontSize: 14, color: 'var(--ink-mut)', maxWidth: 420, margin: '0 auto' }}>
        Quando um cliente te convidar como contador, a empresa dele aparece aqui — e você acessa tudo com um clique, sem link solto por empresa.
      </div>
    </div>
  )
}
