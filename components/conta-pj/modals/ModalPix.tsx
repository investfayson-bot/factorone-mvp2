'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { maskBRLInput, parseBRLInput } from '@/lib/currency-brl'
import LoadingButton from '@/components/ui/LoadingButton'
import { useToast } from '@/components/ui/useToast'
import Modal from '@/components/ui/Modal'

type Props = { open: boolean; onClose: () => void; empresaId: string; contaId: string; onDone: () => void }

export default function ModalPix({ open, onClose, empresaId, contaId, onDone }: Props) {
  const toast = useToast()
  const [chavePix, setChavePix] = useState('')
  const [valorMask, setValorMask] = useState('')
  const [descricao, setDescricao] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)

  async function confirmar() {
    if (pin.length !== 4) return toast.warning('PIN de 4 dígitos')
    setLoading(true)
    const valor = parseBRLInput(valorMask)
    if (valor <= 0) {
      setLoading(false)
      return toast.warning('Informe um valor válido')
    }
    const { data: sess } = await supabase.auth.getSession()
    const res = await fetch('/api/conta-pj/transferencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(sess.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {}) },
      body: JSON.stringify({
        empresaId,
        conta_origem_id: contaId,
        tipo: 'pix',
        valor,
        destinatario_nome: 'Destino PIX',
        chave_pix: chavePix,
        descricao,
        data_agendada: new Date().toISOString().slice(0, 10),
      }),
    })
    const payload = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) return toast.error(payload.error || 'Falha ao enviar PIX')
    toast.success('PIX enviado com sucesso')
    onDone()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Enviar PIX"
      size="md"
      footer={
        <>
          <button className="rounded border px-3 py-2" onClick={onClose}>Cancelar</button>
          <LoadingButton
            loading={loading}
            loadingText="Processando..."
            className="rounded bg-[var(--fo-teal)] px-3 py-2 text-white"
            onClick={() => void confirmar()}
          >
            Confirmar
          </LoadingButton>
        </>
      }
    >
        <input className="mt-2 w-full rounded border px-3 py-2" placeholder="Chave PIX" value={chavePix} onChange={(e) => setChavePix(e.target.value)} />
        <input className="mt-2 w-full rounded border px-3 py-2" placeholder="Valor" value={valorMask} onChange={(e) => setValorMask(maskBRLInput(e.target.value))} />
        <input className="mt-2 w-full rounded border px-3 py-2" placeholder="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        <input className="mt-2 w-full rounded border px-3 py-2" placeholder="PIN 4 dígitos" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} />
        <p className="mt-2 text-xs text-slate-500">Você está enviando {valorMask || '0,00'} via PIX.</p>
    </Modal>
  )
}
