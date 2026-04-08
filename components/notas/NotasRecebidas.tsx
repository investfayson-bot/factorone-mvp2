'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Upload, Camera, Mail, FileText, Send, Eye } from 'lucide-react'

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
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('notas_fiscais')
      .select('*')
      .eq('empresa_id', user.id)
      .order('created_at', { ascending: false })
    setNotas((data ?? []) as NotaFiscalLista[])
  }, [])

  useEffect(() => {
    void carregarNotas()
  }, [carregarNotas])

  async function handleArquivo(file?: File) {
    if (!file) return
    const ext = file.name.toLowerCase()
    if (ext.endsWith('.xml') || ext.endsWith('.txt')) {
      const t = await file.text()
      setTexto(t)
      setPreview(t.slice(0, 200))
      setImagemPreview('')
      return
    }
    if (ext.endsWith('.pdf')) {
      const t = await file.text().catch(() => 'PDF enviado')
      setTexto(t || 'PDF enviado')
      setPreview((t || 'PDF enviado').slice(0, 200))
      setImagemPreview('')
      return
    }
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = String(reader.result || '')
        setTexto(base64)
        setImagemPreview(base64)
        setPreview('Imagem selecionada para OCR')
      }
      reader.readAsDataURL(file)
    }
  }

  async function analisar() {
    if (!texto) return
    setLoading(true)
    const res = await fetch('/api/nota-fiscal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto }),
    })
    const data = await res.json()
    if (res.ok && data.nota) {
      setResultado(data.nota as AnaliseNFResult)
      await carregarNotas()
    }
    setLoading(false)
  }

  async function enviarCaptacao(id: string) {
    await supabase.from('notas_fiscais').update({ status: 'aguardando_captacao' }).eq('id', id)
    await carregarNotas()
  }

  const statusBadge = (s: string) =>
    s === 'aprovada'
      ? 'bg-emerald-100 text-emerald-800'
      : s === 'rejeitada'
        ? 'bg-red-100 text-red-800'
        : s === 'aguardando_captacao'
          ? 'bg-blue-100 text-blue-800'
          : 'bg-slate-100 text-slate-600'

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        <strong>Recebidas</strong> — upload, OCR, câmera ou texto para leitura inteligente.
      </p>

      <div className="grid md:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-blue-200 transition-all text-left"
        >
          <Upload className="text-blue-600 mb-3" />
          <p className="font-semibold text-slate-800">Arquivo</p>
          <p className="text-sm text-slate-500">XML, PDF ou imagem</p>
        </button>
        <button
          type="button"
          onClick={() => camRef.current?.click()}
          className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-blue-200 transition-all text-left"
        >
          <Camera className="text-blue-600 mb-3" />
          <p className="font-semibold text-slate-800">Câmera / Foto</p>
          <p className="text-sm text-slate-500">Capture a NF</p>
        </button>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={16} className="text-blue-600" />{' '}
            <p className="font-semibold text-slate-800">Colar texto</p>
          </div>
          <textarea
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value)
              setPreview(e.target.value.slice(0, 200))
              setImagemPreview('')
            }}
            className="w-full bg-white border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-xl px-4 py-2.5 text-slate-800 min-h-24 text-sm"
            placeholder="Cole XML ou texto da NF..."
          />
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".xml,.pdf,image/*"
        className="hidden"
        onChange={(e) => handleArquivo(e.target.files?.[0])}
      />
      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleArquivo(e.target.files?.[0])}
      />

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Mail size={16} className="text-blue-700" />
          <p className="text-sm text-slate-500">
            Encaminhar para: <span className="text-slate-800">nf@factorone.com.br</span>
          </p>
        </div>
        {imagemPreview ? (
          // eslint-disable-next-line @next/next/no-img-element -- preview data URL local
          <img src={imagemPreview} alt="preview" className="max-h-52 rounded-xl border border-slate-200 mb-4" />
        ) : (
          <p className="text-sm text-slate-500 mb-4">{preview || 'Sem preview ainda'}</p>
        )}
        <button
          type="button"
          onClick={analisar}
          disabled={loading || !texto}
          className="bg-blue-700 hover:bg-blue-800 text-white font-semibold px-5 py-2.5 rounded-xl shadow-sm flex items-center gap-2 disabled:opacity-50"
        >
          <span className="inline-block w-4 h-4 rounded bg-white/30" />{' '}
          {loading ? 'Analisando...' : 'Analisar Nota Fiscal'}
        </button>
      </div>

      {resultado && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">Resultado da análise</h2>
          <div className="grid md:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-slate-500">Número NF</p>
              <p className="text-slate-800">{resultado.numero || '-'}</p>
            </div>
            <div>
              <p className="text-slate-500">Emitente</p>
              <p className="text-slate-800">{resultado.emitente_nome || '-'}</p>
            </div>
            <div>
              <p className="text-slate-500">Data</p>
              <p className="text-slate-800">{resultado.data_emissao || '-'}</p>
            </div>
            <div>
              <p className="text-slate-500">Valor</p>
              <p className="text-slate-800">R$ {(resultado.valor_total || 0).toLocaleString('pt-BR')}</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-full text-xs bg-amber-100 text-amber-800">
              {resultado.classificacao || 'sem classificação'}
            </span>
            {resultado.adequado_para_factoring && (
              <span className="px-3 py-1 rounded-full text-xs bg-emerald-100 text-emerald-800">Factoring</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => enviarCaptacao(resultado.id)}
              className="bg-blue-700 hover:bg-blue-800 text-white font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm"
            >
              <Send size={14} />
              Enviar para Captação
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-3 text-slate-800">Notas cadastradas (leitura)</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-500">
              <th className="text-left py-2">Data</th>
              <th className="text-left">Emitente</th>
              <th className="text-left">Valor</th>
              <th className="text-left">Status</th>
              <th className="text-left">Ações</th>
            </tr>
          </thead>
          <tbody>
            {notas.map((n) => (
              <tr key={n.id} className="border-t border-slate-100">
                <td className="py-2 text-slate-800">{n.data_emissao || '-'}</td>
                <td className="text-slate-800">{n.emitente_nome || '-'}</td>
                <td className="text-slate-800">R$ {(n.valor_total || 0).toLocaleString('pt-BR')}</td>
                <td>
                  <span className={`px-2 py-1 rounded-full text-xs ${statusBadge(n.status || '')}`}>
                    {n.status || 'pendente'}
                  </span>
                </td>
                <td>
                  <span className="text-blue-700 text-sm flex items-center gap-1">
                    <Eye size={13} />
                    Ver
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
