'use client'

import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

type Empresa = { id: string; nome: string | null; cnpj: string | null; plano: string | null; papel: string; ativa: boolean }

export default function CompanySwitcher({ nome, iniciais, onSair }: { nome: string; iniciais: string; onSair: () => void }) {
  const [aberto, setAberto] = useState(false)
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(false)
  const [trocando, setTrocando] = useState(false)
  const [novaNome, setNovaNome] = useState('')
  const [mostrarNova, setMostrarNova] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickFora(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) { setAberto(false); setMostrarNova(false) } }
    document.addEventListener('mousedown', onClickFora)
    return () => document.removeEventListener('mousedown', onClickFora)
  }, [])

  async function auth() {
    const { data: sess } = await supabase.auth.getSession()
    const tk = sess.session?.access_token ?? ''
    return tk ? { Authorization: `Bearer ${tk}` } : {}
  }

  async function abrir() {
    setAberto(v => !v)
    if (aberto) return
    setLoading(true)
    try {
      const r = await fetch('/api/empresas', { headers: await auth() })
      const j = await r.json()
      if (r.ok) setEmpresas(j.empresas ?? [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  async function trocar(id: string) {
    if (trocando) return
    setTrocando(true)
    try {
      const r = await fetch('/api/empresas/trocar', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await auth()) }, body: JSON.stringify({ empresa_id: id }) })
      if (!r.ok) throw new Error((await r.json()).error || 'Falha ao trocar')
      window.location.reload()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro'); setTrocando(false) }
  }

  async function criarEmpresa() {
    if (!novaNome.trim()) { toast.error('Dê um nome pra empresa'); return }
    setTrocando(true)
    try {
      const r = await fetch('/api/empresas', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await auth()) }, body: JSON.stringify({ nome: novaNome }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Falha ao criar empresa')
      await trocar(j.empresa.id)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro'); setTrocando(false) }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div className="sb-co" onClick={() => void abrir()} title="Trocar de empresa">
        <div className="sb-co-av">{iniciais}</div>
        <div>
          <div className="sb-co-name" style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome || 'Conta'}</div>
          <div className="sb-co-plan">Trocar empresa <i className="fa-solid fa-chevron-up" style={{ fontSize: 8, marginLeft: 3 }} /></div>
        </div>
      </div>

      {aberto && (
        <div style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: 8, width: 260, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, boxShadow: 'var(--shadow-pop)', overflow: 'hidden', zIndex: 200 }}>
          <div style={{ padding: '8px 12px', fontSize: 10, fontWeight: 700, color: 'var(--ink-mut)', textTransform: 'uppercase', letterSpacing: '.08em', borderBottom: '1px solid var(--line-soft)' }}>Suas empresas</div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 16, fontSize: 12, color: 'var(--ink-mut)', textAlign: 'center' }}>Carregando…</div>
            ) : empresas.length === 0 ? (
              <div style={{ padding: 16, fontSize: 12, color: 'var(--ink-mut)', textAlign: 'center' }}>Nenhuma empresa encontrada.</div>
            ) : empresas.map(e => (
              <div key={e.id} onClick={() => !e.ativa && void trocar(e.id)} style={{
                padding: '9px 12px', cursor: e.ativa ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: e.ativa ? 'var(--sage-tint)' : 'transparent', opacity: trocando ? 0.6 : 1,
              }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.nome || 'Sem nome'}</span>
                {e.ativa && <i className="fa-solid fa-circle-check" style={{ color: 'var(--sage-deep)', fontSize: 11 }} />}
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid var(--line-soft)' }}>
            {mostrarNova ? (
              <div style={{ padding: 10, display: 'flex', gap: 6 }}>
                <input className="form-input" style={{ fontSize: 11, padding: '6px 8px' }} placeholder="Nome da empresa" value={novaNome} onChange={e => setNovaNome(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter') void criarEmpresa() }} />
                <button className="btn-action" style={{ fontSize: 11, padding: '6px 10px', whiteSpace: 'nowrap' }} disabled={trocando} onClick={() => void criarEmpresa()}>Criar</button>
              </div>
            ) : (
              <button onClick={() => setMostrarNova(true)} style={{ width: '100%', textAlign: 'left', padding: '9px 12px', fontSize: 12, color: 'var(--sage-deep)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
                <i className="fa-solid fa-plus" style={{ marginRight: 6 }} />Nova empresa
              </button>
            )}
            <button onClick={onSair} style={{ width: '100%', textAlign: 'left', padding: '9px 12px', fontSize: 12, color: 'var(--ink-mut)', background: 'none', border: 'none', borderTop: '1px solid var(--line-soft)', cursor: 'pointer' }}>
              <i className="fa-solid fa-arrow-right-from-bracket" style={{ marginRight: 6 }} />Sair
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
