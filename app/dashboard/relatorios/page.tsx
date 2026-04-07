'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

type LinhaDRE = { label: string; atual: number; anterior: number }

export default function RelatoriosPage() {
  const supabase = createClientComponentClient()
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
    <div className="min-h-screen bg-[#0A0A0F] text-white p-6">
      <style>{cssPrint}</style>
      <div className="flex justify-between items-center mb-4 hide-print">
        <h1 className="text-2xl font-bold">DRE Completo</h1>
        <div className="flex gap-2">
          <select className="bg-[#111118] border border-[#2A2A35] rounded px-3 py-2" value={periodo} onChange={(e) => setPeriodo(e.target.value as 'mes' | 'trimestre' | 'ano')}>
            <option value="mes">Mês atual</option>
            <option value="trimestre">Trimestre</option>
            <option value="ano">Último ano</option>
          </select>
          <button className="bg-[#0066FF] px-3 py-2 rounded" onClick={analisarComIA} disabled={loadingIA}>{loadingIA ? 'Analisando...' : 'Analisar com IA'}</button>
          <button className="bg-[#2A2A35] px-3 py-2 rounded" onClick={() => window.print()}>Exportar PDF</button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-[#111118] border border-[#1E1E2E] rounded-xl p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-[#2A2A35]">
                <th className="py-2">Linha</th>
                <th className="py-2">Atual</th>
                <th className="py-2">Mês anterior</th>
                <th className="py-2">Variação</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.label} className="border-b border-[#1A1A25]">
                  <td className="py-2">{l.label}</td>
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
            <div className="bg-[#0A0A0F] border border-[#2A2A35] rounded p-3">Margem Bruta: {margemBruta.toFixed(1)}%</div>
            <div className="bg-[#0A0A0F] border border-[#2A2A35] rounded p-3">Margem EBITDA: {margemEbitda.toFixed(1)}%</div>
            <div className="bg-[#0A0A0F] border border-[#2A2A35] rounded p-3">Margem Líquida: {margemLiquida.toFixed(1)}%</div>
          </div>
        </div>
        <aside className="bg-[#111118] border border-[#1E1E2E] rounded-xl p-4">
          <h2 className="font-semibold mb-2">Análise da IA</h2>
          <p className="text-gray-300 whitespace-pre-line text-sm">
            {analiseIA || 'Clique em "Analisar com IA" para gerar insights do DRE.'}
          </p>
        </aside>
      </div>
    </div>
  )
}
