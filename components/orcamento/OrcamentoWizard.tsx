'use client'

import { useMemo, useState } from 'react'

type Props = {
  open: boolean
  onClose: () => void
  onSaved: () => void
  categorias: string[]
}

export default function OrcamentoWizard({ open, onClose, onSaved, categorias }: Props) {
  const [step, setStep] = useState(1)
  const [nome, setNome] = useState(`Orçamento ${new Date().getFullYear()}`)
  const [ano, setAno] = useState(new Date().getFullYear())
  const [tipo, setTipo] = useState<'top-down' | 'bottom-up'>('bottom-up')
  const [historico, setHistorico] = useState(false)
  const [valores, setValores] = useState<Record<string, number>>(
    Object.fromEntries(categorias.map((c) => [c, 0]))
  )
  const total = useMemo(() => Object.values(valores).reduce((s, v) => s + Number(v || 0), 0), [valores])
  if (!open) return null

  async function salvar(status: 'rascunho' | 'em_aprovacao') {
    const res = await fetch('/api/orcamento/criar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome,
        ano_fiscal: ano,
        enviar_aprovacao: status === 'em_aprovacao',
        tipo,
        historico,
        categorias: categorias.map((c) => ({ categoria: c, previstoAnual: Number(valores[c] || 0) })),
      }),
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) return alert(payload.error || 'Falha ao criar orçamento')
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white p-5">
        <h3 className="text-lg font-bold">Orçamento anual</h3>
        <p className="text-sm text-slate-500">Passo {step}/4</p>

        {step === 1 && (
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <input className="rounded border px-3 py-2" value={nome} onChange={(e) => setNome(e.target.value)} />
            <input type="number" className="rounded border px-3 py-2" value={ano} onChange={(e) => setAno(Number(e.target.value || new Date().getFullYear()))} />
            <select className="rounded border px-3 py-2" value={tipo} onChange={(e) => setTipo(e.target.value as 'top-down' | 'bottom-up')}>
              <option value="top-down">Top-down</option>
              <option value="bottom-up">Bottom-up</option>
            </select>
            <label className="flex items-center gap-2 rounded border px-3 py-2"><input type="checkbox" checked={historico} onChange={(e) => setHistorico(e.target.checked)} /> Usar histórico</label>
          </div>
        )}

        {step === 2 && (
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {categorias.map((c) => (
              <label key={c} className="rounded border p-2 text-sm">
                <span className="block">{c}</span>
                <input type="number" className="mt-1 w-full rounded border px-2 py-1" value={valores[c] || 0} onChange={(e) => setValores((v) => ({ ...v, [c]: Number(e.target.value || 0) }))} />
              </label>
            ))}
          </div>
        )}

        {step === 3 && <div className="mt-3 rounded border p-3 text-sm">Distribuição por centro de custo será aplicada na edição por linha (opcional).</div>}
        {step === 4 && (
          <div className="mt-3 rounded border p-3 text-sm">
            <p><strong>Nome:</strong> {nome}</p>
            <p><strong>Ano:</strong> {ano}</p>
            <p><strong>Total geral:</strong> R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        )}

        <div className="mt-4 flex justify-between">
          <button className="rounded border px-3 py-2" onClick={() => setStep((s) => Math.max(1, s - 1))}>Anterior</button>
          <div className="flex gap-2">
            <button className="rounded border px-3 py-2" onClick={onClose}>Cancelar</button>
            {step < 4 ? <button className="rounded bg-blue-700 px-3 py-2 text-white" onClick={() => setStep((s) => Math.min(4, s + 1))}>Próximo</button> : (
              <>
                <button className="rounded border px-3 py-2" onClick={() => void salvar('rascunho')}>Salvar rascunho</button>
                <button className="rounded bg-emerald-600 px-3 py-2 text-white" onClick={() => void salvar('em_aprovacao')}>Enviar para aprovação</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
