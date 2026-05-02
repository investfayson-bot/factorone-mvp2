'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

type ImpostosNF = { icms?: number; pis?: number; cofins?: number }

type AnaliseNFResult = {
  id: string
  numero?: string
  emitente_nome?: string
  data_emissao?: string
  valor_total?: number
  impostos?: ImpostosNF
  classificacao?: string
  adequado_para_factoring?: boolean
}

type NotaFiscalLista = {
  id: string
  data_emissao: string | null
  emitente_nome: string | null
  valor_total: number | null
  classificacao: string | null
  status: string | null
}

const card: React.CSSProperties = { background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 16, marginBottom: 14 }

export default function NotasRecebidas() {
  const fileRef = useRef<HTMLInputElement>(null)
  const camRef = useRef<HTMLInputElement>(null)
  const [texto, setTexto] = useState('')
  const [preview, setPreview] = useState('')
  const [imagemPreview, setImagemPreview] = useState('')
  const [resultado, setResultado] = useState<AnaliseNFResult | null>(null)
  const [notas, setNotas] = useState<NotaFiscalLista[]>([])
  const [loading, setLoading] = useState(false)

  const carregarNotas = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: usrRow } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const empresaId = usrRow?.empresa_id ?? user.id
    const { data } = await supabase
      .from('notas_fiscais')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })
    setNotas((data ?? []) as NotaFiscalLista[])
  }, [])

  useEffect(() => { void carregarNotas() }, [carregarNotas])

  async function handleArquivo(file?: File) {
    if (!file) return
    const ext = file.name.toLowerCase()
    if (ext.endsWith('.xml') || ext.endsWith('.txt')) {
      const t = await file.text()
      setTexto(t); setPreview(t.slice(0, 200)); setImagemPreview('')
      return
    }
    if (ext.endsWith('.pdf')) {
      const t = await file.text().catch(() => 'PDF enviado')
      setTexto(t || 'PDF enviado'); setPreview((t || 'PDF enviado').slice(0, 200)); setImagemPreview('')
      return
    }
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = String(reader.result || '')
        setTexto(base64); setImagemPreview(base64); setPreview('Imagem selecionada para OCR')
      }
      reader.readAsDataURL(file)
    }
  }

  async function analisar() {
    if (!texto) return
    setLoading(true)
    const res = await fetch('/api/nota-fiscal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto }) })
    const data = await res.json()
    if (res.ok && data.nota) { setResultado(data.nota as AnaliseNFResult); await carregarNotas() }
    setLoading(false)
  }

  async function enviarCaptacao(id: string) {
    await supabase.from('notas_fiscais').update({ status: 'aguardando_captacao' }).eq('id', id)
    await carregarNotas()
  }

  function statusColor(s: string) {
    if (s === 'aprovada') return { bg: 'rgba(45,155,111,.12)', color: 'var(--green)' }
    if (s === 'rejeitada') return { bg: 'rgba(192,80,74,.1)', color: 'var(--red)' }
    if (s === 'aguardando_captacao') return { bg: 'rgba(94,140,135,.12)', color: 'var(--teal)' }
    return { bg: 'var(--gray-100)', color: 'var(--gray-400)' }
  }

  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 14 }}>
        <strong style={{ color: 'var(--navy)' }}>Recebidas</strong> — upload, OCR, câmera ou texto para leitura inteligente.
      </div>

      {/* Upload options */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
        <button type="button" onClick={() => fileRef.current?.click()} style={{ ...card, margin: 0, cursor: 'pointer', textAlign: 'left' }}>
          <div style={{ fontSize: 18, marginBottom: 8 }}>📄</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>Arquivo</div>
          <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>XML, PDF ou imagem</div>
        </button>
        <button type="button" onClick={() => camRef.current?.click()} style={{ ...card, margin: 0, cursor: 'pointer', textAlign: 'left' }}>
          <div style={{ fontSize: 18, marginBottom: 8 }}>📷</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>Câmera / Foto</div>
          <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>Capture a NF</div>
        </button>
        <div style={{ ...card, margin: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>📋 Colar texto</div>
          <textarea
            value={texto}
            onChange={(e) => { setTexto(e.target.value); setPreview(e.target.value.slice(0, 200)); setImagemPreview('') }}
            className="form-input"
            style={{ minHeight: 60, resize: 'vertical', width: '100%' }}
            placeholder="Cole XML ou texto da NF..."
          />
        </div>
      </div>

      <input ref={fileRef} type="file" accept=".xml,.pdf,image/*" style={{ display: 'none' }} onChange={(e) => handleArquivo(e.target.files?.[0])} />
      <input ref={camRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => handleArquivo(e.target.files?.[0])} />

      {/* Preview + analyze */}
      <div style={card}>
        <div style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 10 }}>
          ✉ Encaminhar para: <span style={{ color: 'var(--navy)', fontWeight: 600 }}>nf@factorone.com.br</span>
        </div>
        {imagemPreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imagemPreview} alt="preview" style={{ maxHeight: 200, borderRadius: 8, border: '1px solid var(--gray-100)', marginBottom: 12 }} />
        ) : (
          <div style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 12 }}>{preview || 'Sem preview ainda'}</div>
        )}
        <button type="button" onClick={analisar} disabled={loading || !texto} className="btn-action" style={{ opacity: loading || !texto ? .5 : 1 }}>
          {loading ? 'Analisando...' : '✦ Analisar Nota Fiscal'}
        </button>
      </div>

      {/* Result */}
      {resultado && (
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 12 }}>Resultado da análise</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 12 }}>
            {[
              { label: 'Número NF', val: resultado.numero || '-' },
              { label: 'Emitente', val: resultado.emitente_nome || '-' },
              { label: 'Data', val: resultado.data_emissao || '-' },
              { label: 'Valor', val: `R$ ${(resultado.valor_total || 0).toLocaleString('pt-BR')}` },
            ].map(({ label, val }) => (
              <div key={label}>
                <div style={{ fontSize: 10, color: 'var(--gray-400)', textTransform: 'uppercase', fontFamily: "'DM Mono',monospace" }}>{label}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--navy)' }}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <span className="tag" style={{ background: 'rgba(184,146,42,.1)', color: 'var(--gold)' }}>{resultado.classificacao || 'sem classificação'}</span>
            {resultado.adequado_para_factoring && (
              <span className="tag" style={{ background: 'rgba(45,155,111,.12)', color: 'var(--green)' }}>✓ Factoring</span>
            )}
          </div>
          <button type="button" onClick={() => enviarCaptacao(resultado.id)} className="btn-action">
            ↗ Enviar para Captação
          </button>
        </div>
      )}

      {/* List */}
      <div style={card}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 12 }}>Notas cadastradas</div>
        <div className="expenses-table">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ color: 'var(--gray-400)', fontSize: 10, textTransform: 'uppercase', fontFamily: "'DM Mono',monospace" }}>
                <th style={{ textAlign: 'left', padding: '6px 0', fontWeight: 600 }}>Data</th>
                <th style={{ textAlign: 'left', padding: '6px 0', fontWeight: 600 }}>Emitente</th>
                <th style={{ textAlign: 'left', padding: '6px 0', fontWeight: 600 }}>Valor</th>
                <th style={{ textAlign: 'left', padding: '6px 0', fontWeight: 600 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {notas.map((n) => {
                const sc = statusColor(n.status || '')
                return (
                  <tr key={n.id} style={{ borderTop: '1px solid var(--gray-100)' }}>
                    <td style={{ padding: '8px 0', color: 'var(--navy)' }}>{n.data_emissao || '-'}</td>
                    <td style={{ padding: '8px 0', color: 'var(--navy)' }}>{n.emitente_nome || '-'}</td>
                    <td style={{ padding: '8px 0', color: 'var(--navy)', fontFamily: "'DM Mono',monospace" }}>R$ {(n.valor_total || 0).toLocaleString('pt-BR')}</td>
                    <td style={{ padding: '8px 0' }}>
                      <span className="tag" style={{ background: sc.bg, color: sc.color }}>{n.status || 'pendente'}</span>
                    </td>
                  </tr>
                )
              })}
              {notas.length === 0 && (
                <tr><td colSpan={4} style={{ padding: '20px 0', textAlign: 'center', color: 'var(--gray-400)', fontSize: 12 }}>Nenhuma nota cadastrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
