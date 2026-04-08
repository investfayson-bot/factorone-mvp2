'use client'

import { useState } from 'react'

type Linha = { id: string; categoria: string; valor_previsto: number; valor_realizado: number }
type Props = { open: boolean; onClose: () => void; linha: Linha | null; onSaved: () => void }

export default function SuplementacaoModal({ open, onClose, linha, onSaved }: Props) {
  const [valor, setValor] = useState(0)
  const [justificativa, setJustificativa] = useState('')
  const [urgencia, setUrgencia] = useState<'normal' | 'urgente'>('normal')
  if (!open || !linha) return null
  const pct = linha.valor_previsto > 0 ? (linha.valor_realizado / linha.valor_previsto) * 100 : 0
  async function enviar() {
    if (justificativa.trim().length < 20) return alert('Justificativa mínima de 20 caracteres')
    const res = await fetch('/api/orcamento/suplementacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orcamento_linha_id: linha.id, valor_solicitado: valor, justificativa: `[${urgencia}] ${justificativa}` }),
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) return alert(payload.error || 'Falha ao solicitar')
    onSaved(); onClose()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5">
        <h3 className="font-bold">Solicitar suplementação</h3>
        <p className="text-sm text-slate-500">{linha.categoria} • Consumo {pct.toFixed(1)}%</p>
        <p className="mt-2 text-sm">Previsto: R$ {linha.valor_previsto.toFixed(2)} • Realizado: R$ {linha.valor_realizado.toFixed(2)}</p>
        <input type="number" className="mt-2 w-full rounded border px-3 py-2" placeholder="Valor adicional solicitado" value={valor} onChange={(e) => setValor(Number(e.target.value || 0))} />
        <select className="mt-2 w-full rounded border px-3 py-2" value={urgencia} onChange={(e) => setUrgencia(e.target.value as 'normal' | 'urgente')}><option value="normal">Normal</option><option value="urgente">Urgente</option></select>
        <textarea className="mt-2 w-full rounded border px-3 py-2" placeholder="Justificativa (mínimo 20 chars)" value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
        <p className="mt-2 text-sm">Novo previsto se aprovado: R$ {(linha.valor_previsto + valor).toFixed(2)}</p>
        <div className="mt-3 flex justify-end gap-2"><button className="rounded border px-3 py-2" onClick={onClose}>Cancelar</button><button className="rounded bg-blue-700 px-3 py-2 text-white" onClick={() => void enviar()}>Enviar</button></div>
      </div>
    </div>
  )
}
