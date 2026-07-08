'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const RAMOS = [
  { nome: 'Alimentação', icon: 'fa-utensils' }, { nome: 'Serviços', icon: 'fa-briefcase' },
  { nome: 'Saúde', icon: 'fa-heart-pulse' }, { nome: 'Imóveis', icon: 'fa-building' },
  { nome: 'Beleza', icon: 'fa-scissors' }, { nome: 'Fitness', icon: 'fa-dumbbell' },
  { nome: 'Jurídico', icon: 'fa-scale-balanced' }, { nome: 'Educação', icon: 'fa-graduation-cap' },
  { nome: 'Tecnologia', icon: 'fa-microchip' }, { nome: 'Ecommerce', icon: 'fa-bag-shopping' },
  { nome: 'Construção', icon: 'fa-helmet-safety' }, { nome: 'Outro', icon: 'fa-star' },
]
const TEMPLATES = [
  { id: 'moderno', nome: 'Moderno', desc: 'Claro, limpo, direto', bg: '#F7FAF8', fg: '#13201D' },
  { id: 'bold', nome: 'Bold', desc: 'Escuro e marcante', bg: '#13201D', fg: '#fff' },
  { id: 'elegante', nome: 'Elegante', desc: 'Gradiente sofisticado', bg: 'linear-gradient(135deg,#3D7A6E,#13201D)', fg: '#fff' },
]
const CORES = ['#3D7A6E', '#3D6E8E', '#7A6A9E', '#B0413E', '#B08A3E', '#13201D', '#BE185D', '#0E7490']

