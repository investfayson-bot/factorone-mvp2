'use client'

import { useState } from 'react'
import { maskBRLInput, parseBRLInput } from '@/lib/currency-brl'
import { supabase } from '@/lib/supabase'

type Props = { open: boolean; onClose: () => void; onSaved: () => void }

export default function NovaContaPagarModal({ open, onClose, onSaved }: Props) {
  const [fornecedor, setFornecedor] = useState('')
  const [documento, setDocumento] = useState('')
  const [descricao, setDescricao] = useState('')
  const [categoria, setCategoria] = useState('Outros')
  const [valorMask, setValorMask] = useState('')
  const [emissao, setEmissao] = useState(new Date().toISOString().slice(0, 10))
  const [vencimento, setVencimento] = useState(new Date().toISOString().slice(0, 10))
  const [tipo, setTipo] = useState('pix')
  const [codigoBarras, setCodigoBarras] = useState('')
  const [chavePix, setChavePix] = useState('')
  const [parcelas, setParcelas] = useState(1)
  const [recorrente, setRecorrente] = useState(false)
  const [recorrenciaTipo, setRecorrenciaTipo] = useState('mensal')
  const [obs, setObs] = useState('')
  if (!open) return null

  async function salvar() {
    const { data: sess } = await supabase.auth.getSession()
    const token = sess.session?.access_token
    const res = await fetch('/api/financeiro/pagar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        fornecedor_nome: fornecedor,
        fornecedor_documento: documento,
        descricao,
        categoria,
        valor: parseBRLInput(valorMask),
        data_emissao: emissao,
        data_vencimento: vencimento,
        tipo_pagamento: tipo,
        codigo_barras: codigoBarras || null,
        chave_pix: chavePix || null,
        parcelas,
        recorrente,
        recorrencia_tipo: recorrente ? recorrenciaTipo : null,
        observacoes: obs,
      }),
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) return alert(payload.error || 'Falha ao salvar')
    onSaved()
    onClose()
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 600, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="modal-title">
          Nova Conta a Pagar
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <input className="form-input" placeholder="Fornecedor*" value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} />
          <input className="form-input" placeholder="CNPJ/CPF fornecedor" value={documento} onChange={(e) => setDocumento(e.target.value)} />
          <input className="form-input" placeholder="Descrição*" value={descricao} onChange={(e) => setDescricao(e.target.value)} style={{ gridColumn: 'span 2' }} />
          <input className="form-input" placeholder="Categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} />
          <input className="form-input" placeholder="Valor*" value={valorMask} onChange={(e) => setValorMask(maskBRLInput(e.target.value))} />
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Emissão</label>
            <input type="date" className="form-input" value={emissao} onChange={(e) => setEmissao(e.target.value)} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Vencimento</label>
            <input type="date" className="form-input" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
          </div>
          <select className="form-input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="pix">PIX</option>
            <option value="ted">TED</option>
            <option value="boleto">Boleto</option>
            <option value="cartao">Cartão</option>
            <option value="dinheiro">Dinheiro</option>
            <option value="outro">Outro</option>
          </select>
          <input className="form-input" placeholder="Código de barras" value={codigoBarras} onChange={(e) => setCodigoBarras(e.target.value)} />
          <input className="form-input" placeholder="Chave PIX" value={chavePix} onChange={(e) => setChavePix(e.target.value)} />
          <input type="number" className="form-input" placeholder="Parcelas" value={parcelas} onChange={(e) => setParcelas(Number(e.target.value || 1))} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--navy)', border: '1px solid var(--gray-100)', borderRadius: 8, padding: '8px 12px' }}>
            <input type="checkbox" checked={recorrente} onChange={(e) => setRecorrente(e.target.checked)} />
            Recorrente
          </label>
          {recorrente && (
            <select className="form-input" value={recorrenciaTipo} onChange={(e) => setRecorrenciaTipo(e.target.value)}>
              <option value="semanal">Semanal</option>
              <option value="mensal">Mensal</option>
              <option value="trimestral">Trimestral</option>
              <option value="anual">Anual</option>
            </select>
          )}
          <textarea className="form-input" placeholder="Observações" value={obs} onChange={(e) => setObs(e.target.value)} style={{ gridColumn: 'span 2', minHeight: 60, resize: 'vertical' }} />
        </div>
        <div className="modal-actions">
          <button className="btn-action btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-action" onClick={() => void salvar()}>Salvar</button>
        </div>
      </div>
    </div>
  )
}
