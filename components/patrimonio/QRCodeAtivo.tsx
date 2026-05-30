'use client'

import { QRCodeCanvas } from 'qrcode.react'
import Modal from '@/components/ui/Modal'

type Props = {
  open: boolean
  onClose: () => void
  qrCode: string
  nome: string
}

export default function QRCodeAtivo({ open, onClose, qrCode, nome }: Props) {
  const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/ativo/${qrCode}`
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="QR Code do ativo"
      size="sm"
      footer={
        <>
          <button onClick={onClose} className="rounded border px-3 py-2">Fechar</button>
          <button onClick={() => window.print()} className="rounded bg-blue-700 px-3 py-2 text-white">Imprimir etiqueta</button>
        </>
      }
    >
        <p className="text-sm text-slate-500">{nome}</p>
        <div className="mt-4 flex justify-center rounded-xl border p-4">
          <QRCodeCanvas value={url} size={200} />
        </div>
        <p className="mt-2 break-all text-xs text-slate-500">{url}</p>
    </Modal>
  )
}
