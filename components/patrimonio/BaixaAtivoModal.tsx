'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { maskBRLInput, parseBRLInput } from '@/lib/currency-brl'

type Props = {
  open: boolean
  onClose: () => void
  onDone: () => void
  ativo: { id: string; nome: string; valor_contabil: number; empresa_id: string }
}

export default function BaixaAtivoModal({ open, onClose, onDone, ativo }: Props) {
  const [motivo, setMotivo] = useState('sucateamento')
  const [dataBaixa, setDataBaixa] = useState(new Date().toISOString().slice(0, 10))
  const [valorMask, setValorMask] = useState('')
  const [obs, setObs] = useState('')
  if (!open) return null

  async function confirmar() {
    const valorBaixa = parseBRLInput(valorMask)
    const status = motivo === 'alienacao' ? 'alienado' : 'baixado'
    await supabase.from('ativos').update({
      status, data_baixa: dataBaixa, motivo_baixa: motivo, valor_baixa: valorBaixa, observacoes: obs,
    }).eq('id', ativo.id)

    const diff = valorBaixa - Number(ativo.valor_contabil || 0)
    await supabase.from('transacoes').insert({
      empresa_id: ativo.empresa_id,
      descricao: `Baixa de ativo ${ativo.nome}`,
      tipo: diff >= 0 ? 'entrada' : 'saida',
      valor: Math.abs(diff),
      categoria: diff >= 0 ? 'Ganho na alienação' : 'Perda na alienação',
      status: 'pago',
      data: dataBaixa,
    })
    onDone()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5">
        <h3 className="font-bold">Baixa de ativo</h3>
        <select className="mt-2 w-full rounded border px-3 py-2" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
          <option value="sucateamento">Sucateamento</option>
          <option value="alienacao">Alienação</option>
          <option value="roubo">Roubo</option>
          <option value="sinistro">Sinistro</option>
          <option value="doacao">Doação</option>
        </select>
        <input type="date" className="mt-2 w-full rounded border px-3 py-2" value={dataBaixa} onChange={(e) => setDataBaixa(e.target.value)} />
        <input className="mt-2 w-full rounded border px-3 py-2" placeholder="Valor de alienação" value={valorMask} onChange={(e) => setValorMask(maskBRLInput(e.target.value))} />
        <textarea className="mt-2 w-full rounded border px-3 py-2" placeholder="Observações" value={obs} onChange={(e) => setObs(e.target.value)} />
        <div className="mt-3 flex justify-end gap-2">
          <button className="rounded border px-3 py-2" onClick={onClose}>Cancelar</button>
          <button className="rounded bg-red-600 px-3 py-2 text-white" onClick={() => void confirmar()}>Confirmar baixa</button>
        </div>
      </div>
    </div>
  )
}
