'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AceitarConvitePage({ params }: { params: Promise<{ token: string }> }) {
  const [estado, setEstado] = useState<'loading' | 'login' | 'aceitando' | 'sucesso' | 'erro'>('loading')
  const [msg, setMsg] = useState('')
  const [token, setToken] = useState('')
  const [convite, setConvite] = useState<{ email: string; role: string; nome: string | null } | null>(null)
  const [loginForm, setLoginForm] = useState({ email: '', senha: '' })
  const [loginLoading, setLoginLoading] = useState(false)
  const router = useRouter()

  async function verificar(tk: string) {
    const { data } = await supabase.from('membros_equipe').select('email,role,nome,status,expires_at').eq('token', tk).maybeSingle()
    if (!data) { setEstado('erro'); setMsg('Convite inválido ou expirado.'); return }
    if (data.status === 'ativo') { setEstado('sucesso'); setMsg('Este convite já foi aceito.'); return }
    if (data.expires_at && new Date(data.expires_at) < new Date()) { setEstado('erro'); setMsg('Este convite expirou.'); return }
    setConvite(data as { email: string; role: string; nome: string | null })

    // Check if already logged in
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await aceitar(tk)
    } else {
      setLoginForm(f => ({ ...f, email: data.email ?? '' }))
      setEstado('login')
    }
  }

  async function aceitar(tk: string) {
    setEstado('aceitando')
    try {
      const { data: sess } = await supabase.auth.getSession()
      const token = sess.session?.access_token ?? ''
      const r = await fetch('/api/equipe/aceitar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ token: tk }),
      })
      if (!r.ok) { const j = await r.json().catch(() => ({})); setEstado('erro'); setMsg(j.error || 'Falha ao aceitar o convite.'); return }
    } catch { setEstado('erro'); setMsg('Falha ao aceitar o convite.'); return }
    setEstado('sucesso')
    setTimeout(() => router.push('/dashboard'), 2000)
  }

  useEffect(() => {
    params.then(p => {
      setToken(p.token)
      void verificar(p.token)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fazerLogin() {
    setLoginLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email: loginForm.email, password: loginForm.senha })
    if (error || !data.user) {
      // Try sign up
      const { data: d2, error: e2 } = await supabase.auth.signUp({ email: loginForm.email, password: loginForm.senha })
      if (e2 || !d2.user) { setLoginLoading(false); alert('Erro ao autenticar: ' + (e2?.message ?? error?.message)); return }
      await aceitar(token)
    } else {
      await aceitar(token)
    }
    setLoginLoading(false)
  }

  const ROLES: Record<string, string> = { admin: 'Admin', financeiro: 'Financeiro', comercial: 'Comercial', operacional: 'Operacional', logistica: 'Logística', viewer: 'Visualizador' }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,.08)', padding: '40px 36px', maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#0d1b2a', marginBottom: 24 }}>
          Factor<span style={{ color: 'var(--teal)' }}>One</span>
        </div>

        {estado === 'loading' && (
          <div style={{ color: '#94a3b8' }}><i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 28, marginBottom: 12, display: 'block' }} />Verificando convite...</div>
        )}

        {estado === 'aceitando' && (
          <div style={{ color: '#94a3b8' }}><i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 28, marginBottom: 12, display: 'block' }} />Configurando acesso...</div>
        )}

        {estado === 'sucesso' && (
          <div>
            <i className="fa-solid fa-circle-check" style={{ fontSize: 52, color: '#3D7A6E', marginBottom: 16, display: 'block' }} />
            <h2 style={{ color: '#0d1b2a', marginBottom: 8 }}>Acesso confirmado!</h2>
            <p style={{ color: '#64748b', fontSize: 14 }}>{msg || 'Bem-vindo à equipe. Redirecionando para o dashboard...'}</p>
          </div>
        )}

        {estado === 'erro' && (
          <div>
            <i className="fa-solid fa-circle-xmark" style={{ fontSize: 52, color: '#B0413E', marginBottom: 16, display: 'block' }} />
            <h2 style={{ color: '#0d1b2a', marginBottom: 8 }}>Convite inválido</h2>
            <p style={{ color: '#64748b', fontSize: 14 }}>{msg}</p>
          </div>
        )}

        {estado === 'login' && convite && (
          <div style={{ textAlign: 'left' }}>
            <h2 style={{ color: '#0d1b2a', marginBottom: 8, textAlign: 'center' }}>Aceitar convite</h2>
            <p style={{ color: '#64748b', fontSize: 13, textAlign: 'center', marginBottom: 20 }}>
              Você foi convidado como <strong>{ROLES[convite.role] ?? convite.role}</strong>. Entre ou crie uma conta para aceitar.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>E-mail</label>
                <input
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}
                  value={loginForm.email}
                  onChange={e => setLoginForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Senha</label>
                <input
                  type="password"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}
                  value={loginForm.senha}
                  onChange={e => setLoginForm(f => ({ ...f, senha: e.target.value }))}
                  placeholder="Crie uma senha ou entre com a existente"
                />
              </div>
              <button
                onClick={fazerLogin}
                disabled={loginLoading}
                style={{ background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontWeight: 700, fontSize: 14, cursor: 'pointer', marginTop: 4 }}
              >
                {loginLoading ? 'Entrando...' : 'Aceitar convite'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
