'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { formatBRL, maskBRLInput, parseBRLInput } from '@/lib/currency-brl'

export type DespesaEdit = {
  id: string
  descricao: string
  valor: number
  categoria: string
  centro_custo_id: string | null
  responsavel_id: string | null
  tipo_pagamento: string | null
  data_despesa: string
  data_vencimento: string | null
  observacao: string | null
  recorrente: boolean
  recorrencia_tipo: string | null
  comprovante_url: string | null
}

type Props = {
  open: boolean
  onClose: () => void
  empresaId: string
  userId: string
  userName: string | null
  categorias: string[]
  centros: { id: string; nome: string }[]
  membros: { id: string; nome: string | null }[]
  onSaved: () => void
  edit?: DespesaEdit | null
  onCentroCriado?: (c: { id: string; nome: string }) => void
}

const TIPOS_PAG = [
  { v: '', l: '—' },
  { v: 'cartao', l: 'Cartão' },
  { v: 'pix', l: 'PIX' },
  { v: 'transferencia', l: 'Transferência' },
  { v: 'boleto', l: 'Boleto' },
  { v: 'dinheiro', l: 'Dinheiro' },
  { v: 'outro', l: 'Outro' },
]

const RECORR = [
  { v: 'mensal', l: 'Mensal' },
  { v: 'semanal', l: 'Semanal' },
  { v: 'trimestral', l: 'Trimestral' },
  { v: 'anual', l: 'Anual' },
]

