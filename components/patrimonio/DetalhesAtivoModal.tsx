'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'

type Props = {
  open: boolean
  onClose: () => void
  ativo: { id: string; nome: string; categoria?: string; foto_url?: string | null; localizacao?: string | null; responsavel_nome?: string | null; valor_contabil: number }
}

export default function DetalhesAtivoModal({ open, onClose, ativo }: Props) {
  const [depreciacoes, setDepreciacoes] = useState<Array<{ competencia: string; valor_depreciacao: number; valor_contabil_apos: number }>>([])
  const [manutencoes, setManutencoes] = useState<Array<{ tipo: string; descricao: string; data_manutencao: string; custo: number }>>([])

  useEffect(() => {
    if (!open) return
    void (async () => {
      const [d, m] = await Promise.all([
        supabase.from('depreciacoes').select('competencia,valor_depreciacao,valor_contabil_apos').eq('ativo_id', ativo.id).order('competencia', { ascending: false }).limit(24),
        supabase.from('manutencoes_ativo').select('tipo,descricao,data_manutencao,custo').eq('ativo_id', ativo.id).order('data_manutencao', { ascending: false }).limit(24),
      ])
      setDepreciacoes((d.data || []) as Array<{ competencia: string; valor_depreciacao: number; valor_contabil_apos: number }>)
      setManutencoes((m.data || []) as Array<{ tipo: string; descricao: string; data_manutencao: string; custo: number }>)
    })()
  }, [open, ativo.id])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold">{ativo.nome}</h3>
            <p className="text-sm text-slate-500">{ativo.categoria || 'Sem categoria'} • {ativo.localizacao || 'Sem localização'}</p>
          </div>
          <button className="rounded border px-3 py-2" onClick={onClose}>Fechar</button>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border p-4">
            <h4 className="font-semibold">Dados gerais</h4>
            <p className="text-sm">Responsável: {ativo.responsavel_nome || '—'}</p>
            <p className="text-sm">Valor contábil: {formatBRL(Number(ativo.valor_contabil || 0))}</p>
          </div>
          <div className="rounded-xl border p-4">
            <h4 className="font-semibold">Depreciação (histórico)</h4>
            <div className="mt-2 space-y-1 text-sm">
              {depreciacoes.map((d) => <div key={d.competencia} className="flex justify-between"><span>{d.competencia}</span><span>{formatBRL(Number(d.valor_depreciacao || 0))}</span></div>)}
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-xl border p-4">
          <h4 className="font-semibold">Manutenções</h4>
          <div className="mt-2 space-y-1 text-sm">
            {manutencoes.map((m, i) => <div key={String(i)} className="flex justify-between"><span>{m.data_manutencao} • {m.tipo} • {m.descricao}</span><span>{formatBRL(Number(m.custo || 0))}</span></div>)}
          </div>
        </div>
      </div>
    </div>
  )
}
