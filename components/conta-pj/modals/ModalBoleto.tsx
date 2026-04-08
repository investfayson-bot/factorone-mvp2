'use client'
import { useState } from 'react'

type Props = { open: boolean; onClose: () => void }
export default function ModalBoleto({ open, onClose }: Props) {
  const [codigo, setCodigo] = useState('')
  if (!open) return null
  const digits = codigo.replace(/\D/g, '')
  const vencido = false
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5">
        <h3 className="font-bold">Pagamento de Boleto</h3>
        <input className="mt-2 w-full rounded border px-3 py-2" placeholder="Código de barras" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
        <p className="mt-2 text-sm text-slate-600">Dígitos: {digits.length}/48</p>
        {vencido && <p className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-800">Boleto vencido: juros estimados aplicados.</p>}
        <div className="mt-3 flex justify-end gap-2"><button className="rounded border px-3 py-2" onClick={onClose}>Fechar</button><button className="rounded bg-blue-700 px-3 py-2 text-white">Confirmar pagamento</button></div>
      </div>
    </div>
  )
}
