'use client'

import { useState } from 'react'
import { maskBRLInput, parseBRLInput } from '@/lib/currency-brl'
import { supabase } from '@/lib/supabase'

type Props = { open: boolean; onClose: () => void; onSaved: () => void }

export default function NovaContaReceberModal({ open, onClose, onSaved }: Props) {
  const [cliente, setCliente] = useState('')
  const [documento, setDocumento] = useState('')
  const [email, setEmail] = useState('')
  const [descricao, setDescricao] = useState('')
  const [categoria, setCategoria] = useState('Receita Operacional')
  const [valorMask, setValorMask] = useState('')
  const [emissao, setEmissao] = useState(new Date().toISOString().slice(0, 10))
  const [vencimento, setVencimento] = useState(new Date().toISOString().slice(0, 10))
  const [tipo, setTipo] = useState('pix')
  const [pix, setPix] = useState('')
  const [parcelas, setParcelas] = useState(1)
  const [recorrente, setRecorrente] = useState(false)
  const [recorrenciaTipo, setRecorrenciaTipo] = useState('mensal')
  const [juros, setJuros] = useState('0.0033')
  const [multa, setMulta] = useState('0.02')
  const [obs, setObs] = useState('')
  if (!open) return null

  async function salvar() {
    const { data: sess } = await supabase.auth.getSession()
    const token = sess.session?.access_token
    const res = await fetch('/api/financeiro/receber', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        cliente_nome: cliente,
        cliente_documento: documento,
        cliente_email: email,
        descricao,
        categoria,
        valor: parseBRLInput(valorMask),
        data_emissao: emissao,
        data_vencimento: vencimento,
        tipo_cobranca: tipo,
        chave_pix_cobranca: pix || null,
        parcelas,
        recorrente,
        recorrencia_tipo: recorrente ? recorrenciaTipo : null,
        juros_mora: Number(juros),
        multa: Number(multa),
        observacoes: obs,
      }),
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) return alert(payload.error || 'Falha ao salvar')
    onSaved(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5">
        <h3 className="text-lg font-bold">Nova Conta a Receber</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <input className="rounded border px-3 py-2" placeholder="Cliente*" value={cliente} onChange={(e) => setCliente(e.target.value)} />
          <input className="rounded border px-3 py-2" placeholder="CNPJ/CPF" value={documento} onChange={(e) => setDocumento(e.target.value)} />
          <input className="rounded border px-3 py-2 md:col-span-2" placeholder="Email cliente" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="rounded border px-3 py-2 md:col-span-2" placeholder="Descrição*" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          <input className="rounded border px-3 py-2" placeholder="Categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} />
          <input className="rounded border px-3 py-2" placeholder="Valor*" value={valorMask} onChange={(e) => setValorMask(maskBRLInput(e.target.value))} />
          <input type="date" className="rounded border px-3 py-2" value={emissao} onChange={(e) => setEmissao(e.target.value)} />
          <input type="date" className="rounded border px-3 py-2" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
          <select className="rounded border px-3 py-2" value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="boleto">Boleto</option><option value="pix">PIX</option><option value="cartao">Cartão</option><option value="transferencia">Transferência</option><option value="dinheiro">Dinheiro</option></select>
          <input className="rounded border px-3 py-2" placeholder="Chave PIX cobrança" value={pix} onChange={(e) => setPix(e.target.value)} />
          <input type="number" className="rounded border px-3 py-2" placeholder="Parcelas" value={parcelas} onChange={(e) => setParcelas(Number(e.target.value || 1))} />
          <label className="flex items-center gap-2 rounded border px-3 py-2"><input type="checkbox" checked={recorrente} onChange={(e) => setRecorrente(e.target.checked)} /> Recorrente</label>
          {recorrente && <select className="rounded border px-3 py-2" value={recorrenciaTipo} onChange={(e) => setRecorrenciaTipo(e.target.value)}><option value="semanal">Semanal</option><option value="mensal">Mensal</option><option value="trimestral">Trimestral</option><option value="anual">Anual</option></select>}
          <input className="rounded border px-3 py-2" placeholder="Juros mora" value={juros} onChange={(e) => setJuros(e.target.value)} />
          <input className="rounded border px-3 py-2" placeholder="Multa" value={multa} onChange={(e) => setMulta(e.target.value)} />
          <textarea className="rounded border px-3 py-2 md:col-span-2" placeholder="Observações" value={obs} onChange={(e) => setObs(e.target.value)} />
        </div>
        <div className="mt-3 flex justify-end gap-2"><button className="rounded border px-3 py-2" onClick={onClose}>Cancelar</button><button className="rounded bg-blue-700 px-3 py-2 text-white" onClick={() => void salvar()}>Salvar</button></div>
      </div>
    </div>
  )
}
