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

const TEMPLATES = [
  { nome: 'Restaurante & Delivery', ramo: 'Alimentação', g: 'linear-gradient(135deg,#E74C3C,#D97706)', icon: 'fa-utensils' },
  { nome: 'Loja Online', ramo: 'Ecommerce', g: 'linear-gradient(135deg,#7C3AED,#2563eb)', icon: 'fa-bag-shopping' },
  { nome: 'Consultoria & Serviços', ramo: 'Serviços', g: 'linear-gradient(135deg,#1C2B2A,#5E8C87)', icon: 'fa-briefcase' },
  { nome: 'Clínica & Saúde', ramo: 'Saúde', g: 'linear-gradient(135deg,#16A085,#2D9B6F)', icon: 'fa-heart-pulse' },
  { nome: 'Imobiliária', ramo: 'Imóveis', g: 'linear-gradient(135deg,#0E7490,#2563eb)', icon: 'fa-building' },
  { nome: 'Tech & SaaS', ramo: 'Tecnologia', g: 'linear-gradient(135deg,#1C2B2A,#7C3AED)', icon: 'fa-microchip' },
  { nome: 'Beleza & Estética', ramo: 'Beleza', g: 'linear-gradient(135deg,#BE185D,#7C3AED)', icon: 'fa-scissors' },
  { nome: 'Academia & Fitness', ramo: 'Fitness', g: 'linear-gradient(135deg,#D97706,#E74C3C)', icon: 'fa-dumbbell' },
  { nome: 'Advocacia', ramo: 'Jurídico', g: 'linear-gradient(135deg,#1C2B2A,#243736)', icon: 'fa-scale-balanced' },
  { nome: 'Educação & Cursos', ramo: 'Educação', g: 'linear-gradient(135deg,#2563eb,#16A085)', icon: 'fa-graduation-cap' },
]

function ConnectCard({ nome, desc, icon, cor, dark, on }: { nome: string; desc: string; icon: string; cor: string; dark?: boolean; on: boolean }) {
  return (
    <div style={{ background: '#fff', border: '0.5px solid #E2E8E7', borderRadius: 14, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: cor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <i className={`fa-brands ${icon}`} style={{ fontSize: 18, color: dark ? '#1C2B2A' : '#fff' }} />
        </div>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1C2B2A' }}>{nome}</div>
          <div style={{ fontSize: 11, color: '#7A8F8E' }}>{desc}</div>
        </div>
      </div>
      <button
        onClick={() => on ? undefined : toast('Conexão via OAuth entra quando a chave da API estiver configurada.', { icon: '🔌' })}
        disabled={on}
        style={{ fontSize: 12, fontWeight: 700, padding: '8px', borderRadius: 9, border: 'none', cursor: on ? 'default' : 'pointer', background: on ? '#EAF5F3' : '#1C2B2A', color: on ? '#0F6E56' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
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

      {/* Banner */}
      <div style={{ background: 'linear-gradient(135deg,#1C2B2A,#243736)', borderRadius: 16, padding: '22px 26px', marginBottom: 22, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: '-.02em' }}>Central de Marketing</div>
          <div style={{ fontSize: 13, color: '#7EBDB8', marginTop: 4 }}>Conecte seus anúncios e loja, meça o ROI real e publique sites em minutos.</div>
        </div>
      </div>

      {/* Canais de anúncio */}
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 10 }}>Canais de anúncio</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, marginBottom: 24 }}>
        {ADS.map(a => <ConnectCard key={a.key} nome={a.nome} desc={a.desc} icon={a.icon} cor={a.cor} on={!!st?.ads[a.key]} />)}
      </div>

      {/* Ecommerce */}
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 10 }}>Ecommerce</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, marginBottom: 24 }}>
        {ECOM.map(e => <ConnectCard key={e.key} nome={e.nome} desc={e.desc} icon={e.icon} cor={e.cor} dark={'dark' in e ? e.dark : false} on={!!st?.ecommerce[e.key]} />)}
      </div>

      {/* Templates de site por ramo */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Sites & landing pages · por ramo</div>
        <span style={{ fontSize: 11, color: '#7A8F8E' }}>escolha um modelo e publique</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 12 }}>
        {TEMPLATES.map(t => (
          <button key={t.nome} onClick={() => toast('Editor de site em breve — o template abre pra personalizar e publicar.', { icon: '🎨' })} style={{ padding: 0, border: '0.5px solid #E2E8E7', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', background: '#fff', textAlign: 'left' }}>
            <div style={{ height: 110, background: t.g, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className={`fa-solid ${t.icon}`} style={{ fontSize: 30, color: 'rgba(255,255,255,.9)' }} />
              <div style={{ position: 'absolute', top: 8, right: 8, fontSize: 9, fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,.25)', padding: '2px 8px', borderRadius: 20 }}>{t.ramo}</div>
            </div>
            <div style={{ padding: '11px 14px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1C2B2A' }}>{t.nome}</div>
              <div style={{ fontSize: 11, color: '#5E8C87', fontWeight: 600, marginTop: 3 }}><i className="fa-solid fa-wand-magic-sparkles" style={{ marginRight: 5 }} />Usar template</div>
            </div>
          </button>
        ))}
      </div>

      <div style={{ fontSize: 11, color: '#AAB8B7', marginTop: 16, lineHeight: 1.6 }}>
        <i className="fa-solid fa-circle-info" style={{ color: '#5E8C87', marginRight: 6 }} />
        Ads e ecommerce conectam via OAuth do provedor quando as chaves de API estiverem configuradas. Os templates de site abrem no editor (em construção) pra personalizar e publicar.
      </div>
    </>
  )
}
