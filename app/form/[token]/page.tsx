'use client'
import { useState } from 'react'
import { useParams } from 'next/navigation'

// Formulário de captura hospedado. Posta no webhook universal (/api/inbound).
// Pode ser aberto direto ou embutido via <iframe> no site do cliente.
export default function FormPage() {
  const { token } = useParams<{ token: string }>()
  const [form, setForm] = useState({ nome: '', email: '', telefone: '', mensagem: '' })
  const [enviando, setEnviando] = useState(false)
  const [pronto, setPronto] = useState(false)
  const [erro, setErro] = useState('')

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome.trim()) return
    setEnviando(true); setErro('')
    try {
      const r = await fetch(`/api/inbound?token=${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, origem: 'Formulário' }) })
      if (!r.ok) { setErro('Não foi possível enviar. Tente de novo.'); setEnviando(false); return }
      setPronto(true)
    } catch { setErro('Falha de conexão.'); setEnviando(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', fontFamily: 'var(--font-sans)', color: 'var(--ink)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px' }}>
      <div style={{ width: '100%', maxWidth: 440, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
        <div style={{ background: 'var(--sidebar-bg, #16352E)', padding: '18px 24px', color: '#fff', fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700 }}>Fale com a gente</div>
        <div style={{ padding: '24px' }}>
          {pronto ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--sage)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}><i className="fa-solid fa-check" style={{ color: '#fff', fontSize: 24 }} /></div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>Recebido! ✅</div>
              <div style={{ fontSize: 15, color: 'var(--ink-mut)', marginTop: 6 }}>Obrigado. Em breve entramos em contato.</div>
            </div>
          ) : (
            <form onSubmit={enviar}>
              <div className="form-group"><label className="form-label">Nome</label><input className="form-input" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required /></div>
              <div className="form-group"><label className="form-label">E-mail</label><input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Telefone / WhatsApp</label><input className="form-input" value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Mensagem</label><textarea className="form-input" rows={3} value={form.mensagem} onChange={e => setForm(f => ({ ...f, mensagem: e.target.value }))} style={{ resize: 'vertical' }} /></div>
              {erro && <div style={{ fontSize: 14, color: 'var(--brick)', marginBottom: 10 }}>{erro}</div>}
              <button className="btn-action" style={{ width: '100%', padding: '12px 0', fontSize: 14 }} disabled={enviando || !form.nome.trim()}>{enviando ? 'Enviando…' : 'Enviar'}</button>
            </form>
          )}
          <div style={{ fontSize: 12, color: 'var(--ink-faint)', textAlign: 'center', marginTop: 16 }}>powered by Factor<span style={{ color: 'var(--sage)' }}>One</span></div>
        </div>
      </div>
    </div>
  )
}
