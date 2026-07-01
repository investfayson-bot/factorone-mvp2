'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { appById } from '@/lib/marketplace'

export default function AppPlaceholderPage() {
  const params = useParams()
  const id = String(params.id || '')
  const app = appById(id)

  return (
    <div style={{ maxWidth: 560, margin: '40px auto 0', textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: 16, background: app?.iconBg ?? 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
        <i className={`fa-solid ${app?.icon ?? 'fa-cube'}`} style={{ color: app?.iconColor ?? 'var(--gray-500)', fontSize: 26 }} />
      </div>
      <h1 style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 22, fontWeight: 800, color: 'var(--navy)', marginBottom: 6 }}>
        {app?.name ?? 'Aplicativo'}
      </h1>
      <p style={{ fontSize: 13, color: 'var(--gray-500)', lineHeight: 1.6, marginBottom: 22 }}>
        {app?.desc ?? 'Este aplicativo está instalado.'}
        <br />A tela completa deste módulo está em construção.
      </p>
      <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, color: '#7C3AED', background: 'rgba(124,58,237,.1)', padding: '4px 12px', borderRadius: 20, marginBottom: 24 }}>
        EM BREVE
      </span>
      <div>
        <Link href="/dashboard/marketplace" style={{ fontSize: 13, color: 'var(--teal)', textDecoration: 'none' }}>
          <i className="fa-solid fa-arrow-left" style={{ marginRight: 6 }} />Voltar ao Marketplace
        </Link>
      </div>
    </div>
  )
}