export default function NovaDespesaModal({
  open,
  onClose,
  empresaId,
  userId,
  userName,
  categorias,
  centros,
  membros,
  onSaved,
  edit,
  onCentroCriado,
}: Props) {
  const [valorMask, setValorMask] = useState('')
  const [form, setForm] = useState({
    descricao: '',
    categoria: '',
    centro_custo_id: '',
    responsavel_id: '',
    tipo_pagamento: '',
    data_despesa: new Date().toISOString().slice(0, 10),
    data_vencimento: '',
    observacao: '',
    recorrente: false,
    recorrencia_tipo: 'mensal',
  })
  const [novoCentro, setNovoCentro] = useState('')
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)

  const reset = useCallback(() => {
    setValorMask('')
    setForm({
      descricao: '',
      categoria: categorias[0] ?? '',
      centro_custo_id: '',
      responsavel_id: userId,
      tipo_pagamento: '',
      data_despesa: new Date().toISOString().slice(0, 10),
      data_vencimento: '',
      observacao: '',
      recorrente: false,
      recorrencia_tipo: 'mensal',
    })
    setFile(null)
    setNovoCentro('')
  }, [categorias, userId])

  useEffect(() => {
    if (!open) return
    if (edit) {
      setForm({
        descricao: edit.descricao,
        categoria: edit.categoria,
        centro_custo_id: edit.centro_custo_id ?? '',
        responsavel_id: edit.responsavel_id ?? userId,
        tipo_pagamento: edit.tipo_pagamento ?? '',
        data_despesa: (edit.data_despesa || '').slice(0, 10),
        data_vencimento: edit.data_vencimento ? edit.data_vencimento.slice(0, 10) : '',
        observacao: edit.observacao ?? '',
        recorrente: !!edit.recorrente,
        recorrencia_tipo: edit.recorrencia_tipo ?? 'mensal',
      })
      setValorMask(
        edit.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      )
    } else {
      reset()
    }
  }, [open, edit, userId, reset])

  async function criarCentroRapido() {
    const n = novoCentro.trim()
    if (n.length < 2) {
      toast.error('Nome do centro muito curto')
      return
    }
    const { data, error } = await supabase
      .from('centros_custo')
      .insert({ empresa_id: empresaId, nome: n })
      .select('id, nome')
      .single()
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Centro criado')
    setForm((f) => ({ ...f, centro_custo_id: data.id }))
    setNovoCentro('')
    onCentroCriado?.(data)
  }

  /** Salva caminho no bucket (privado); leitura via signed URL na listagem. */
  async function uploadComprovante(): Promise<string | null> {
    if (!file) return edit?.comprovante_url ?? null
    const path = `${empresaId}/${Date.now()}_${file.name.replace(/[^\w.-]/g, '_')}`
    const { error } = await supabase.storage.from('comprovantes').upload(path, file, {
      upsert: false,
    })
    if (error) {
      toast.error(error.message)
      return null
    }
    return path
  }

  async function salvar() {
    const valor = parseBRLInput(valorMask)
    if (!form.descricao.trim() || valor <= 0) {
      toast.error('Preencha descrição e valor válido')
      return
    }
    if (!form.categoria) {
      toast.error('Selecione uma categoria')
      return
    }
    setLoading(true)
    try {
      const comprovante_url = await uploadComprovante()
      if (file && !comprovante_url) {
        setLoading(false)
        return
      }

      const respNome =
        membros.find((m) => m.id === (form.responsavel_id || userId))?.nome || userName
      const payload = {
        empresa_id: empresaId,
        descricao: form.descricao.trim(),
        valor,
        categoria: form.categoria,
        centro_custo_id: form.centro_custo_id || null,
        responsavel_id: form.responsavel_id || userId,
        responsavel_nome: respNome,
        tipo_pagamento: form.tipo_pagamento || null,
        data_despesa: form.data_despesa,
        data: form.data_despesa,
        data_vencimento: form.data_vencimento || null,
        observacao: form.observacao?.trim() || null,
        recorrente: form.recorrente,
        recorrencia_tipo: form.recorrente ? form.recorrencia_tipo : null,
        comprovante_url: comprovante_url ?? undefined,
        created_by: userId,
      }

      if (edit) {
        const { created_by: _omitCreatedBy, ...updatePayload } = payload
        void _omitCreatedBy
        const { error } = await supabase.from('despesas').update(updatePayload).eq('id', edit.id)
        if (error) throw error
        toast.success('Despesa atualizada')
      } else {
        const { error } = await supabase.from('despesas').insert({
          ...payload,
          status: 'pendente_aprovacao',
        })
        if (error) throw error
        toast.success('Despesa registrada — aguardando aprovação')
      }
      onSaved()
      onClose()
      reset()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao salvar'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-slate-800">
          {edit ? 'Editar despesa' : 'Nova despesa'}
        </h2>
        <p className="mb-4 text-sm text-slate-500">
          Campos com <span className="text-red-500">*</span> são obrigatórios.
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600">Descrição *</label>
            <input
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-800 outline-none ring-blue-100 focus:border-blue-400 focus:ring-2"
              placeholder="Ex.: Assinatura software"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Valor *</label>
            <input
              value={valorMask}
              onChange={(e) => setValorMask(maskBRLInput(e.target.value))}
              inputMode="decimal"
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-800 outline-none ring-blue-100 focus:border-blue-400 focus:ring-2"
              placeholder="0,00"
            />
            <p className="mt-0.5 text-xs text-slate-400">
              {valorMask ? formatBRL(parseBRLInput(valorMask)) : ''}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600">Categoria *</label>
              <select
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                {categorias.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Centro de custo</label>
              <select
                value={form.centro_custo_id}
                onChange={(e) => setForm({ ...form, centro_custo_id: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">— Nenhum —</option>
                {centros.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-3">
            <div className="min-w-[140px] flex-1">
              <label className="text-xs font-medium text-slate-600">Novo centro (rápido)</label>
              <input
                value={novoCentro}
                onChange={(e) => setNovoCentro(e.target.value)}
                placeholder="Nome"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
              />
            </div>
            <button
              type="button"
              onClick={() => void criarCentroRapido()}
              className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              + Criar
            </button>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Responsável</label>
            <select
              value={form.responsavel_id || userId}
              onChange={(e) => setForm({ ...form, responsavel_id: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              {membros.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome || m.id.slice(0, 8) + '…'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Tipo de pagamento</label>
            <select
              value={form.tipo_pagamento}
              onChange={(e) => setForm({ ...form, tipo_pagamento: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              {TIPOS_PAG.map((t) => (
                <option key={t.v || 'empty'} value={t.v}>
                  {t.l}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600">Data da despesa</label>
              <input
                type="date"
                value={form.data_despesa}
                onChange={(e) => setForm({ ...form, data_despesa: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-800"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Vencimento</label>
              <input
                type="date"
                value={form.data_vencimento}
                onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-800"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Observações</label>
            <textarea
              value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
              rows={2}
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.recorrente}
                onChange={(e) => setForm({ ...form, recorrente: e.target.checked })}
                className="rounded border-slate-300"
              />
              Recorrente
            </label>
            {form.recorrente && (
              <select
                value={form.recorrencia_tipo}
                onChange={(e) => setForm({ ...form, recorrencia_tipo: e.target.value })}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                {RECORR.map((r) => (
                  <option key={r.v} value={r.v}>
                    {r.l}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Comprovante</label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 w-full text-sm text-slate-600"
            />
            {edit?.comprovante_url && !file && (
              <p className="mt-1 text-xs text-slate-500">
                Há um comprovante anexado — abra pela lista (ações → Ver comprovante).
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void salvar()}
            className="rounded-xl bg-blue-700 px-5 py-2.5 font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60"
          >
            {loading ? 'Salvando…' : edit ? 'Salvar' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  )
}
