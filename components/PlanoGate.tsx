'use client'
import { useRouter } from 'next/navigation'
import { usePlano } from '@/hooks/usePlano'

interface PlanoGateProps {
  children: React.ReactNode
  feature?: string
}

export default function PlanoGate({ children, feature = 'esta funcionalidade' }: PlanoGateProps) {
  const { isPlus, loading } = usePlano()
  const router = useRouter()

  if (loading) return <>{children}</>
  if (isPlus) return <>{children}</>

  return (
    <div style={{ position: 'relative', minHeight: 400 }}>
      {/* Conteúdo desfocado */}
      <div style={{ filter: 'blur(4px)', pointerEvents: 'none', userSelect: 'none', opacity: 0.4 }}>
        {children}
      </div>
      {/* Overlay */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: '36px 40px', textAlign: 'center', boxShadow: '0 8px 40px rgba(0,0,0,.12)', border: '1px solid var(--gray-100)', maxWidth: 380 }}>
          <div style={{ width: 52, height: 52, background: 'linear-gradient(135deg, #7A6A9E, #9F5AF7)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <i className="fa-solid fa-star" style={{ color: '#fff', fontSize: 20 }} />
          </div>
          <div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 18, fontWeight: 800, color: 'var(--navy)', marginBottom: 8 }}>
            Funcionalidade Pro
          </div>
          <div style={{ fontSize: 13, color: 'var(--gray-400)', lineHeight: 1.7, marginBottom: 24 }}>
            <strong style={{ color: 'var(--navy)' }}>{feature}</strong> está disponível a partir do plano Pro. Faça upgrade para desbloquear CRM, Logística, Marketing e muito mais.
          </div>
          <button
            className="btn-action"
            style={{ width: '100%', padding: '11px 0', fontSize: 13, background: 'linear-gradient(135deg, #7A6A9E, #9F5AF7)', border: 'none' }}
            onClick={() => router.push('/dashboard/planos')}
          >
            <i className="fa-solid fa-arrow-up" style={{ marginRight: 8 }} />
            Ver planos e preços
          </button>
          <button className="btn-action btn-ghost" style={{ width: '100%', marginTop: 8, fontSize: 12 }} onClick={() => router.back()}>
            Voltar
          </button>
        </div>
      </div>
    </div>
  )
}
