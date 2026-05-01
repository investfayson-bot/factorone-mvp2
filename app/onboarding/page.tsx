'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

type TipoPerfil = 'empresarial' | 'pessoal'

const FEAT_EMP = ['Gestão financeira completa', 'NF-e / DRE automático', 'Cartões corporativos', 'Módulo fiscal & contador', 'AI CFO em tempo real']
const FEAT_PES = ['Controle de gastos', 'Contas a pagar/receber', 'Orçamento mensal', 'Onde vai meu dinheiro', 'Assinaturas e fixos']

export default function OnboardingPage() {
  const [loading, setLoading] = useState<TipoPerfil | null>(null)
  const router = useRouter()

  async function selecionar(tipo: TipoPerfil) {
    setLoading(tipo)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      const { error } = await supabase.from('perfil_usuario').upsert({ user_id: user.id, tipo }, { onConflict: 'user_id' })
      if (error) throw error
      toast.success(`Modo ${tipo === 'empresarial' ? 'Empresarial' : 'Pessoal'} configurado`)
      router.push(tipo === 'empresarial' ? '/dashboard' : '/dashboard-pessoal')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar seu perfil')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      {/* Logo */}
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 24, fontWeight: 800, color: 'var(--navy)', letterSpacing: '-.04em', marginBottom: 8 }}>
          Factor<span style={{ color: 'var(--teal)' }}>One</span>
        </div>
        <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 18, fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>
          Como você quer usar a FactorOne?
        </div>
        <div style={{ fontSize: 11, color: 'var(--gray-400)', fontFamily: "'DM Mono',monospace" }}>
          Escolha seu modo principal — você pode alterar depois.
        </div>
      </div>

      {/* Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, width: '100%', maxWidth: 680 }}>
        {/* Empresarial */}
        <div style={{ background: '#fff', border: '2px solid var(--teal)', borderRadius: 12, padding: '22px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
          <div style={{ width: 40, height: 40, background: 'var(--teal)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <i className="fa-solid fa-building" style={{ color: '#fff', fontSize: 16 }} />
          </div>
          <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>Empresarial</div>
          <div style={{ fontSize: 11, color: 'var(--gray-400)', fontFamily: "'DM Mono',monospace", marginBottom: 16 }}>Para PMEs e empresas</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 20 }}>
            {FEAT_EMP.map(f => (
              <div key={f} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--gray-500)' }}>
                <span style={{ color: 'var(--teal)', fontWeight: 700, flexShrink: 0 }}>✓</span> {f}
              </div>
            ))}
          </div>
          <button
            className="btn-action"
            style={{ width: '100%', padding: '10px 0', fontSize: 13, opacity: loading !== null ? .6 : 1 }}
            onClick={() => selecionar('empresarial')}
            disabled={loading !== null}
          >
            {loading === 'empresarial' ? 'Salvando…' : 'Começar como Empresa'}
          </button>
        </div>

        {/* Pessoal */}
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: '22px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
          <div style={{ width: 40, height: 40, background: 'var(--gray-100)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <i className="fa-solid fa-user" style={{ color: 'var(--gray-500)', fontSize: 16 }} />
          </div>
          <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>Pessoa Física</div>
          <div style={{ fontSize: 11, color: 'var(--gray-400)', fontFamily: "'DM Mono',monospace", marginBottom: 16 }}>Para finanças pessoais</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 20 }}>
            {FEAT_PES.map(f => (
              <div key={f} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--gray-500)' }}>
                <span style={{ color: 'var(--gray-400)', fontWeight: 700, flexShrink: 0 }}>·</span> {f}
              </div>
            ))}
          </div>
          <button
            className="btn-action btn-ghost"
            style={{ width: '100%', padding: '10px 0', fontSize: 13, opacity: loading !== null ? .6 : 1 }}
            onClick={() => selecionar('pessoal')}
            disabled={loading !== null}
          >
            {loading === 'pessoal' ? 'Salvando…' : 'Começar como Pessoa'}
          </button>
        </div>
      </div>
    </div>
  )
}