export default function GerarSitePage() {
  const [step, setStep] = useState(1)
  const [f, setF] = useState({ ramo: '', nome: '', slogan: '', template: 'moderno', cor: '#3D7A6E', sobre: '', servicos: [] as string[], whatsapp: '', email: '', telefone: '' })
  const [novoServ, setNovoServ] = useState('')
  const [token, setToken] = useState('')
  const [origin, setOrigin] = useState('')
  const [slug, setSlug] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    setOrigin(window.location.origin)
    void (async () => {
      const { data: sess } = await supabase.auth.getSession(); const tk = sess.session?.access_token ?? ''; setToken(tk)
      try { const r = await fetch('/api/site', { headers: tk ? { Authorization: `Bearer ${tk}` } : {} }); const j = await r.json(); if (j.ok && j.site) { const s = j.site; setF({ ramo: s.ramo ?? '', nome: s.nome ?? '', slogan: s.slogan ?? '', template: s.template ?? 'moderno', cor: s.cor ?? '#3D7A6E', sobre: s.sobre ?? '', servicos: s.servicos ?? [], whatsapp: s.whatsapp ?? '', email: s.email ?? '', telefone: s.telefone ?? '' }); setSlug(s.slug) } } catch { /* ignore */ }
    })()
  }, [])

  async function publicar() {
    if (!f.nome.trim()) { toast.error('Dê um nome ao site'); return }
    setSalvando(true)
    try {
      const r = await fetch('/api/site', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(f) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Falha')
      setSlug(j.slug); setStep(6); toast.success('Site no ar! 🎉')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro') }
    finally { setSalvando(false) }
  }

  const url = slug ? `${origin}/site/${slug}` : ''
  const podeAvancar = step === 1 ? !!f.ramo : step === 2 ? !!f.nome.trim() : true

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="page-hdr">
        <div>
          <div className="page-title">Gere seu site</div>
          <div className="page-sub">5 passos e seu site está no ar — já com formulário que captura cliente.</div>
        </div>
        <Link href="/dashboard/marketing/central" className="btn-ghost" style={{ fontSize: 14, textDecoration: 'none' }}>Voltar</Link>
      </div>

      {step < 6 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {[1, 2, 3, 4, 5].map(n => <div key={n} style={{ flex: 1, height: 5, borderRadius: 3, background: n <= step ? 'var(--sage)' : 'var(--line)' }} />)}
        </div>
      )}

      <div className="txs-card" style={{ padding: '24px' }}>
        {step === 1 && (<>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700, marginBottom: 6 }}>Qual o ramo do seu negócio?</div>
          <div style={{ fontSize: 15, color: 'var(--ink-mut)', marginBottom: 18 }}>A gente ajusta o site pro seu segmento.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 10 }}>
            {RAMOS.map(r => { const on = f.ramo === r.nome; return (
              <button key={r.nome} onClick={() => setF(s => ({ ...s, ramo: r.nome }))} style={{ padding: '16px 8px', borderRadius: 12, cursor: 'pointer', border: `1px solid ${on ? 'var(--sage)' : 'var(--line)'}`, background: on ? 'var(--sage-tint)' : 'var(--surface)', textAlign: 'center' }}>
                <i className={`fa-solid ${r.icon}`} style={{ fontSize: 20, color: on ? 'var(--sage-deep)' : 'var(--ink-mut)', display: 'block', marginBottom: 8 }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{r.nome}</span>
              </button>
            ) })}
          </div>
        </>)}

        {step === 2 && (<>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700, marginBottom: 6 }}>Nome e frase de impacto</div>
          <div style={{ fontSize: 15, color: 'var(--ink-mut)', marginBottom: 18 }}>É o que o cliente vê primeiro.</div>
          <div className="form-group"><label className="form-label">Nome do negócio</label><input className="form-input" value={f.nome} onChange={e => setF(s => ({ ...s, nome: e.target.value }))} placeholder="Ex: Padaria do João" autoFocus /></div>
          <div className="form-group"><label className="form-label">Slogan / frase</label><input className="form-input" value={f.slogan} onChange={e => setF(s => ({ ...s, slogan: e.target.value }))} placeholder="Ex: O melhor pão da cidade, todo dia fresquinho." /></div>
        </>)}

        {step === 3 && (<>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700, marginBottom: 6 }}>Escolha o estilo</div>
          <div style={{ fontSize: 15, color: 'var(--ink-mut)', marginBottom: 18 }}>3 modelos — mude quando quiser.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
            {TEMPLATES.map(t => { const on = f.template === t.id; return (
              <button key={t.id} onClick={() => setF(s => ({ ...s, template: t.id }))} style={{ padding: 0, borderRadius: 12, overflow: 'hidden', cursor: 'pointer', border: `2px solid ${on ? 'var(--sage)' : 'var(--line)'}`, background: 'var(--surface)' }}>
                <div style={{ height: 66, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.fg, fontWeight: 800, fontSize: 15 }}>Aa</div>
                <div style={{ padding: '8px 6px' }}><div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{t.nome}</div><div style={{ fontSize: 12, color: 'var(--ink-mut)' }}>{t.desc}</div></div>
              </button>
            ) })}
          </div>
          <label className="form-label">Cor principal</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {CORES.map(c => <button key={c} onClick={() => setF(s => ({ ...s, cor: c }))} style={{ width: 34, height: 34, borderRadius: '50%', background: c, cursor: 'pointer', border: f.cor === c ? '3px solid var(--ink)' : '2px solid var(--line)' }} />)}
          </div>
        </>)}

        {step === 4 && (<>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700, marginBottom: 6 }}>Sobre e serviços</div>
          <div style={{ fontSize: 15, color: 'var(--ink-mut)', marginBottom: 18 }}>Conte o que você faz.</div>
          <div className="form-group"><label className="form-label">Sobre o negócio</label><textarea className="form-input" rows={3} value={f.sobre} onChange={e => setF(s => ({ ...s, sobre: e.target.value }))} placeholder="Uma breve descrição…" style={{ resize: 'vertical' }} /></div>
          <label className="form-label">Serviços / produtos</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input className="form-input" value={novoServ} onChange={e => setNovoServ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && novoServ.trim()) { setF(s => ({ ...s, servicos: [...s.servicos, novoServ.trim()] })); setNovoServ('') } }} placeholder="Ex: Entrega em domicílio" />
            <button className="btn-ghost" style={{ fontSize: 14, flexShrink: 0 }} onClick={() => { if (novoServ.trim()) { setF(s => ({ ...s, servicos: [...s.servicos, novoServ.trim()] })); setNovoServ('') } }}>Adicionar</button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {f.servicos.map((sv, i) => <span key={i} style={{ fontSize: 14, background: 'var(--sage-tint)', color: 'var(--sage-deep)', padding: '5px 10px', borderRadius: 100, display: 'inline-flex', gap: 6, alignItems: 'center' }}>{sv}<i className="fa-solid fa-xmark" style={{ cursor: 'pointer' }} onClick={() => setF(s => ({ ...s, servicos: s.servicos.filter((_, j) => j !== i) }))} /></span>)}
          </div>
        </>)}

        {step === 5 && (<>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700, marginBottom: 6 }}>Contato</div>
          <div style={{ fontSize: 15, color: 'var(--ink-mut)', marginBottom: 18 }}>Como o cliente fala com você.</div>
          <div className="form-group"><label className="form-label">WhatsApp</label><input className="form-input" value={f.whatsapp} onChange={e => setF(s => ({ ...s, whatsapp: e.target.value }))} placeholder="(11) 99999-9999" /></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">E-mail</label><input className="form-input" value={f.email} onChange={e => setF(s => ({ ...s, email: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Telefone</label><input className="form-input" value={f.telefone} onChange={e => setF(s => ({ ...s, telefone: e.target.value }))} /></div>
          </div>
        </>)}

        {step === 6 && (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--sage)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><i className="fa-solid fa-check" style={{ color: '#fff', fontSize: 28 }} /></div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700 }}>Seu site está no ar! 🎉</div>
            <div style={{ fontSize: 15, color: 'var(--ink-mut)', margin: '8px 0 18px' }}>Compartilhe o link. Todo formulário preenchido vira lead na sua Captação.</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', maxWidth: 480, margin: '0 auto', flexWrap: 'wrap' }}>
              <code style={{ flex: 1, minWidth: 200, fontSize: 14, background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px', whiteSpace: 'nowrap', overflow: 'auto' }}>{url}</code>
              <button className="btn-action" style={{ fontSize: 14 }} onClick={() => { void navigator.clipboard.writeText(url); toast.success('Link copiado') }}>Copiar</button>
              <a href={url} target="_blank" rel="noreferrer" className="btn-ghost" style={{ fontSize: 14, textDecoration: 'none' }}>Abrir</a>
            </div>
            <button className="btn-ghost" style={{ fontSize: 14, marginTop: 16 }} onClick={() => setStep(1)}>Editar o site</button>
          </div>
        )}

        {step < 6 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
            <button className="btn-ghost" style={{ visibility: step > 1 ? 'visible' : 'hidden' }} onClick={() => setStep(s => s - 1)}>Voltar</button>
            {step < 5 ? (
              <button className="btn-action" disabled={!podeAvancar} onClick={() => setStep(s => s + 1)}>Continuar <i className="fa-solid fa-arrow-right" style={{ marginLeft: 6 }} /></button>
            ) : (
              <button className="btn-action" disabled={salvando} onClick={() => void publicar()}><i className="fa-solid fa-rocket" style={{ marginRight: 6 }} />{salvando ? 'Publicando…' : 'Publicar site'}</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
