'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type Site = { nome: string | null; slogan: string | null; ramo: string | null; template: string; cor: string; sobre: string | null; servicos: string[]; whatsapp: string | null; email: string | null; telefone: string | null }

export default function SitePublico() {
  const { slug } = useParams<{ slug: string }>()
  const [site, setSite] = useState<Site | null>(null)
  const [token, setToken] = useState('')
  const [erro, setErro] = useState('')
  const [form, setForm] = useState({ nome: '', email: '', telefone: '', mensagem: '' })
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    void (async () => {
      try { const r = await fetch(`/api/site/public/${slug}`); if (!r.ok) { setErro('Site não encontrado.'); return } const j = await r.json(); setSite(j.site as Site); setToken(j.token as string) }
      catch { setErro('Falha ao carregar.') }
    })()
  }, [slug])

  async function enviar(e: React.FormEvent) {
    e.preventDefault(); if (!form.nome.trim()) return; setEnviando(true)
    try { await fetch(`/api/inbound?token=${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, origem: `Site — ${site?.nome ?? ''}` }) }); setEnviado(true) }
    catch { /* ignore */ } finally { setEnviando(false) }
  }

  if (erro) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Nunito, sans-serif', color: '#64748b' }}>{erro}</div>
  if (!site) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: 24, color: '#94a3b8' }} /></div>

  const cor = site.cor || '#3D7A6E'
  const dark = site.template === 'bold'
  const heroBg = dark ? '#13201D' : site.template === 'elegante' ? `linear-gradient(135deg, ${cor}, #13201D)` : '#F7FAF8'
  const heroText = dark || site.template === 'elegante' ? '#fff' : '#13201D'
  const btn: React.CSSProperties = { background: cor, color: '#fff', border: 'none', borderRadius: 10, padding: '13px 26px', fontSize: 15, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }

  return (
    <div style={{ fontFamily: 'Nunito, system-ui, sans-serif', color: '#1e293b', background: '#fff' }}>
      {/* Nav */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 28px', position: 'sticky', top: 0, background: 'rgba(255,255,255,.9)', backdropFilter: 'blur(8px)', zIndex: 10, borderBottom: '1px solid #eef2f0' }}>
        <div style={{ fontSize: 19, fontWeight: 800, color: cor }}>{site.nome}</div>
        <a href="#contato" style={{ ...btn, padding: '9px 18px', fontSize: 13 }}>Fale com a gente</a>
      </nav>

      {/* Hero */}
      <section style={{ background: heroBg, color: heroText, padding: '90px 28px', textAlign: 'center' }}>
        {site.ramo && <div style={{ display: 'inline-block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: dark || site.template === 'elegante' ? 'rgba(255,255,255,.7)' : cor, marginBottom: 16 }}>{site.ramo}</div>}
        <h1 style={{ fontSize: 46, fontWeight: 900, margin: '0 0 16px', letterSpacing: '-.02em', lineHeight: 1.05 }}>{site.nome}</h1>
        {site.slogan && <p style={{ fontSize: 19, maxWidth: 560, margin: '0 auto 28px', opacity: .82, lineHeight: 1.5 }}>{site.slogan}</p>}
        <a href="#contato" style={btn}>Solicitar orçamento</a>
      </section>

      {/* Sobre */}
      {site.sobre && (
        <section style={{ padding: '64px 28px', maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 16, color: '#13201D' }}>Sobre</h2>
          <p style={{ fontSize: 16, lineHeight: 1.7, color: '#475569' }}>{site.sobre}</p>
        </section>
      )}

      {/* Serviços */}
      {site.servicos.length > 0 && (
        <section style={{ padding: '48px 28px', background: '#F7FAF8' }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, textAlign: 'center', marginBottom: 32, color: '#13201D' }}>O que oferecemos</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16, maxWidth: 900, margin: '0 auto' }}>
            {site.servicos.map((s, i) => (
              <div key={i} style={{ background: '#fff', border: '1px solid #eef2f0', borderRadius: 14, padding: '22px', textAlign: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${cor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}><i className="fa-solid fa-check" style={{ color: cor, fontSize: 18 }} /></div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#13201D' }}>{s}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Contato */}
      <section id="contato" style={{ padding: '64px 28px', maxWidth: 520, margin: '0 auto' }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, textAlign: 'center', marginBottom: 8, color: '#13201D' }}>Fale com a gente</h2>
        <p style={{ textAlign: 'center', color: '#64748b', marginBottom: 24 }}>Deixe seus dados que retornamos rapidinho.</p>
        {enviado ? (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: cor, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}><i className="fa-solid fa-check" style={{ color: '#fff', fontSize: 24 }} /></div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#13201D' }}>Recebido! ✅</div>
            <div style={{ fontSize: 14, color: '#64748b', marginTop: 6 }}>Obrigado, {form.nome.split(' ')[0]}. Em breve entramos em contato.</div>
          </div>
        ) : (
          <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input placeholder="Seu nome" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required style={inp} />
            <input placeholder="E-mail" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inp} />
            <input placeholder="Telefone / WhatsApp" value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} style={inp} />
            <textarea placeholder="Mensagem" rows={3} value={form.mensagem} onChange={e => setForm(f => ({ ...f, mensagem: e.target.value }))} style={{ ...inp, resize: 'vertical' }} />
            <button type="submit" disabled={enviando || !form.nome.trim()} style={{ ...btn, width: '100%', opacity: enviando ? .6 : 1 }}>{enviando ? 'Enviando…' : 'Enviar'}</button>
          </form>
        )}
        <div style={{ display: 'flex', gap: 18, justifyContent: 'center', marginTop: 22, flexWrap: 'wrap', fontSize: 13, color: '#475569' }}>
          {site.whatsapp && <a href={`https://wa.me/${site.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={{ color: cor, textDecoration: 'none', fontWeight: 600 }}><i className="fa-brands fa-whatsapp" style={{ marginRight: 5 }} />{site.whatsapp}</a>}
          {site.telefone && <span><i className="fa-solid fa-phone" style={{ marginRight: 5 }} />{site.telefone}</span>}
          {site.email && <span><i className="fa-solid fa-envelope" style={{ marginRight: 5 }} />{site.email}</span>}
        </div>
      </section>

      <footer style={{ padding: '24px', textAlign: 'center', borderTop: '1px solid #eef2f0', fontSize: 12, color: '#94a3b8' }}>
        © {new Date().getFullYear()} {site.nome} · feito com Factor<span style={{ color: cor }}>One</span>
      </footer>
    </div>
  )
}

const inp: React.CSSProperties = { width: '100%', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 15, fontFamily: 'inherit', outline: 'none' }
