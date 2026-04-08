'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff, Loader2, ArrowRight, Zap, CheckCircle } from 'lucide-react'

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
        router.push('/dashboard')
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
    if (!error) router.push('/dashboard')
    else setMsg({ text: 'Conta demo não encontrada. Crie uma conta primeiro.', type: 'error' })
    setLoading(false)
  }

  const features = [
    'Reconhecimento de NF por foto ou upload',
    'CFO Inteligente com IA em tempo real',
    'DRE e fluxo de caixa automáticos',
    'Abertura de conta PJ e captação',
  ]

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <div className="hidden lg:flex lg:w-[45%] flex-col bg-gradient-to-br from-blue-700 to-blue-900 p-12 text-white">
        <div className="flex items-center gap-3 mb-auto">
          <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center font-bold text-white text-sm border border-white/20">F1</div>
          <div>
            <p className="font-bold text-lg leading-none">FactorOne</p>
            <p className="text-blue-200 text-xs">Finance OS</p>
          </div>
        </div>
        <div className="space-y-8 my-auto">
          <div>
            <h1 className="text-4xl font-bold leading-tight text-white">Sistema Operacional<br />Financeiro com IA</h1>
            <p className="text-blue-200 mt-4 text-base leading-relaxed">Automatizando a gestão financeira das empresas modernas.</p>
          </div>
          <div className="space-y-3">
            {features.map((f) => (
              <div key={f} className="flex items-center gap-3">
                <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0"><CheckCircle size={13} className="text-white" /></div>
                <span className="text-blue-100 text-sm">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">{modo === 'entrar' ? 'Entrar na sua conta' : 'Criar sua conta'}</h2>
              <p className="text-slate-500 text-sm mt-1">{modo === 'entrar' ? 'Acesse o seu painel financeiro' : 'Comece gratuitamente hoje'}</p>
            </div>
            <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
              {(['entrar', 'cadastrar'] as const).map((m) => (
                <button key={m} onClick={() => { setModo(m); setMsg({ text: '', type: '' }) }} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${modo === m ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{m === 'entrar' ? 'Entrar' : 'Criar conta'}</button>
              ))}
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required className="w-full bg-white border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-xl px-4 py-2.5 text-slate-800 placeholder-slate-400 outline-none transition-all text-sm" />
              <div className="relative">
                <input type={mostrarSenha ? 'text' : 'password'} value={senha} onChange={e => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" required className="w-full bg-white border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-xl px-4 py-2.5 text-slate-800 placeholder-slate-400 outline-none transition-all text-sm pr-11" />
                <button type="button" onClick={() => setMostrarSenha(!mostrarSenha)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">{mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
              {msg.text && <div className={`text-sm px-4 py-3 rounded-xl border ${msg.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>{msg.text}</div>}
              <button type="submit" disabled={loading} className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm">{loading ? <Loader2 size={18} className="animate-spin" /> : <>{modo === 'entrar' ? 'Entrar no painel' : 'Criar conta'} <ArrowRight size={16} /></>}</button>
            </form>
            <button onClick={usarDemo} disabled={loading} className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm"><Zap size={15} className="text-blue-600" /> Usar conta demo</button>
          </div>
        </div>
      </div>
    </div>
  )
}
