'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { TrendingUp, TrendingDown, DollarSign, FileText, Zap } from 'lucide-react'

interface Metricas {
  receita_mes: number
  despesas_mes: number
  saldo_atual: number
  notas_pendentes: number
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [metricas, setMetricas] = useState<Metricas>({
    receita_mes: 0, despesas_mes: 0, saldo_atual: 0, notas_pendentes: 0
  })
  const [aiInsight, setAiInsight] = useState('')
  const [loadingAi, setLoadingAi] = useState(false)
  const supabase = createClientComponentClient()
  const router = useRouter()

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      setUser(user)

      const inicioMes = new Date()
      inicioMes.setDate(1)
      inicioMes.setHours(0, 0, 0, 0)

      const { data: transacoes } = await supabase
        .from('transacoes')
        .select('tipo, valor')
        .eq('empresa_id', user.id)
        .gte('data', inicioMes.toISOString())

      if (transacoes) {
        const receita = transacoes.filter(t => t.tipo === 'entrada').reduce((s, t) => s + t.valor, 0)
        const despesas = transacoes.filter(t => t.tipo === 'saida').reduce((s, t) => s + t.valor, 0)
        setMetricas({ receita_mes: receita, despesas_mes: despesas, saldo_atual: receita - despesas, notas_pendentes: 0 })
      }
      setLoading(false)
    }
    loadData()
  }, [router, supabase])

  async function gerarInsight() {
    setLoadingAi(true)
    const res = await fetch('/api/aicfo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Analise o desempenho financeiro deste mês e dê 3 insights rápidos e práticos.',
        context: 'dashboard_principal'
      })
    })
    const data = await res.json()
    setAiInsight(data.response || data.error)
    setLoadingAi(false)
  }

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-[#0A0A0F]">
      <div className="text-white text-lg animate-pulse">Carregando FactorOne...</div>
    </div>
  )

  return (
    <div className="p-6 bg-[#0A0A0F] min-h-screen text-white">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Bom dia! 👋</h1>
        <p className="text-gray-400">Aqui está o resumo financeiro de hoje</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-[#111118] border border-[#1E1E2E] rounded-xl p-5">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
            <TrendingUp size={16} className="text-green-400" /> Receita do Mês
          </div>
          <p className="text-2xl font-bold text-green-400">{fmt(metricas.receita_mes)}</p>
        </div>
        <div className="bg-[#111118] border border-[#1E1E2E] rounded-xl p-5">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
            <TrendingDown size={16} className="text-red-400" /> Despesas do Mês
          </div>
          <p className="text-2xl font-bold text-red-400">{fmt(metricas.despesas_mes)}</p>
        </div>
        <div className="bg-[#111118] border border-[#1E1E2E] rounded-xl p-5">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
            <DollarSign size={16} className="text-blue-400" /> Saldo Atual
          </div>
          <p className={`text-2xl font-bold ${metricas.saldo_atual >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
            {fmt(metricas.saldo_atual)}
          </p>
        </div>
        <div className="bg-[#111118] border border-[#1E1E2E] rounded-xl p-5">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
            <FileText size={16} className="text-yellow-400" /> NFs Pendentes
          </div>
          <p className="text-2xl font-bold text-yellow-400">{metricas.notas_pendentes}</p>
        </div>
      </div>

      <div className="bg-[#111118] border border-[#0066FF]/30 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-[#0066FF]" />
            <h2 className="font-semibold">Insight do CFO Inteligente</h2>
          </div>
          <button
            onClick={gerarInsight}
            disabled={loadingAi}
            className="bg-[#0066FF] hover:bg-blue-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition"
          >
            {loadingAi ? 'Analisando...' : 'Gerar Análise'}
          </button>
        </div>
        {aiInsight ? (
          <p className="text-gray-300 leading-relaxed whitespace-pre-line">{aiInsight}</p>
        ) : (
          <p className="text-gray-500 italic">Clique em "Gerar Análise" para receber insights personalizados sobre sua empresa.</p>
        )}
      </div>
    </div>
  )
}
