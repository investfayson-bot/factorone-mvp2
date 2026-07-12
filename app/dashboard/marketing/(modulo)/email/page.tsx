'use client'

// E-mail Marketing (Fase 7, spec básica) — conteúdos tipo 'email' de
// marketing_conteudo como campanhas de e-mail. Taxas de abertura/clique
// dependem de provedor de disparo em massa (não existe) — colunas ficam
// "—" com nota honesta; criação usa o mesmo gerador IA adaptado.

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

type EmailMkt = { id: string; titulo: string; status: string; data_pub: string | null; copy: string | null }

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const t = data.session?.access_token
  return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) }
}

export default function EmailMarketingPage() {
  const [emails, setEmails] = useState<EmailMkt[]>([])
  const [loading, setLoading] = useState(true)
  const [prompt, setPrompt] = useState('')
  const [gerando, setGerando] = useState(false)

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const eid = (u?.empresa_id as string) ?? user.id
    const { data } = await supabase
      .from('marketing_conteudo')
      .select('id, titulo, status, data_pub, copy')
      .eq('empresa_id', eid).eq('tipo', 'email')
      .order('created_at', { ascending: false })
      .limit(50)
    setEmails((data as EmailMkt[]) ?? [])
    setLoading(false)
  }, [])
  useEffect(() => { void carregar() }, [carregar])

  async function gerarEmail() {
    if (!prompt.trim()) { toast.error('Descreve o assunto do e-mail'); return }
    setGerando(true)
    try {
      const r = await fetch('/api/marketing/gerar-conteudo', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ prompt: `E-mail marketing: ${prompt.trim()}` }) })
      const d = await r.json() as { sugestoes?: { titulo: string; copy: string }[]; error?: string }
      if (!r.ok || !d.sugestoes?.[0]) throw new Error(d.error || 'Falha ao gerar')
      const s = d.sugestoes[0]
      const r2 = await fetch('/api/marketing/gerar-conteudo', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ agendar: { tipo: 'email', titulo: s.titulo, copy: s.copy } }) })
      if (!r2.ok) throw new Error('Falha ao salvar rascunho')
      toast.success('Rascunho de e-mail criado pela IA')
      setPrompt('')
      void carregar()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro') }
    finally { setGerando(false) }
  }

  return (
    <div style={{ maxWidth: 860, paddingBottom: 30 }}>
      <div className="gen" style={{ marginBottom: 14 }}>
        <span className="tag">FACTORONE AI</span>
        <h3>Gerar e-mail marketing</h3>
        <input className="gen-input" placeholder="Ex: e-mail de lançamento do plano anual com 20% off" value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void gerarEmail() }} />
        <div className="actions">
          <button className="solid" disabled={gerando} onClick={() => void gerarEmail()}>{gerando ? 'Gerando…' : 'Gerar rascunho'}</button>
        </div>
      </div>

      <div className="card-v2" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 0.8fr 0.8fr 1fr', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--line)', fontSize: 10.5, fontWeight: 800, color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
          <span>Assunto</span><span>Envio</span><span style={{ textAlign: 'right' }}>Abertura</span><span style={{ textAlign: 'right' }}>Clique</span><span>Status</span>
        </div>
        {loading ? (
          <div style={{ padding: '26px 16px', textAlign: 'center', color: 'var(--mut)', fontSize: 13 }}>Carregando…</div>
        ) : emails.length === 0 ? (
          <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--mut)', fontSize: 13 }}>Nenhum e-mail ainda — gere o primeiro com a IA acima.</div>
        ) : emails.map(e => (
          <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 0.8fr 0.8fr 1fr', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--line)', fontSize: 12.5, alignItems: 'center' }}>
            <span style={{ fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.copy ?? ''}>{e.titulo}</span>
            <span style={{ color: 'var(--mut)', fontWeight: 600 }}>{e.data_pub ? new Date(e.data_pub + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</span>
            <span style={{ textAlign: 'right', color: 'var(--mut2)' }}>—</span>
            <span style={{ textAlign: 'right', color: 'var(--mut2)' }}>—</span>
            <span><span className={`chip-v2 ${e.status === 'publicado' ? 'g' : e.status === 'agendado' ? 'y' : ''}`}>{e.status}</span></span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 8 }}>
        Taxas de abertura/clique exigem provedor de disparo em massa (roadmap) — por enquanto os rascunhos servem pra enviar pela sua ferramenta atual.
      </div>
    </div>
  )
}
