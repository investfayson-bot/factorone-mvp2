'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'

type Status = {
  ads: { meta: boolean; google: boolean; tiktok: boolean }
  ecommerce: { nuvemshop: boolean; mercadolivre: boolean; shopify: boolean }
}

const ADS = [
  { key: 'meta', nome: 'Meta Ads', desc: 'Facebook e Instagram', icon: 'fa-facebook', cor: '#1877F2' },
  { key: 'google', nome: 'Google Ads', desc: 'Search, Display, YouTube', icon: 'fa-google', cor: '#4285F4' },
  { key: 'tiktok', nome: 'TikTok Ads', desc: 'Vídeo e criativos virais', icon: 'fa-tiktok', cor: '#111' },
] as const

const ECOM = [
  { key: 'nuvemshop', nome: 'Nuvemshop', desc: 'Sua loja Nuvemshop', icon: 'fa-store', cor: '#2D6CDF' },
  { key: 'mercadolivre', nome: 'Mercado Livre', desc: 'Anúncios e vendas ML', icon: 'fa-bag-shopping', cor: '#FFE600', dark: true },
  { key: 'shopify', nome: 'Shopify', desc: 'Loja Shopify', icon: 'fa-shopify', cor: '#95BF47' },
] as const

function ConnectCard({ nome, desc, icon, cor, dark, on }: { nome: string; desc: string; icon: string; cor: string; dark?: boolean; on: boolean }) {
  return (
    <div style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 14, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: cor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <i className={`fa-brands ${icon}`} style={{ fontSize: 18, color: dark ? '#13201D' : '#fff' }} />
        </div>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#13201D' }}>{nome}</div>
          <div style={{ fontSize: 11, color: '#7B8C88' }}>{desc}</div>
        </div>
      </div>
      <button
        onClick={() => on ? undefined : toast('Conexão via OAuth entra quando a chave da API estiver configurada.', { icon: '🔌' })}
        disabled={on}
        style={{ fontSize: 12, fontWeight: 700, padding: '8px', borderRadius: 9, border: 'none', cursor: on ? 'default' : 'pointer', background: on ? '#E9F0ED' : '#13201D', color: on ? '#2B564D' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
      >
        {on ? (<><i className="fa-solid fa-circle-check" />Conectado</>) : (<><i className="fa-solid fa-link" />Conectar</>)}
      </button>
    </div>
  )
}

export default function MarketingCentralPage() {
  const [st, setSt] = useState<Status | null>(null)
  useEffect(() => { fetch('/api/marketing/status').then(r => r.json()).then(setSt).catch(() => {}) }, [])

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Marketing</div>
          <div className="page-sub">Anúncios · ecommerce · sites — tudo integrado às suas finanças</div>
        </div>
        <Link href="/dashboard/marketing" className="btn-ghost" style={{ fontSize: 12, textDecoration: 'none' }}>
          <i className="fa-solid fa-bullhorn" style={{ marginRight: 6 }} />Campanhas
        </Link>
      </div>

      {/* Ações principais — convidativo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { t: 'Crie sua campanha', d: 'Anúncio com investido, receita e ROAS medidos de verdade.', ic: 'fa-bullhorn', href: '/dashboard/marketing', cta: 'Nova campanha' },
          { t: 'Gere seu site', d: 'Mini-quiz de 5 passos → site no ar com formulário que captura cliente.', ic: 'fa-wand-magic-sparkles', href: '/dashboard/marketing/site', cta: 'Gerar site', destaque: true },
          { t: 'Capte leads', d: 'Plugue qualquer ferramenta e veja o lead virar receita.', ic: 'fa-magnet', href: '/dashboard/captacao', cta: 'Abrir Captação' },
        ].map(a => (
          <Link key={a.t} href={a.href} style={{ textDecoration: 'none' }}>
            <div className="txs-card" style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', gap: 8, border: a.destaque ? '1px solid var(--sage)' : undefined, boxShadow: 'var(--shadow-card)' }}>
              <div style={{ width: 42, height: 42, borderRadius: 11, background: 'var(--sage-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className={`fa-solid ${a.ic}`} style={{ fontSize: 17, color: 'var(--sage-deep)' }} /></div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{a.t}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-mut)', lineHeight: 1.5, flex: 1 }}>{a.d}</div>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--sage-deep)' }}>{a.cta} →</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Conexões — secundário (não na frente) */}
      <details>
        <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--ink-mut)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 12, listStyle: 'none' }}>
          <i className="fa-solid fa-chevron-right" style={{ fontSize: 10, marginRight: 8 }} />Conexões · anúncios & ecommerce (opcional)
        </summary>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
          {ADS.map(a => <ConnectCard key={a.key} nome={a.nome} desc={a.desc} icon={a.icon} cor={a.cor} on={!!st?.ads[a.key]} />)}
          {ECOM.map(e => <ConnectCard key={e.key} nome={e.nome} desc={e.desc} icon={e.icon} cor={e.cor} dark={'dark' in e ? e.dark : false} on={!!st?.ecommerce[e.key]} />)}
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-faint)', lineHeight: 1.6 }}>Conectam via OAuth do provedor quando a chave de API estiver configurada — ou plugue tudo pelo webhook da Captação.</div>
      </details>
    </>
  )
}
