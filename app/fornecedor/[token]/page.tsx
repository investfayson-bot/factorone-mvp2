'use client'

import { useEffect, useState } from 'react'
import { maskBRLInput, parseBRLInput } from '@/lib/currency-brl'
import { maskCpfCnpj } from '@/lib/masks'

type Info = { empresa_nome: string; descricao: string | null; valor_sugerido: number | null; data_vencimento_sugerida: string | null; categoria: string | null }

export default function FornecedorPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState('')
  const [info, setInfo] = useState<Info | null>(null)
  const [err, setErr] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [sending, setSending] = useState(false)
  const [form, setForm] = useState({
    fornecedor_nome: '', fornecedor_documento: '', descricao: '',
    valorMask: '', data_vencimento: '', tipo_pagamento: 'pix',
    chave_pix: '', codigo_barras: '', observacoes: '',
  })

  useEffect(() => {
    void params.then(p => {
      setToken(p.token)
      fetch(`/api/fornecedores/portal/${p.token}`)
        .then(r => r.json())
        .then((d: Info & { error?: string }) => {
          if (d.error) { setErr(d.error); return }
          setInfo(d)
          setForm(f => ({
            ...f,
            descricao: d.descricao || '',
            valorMask: d.valor_sugerido ? maskBRLInput(String(Math.round(d.valor_sugerido * 100))) : '',
            data_vencimento: d.data_vencimento_sugerida || '',
          }))
        })
        .catch(() => setErr('Erro ao carregar o portal'))
    })
  }, [params])

  async function enviar() {
    const valor = parseBRLInput(form.valorMask)
    if (!form.fornecedor_nome || valor <= 0 || !form.data_vencimento) {
      alert('Preencha nome, valor e data de vencimento')
      return
    }
    setSending(true)
    const res = await fetch(`/api/fornecedores/portal/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fornecedor_nome: form.fornecedor_nome,
        fornecedor_documento: form.fornecedor_documento,
        descricao: form.descricao,
        valor,
        data_vencimento: form.data_vencimento,
        tipo_pagamento: form.tipo_pagamento,
        chave_pix: form.chave_pix,
        codigo_barras: form.codigo_barras,
        observacoes: form.observacoes,
      }),
    })
    const out = await res.json() as { ok?: boolean; error?: string }
    setSending(false)
    if (out.ok) setEnviado(true)
    else alert(out.error || 'Erro ao enviar')
  }

  const inp: React.CSSProperties = {
    width: '100%', border: '1px solid #e2e8f0', borderRadius: 8,
    padding: '10px 14px', fontSize: 14, color: '#0f172a',
    background: '#fff', boxSizing: 'border-box', outline: 'none',
    fontFamily: 'Inter, sans-serif',
  }
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 5, display: 'block' }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#0A192F', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontFamily: 'Sora, sans-serif', fontSize: 18, fontWeight: 800, color: '#fff' }}>
          Factor<span style={{ color: '#00A896' }}>One</span>
        </div>
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.15)' }} />
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Portal do Fornecedor</div>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '40px 20px' }}>
        {err ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <span style={{ fontSize: 28 }}>⚠️</span>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Link inválido</h2>
            <p style={{ color: '#64748b', fontSize: 14 }}>{err}</p>
          </div>
        ) : enviado ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <span style={{ fontSize: 36 }}></span>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>Fatura enviada com sucesso!</h2>
            <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.6 }}>
              Seus dados foram recebidos por <strong>{info?.empresa_nome}</strong> e entrarão no sistema de contas a pagar.
            </p>
            <p style={{ color: '#94a3b8', fontSize: 12, marginTop: 12 }}>Você pode fechar esta janela.</p>
          </div>
        ) : !info ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8', fontSize: 14 }}>Carregando…</div>
        ) : (
          <>
            {/* Card intro */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 28, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#00A896', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>Convite de {info.empresa_nome}</p>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: '0 0 8px', fontFamily: 'Sora, sans-serif' }}>Envie sua fatura</h1>
              <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, margin: 0 }}>
                Preencha os dados abaixo. Sua fatura será cadastrada automaticamente no sistema financeiro de <strong>{info.empresa_nome}</strong>.
              </p>
              {info.descricao && (
                <div style={{ marginTop: 12, padding: '8px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, color: '#475569' }}>
                  <strong>Referência:</strong> {info.descricao}
                </div>
              )}
            </div>

            {/* Form */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 28, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={lbl}>Razão social / Nome *</label>
                    <input style={inp} placeholder="Sua empresa ou nome completo" value={form.fornecedor_nome} onChange={e => setForm(f => ({ ...f, fornecedor_nome: e.target.value }))} />
                  </div>
                  <div>
                    <label style={lbl}>CNPJ / CPF</label>
                    <input style={inp} placeholder="00.000.000/0001-00" value={form.fornecedor_documento} onChange={e => setForm(f => ({ ...f, fornecedor_documento: maskCpfCnpj(e.target.value) }))} />
                  </div>
                  <div>
                    <label style={lbl}>Valor da fatura *</label>
                    <input style={inp} placeholder="0,00" inputMode="decimal" value={form.valorMask} onChange={e => setForm(f => ({ ...f, valorMask: maskBRLInput(e.target.value) }))} />
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={lbl}>Descrição / Serviço prestado *</label>
                    <input style={inp} placeholder="Descreva o serviço ou produto" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
                  </div>
                  <div>
                    <label style={lbl}>Vencimento *</label>
                    <input style={inp} type="date" value={form.data_vencimento} onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))} />
                  </div>
                  <div>
                    <label style={lbl}>Forma de recebimento</label>
                    <select style={inp} value={form.tipo_pagamento} onChange={e => setForm(f => ({ ...f, tipo_pagamento: e.target.value }))}>
                      <option value="pix">PIX</option>
                      <option value="ted">TED / Transferência</option>
                      <option value="boleto">Boleto bancário</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>
                  {form.tipo_pagamento === 'pix' && (
                    <div style={{ gridColumn: '1/-1' }}>
                      <label style={lbl}>Chave PIX</label>
                      <input style={inp} placeholder="CNPJ, CPF, e-mail ou chave aleatória" value={form.chave_pix} onChange={e => setForm(f => ({ ...f, chave_pix: e.target.value }))} />
                    </div>
                  )}
                  {form.tipo_pagamento === 'boleto' && (
                    <div style={{ gridColumn: '1/-1' }}>
                      <label style={lbl}>Código de barras / Linha digitável</label>
                      <input style={inp} placeholder="00000.00000 00000.000000 00000.000000 0 00000000000000" value={form.codigo_barras} onChange={e => setForm(f => ({ ...f, codigo_barras: e.target.value }))} />
                    </div>
                  )}
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={lbl}>Observações</label>
                    <textarea style={{ ...inp, resize: 'vertical', minHeight: 70 }} placeholder="Informações adicionais (número da NF, contrato, etc.)" value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={sending}
                  onClick={() => void enviar()}
                  style={{
                    padding: '13px 24px', borderRadius: 10, border: 'none',
                    background: '#00A896', color: '#fff', fontSize: 14, fontWeight: 700,
                    cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.7 : 1,
                    width: '100%',
                  }}
                >
                  {sending ? 'Enviando…' : 'Enviar fatura para ' + info.empresa_nome}
                </button>

                <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', margin: 0 }}>
                  Seus dados são enviados com segurança via criptografia TLS e armazenados apenas para fins de pagamento.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
