'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { maskBRLInput, parseBRLInput } from '@/lib/currency-brl'
import { useToast } from '@/components/ui/useToast'
import LoadingButton from '@/components/ui/LoadingButton'

type Props = { open: boolean; onClose: () => void; empresaId?: string; contaId?: string; onDone?: () => void }
export default function ModalBoleto({ open, onClose, empresaId, contaId, onDone }: Props) {
  const toast = useToast()
  const [codigo, setCodigo] = useState('')
  const [valorMask, setValorMask] = useState('')
  const [loading, setLoading] = useState(false)
  if (!open) return null
  const digits = codigo.replace(/\D/g, '')
  const vencido = false

  async function confirmar() {
    if (!contaId) return toast.error('Conta não informada')
    if (digits.length < 44) return toast.warning('Código de barras incompleto')
    const valor = parseBRLInput(valorMask)
    if (valor <= 0) return toast.warning('Informe o valor do boleto')
    setLoading(true)
    const { data: sess } = await supabase.auth.getSession()
    const res = await fetch('/api/conta-pj/transferencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(sess.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {}) },
      body: JSON.stringify({
        empresaId,
        conta_origem_id: contaId,
        tipo: 'boleto',
        valor,
        destinatario_nome: 'Pagamento de boleto',
        descricao: `Boleto ${digits.slice(0, 8)}...`,
        data_agendada: new Date().toISOString().slice(0, 10),
      }),
    })
    const payload = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) return toast.error(payload.error || 'Falha ao pagar boleto')
    toast.success('Boleto pago com sucesso')
    onDone?.()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5">
        <h3 className="font-bold">Pagamento de Boleto</h3>
        <input className="mt-2 w-full rounded border px-3 py-2" placeholder="Código de barras" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
        <input className="mt-2 w-full rounded border px-3 py-2" placeholder="Valor do boleto" value={valorMask} onChange={(e) => setValorMask(maskBRLInput(e.target.value))} />
        <p className="mt-2 text-sm text-slate-600">Dígitos: {digits.length}/48</p>
        {vencido && <p className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-800">Boleto vencido: juros estimados aplicados.</p>}
        <div className="mt-3 flex justify-end gap-2">
          <button className="rounded border px-3 py-2" onClick={onClose}>Fechar</button>
          <LoadingButton
            loading={loading}
            loadingText="Pagando..."
            className="rounded bg-[var(--fo-teal)] px-3 py-2 text-white"
            onClick={() => void confirmar()}
          >
            Confirmar pagamento
          </LoadingButton>
        </div>
      </div>
    </div>
  )
}
