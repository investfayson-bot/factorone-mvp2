'use client'

import { useEffect, useMemo, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Upload, FileText, Send } from 'lucide-react'

type NotaFiscal = {
  id: string
  numero: string | null
  emitente_cnpj: string | null
  emitente_nome: string | null
  data_emissao: string | null
  valor_total: number | null
  impostos: { icms?: number; pis?: number; cofins?: number } | null
  itens: Array<{ descricao?: string; quantidade?: number; valor?: number }> | null
  classificacao: 'custo' | 'despesa_operacional' | 'receita' | null
  status: string | null
}

const STATUS = ['todos', 'pendente', 'aguardando_captacao'] as const

export default function NotaFiscalPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'public-anon-key'
  )
  const [dragAtivo, setDragAtivo] = useState(false)
  const [processando, setProcessando] = useState(false)
  const [statusFiltro, setStatusFiltro] = useState<(typeof STATUS)[number]>('todos')
  const [notas, setNotas] = useState<NotaFiscal[]>([])
  const [notaAtual, setNotaAtual] = useState<NotaFiscal | null>(null)

  useEffect(() => {
    carregarNotas()
  }, [])

  async function carregarNotas() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('notas_fiscais')
      .select('*')
      .eq('empresa_id', user.id)
      .order('created_at', { ascending: false })
    setNotas((data as NotaFiscal[]) || [])
  }

  async function extrairTexto(arquivo: File) {
    const nome = arquivo.name.toLowerCase()
    if (nome.endsWith('.xml')) {
      return await arquivo.text()
    }
    if (nome.endsWith('.pdf')) {
      const arr = await arquivo.arrayBuffer()
      const bytes = new Uint8Array(arr).slice(0, 30000)
      let binary = ''
      bytes.forEach((b) => {
        binary += String.fromCharCode(b)
      })
      return `PDF_BASE64:${btoa(binary)}`
    }
    throw new Error('Formato inválido. Envie XML ou PDF.')
  }

  async function onFile(file: File) {
    try {
      setProcessando(true)
      const texto = await extrairTexto(file)
      const res = await fetch('/api/nota-fiscal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao processar nota fiscal')
      setNotaAtual(data.nota)
      await carregarNotas()
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao processar nota'
      alert(msg)
    } finally {
      setProcessando(false)
    }
  }

  async function enviarCaptacao(id: string) {
    await supabase
      .from('notas_fiscais')
      .update({ status: 'aguardando_captacao' })
      .eq('id', id)
    await carregarNotas()
  }

  const notasFiltradas = useMemo(
    () => notas.filter(n => statusFiltro === 'todos' || n.status === statusFiltro),
    [notas, statusFiltro]
  )

  const badgeClassificacao = (value: string | null) => {
    if (value === 'custo') return 'bg-red-500/20 text-red-300'
    if (value === 'despesa_operacional') return 'bg-yellow-500/20 text-yellow-300'
    if (value === 'receita') return 'bg-green-500/20 text-green-300'
    return 'bg-gray-500/20 text-gray-300'
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white p-6 space-y-6">
      <h1 className="text-2xl font-bold">Nota Fiscal Inteligente</h1>

      <label
        className={`block border-2 border-dashed rounded-xl p-8 text-center transition ${
          dragAtivo ? 'border-[#0066FF] bg-[#111118]' : 'border-[#2A2A35] bg-[#111118]'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragAtivo(true) }}
        onDragLeave={() => setDragAtivo(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragAtivo(false)
          const file = e.dataTransfer.files?.[0]
          if (file) onFile(file)
        }}
      >
        <Upload className="mx-auto mb-3 text-[#0066FF]" />
        <p className="text-gray-300">Arraste XML/PDF aqui ou clique para selecionar</p>
        <input
          type="file"
          accept=".xml,.pdf"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
      </label>

      {processando && <p className="text-[#0066FF]">Processando nota fiscal...</p>}

      {notaAtual && (
        <div className="bg-[#111118] border border-[#1E1E2E] rounded-xl p-5 space-y-3">
          <h2 className="font-semibold flex items-center gap-2"><FileText size={16} /> Dados extraídos</h2>
          <p><strong>Número:</strong> {notaAtual.numero || '-'}</p>
          <p><strong>Emitente:</strong> {notaAtual.emitente_nome || '-'} ({notaAtual.emitente_cnpj || '-'})</p>
          <p><strong>Data:</strong> {notaAtual.data_emissao || '-'}</p>
          <p><strong>Valor total:</strong> R$ {(notaAtual.valor_total || 0).toLocaleString('pt-BR')}</p>
          <p>
            <strong>Impostos:</strong> ICMS {notaAtual.impostos?.icms || 0} | PIS {notaAtual.impostos?.pis || 0} | COFINS {notaAtual.impostos?.cofins || 0}
          </p>
          <div>
            <strong>Itens:</strong>
            <ul className="list-disc pl-6 text-gray-300">
              {(notaAtual.itens || []).map((item, idx) => (
                <li key={idx}>{item.descricao || 'Item'} - qtd {item.quantidade || 0} - R$ {item.valor || 0}</li>
              ))}
            </ul>
          </div>
          <span className={`inline-block px-3 py-1 rounded-full text-xs ${badgeClassificacao(notaAtual.classificacao)}`}>
            {notaAtual.classificacao || 'não classificada'}
          </span>
        </div>
      )}

      <div className="bg-[#111118] border border-[#1E1E2E] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Notas cadastradas</h2>
          <select
            className="bg-[#0A0A0F] border border-[#2A2A35] rounded px-3 py-2"
            value={statusFiltro}
            onChange={(e) => setStatusFiltro(e.target.value as (typeof STATUS)[number])}
          >
            {STATUS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="space-y-3">
          {notasFiltradas.map((nota) => (
            <div key={nota.id} className="border border-[#2A2A35] rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">NF {nota.numero || '-'}</p>
                <p className="text-sm text-gray-400">{nota.emitente_nome || '-'} | R$ {(nota.valor_total || 0).toLocaleString('pt-BR')}</p>
                <span className={`inline-block mt-2 px-2 py-1 rounded text-xs ${badgeClassificacao(nota.classificacao)}`}>
                  {nota.classificacao || 'não classificada'}
                </span>
              </div>
              <button
                onClick={() => enviarCaptacao(nota.id)}
                className="bg-[#0066FF] px-3 py-2 rounded-lg text-sm disabled:opacity-50 flex items-center gap-2"
                disabled={nota.status === 'aguardando_captacao'}
              >
                <Send size={14} /> Enviar para Captação
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
