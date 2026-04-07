'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { TrendingUp, TrendingDown, DollarSign, FileText, Zap, ArrowUpRight, AlertCircle } from 'lucide-react'

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [metricas, setMetricas] = useState({ receita: 0, despesas: 0, saldo: 0, nfs: 0 })
  const [aiInsight, setAiInsight] = useState('')
  const [loadingAi, setLoadingAi] = useState(false)
  const [transacoes, setTransacoes] = useState<any[]>([])
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      setUser(user)
      const inicio = new Date(); inicio.setDate(1); inicio.setHours(0, 0, 0, 0)
      const { data: t } = await supabase.from('transacoes').select('*').eq('empresa_id', user.id).gte('data', inicio.toISOString().split('T')[0]).order('data', { ascending: false })
      if (t) {
        setTransacoes(t.slice(0, 5))
        const rec = t.filter(x => x.tipo === 'entrada').reduce((s: number, x: any) => s + Number(x.valor), 0)
        const desp = t.filter(x => x.tipo === 'saida').reduce((s: number, x: any) => s + Number(x.valor), 0)
        setMetricas({ receita: rec, despesas: desp, saldo: rec - desp, nfs: 0 })
      }
      setLoading(false)
    }
    load()
  }, [])

  async function gerarInsight() {
    setLoadingAi(true)
    setAiInsight('')
    try {
      const res = await fetch('/api/aicfo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Analise o desempenho financeiro deste mês. Dê 3 insights práticos e diretos sobre o que precisa de atenção imediata.', context: 'dashboard' }) })
      const data = await res.json()
      setAiInsight(data.response || data.error || 'Erro ao gerar análise')
    } catch (e) { setAiInsight('Erro de conexão') }
    setLoadingAi(false)
  }

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="p-6 space-y-6 max-w-7xl text-white">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{saudacao}, {user?.email?.split('@')[0]}! 👋</h1>
          <p className="text-gray-400 text-sm mt-1">Resumo financeiro de hoje — {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <button onClick={gerarInsight} disabled={loadingAi} className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-medium px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 text-sm">
          <Zap size={16} />{loadingAi ? 'Analisando...' : 'Análise IA'}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Receita do Mês', value: fmt(metricas.receita), icon: TrendingUp, color: 'emerald', change: '+0%' },
          { label: 'Despesas do Mês', value: fmt(metricas.despesas), icon: TrendingDown, color: 'red', change: '+0%' },
          { label: 'Saldo Atual', value: fmt(metricas.saldo), icon: DollarSign, color: metricas.saldo >= 0 ? 'blue' : 'red', change: '' },
          { label: 'NFs Pendentes', value: metricas.nfs.toString(), icon: FileText, color: 'amber', change: '' },
        ].map((m) => (
          <div key={m.label} className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-blue-500/30 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-400 text-xs font-medium uppercase tracking-wide">{m.label}</span>
              <div className={`w-8 h-8 rounded-lg bg-${m.color}-500/20 flex items-center justify-center`}>
                <m.icon size={16} className={`text-${m.color}-400`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{m.value}</p>
            {m.change && <p className="text-xs text-gray-500 mt-1">{m.change} vs mês anterior</p>}
          </div>
        ))}
      </div>

      <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/5 border border-blue-500/20 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <Zap size={16} className="text-blue-400" />
          </div>
          <h2 className="font-semibold text-white">CFO Inteligente</h2>
          <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">IA</span>
        </div>
        {aiInsight ? (
          <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{aiInsight}</p>
        ) : (
          <div className="flex items-center gap-3 text-gray-500">
            <AlertCircle size={16} />
            <p className="text-sm">Clique em "Análise IA" para receber insights personalizados sobre sua empresa.</p>
          </div>
        )}
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white">Últimas Transações</h2>
          <button onClick={() => router.push('/dashboard/cashflow')} className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1">Ver todas <ArrowUpRight size={14} /></button>
        </div>
        {transacoes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma transação este mês</p>
            <button onClick={() => router.push('/dashboard/cashflow')} className="mt-3 text-blue-400 text-sm hover:underline">Adicionar transação</button>
          </div>
        ) : (
          <div className="space-y-2">
            {transacoes.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.tipo === 'entrada' ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                    {t.tipo === 'entrada' ? <TrendingUp size={14} className="text-emerald-400" /> : <TrendingDown size={14} className="text-red-400" />}
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{t.descricao || 'Sem descrição'}</p>
                    <p className="text-gray-500 text-xs">{t.categoria || 'Sem categoria'} • {new Date(t.data).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>
                <span className={`font-semibold text-sm ${t.tipo === 'entrada' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {t.tipo === 'entrada' ? '+' : '-'}{fmt(Number(t.valor))}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
