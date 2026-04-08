'use client'

import { QRCodeCanvas } from 'qrcode.react'

type Props = {
  open: boolean
  onClose: () => void
  qrCode: string
  nome: string
}

export default function QRCodeAtivo({ open, onClose, qrCode, nome }: Props) {
  if (!open) return null
  const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/ativo/${qrCode}`
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5">
        <h3 className="text-lg font-bold">QR Code do ativo</h3>
        <p className="text-sm text-slate-500">{nome}</p>
        <div className="mt-4 flex justify-center rounded-xl border p-4">
          <QRCodeCanvas value={url} size={200} />
        </div>
        <p className="mt-2 break-all text-xs text-slate-500">{url}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded border px-3 py-2">Fechar</button>
          <button onClick={() => window.print()} className="rounded bg-blue-700 px-3 py-2 text-white">Imprimir etiqueta</button>
        </div>
      </div>
    </div>
  )
}
