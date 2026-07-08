'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

type Tab = 'senhas' | 'chaves'

type ItemCofre = { id: string; rotulo: string; nota: string | null; created_at: string }
type ChaveApi = { provider: string; mascarado: string; updated_at: string }

const PROVIDERS: { id: string; nome: string; desc: string; obterChave: string }[] = [
  { id: 'openai', nome: 'OpenAI', desc: 'GPT, embeddings, geração de imagem.', obterChave: 'https://platform.openai.com/api-keys' },
  { id: 'anthropic', nome: 'Anthropic (Claude)', desc: 'Modelo Claude direto.', obterChave: 'https://console.anthropic.com/settings/keys' },
  { id: 'openrouter', nome: 'OpenRouter', desc: 'Gateway multi-modelo.', obterChave: 'https://openrouter.ai/keys' },
  { id: 'tavily', nome: 'Tavily', desc: 'Busca web em tempo real.', obterChave: 'https://app.tavily.com/' },
  { id: 'resend', nome: 'Resend', desc: 'Envio de e-mail.', obterChave: 'https://resend.com/api-keys' },
]

export default function CofrePage() {
  const [tab, setTab] = useState<Tab>('senhas')
  const [token, setToken] = useState('')

  // Cofre pessoal
  const [itens, setItens] = useState<ItemCofre[]>([])
  const [rotulo, setRotulo] = useState('')
  const [valor, setValor] = useState('')
  const [nota, setNota] = useState('')
  const [revelados, setRevelados] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  // Chaves de API
  const [chaves, setChaves] = useState<Record<string, ChaveApi>>({})
  const [editando, setEditando] = useState<string | null>(null)
  const [novaChave, setNovaChave] = useState('')

  useEffect(() => {
    void (async () => {
      const { data: sess } = await supabase.auth.getSession()
      const tk = sess.session?.access_token ?? ''
      setToken(tk)
      await Promise.all([carregarItens(tk), carregarChaves(tk)])
    })()
  }, [])

  async function carregarItens(tk: string) {
    try {
      const r = await fetch('/api/cofre', { headers: tk ? { Authorization: `Bearer ${tk}` } : {} })
      const j = await r.json()
      if (r.ok) setItens(j.itens ?? [])
    } catch { /* ignore */ }
  }

  async function carregarChaves(tk: string) {
    try {
      const r = await fetch('/api/cofre/keys', { headers: tk ? { Authorization: `Bearer ${tk}` } : {} })
      const j = await r.json()
      if (r.ok) {
        const map: Record<string, ChaveApi> = {}
        for (const c of (j.itens ?? []) as ChaveApi[]) map[c.provider] = c
        setChaves(map)
      }
    } catch { /* ignore */ }
  }

  async function guardar() {
    if (!rotulo.trim() || !valor.trim()) { toast.error('Informe rótulo e valor'); return }
    setBusy(true)
    try {
      const r = await fetch('/api/cofre', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ rotulo, valor, nota: nota || undefined }),
      })
      if (!r.ok) throw new Error((await r.json()).error || 'Falha ao guardar')
      setRotulo(''); setValor(''); setNota('')
      await carregarItens(token)
      toast.success('Guardado no cofre')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro') }
    finally { setBusy(false) }
  }

  async function revelar(id: string) {
    if (revelados[id]) { setRevelados(r => { const n = { ...r }; delete n[id]; return n }); return }
    try {
      const r = await fetch(`/api/cofre/${id}`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {} })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Falha ao revelar')
      setRevelados(prev => ({ ...prev, [id]: j.valor }))
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro') }
  }

  async function excluir(id: string) {
    if (!window.confirm('Excluir este item do cofre?')) return
    try {
      const r = await fetch(`/api/cofre/${id}`, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (!r.ok) throw new Error('Falha ao excluir')
      setItens(prev => prev.filter(i => i.id !== id))
      toast.success('Removido')
    } catch { toast.error('Não consegui excluir') }
  }

  async function salvarChave(providerId: string) {
    if (!novaChave.trim()) { toast.error('Cole a chave antes de salvar'); return }
    setBusy(true)
    try {
      const r = await fetch('/api/cofre/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ provider: providerId, valor: novaChave }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Falha ao salvar')
      setChaves(prev => ({ ...prev, [providerId]: { provider: providerId, mascarado: j.mascarado, updated_at: new Date().toISOString() } }))
      setEditando(null); setNovaChave('')
      toast.success('Chave salva no cofre')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro') }
    finally { setBusy(false) }
  }

  async function removerChave(providerId: string) {
    if (!window.confirm('Remover esta chave do cofre?')) return
    try {
      const r = await fetch(`/api/cofre/keys/${providerId}`, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (!r.ok) throw new Error('Falha ao remover')
      setChaves(prev => { const n = { ...prev }; delete n[providerId]; return n })
      toast.success('Chave removida')
    } catch { toast.error('Não consegui remover') }
  }

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Cofre</div>
          <div className="page-sub">Senhas e chaves de API criptografadas (AES-256). Só você vê o valor — clique em &quot;Revelar&quot; quando precisar.</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
        {([['senhas', 'Cofre pessoal'], ['chaves', 'Chaves de API']] as [Tab, string][]).map(([k, l]) => (
          <button key={k} className={`btn-action${tab !== k ? ' btn-ghost' : ''}`} style={{ fontSize: 13, padding: '5px 12px' }} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'senhas' && (
        <>
          <div className="txs-card" style={{ padding: 18, marginBottom: 16 }}>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Rótulo</label><input className="form-input" placeholder="Ex: Twilio recovery code" value={rotulo} onChange={e => setRotulo(e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Valor</label><input className="form-input" type="password" placeholder="Senha / código" value={valor} onChange={e => setValor(e.target.value)} /></div>
            </div>
            <div className="form-group"><label className="form-label">Nota (opcional)</label><input className="form-input" placeholder="Alguma referência que te ajude a lembrar" value={nota} onChange={e => setNota(e.target.value)} /></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-action" style={{ fontSize: 14 }} disabled={busy} onClick={() => void guardar()}>Guardar no cofre</button>
            </div>
          </div>

          {itens.length === 0 ? (
            <div className="txs-card" style={{ padding: 44, textAlign: 'center', color: 'var(--ink-mut)', fontSize: 15 }}>
              Cofre vazio. Guarde sua 1ª senha acima.
            </div>
          ) : (
            <div className="txs-card">
              {itens.map((it, i) => (
                <div key={it.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'center', padding: '12px 18px', borderBottom: i < itens.length - 1 ? '1px solid var(--line-soft)' : 'none' }}>
                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>{it.rotulo}</div>
                    {it.nota && <div style={{ fontSize: 13, color: 'var(--ink-mut)' }}>{it.nota}</div>}
                  </div>
                  <div style={{ fontSize: 14.5, fontFamily: 'var(--font-mono)', color: revelados[it.id] ? 'var(--ink)' : 'var(--ink-faint)' }}>
                    {revelados[it.id] ?? '••••••••••••'}
                  </div>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button className="btn-ghost" style={{ fontSize: 13, padding: '6px 10px' }} onClick={() => void revelar(it.id)}>{revelados[it.id] ? 'Ocultar' : 'Revelar'}</button>
                    <button className="btn-ghost" style={{ fontSize: 13, padding: '6px 10px', color: '#B0413E', borderColor: '#B0413E' }} onClick={() => void excluir(it.id)}><i className="fa-solid fa-trash-can" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'chaves' && (
        <>
          <div style={{ fontSize: 14, color: 'var(--ink-mut)', marginBottom: 14, lineHeight: 1.6 }}>
            Cole sua própria chave de API aqui — ela é guardada criptografada e nunca volta pro navegador em texto puro.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
            {PROVIDERS.map(p => {
              const salva = chaves[p.id]
              const abrindo = editando === p.id
              return (
                <div key={p.id} className="txs-card" style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{p.nome}</div>
                    {salva ? (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'var(--sage-tint)', color: 'var(--sage-deep)' }}>conectado</span>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'var(--line-soft)', color: 'var(--ink-mut)' }}>não conectada</span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink-mut)', marginBottom: 10 }}>{p.desc}</div>
                  {salva && !abrindo && (
                    <div style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: 'var(--ink-soft)', marginBottom: 10 }}>{salva.mascarado}</div>
                  )}
                  {abrindo ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input className="form-input" style={{ fontSize: 13 }} type="password" placeholder="Cole a chave" value={novaChave} onChange={e => setNovaChave(e.target.value)} autoFocus />
                      <button className="btn-action" style={{ fontSize: 13, padding: '6px 10px', whiteSpace: 'nowrap' }} disabled={busy} onClick={() => void salvarChave(p.id)}>Salvar</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button className="btn-ghost" style={{ fontSize: 13, padding: '5px 10px' }} onClick={() => { setEditando(p.id); setNovaChave('') }}>{salva ? 'Trocar' : 'Conectar'}</button>
                      {salva && <button className="btn-ghost" style={{ fontSize: 13, padding: '5px 10px', color: '#B0413E', borderColor: '#B0413E' }} onClick={() => void removerChave(p.id)}>Remover</button>}
                      <a href={p.obterChave} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: 'var(--sage-deep)', marginLeft: 'auto' }}>obter chave →</a>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}
