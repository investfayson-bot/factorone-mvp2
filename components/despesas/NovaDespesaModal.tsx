'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { formatBRL, maskBRLInput, parseBRLInput } from '@/lib/currency-brl'
import { sugerirCategoriaDespesa } from '@/lib/despesas-categorizacao'

export type DespesaEdit = {
  id: string; descricao: string; valor: number; categoria: string
  centro_custo_id: string | null; responsavel_id: string | null
  tipo_pagamento: string | null; data_despesa: string; data_vencimento: string | null
  observacao: string | null; recorrente: boolean; recorrencia_tipo: string | null
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
  { v: '', l: '—' }, { v: 'cartao', l: 'Cartão' }, { v: 'pix', l: 'PIX' },
  { v: 'transferencia', l: 'Transferência' }, { v: 'boleto', l: 'Boleto' },
  { v: 'dinheiro', l: 'Dinheiro' }, { v: 'outro', l: 'Outro' },
]

const RECORR = [
  { v: 'mensal', l: 'Mensal' }, { v: 'semanal', l: 'Semanal' }, { v: 'bisemanal', l: 'Bisemanal' },
]

export default function NovaDespesaModal({
  open, onClose, empresaId, userId, userName, categorias, centros, membros,
  onSaved, edit, onCentroCriado,
}: Props) {
  const [valorMask, setValorMask] = useState('')
  const [form, setForm] = useState({
    descricao: '', categoria: '', centro_custo_id: '', responsavel_id: '',
    tipo_pagamento: '', data_despesa: new Date().toISOString().slice(0, 10),
    data_vencimento: '', observacao: '', recorrente: false, recorrencia_tipo: 'mensal',
  })
  const [novoCentro, setNovoCentro] = useState('')
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [centroDisponivel, setCentroDisponivel] = useState(true)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [sugestaoCategoria, setSugestaoCategoria] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const reset = useCallback(() => {
    setValorMask('')
    setForm({
      descricao: '', categoria: categorias[0] ?? '', centro_custo_id: '',
      responsavel_id: userId, tipo_pagamento: '',
      data_despesa: new Date().toISOString().slice(0, 10),
      data_vencimento: '', observacao: '', recorrente: false, recorrencia_tipo: 'mensal',
    })
    setFile(null)
    setNovoCentro('')
    setSugestaoCategoria(null)
  }, [categorias, userId])

  useEffect(() => {
    if (!open) return
    setCentroDisponivel(true)
    if (edit) {
      setForm({
        descricao: edit.descricao, categoria: edit.categoria,
        centro_custo_id: edit.centro_custo_id ?? '',
        responsavel_id: edit.responsavel_id ?? userId,
        tipo_pagamento: edit.tipo_pagamento ?? '',
        data_despesa: (edit.data_despesa || '').slice(0, 10),
        data_vencimento: edit.data_vencimento ? edit.data_vencimento.slice(0, 10) : '',
        observacao: edit.observacao ?? '', recorrente: !!edit.recorrente,
        recorrencia_tipo: edit.recorrencia_tipo ?? 'mensal',
      })
      setValorMask(edit.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
    } else {
      reset()
    }
  }, [open, edit, userId, reset])

  async function criarCentroRapido() {
    const n = novoCentro.trim()
    if (n.length < 2) { toast.error('Nome do centro muito curto'); return }
    const { data, error } = await supabase.from('centros_custo').insert({ empresa_id: empresaId, nome: n }).select('id, nome').single()
    if (error) { setCentroDisponivel(false); toast.error('Centro de custo indisponível. Aplique a migration de despesas.'); return }
    setCentroDisponivel(true)
    toast.success('Centro criado')
    setForm((f) => ({ ...f, centro_custo_id: data.id }))
    setNovoCentro('')
    onCentroCriado?.(data)
  }

  async function uploadComprovante(): Promise<string | null> {
    if (!file) return edit?.comprovante_url ?? null
    const path = `${empresaId}/${Date.now()}_${file.name.replace(/[^\w.-]/g, '_')}`
    const { error } = await supabase.storage.from('comprovantes').upload(path, file, { upsert: false })
    if (error) { toast.error(error.message); return null }
    return path
  }

  async function salvar() {
    const valor = parseBRLInput(valorMask)
    if (!form.descricao.trim() || valor <= 0) { toast.error('Preencha descrição e valor válido'); return }
    if (!form.categoria) { toast.error('Selecione uma categoria'); return }
    setLoading(true)
    try {
      const dataRef = new Date(form.data_despesa || new Date().toISOString().slice(0, 10))
      const mes = dataRef.getMonth() + 1
      const ano = dataRef.getFullYear()
      const { data: orc } = await supabase.from('orcamentos').select('id').eq('empresa_id', empresaId).eq('ano_fiscal', ano).in('status', ['ativo', 'aprovado']).order('versao', { ascending: false }).limit(1).maybeSingle()
      if (orc) {
        const { data: linha } = await supabase.from('orcamento_linhas').select('valor_previsto,valor_realizado').eq('orcamento_id', orc.id).eq('categoria', form.categoria).eq('mes', mes).eq('ano', ano).is('centro_custo_id', null).maybeSingle()
        if (linha) {
          const previsto = Number(linha.valor_previsto || 0)
          const realizadoApos = Number(linha.valor_realizado || 0) + valor
          if (realizadoApos > previsto && previsto > 0) {
            const pct = ((realizadoApos / previsto) * 100).toFixed(1)
            const ok = window.confirm(`⚠️ Esta despesa ultrapassará o orçamento (${pct}% do previsto).\n\nDeseja salvar mesmo assim?`)
            if (!ok) { setLoading(false); return }
          }
        }
      }
      const comprovante_url = await uploadComprovante()
      if (file && !comprovante_url) { setLoading(false); return }
      const categoriaFinal = form.categoria || sugerirCategoriaDespesa(form.descricao, categorias)
      const respNome = membros.find((m) => m.id === (form.responsavel_id || userId))?.nome || userName
      const payload = {
        empresa_id: empresaId, descricao: form.descricao.trim(), valor,
        categoria: categoriaFinal, centro_custo_id: centroDisponivel ? form.centro_custo_id || null : null,
        responsavel_id: form.responsavel_id || userId, responsavel_nome: respNome,
        tipo_pagamento: form.tipo_pagamento || null, data_despesa: form.data_despesa,
        data: form.data_despesa, data_vencimento: form.recorrente ? null : form.data_vencimento || null,
        observacao: form.observacao?.trim() || null, recorrente: form.recorrente,
        recorrencia_tipo: form.recorrente ? form.recorrencia_tipo : null,
        comprovante_url: comprovante_url ?? undefined, created_by: userId,
      }
      if (edit) {
        const { created_by: _cb, ...upd } = payload; void _cb
        const { error } = await supabase.from('despesas').update(upd).eq('id', edit.id)
        if (error) throw error
        toast.success('Despesa atualizada')
      } else {
        const { error } = await supabase.from('despesas').insert({ ...payload, status: 'pendente_aprovacao' })
        if (error) throw error
        toast.success('Despesa registrada — aguardando aprovação')
      }
      onSaved(); onClose(); reset()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setLoading(false)
    }
  }

  function sugerirCategoria(descricao: string): string {
    return sugerirCategoriaDespesa(descricao, categorias)
  }

  async function preencherComOcr() {
    if (!file) { toast.error('Selecione um comprovante ou extrato (imagem/PDF)'); return }
    setOcrLoading(true)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/despesas/extrair-comprovante', {
        method: 'POST',
        headers: sess.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : undefined,
        body: fd,
      })
      const out = (await res.json()) as { error?: string; extracted?: { merchant?: string; amount?: number | null; issue_date?: string | null; due_date?: string | null; description?: string; suggested_category?: string } }
      if (!res.ok) throw new Error(out.error || 'Falha ao ler comprovante')
      const e = out.extracted ?? {}
      if (e.amount && e.amount > 0) setValorMask(maskBRLInput(String(Math.round(e.amount * 100))))
      setForm((prev) => ({
        ...prev,
        descricao: prev.descricao || e.merchant || e.description || prev.descricao,
        data_despesa: e.issue_date || prev.data_despesa,
        data_vencimento: e.due_date || prev.data_vencimento,
      }))
      const sug = e.suggested_category || sugerirCategoria(`${e.merchant || ''} ${e.description || ''}`)
      if (sug) setSugestaoCategoria(sug)
      toast.success('Dados extraídos. Confira e confirme.')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Falha no OCR')
    } finally {
      setOcrLoading(false)
    }
  }

  if (!open) return null

  const inp: React.CSSProperties = {
    width: '100%', border: '1px solid var(--gray-100)', borderRadius: 8,
    padding: '8px 12px', fontSize: 13, color: 'var(--navy)',
    background: '#fff', boxSizing: 'border-box', outline: 'none',
  }
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 4, display: 'block' }

  return (
    <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 className="modal-title">{edit ? 'Editar despesa' : 'Nova despesa'}</h3>
          <button className="modal-close" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>

        {/* OCR Zone — destaque */}
        <div
          style={{
            border: file ? '2px solid var(--teal)' : '2px dashed var(--gray-100)',
            borderRadius: 12, padding: 16, marginBottom: 20, textAlign: 'center',
            background: file ? 'rgba(0,168,150,0.04)' : '#fafafa', cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {file ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <i className="fa-solid fa-file-image" style={{ fontSize: 22, color: 'var(--teal)' }} />
                <div style={{ textAlign: 'left' }}>
                  <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--navy)', margin: 0 }}>{file.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--gray-400)', margin: 0 }}>{(file.size / 1024).toFixed(0)} KB</p>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); void preencherComOcr() }}
                disabled={ocrLoading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                  borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12,
                  background: 'var(--teal)', color: '#fff', opacity: ocrLoading ? 0.7 : 1,
                }}
              >
                <i className="fa-solid fa-wand-magic-sparkles" />
                {ocrLoading ? 'Lendo…' : 'Ler com IA'}
              </button>
            </div>
          ) : (
            <>
              <i className="fa-solid fa-camera" style={{ fontSize: 28, color: 'var(--gray-400)', marginBottom: 8 }} />
              <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--navy)', margin: '0 0 2px' }}>Escanear comprovante ou NF</p>
              <p style={{ fontSize: 11, color: 'var(--gray-400)', margin: 0 }}>Clique para fazer upload · IA preenche os campos automaticamente</p>
            </>
          )}
        </div>

        {/* Sugestão de categoria por IA */}
        {sugestaoCategoria && (
          <div style={{ margin: '0 0 16px', padding: '10px 14px', borderRadius: 10, background: '#f0fdf4', border: '1px solid #86efac', fontSize: 12 }}>
            <span style={{ color: '#166534' }}>FactorOne IA sugeriu categoria: </span>
            <strong style={{ color: '#14532d' }}>{sugestaoCategoria}</strong>
            <button type="button" onClick={() => { setForm(f => ({ ...f, categoria: sugestaoCategoria })); setSugestaoCategoria(null) }}
              style={{ marginLeft: 10, color: '#15803d', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: 12 }}>
              Aplicar
            </button>
            <button type="button" onClick={() => setSugestaoCategoria(null)}
              style={{ marginLeft: 6, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: 12 }}>
              Ignorar
            </button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Descrição */}
          <div>
            <label style={lbl}>Descrição *</label>
            <input style={inp} placeholder="Ex.: Assinatura software" value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            <button type="button" onClick={() => setForm(f => ({ ...f, categoria: sugerirCategoria(f.descricao) }))}
              style={{ marginTop: 4, fontSize: 11, color: 'var(--teal)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              Sugerir categoria pela descrição
            </button>
          </div>

          {/* Valor */}
          <div>
            <label style={lbl}>Valor *</label>
            <input style={inp} placeholder="0,00" inputMode="decimal" value={valorMask}
              onChange={(e) => setValorMask(maskBRLInput(e.target.value))} />
            {valorMask && <p style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>{formatBRL(parseBRLInput(valorMask))}</p>}
          </div>

          {/* Categoria + Centro */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={lbl}>Categoria *</label>
              <select style={inp} value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
                {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {!form.recorrente && (
              <div>
                <label style={lbl}>Centro de custo</label>
                <select style={inp} disabled={!centroDisponivel} value={form.centro_custo_id}
                  onChange={(e) => setForm({ ...form, centro_custo_id: e.target.value })}>
                  <option value="">— Nenhum —</option>
                  {centros.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Novo centro rápido */}
          <div style={{ display: 'flex', gap: 8, padding: 10, borderRadius: 8, border: '1px dashed var(--gray-100)', background: '#fafafa', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Novo centro (rápido)</label>
              <input style={inp} disabled={!centroDisponivel} placeholder="Nome do centro" value={novoCentro}
                onChange={(e) => setNovoCentro(e.target.value)} />
            </div>
            <button type="button" disabled={!centroDisponivel} onClick={() => void criarCentroRapido()}
              style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--navy)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: centroDisponivel ? 1 : 0.5, whiteSpace: 'nowrap' }}>
              + Criar
            </button>
          </div>

          {/* Responsável + Pagamento */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={lbl}>Responsável</label>
              <select style={inp} value={form.responsavel_id || userId} onChange={(e) => setForm({ ...form, responsavel_id: e.target.value })}>
                {membros.map((m) => <option key={m.id} value={m.id}>{m.nome || m.id.slice(0, 8) + '…'}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Tipo de pagamento</label>
              <select style={inp} value={form.tipo_pagamento} onChange={(e) => setForm({ ...form, tipo_pagamento: e.target.value })}>
                {TIPOS_PAG.map((t) => <option key={t.v || 'empty'} value={t.v}>{t.l}</option>)}
              </select>
            </div>
          </div>

          {/* Datas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={lbl}>Data da despesa</label>
              <input style={inp} type="date" value={form.data_despesa} onChange={(e) => setForm({ ...form, data_despesa: e.target.value })} />
            </div>
            <div>
              <label style={lbl}>Vencimento</label>
              <input style={inp} type="date" value={form.data_vencimento} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} />
            </div>
          </div>

          {/* Observações */}
          <div>
            <label style={lbl}>Observações</label>
            <textarea style={{ ...inp, resize: 'vertical', minHeight: 54 }} rows={2} value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
          </div>

          {/* Recorrente */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--navy)', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.recorrente} onChange={(e) => setForm({ ...form, recorrente: e.target.checked })} />
              Despesa recorrente
            </label>
            {form.recorrente && (
              <select style={{ ...inp, width: 'auto' }} value={form.recorrencia_tipo} onChange={(e) => setForm({ ...form, recorrencia_tipo: e.target.value })}>
                {RECORR.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
              </select>
            )}
          </div>

          {/* Comprovante existente */}
          {edit?.comprovante_url && !file && (
            <p style={{ fontSize: 11, color: 'var(--gray-400)', margin: 0 }}>
              Comprovante atual mantido. Para substituir, clique na zona de upload acima.
            </p>
          )}
        </div>

        <div className="modal-actions" style={{ marginTop: 24 }}>
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-action" disabled={loading} onClick={() => void salvar()}>
            {loading ? 'Salvando…' : edit ? 'Salvar' : 'Registrar despesa'}
          </button>
        </div>
      </div>
    </div>
  )
}
