'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Upload, Camera, Mail, FileText, Send, CheckCircle, Clock, XCircle, Eye } from 'lucide-react'

export default function NotaFiscalPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const camRef = useRef<HTMLInputElement>(null)
  const [texto, setTexto] = useState('')
  const [preview, setPreview] = useState('')
  const [imagemPreview, setImagemPreview] = useState('')
  const [resultado, setResultado] = useState<any>(null)
  const [notas, setNotas] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    carregarNotas()
  }, [])

  async function carregarNotas() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('notas_fiscais').select('*').eq('empresa_id', user.id).order('created_at', { ascending: false })
    setNotas(data || [])
  }

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
      body: JSON.stringify({ texto })
    })
    const data = await res.json()
    if (res.ok) {
      setResultado(data.nota)
      await carregarNotas()
    }
    setLoading(false)
  }

  async function enviarCaptacao(id: string) {
    await supabase.from('notas_fiscais').update({ status: 'aguardando_captacao' }).eq('id', id)
    await carregarNotas()
  }

  const statusBadge = (s: string) =>
    s === 'aprovada' ? 'bg-emerald-500/20 text-emerald-400' :
      s === 'rejeitada' ? 'bg-red-500/20 text-red-400' :
        s === 'aguardando_captacao' ? 'bg-blue-500/20 text-blue-400' :
          'bg-white/10 text-gray-300'

  return (
    <div className="p-6 space-y-6 text-white">
      <h1 className="text-2xl font-bold text-white">Nota Fiscal Inteligente</h1>
      <p className="text-sm text-gray-400">Upload por arquivo, foto, texto manual ou email.</p>

      <div className="grid md:grid-cols-3 gap-4">
        <button onClick={() => fileRef.current?.click()} className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm hover:border-blue-500/30 transition-all text-left">
          <Upload className="text-blue-400 mb-3" />
          <p className="font-semibold">Arquivo</p>
          <p className="text-sm text-gray-400">Arraste ou selecione XML, PDF ou imagem</p>
        </button>
        <button onClick={() => camRef.current?.click()} className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm hover:border-blue-500/30 transition-all text-left">
          <Camera className="text-blue-400 mb-3" />
          <p className="font-semibold">Câmera / Foto</p>
          <p className="text-sm text-gray-400">Capture a NF com seu celular</p>
        </button>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm hover:border-blue-500/30 transition-all">
          <div className="flex items-center gap-2 mb-2"><FileText size={16} className="text-blue-400" /> <p className="font-semibold">Colar texto</p></div>
          <textarea value={texto} onChange={(e) => { setTexto(e.target.value); setPreview(e.target.value.slice(0, 200)); setImagemPreview('') }} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/8 transition-all min-h-24" placeholder="Cole XML ou texto da NF..." />
        </div>
      </div>

      <input ref={fileRef} type="file" accept=".xml,.pdf,image/*" className="hidden" onChange={(e) => handleArquivo(e.target.files?.[0])} />
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleArquivo(e.target.files?.[0])} />

      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm hover:border-blue-500/30 transition-all">
        <div className="flex items-center gap-2 mb-3"><Mail size={16} className="text-blue-400" /><p className="text-sm text-gray-400">Também é possível encaminhar para: <span className="text-white">nf@factorone.com.br</span></p></div>
        {imagemPreview ? <img src={imagemPreview} alt="preview" className="max-h-52 rounded-xl border border-white/10 mb-4" /> : <p className="text-sm text-gray-400 mb-4">{preview ? preview : 'Sem preview ainda'}</p>}
        <button onClick={analisar} disabled={loading || !texto} className="bg-blue-500 hover:bg-blue-600 text-white font-medium px-4 py-2.5 rounded-xl transition-all flex items-center gap-2">
          <ZapIcon /> {loading ? 'Analisando...' : 'Analisar Nota Fiscal'}
        </button>
      </div>

      {resultado && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm hover:border-blue-500/30 transition-all space-y-4">
          <h2 className="text-lg font-semibold">Resultado da análise</h2>
          <div className="grid md:grid-cols-4 gap-3 text-sm">
            <div><p className="text-gray-400">Número NF</p><p>{resultado.numero || '-'}</p></div>
            <div><p className="text-gray-400">Emitente</p><p>{resultado.emitente_nome || '-'}</p></div>
            <div><p className="text-gray-400">Data</p><p>{resultado.data_emissao || '-'}</p></div>
            <div><p className="text-gray-400">Valor</p><p>R$ {(resultado.valor_total || 0).toLocaleString('pt-BR')}</p></div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-gray-400"><th className="text-left">ICMS</th><th className="text-left">PIS</th><th className="text-left">COFINS</th></tr></thead>
              <tbody><tr><td>{resultado.impostos?.icms || 0}</td><td>{resultado.impostos?.pis || 0}</td><td>{resultado.impostos?.cofins || 0}</td></tr></tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <span className="px-3 py-1 rounded-full text-xs bg-amber-500/20 text-amber-400">{resultado.classificacao || 'sem classificação'}</span>
            {resultado.adequado_para_factoring && <span className="px-3 py-1 rounded-full text-xs bg-emerald-500/20 text-emerald-400">Adequado para factoring</span>}
          </div>
          <div className="flex gap-2">
            <button className="bg-white/10 hover:bg-white/15 text-white font-medium px-4 py-2.5 rounded-xl border border-white/10 transition-all">Salvar no sistema</button>
            <button onClick={() => enviarCaptacao(resultado.id)} className="bg-blue-500 hover:bg-blue-600 text-white font-medium px-4 py-2.5 rounded-xl transition-all flex items-center gap-2"><Send size={14} />Enviar para Captação</button>
          </div>
        </div>
      )}

      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm hover:border-blue-500/30 transition-all">
        <h2 className="text-lg font-semibold mb-3">Notas cadastradas</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-gray-400"><th className="text-left">Data</th><th className="text-left">Emitente</th><th className="text-left">Valor</th><th className="text-left">Classificação</th><th className="text-left">Status</th><th className="text-left">Ações</th></tr></thead>
          <tbody>
            {notas.map((n) => (
              <tr key={n.id} className="border-t border-white/10">
                <td className="py-2">{n.data_emissao || '-'}</td>
                <td>{n.emitente_nome || '-'}</td>
                <td>R$ {(n.valor_total || 0).toLocaleString('pt-BR')}</td>
                <td>{n.classificacao || '-'}</td>
                <td><span className={`px-2 py-1 rounded-full text-xs ${statusBadge(n.status)}`}>{n.status || 'pendente'}</span></td>
                <td><button className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"><Eye size={13} />Ver detalhes</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ZapIcon() {
  return <span className="inline-block w-4 h-4 rounded bg-blue-400" />
}
