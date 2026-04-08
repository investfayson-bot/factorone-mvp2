'use client'
import { useMemo, useState } from 'react'
import { maskBRLInput, parseBRLInput, formatBRL } from '@/lib/currency-brl'
import { supabase } from '@/lib/supabase'

type Props = { open: boolean; onClose: () => void; empresaId: string; contaId: string; onDone: () => void }
export default function ModalInvestir({ open, onClose, empresaId, contaId, onDone }: Props) {
  const [valorMask, setValorMask] = useState('R$ 1.000,00')
  const [tipo, setTipo] = useState('cdb')
  const [prazo, setPrazo] = useState(180)
  const [percentual, setPercentual] = useState(102)
  const valor = parseBRLInput(valorMask)
  const cdi = 10.5
  const resultado = useMemo(() => {
    const taxaAnual = (cdi * percentual) / 10000
    const bruto = valor * (1 + taxaAnual * (prazo / 365))
    const ir = bruto - valor > 0 ? (bruto - valor) * 0.175 : 0
    const liquido = bruto - ir
    return { bruto, ir, liquido, rent: valor ? ((liquido - valor) / valor) * 100 : 0 }
  }, [valor, prazo, percentual])
  if (!open) return null

  async function aplicar() {
    await supabase.from('investimentos').insert({
      empresa_id: empresaId, conta_id: contaId, tipo, nome: `${tipo.toUpperCase()} ${percentual}% CDI`,
      valor_aplicado: valor, valor_atual: resultado.liquido, percentual_cdi: percentual, data_aplicacao: new Date().toISOString().slice(0, 10),
      data_vencimento: new Date(Date.now() + prazo * 86400000).toISOString().slice(0, 10),
    })
    onDone(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-5">
        <h3 className="font-bold">Investir agora</h3>
        <input className="mt-2 w-full rounded border px-3 py-2" value={valorMask} onChange={(e) => setValorMask(maskBRLInput(e.target.value))} />
        <div className="mt-2 grid grid-cols-3 gap-2">
          <select className="rounded border px-3 py-2" value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="cdb">CDB</option><option value="lci">LCI</option><option value="lca">LCA</option><option value="tesouro_direto">Tesouro Selic</option></select>
          <select className="rounded border px-3 py-2" value={prazo} onChange={(e) => setPrazo(Number(e.target.value))}>{[30, 60, 90, 180, 360].map((d) => <option key={d} value={d}>{d} dias</option>)}</select>
          <select className="rounded border px-3 py-2" value={percentual} onChange={(e) => setPercentual(Number(e.target.value))}>{[100, 102, 104, 110].map((p) => <option key={p} value={p}>{p}% CDI</option>)}</select>
        </div>
        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">
          <p>Valor bruto: {formatBRL(resultado.bruto)}</p><p>IR estimado: {formatBRL(resultado.ir)}</p><p>Valor líquido: {formatBRL(resultado.liquido)}</p><p>Rentabilidade líquida: {resultado.rent.toFixed(2)}%</p>
        </div>
        <div className="mt-3 flex justify-end gap-2"><button className="rounded border px-3 py-2" onClick={onClose}>Cancelar</button><button className="rounded bg-blue-700 px-3 py-2 text-white" onClick={() => void aplicar()}>Aplicar agora</button></div>
      </div>
    </div>
  )
}
