'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type LinhaDRE = { label: string; atual: number; anterior: number }

export default function RelatoriosPage() {
  const [periodo, setPeriodo] = useState<'mes' | 'trimestre' | 'ano'>('mes')
  const [linhas, setLinhas] = useState<LinhaDRE[]>([])
  const [analiseIA, setAnaliseIA] = useState('')
  const [loadingIA, setLoadingIA] = useState(false)

  useEffect(() => {
    carregarDRE()
  }, [periodo])

  async function carregarDRE() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const now = new Date()
    const inicioAtual = new Date(now)
    const inicioAnterior = new Date(now)
    if (periodo === 'mes') {
      inicioAtual.setDate(1)
      inicioAnterior.setMonth(now.getMonth() - 1, 1)
    } else if (periodo === 'trimestre') {
      inicioAtual.setMonth(now.getMonth() - 2, 1)
      inicioAnterior.setMonth(now.getMonth() - 5, 1)
    } else {
      inicioAtual.setFullYear(now.getFullYear() - 1, now.getMonth(), 1)
      inicioAnterior.setFullYear(now.getFullYear() - 2, now.getMonth(), 1)
    }

    const { data: atual } = await supabase
      .from('transacoes')
      .select('tipo,valor,categoria,data')
      .eq('empresa_id', user.id)
      .gte('data', inicioAtual.toISOString())

    const { data: anterior } = await supabase
      .from('transacoes')
      .select('tipo,valor,categoria,data')
      .eq('empresa_id', user.id)
      .gte('data', inicioAnterior.toISOString())
      .lt('data', inicioAtual.toISOString())

    const calc = (lista: any[]) => {
      const receitaBruta = lista.filter(i => i.tipo === 'entrada').reduce((s, i) => s + Number(i.valor || 0), 0)
      const deducoes = lista.filter(i => i.categoria === 'impostos').reduce((s, i) => s + Number(i.valor || 0), 0)
      const custos = lista.filter(i => i.categoria === 'custo').reduce((s, i) => s + Number(i.valor || 0), 0)
      const despesasOp = lista.filter(i => i.categoria === 'despesa_operacional').reduce((s, i) => s + Number(i.valor || 0), 0)
      const depreciacao = lista.filter(i => i.categoria === 'depreciacao').reduce((s, i) => s + Number(i.valor || 0), 0)

      const receitaLiquida = receitaBruta - deducoes
      const lucroBruto = receitaLiquida - custos
      const ebitda = lucroBruto - despesasOp
      const lucroLiquido = ebitda - depreciacao
      return { receitaBruta, deducoes, receitaLiquida, lucroBruto, ebitda, lucroLiquido }
    }

    const a = calc(atual || [])
    const p = calc(anterior || [])
    setLinhas([
      { label: 'Receita Bruta', atual: a.receitaBruta, anterior: p.receitaBruta },
      { label: 'Deduções', atual: a.deducoes, anterior: p.deducoes },
      { label: 'Receita Líquida', atual: a.receitaLiquida, anterior: p.receitaLiquida },
      { label: 'Lucro Bruto', atual: a.lucroBruto, anterior: p.lucroBruto },
      { label: 'EBITDA', atual: a.ebitda, anterior: p.ebitda },
      { label: 'Lucro Líquido', atual: a.lucroLiquido, anterior: p.lucroLiquido }
    ])
  }

  async function analisarComIA() {
    setLoadingIA(true)
    const res = await fetch('/api/aicfo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Analise este DRE e traga pontos críticos e ações práticas.',
        context: JSON.stringify({ periodo, dre: linhas })
      })
    })
    const data = await res.json()
    setAnaliseIA(data.response || data.error || '')
    setLoadingIA(false)
  }

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
  const variacao = (a: number, b: number) => (b === 0 ? 0 : ((a - b) / Math.abs(b)) * 100)
  const receitaLiquida = linhas.find(l => l.label === 'Receita Líquida')?.atual || 0
  const lucroBruto = linhas.find(l => l.label === 'Lucro Bruto')?.atual || 0
  const ebitda = linhas.find(l => l.label === 'EBITDA')?.atual || 0
  const lucroLiquido = linhas.find(l => l.label === 'Lucro Líquido')?.atual || 0
  const margemBruta = receitaLiquida ? (lucroBruto / receitaLiquida) * 100 : 0
  const margemEbitda = receitaLiquida ? (ebitda / receitaLiquida) * 100 : 0
  const margemLiquida = receitaLiquida ? (lucroLiquido / receitaLiquida) * 100 : 0

  const cssPrint = `
    @media print {
      .hide-print { display: none !important; }
      body { background: white; color: black; }
    }
  `

  return (
    <div className="min-h-screen bg-slate-50 text-slate-700 p-6">
      <style>{cssPrint}</style>
      <div className="flex justify-between items-center mb-4 hide-print">
        <h1 className="text-2xl font-bold text-slate-800">DRE Completo</h1>
        <div className="flex gap-2">
          <select className="w-full md:w-auto bg-white border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-xl px-4 py-2.5 text-slate-800 placeholder-slate-400 outline-none transition-all" value={periodo} onChange={(e) => setPeriodo(e.target.value as 'mes' | 'trimestre' | 'ano')}>
            <option value="mes">Mês atual</option>
            <option value="trimestre">Trimestre</option>
            <option value="ano">Último ano</option>
          </select>
          <button className="bg-blue-700 hover:bg-blue-800 text-white font-semibold px-5 py-2.5 rounded-xl shadow-sm transition-all flex items-center gap-2" onClick={analisarComIA} disabled={loadingIA}>{loadingIA ? 'Analisando...' : 'Analisar com IA'}</button>
          <button className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300 font-medium px-5 py-2.5 rounded-xl transition-all" onClick={() => window.print()}>Exportar PDF</button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-blue-200 transition-all">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-2">Linha</th>
                <th className="py-2">Atual</th>
                <th className="py-2">Mês anterior</th>
                <th className="py-2">Variação</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.label} className="border-b border-slate-100">
                  <td className="py-2 text-slate-800">{l.label}</td>
                  <td>{fmt(l.atual)}</td>
                  <td>{fmt(l.anterior)}</td>
                  <td className={variacao(l.atual, l.anterior) >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {variacao(l.atual, l.anterior).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="grid md:grid-cols-3 gap-3 mt-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">Margem Bruta: {margemBruta.toFixed(1)}%</div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">Margem EBITDA: {margemEbitda.toFixed(1)}%</div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">Margem Líquida: {margemLiquida.toFixed(1)}%</div>
            </div>
        </div>
        <aside className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-blue-200 transition-all">
          <h2 className="font-semibold mb-2 text-slate-800">Análise da IA</h2>
          <p className="text-slate-600 whitespace-pre-line text-sm">
            {analiseIA || 'Clique em "Analisar com IA" para gerar insights do DRE.'}
          </p>
        </aside>
      </div>
    </div>
  )
}
