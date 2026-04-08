'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { maskBRLInput, parseBRLInput } from '@/lib/currency-brl'

type Props = { open: boolean; onClose: () => void; empresaId: string; contaId: string; onDone: () => void }
const BANCOS = ['001 Banco do Brasil', '237 Bradesco', '341 Itaú', '033 Santander', '260 Nu Pagamentos', '077 Inter']

export default function ModalTed({ open, onClose, empresaId, contaId, onDone }: Props) {
  const [banco, setBanco] = useState(BANCOS[0])
  const [agencia, setAgencia] = useState('')
  const [conta, setConta] = useState('')
  const [nome, setNome] = useState('')
  const [documento, setDocumento] = useState('')
  const [valorMask, setValorMask] = useState('')
  const [descricao, setDescricao] = useState('')
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))
  if (!open) return null

  async function confirmar() {
    const { data: sess } = await supabase.auth.getSession()
    await fetch('/api/conta-pj/transferencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(sess.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {}) },
      body: JSON.stringify({
        empresaId, conta_origem_id: contaId, tipo: 'ted', valor: parseBRLInput(valorMask), destinatario_nome: nome,
        destinatario_documento: documento, destinatario_banco: banco, destinatario_agencia: agencia, destinatario_conta: conta, descricao, data_agendada: data,
      }),
    })
    onDone(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5">
        <h3 className="font-bold">Transferência TED</h3>
        <select className="mt-2 w-full rounded border px-3 py-2" value={banco} onChange={(e) => setBanco(e.target.value)}>{BANCOS.map((b) => <option key={b}>{b}</option>)}</select>
        <div className="mt-2 grid grid-cols-2 gap-2"><input className="rounded border px-3 py-2" placeholder="Agência" value={agencia} onChange={(e) => setAgencia(e.target.value)} /><input className="rounded border px-3 py-2" placeholder="Conta+DV" value={conta} onChange={(e) => setConta(e.target.value)} /></div>
        <input className="mt-2 w-full rounded border px-3 py-2" placeholder="Nome destinatário" value={nome} onChange={(e) => setNome(e.target.value)} />
        <input className="mt-2 w-full rounded border px-3 py-2" placeholder="CPF/CNPJ" value={documento} onChange={(e) => setDocumento(e.target.value)} />
        <input className="mt-2 w-full rounded border px-3 py-2" placeholder="Valor" value={valorMask} onChange={(e) => setValorMask(maskBRLInput(e.target.value))} />
        <input className="mt-2 w-full rounded border px-3 py-2" placeholder="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        <input type="date" className="mt-2 w-full rounded border px-3 py-2" value={data} onChange={(e) => setData(e.target.value)} />
        <div className="mt-3 flex justify-end gap-2"><button className="rounded border px-3 py-2" onClick={onClose}>Cancelar</button><button className="rounded bg-blue-700 px-3 py-2 text-white" onClick={() => void confirmar()}>Confirmar</button></div>
      </div>
    </div>
  )
}
