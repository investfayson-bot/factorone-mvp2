'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const FEATURES = [
  'CFO Inteligente com IA em tempo real',
  'DRE e fluxo de caixa automáticos',
  'Reconhecimento de NF por foto ou upload',
  'Abertura de conta PJ e captação',
  'Conciliação bancária automática',
]

export default function AuthPage() {
  const [modo, setModo] = useState<'entrar' | 'cadastrar'>('entrar')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState({ text: '', type: '' })
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMsg({ text: '', type: '' })
    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
        if (error) throw error
        router.push('/onboarding')
      } else {
        const { error } = await supabase.auth.signUp({ email, password: senha })
        if (error) throw error
        setMsg({ text: 'Conta criada! Verifique seu email para confirmar.', type: 'success' })
      }
    } catch (err: unknown) {
      const msgs: Record<string, string> = {
        'Invalid login credentials': 'Email ou senha incorretos',
        'Email not confirmed': 'Confirme seu email antes de entrar',
        'User already registered': 'Email já cadastrado. Faça login.',
        'Password should be at least 6 characters': 'Senha: mínimo 6 caracteres',
      }
      const raw = err instanceof Error ? err.message : String(err)
      setMsg({ text: msgs[raw] ?? raw, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  async function usarDemo() {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email: 'demo@factorone.com.br', password: 'demo123456' })
    if (!error) router.push('/onboarding')
    else setMsg({ text: 'Conta demo não encontrada. Crie uma conta primeiro.', type: 'error' })
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--cream)' }}>
      {/* Left panel — brand */}
      <div style={{ width: 400, minWidth: 400, background: 'var(--navy)', display: 'flex', flexDirection: 'column', padding: '36px 32px' }}>
        <div style={{ marginBottom: 'auto' }}>
          <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-.04em', marginBottom: 40 }}>
            Factor<span style={{ color: 'var(--teal)' }}>One</span>
          </div>
          <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 26, fontWeight: 800, color: '#fff', lineHeight: 1.25, marginBottom: 14 }}>
            Finance OS<br />com Inteligência<br />Artificial
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', lineHeight: 1.65, marginBottom: 36 }}>
            Automatizando a gestão financeira das empresas modernas.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {FEATURES.map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ color: 'var(--teal)', fontSize: 13, fontWeight: 700, marginTop: 1, flexShrink: 0 }}>✓</span>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,.65)', lineHeight: 1.4 }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,.2)', fontFamily: "'DM Mono',monospace", marginTop: 32 }}>
          FACTORONE · FINANCE OS v2
        </div>
      </div>

      {/* Right panel — form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: 400, maxWidth: '100%', border: '1px solid var(--gray-100)', boxShadow: '0 4px 32px rgba(0,0,0,.07)' }}>
          {/* Tab switcher */}
          <div style={{ display: 'flex', background: 'var(--cream)', borderRadius: 10, padding: 4, gap: 4, marginBottom: 28 }}>
            {(['entrar', 'cadastrar'] as const).map(m => (
              <button
                key={m}
                onClick={() => { setModo(m); setMsg({ text: '', type: '' }) }}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 7, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, fontFamily: "'Inter',sans-serif",
                  background: modo === m ? '#fff' : 'transparent',
                  color: modo === m ? 'var(--navy)' : 'var(--gray-400)',
                  boxShadow: modo === m ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
                  transition: 'all .15s',
                }}
              >
                {m === 'entrar' ? 'Entrar' : 'Criar conta'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                autoComplete="email"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Senha</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  className="form-input"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
                  style={{ paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', fontSize: 12 }}
                >
                  {mostrarSenha ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {msg.text && (
              <div style={{
                padding: '9px 12px', borderRadius: 8, fontSize: 12, marginBottom: 12,
                background: msg.type === 'success' ? 'rgba(45,155,111,.08)' : 'rgba(192,80,74,.08)',
                border: `1px solid ${msg.type === 'success' ? 'rgba(45,155,111,.2)' : 'rgba(192,80,74,.2)'}`,
                color: msg.type === 'success' ? 'var(--green)' : 'var(--red)',
              }}>
                {msg.text}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-action"
              style={{ width: '100%', padding: '11px 0', fontSize: 13, marginBottom: 10, opacity: loading ? .6 : 1 }}
            >
              {loading ? 'Aguarde…' : modo === 'entrar' ? 'Entrar no painel' : 'Criar conta'}
            </button>
          </form>

          <button
            onClick={usarDemo}
            disabled={loading}
            className="btn-action btn-ghost"
            style={{ width: '100%', padding: '10px 0', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            ⚡ Usar conta demo
          </button>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--gray-100)', textAlign: 'center', fontSize: 11, color: 'var(--gray-400)' }}>
            Ao continuar você concorda com os{' '}
            <span style={{ color: 'var(--teal)', cursor: 'pointer' }}>Termos de Uso</span>
          </div>
        </div>
      </div>
    </div>
  )
}
