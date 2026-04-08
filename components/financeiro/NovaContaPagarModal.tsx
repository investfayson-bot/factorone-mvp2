'use client'

import { useState } from 'react'
import { maskBRLInput, parseBRLInput } from '@/lib/currency-brl'
import { supabase } from '@/lib/supabase'

type Props = { open: boolean; onClose: () => void; onSaved: () => void }

export default function NovaContaPagarModal({ open, onClose, onSaved }: Props) {
  const [fornecedor, setFornecedor] = useState('')
  const [documento, setDocumento] = useState('')
  const [descricao, setDescricao] = useState('')
  const [categoria, setCategoria] = useState('Outros')
  const [valorMask, setValorMask] = useState('')
  const [emissao, setEmissao] = useState(new Date().toISOString().slice(0, 10))
  const [vencimento, setVencimento] = useState(new Date().toISOString().slice(0, 10))
  const [tipo, setTipo] = useState('pix')
  const [codigoBarras, setCodigoBarras] = useState('')
  const [chavePix, setChavePix] = useState('')
  const [parcelas, setParcelas] = useState(1)
  const [recorrente, setRecorrente] = useState(false)
  const [recorrenciaTipo, setRecorrenciaTipo] = useState('mensal')
  const [obs, setObs] = useState('')
  if (!open) return null

  async function salvar() {
    const { data: sess } = await supabase.auth.getSession()
    const token = sess.session?.access_token
    const res = await fetch('/api/financeiro/pagar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        fornecedor_nome: fornecedor,
        fornecedor_documento: documento,
        descricao,
        categoria,
        valor: parseBRLInput(valorMask),
        data_emissao: emissao,
        data_vencimento: vencimento,
        tipo_pagamento: tipo,
        codigo_barras: codigoBarras || null,
        chave_pix: chavePix || null,
        parcelas,
        recorrente,
        recorrencia_tipo: recorrente ? recorrenciaTipo : null,
        observacoes: obs,
      }),
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) return alert(payload.error || 'Falha ao salvar')
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5">
        <h3 className="text-lg font-bold">Nova Conta a Pagar</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <input className="rounded border px-3 py-2" placeholder="Fornecedor*" value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} />
          <input className="rounded border px-3 py-2" placeholder="CNPJ/CPF fornecedor" value={documento} onChange={(e) => setDocumento(e.target.value)} />
          <input className="rounded border px-3 py-2 md:col-span-2" placeholder="Descrição*" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          <input className="rounded border px-3 py-2" placeholder="Categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} />
          <input className="rounded border px-3 py-2" placeholder="Valor*" value={valorMask} onChange={(e) => setValorMask(maskBRLInput(e.target.value))} />
          <input type="date" className="rounded border px-3 py-2" value={emissao} onChange={(e) => setEmissao(e.target.value)} />
          <input type="date" className="rounded border px-3 py-2" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
          <select className="rounded border px-3 py-2" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="pix">PIX</option><option value="ted">TED</option><option value="boleto">Boleto</option><option value="cartao">Cartão</option><option value="dinheiro">Dinheiro</option><option value="outro">Outro</option>
          </select>
          <input className="rounded border px-3 py-2" placeholder="Código de barras" value={codigoBarras} onChange={(e) => setCodigoBarras(e.target.value)} />
          <input className="rounded border px-3 py-2" placeholder="Chave PIX" value={chavePix} onChange={(e) => setChavePix(e.target.value)} />
          <input type="number" className="rounded border px-3 py-2" placeholder="Parcelas" value={parcelas} onChange={(e) => setParcelas(Number(e.target.value || 1))} />
          <label className="flex items-center gap-2 rounded border px-3 py-2"><input type="checkbox" checked={recorrente} onChange={(e) => setRecorrente(e.target.checked)} /> Recorrente</label>
          {recorrente && <select className="rounded border px-3 py-2" value={recorrenciaTipo} onChange={(e) => setRecorrenciaTipo(e.target.value)}><option value="semanal">Semanal</option><option value="mensal">Mensal</option><option value="trimestral">Trimestral</option><option value="anual">Anual</option></select>}
          <textarea className="rounded border px-3 py-2 md:col-span-2" placeholder="Observações" value={obs} onChange={(e) => setObs(e.target.value)} />
        </div>
        <div className="mt-3 flex justify-end gap-2"><button className="rounded border px-3 py-2" onClick={onClose}>Cancelar</button><button className="rounded bg-blue-700 px-3 py-2 text-white" onClick={() => void salvar()}>Salvar</button></div>
      </div>
    </div>
  )
}
