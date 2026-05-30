'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Modal from '@/components/ui/Modal'

type Linha = { id: string; categoria: string; mes: number; ano: number; valor_previsto: number; valor_realizado: number; centro_custo_id?: string | null }
type Props = { open: boolean; onClose: () => void; linha: Linha | null; onSaved: () => void }

export default function EditarLinhaModal({ open, onClose, linha, onSaved }: Props) {
  const [novoValor, setNovoValor] = useState(0)
  const [justificativa, setJustificativa] = useState('')
  if (!linha) return null
  const preview = novoValor - Number(linha.valor_realizado || 0)
  async function salvar() {
    const { error } = await supabase.from('orcamento_linhas').update({ valor_previsto: novoValor }).eq('id', linha.id)
    if (error) return alert(error.message)
    onSaved(); onClose()
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Editar linha orçamentária"
      size="md"
      footer={
        <>
          <button className="rounded border px-3 py-2" onClick={onClose}>Cancelar</button>
          <button className="rounded bg-blue-700 px-3 py-2 text-white" onClick={() => void salvar()}>Salvar</button>
        </>
      }
    >
        <p className="text-sm text-slate-500">{linha.categoria} • {linha.mes}/{linha.ano}</p>
        <input type="number" className="mt-2 w-full rounded border px-3 py-2" value={novoValor || linha.valor_previsto} onChange={(e) => setNovoValor(Number(e.target.value || 0))} />
        <textarea className="mt-2 w-full rounded border px-3 py-2" placeholder="Justificativa (se ativo)" value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
        <p className="mt-2 text-sm">Preview variação: {preview.toFixed(2)}</p>
    </Modal>
  )
}
