'use client'
export const dynamic = 'force-dynamic'
import React, { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nome, setNome] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [modo, setModo] = useState<'login'|'cadastro'>('login')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const sb = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data, error } = await sb.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error('Email ou senha incorretos')
      setLoading(false)
      return
    }
    if (data.user) {
      toast.success('Bem-vindo!')
      window.location.href = '/dashboard'
    }
  }

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault()
    if (!nome || !empresa) { toast.error('Preencha nome e empresa'); return }
    setLoading(true)
    const { data, error } = await sb.auth.signUp({
      email, password,
      options: { data: { nome, empresa_nome: empresa } }
    })
    if (error) { toast.error(error.message); setLoading(false); return }
    if (data.user) {
      try {
        const { data: emp } = await sb.from('empresas')
          .insert({ nome: empresa, plano: 'trial', plano_ativo: true })
          .select().single()

        if (emp) {
          await sb.from('usuarios').insert({
            id: data.user.id, empresa_id: emp.id, nome, email, papel: 'admin'
          })
          await sb.from('metricas').insert({ empresa_id: emp.id })
          // Cash flow de demo
          await sb.from('cashflow').insert([
            { empresa_id: emp.id, mes: 'Jan/26', entradas: 180000, saidas: 140000 },
            { empresa_id: emp.id, mes: 'Fev/26', entradas: 220000, saidas: 165000 },
            { empresa_id: emp.id, mes: 'Mar/26', entradas: 265000, saidas: 178000 },
            { empresa_id: emp.id, mes: 'Abr/26', entradas: 290000, saidas: 185000, projetado: true },
            { empresa_id: emp.id, mes: 'Mai/26', entradas: 320000, saidas: 192000, projetado: true },
          ])
        }
        toast.success('Conta criada! Redirecionando...')
        window.location.href = '/dashboard'
      } catch (err) {
        console.error(err)
        window.location.href = '/dashboard'
      }
    }
    setLoading(false)
  }

  function usarDemo() {
    setEmail('demo@factorone.com.br')
    setPassword('demo123456')
    setModo('login')
    toast('Clique em "Entrar" para usar a conta demo', { icon: '💡' })
  }

  return (
    <div style={{ minHeight:'100vh', background:'#F8FAF9', display:'flex', alignItems:'center', justifyContent:'center', padding:16, fontFamily:'Inter,sans-serif' }}>
      <div style={{ width:'100%', maxWidth:420 }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:10, marginBottom:20 }}>
            <div style={{ width:36, height:36, background:'#C8F135', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:14, color:'#000', fontFamily:'Sora,sans-serif' }}>F1</div>
            <span style={{ fontSize:22, fontWeight:800, color:'#1C2B2A', fontFamily:'Sora,sans-serif', letterSpacing:'-.03em' }}>FactorOne</span>
          </div>
          <h1 style={{ fontSize:24, fontWeight:700, color:'#1C2B2A', fontFamily:'Sora,sans-serif', margin:'0 0 6px' }}>
            {modo === 'login' ? 'Bem-vindo de volta' : 'Criar sua conta'}
          </h1>
          <p style={{ fontSize:14, color:'#6B7280', margin:0 }}>
            {modo === 'login' ? 'Entre no painel financeiro' : '14 dias grátis, sem cartão'}
          </p>
        </div>

        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E5E7EB', padding:32, boxShadow:'0 1px 8px rgba(0,0,0,.06)' }}>
          {/* Tabs */}
          <div style={{ display:'flex', background:'#F3F4F6', borderRadius:10, padding:4, marginBottom:24, gap:4 }}>
            {(['login','cadastro'] as const).map(m => (
              <button key={m} onClick={() => setModo(m)}
                style={{ flex:1, padding:'9px 0', fontSize:13, fontWeight:modo===m?700:500, borderRadius:7, border:'none', cursor:'pointer', transition:'all .15s', background:modo===m?'#fff':'transparent', color:modo===m?'#1C2B2A':'#6B7280', boxShadow:modo===m?'0 1px 4px rgba(0,0,0,.1)':'none' }}>
                {m === 'login' ? 'Entrar' : 'Criar conta'}
              </button>
            ))}
          </div>

          <form onSubmit={modo === 'login' ? handleLogin : handleCadastro}>
            {modo === 'cadastro' && (
              <>
                <div style={{ marginBottom:14 }}>
                  <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:6, textTransform:'uppercase', letterSpacing:'.05em' }}>Seu nome</label>
                  <input value={nome} onChange={e=>setNome(e.target.value)} required placeholder="João Silva"
                    style={{ width:'100%', padding:'11px 14px', borderRadius:9, border:'1.5px solid #E5E7EB', fontSize:14, color:'#1C2B2A', outline:'none', boxSizing:'border-box', transition:'border-color .15s', fontFamily:'Inter,sans-serif' }}
                    onFocus={e=>e.target.style.borderColor='#0055FF'} onBlur={e=>e.target.style.borderColor='#E5E7EB'} />
                </div>
                <div style={{ marginBottom:14 }}>
                  <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:6, textTransform:'uppercase', letterSpacing:'.05em' }}>Nome da empresa</label>
                  <input value={empresa} onChange={e=>setEmpresa(e.target.value)} required placeholder="Minha Empresa Ltda"
                    style={{ width:'100%', padding:'11px 14px', borderRadius:9, border:'1.5px solid #E5E7EB', fontSize:14, color:'#1C2B2A', outline:'none', boxSizing:'border-box', transition:'border-color .15s', fontFamily:'Inter,sans-serif' }}
                    onFocus={e=>e.target.style.borderColor='#0055FF'} onBlur={e=>e.target.style.borderColor='#E5E7EB'} />
                </div>
              </>
            )}

            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:6, textTransform:'uppercase', letterSpacing:'.05em' }}>Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="joao@empresa.com.br"
                style={{ width:'100%', padding:'11px 14px', borderRadius:9, border:'1.5px solid #E5E7EB', fontSize:14, color:'#1C2B2A', outline:'none', boxSizing:'border-box', transition:'border-color .15s', fontFamily:'Inter,sans-serif' }}
                onFocus={e=>e.target.style.borderColor='#0055FF'} onBlur={e=>e.target.style.borderColor='#E5E7EB'} />
            </div>

            <div style={{ marginBottom:22 }}>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:6, textTransform:'uppercase', letterSpacing:'.05em' }}>Senha</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6} placeholder="Mínimo 6 caracteres"
                style={{ width:'100%', padding:'11px 14px', borderRadius:9, border:'1.5px solid #E5E7EB', fontSize:14, color:'#1C2B2A', outline:'none', boxSizing:'border-box', transition:'border-color .15s', fontFamily:'Inter,sans-serif' }}
                onFocus={e=>e.target.style.borderColor='#0055FF'} onBlur={e=>e.target.style.borderColor='#E5E7EB'} />
            </div>

            <button type="submit" disabled={loading}
              style={{ width:'100%', padding:'13px', borderRadius:10, border:'none', background:'#1C2B2A', color:'#fff', fontSize:14, fontWeight:700, cursor:loading?'not-allowed':'pointer', opacity:loading?.7:1, transition:'all .15s', fontFamily:'Sora,sans-serif' }}>
              {loading ? 'Aguarde...' : modo === 'login' ? 'Entrar no painel →' : 'Criar conta grátis →'}
            </button>
          </form>

          <div style={{ textAlign:'center', marginTop:16 }}>
            <button onClick={usarDemo}
              style={{ fontSize:12, color:'#9CA3AF', background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }}>
              Usar conta demo
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
