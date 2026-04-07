'use client'

import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function ContaPJPage() {
  const [etapa, setEtapa] = useState(1)
  const [empresa, setEmpresa] = useState({ cnpj: '', razao_social: '', cnae: '', data_abertura: '' })
  const [socios, setSocios] = useState([{ nome: '', cpf: '', participacao: 0 }])
  const [documentos, setDocumentos] = useState<Record<string, string>>({})
  const [banco, setBanco] = useState('')

  const progresso = useMemo(() => (etapa / 4) * 100, [etapa])

  async function salvarProgresso() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('abertura_conta_pj').upsert({
      empresa_id: user.id,
      cnpj: empresa.cnpj,
      razao_social: empresa.razao_social,
      cnae: empresa.cnae,
      data_abertura: empresa.data_abertura,
      socios,
      documentos,
      banco_escolhido: banco,
      etapa_atual: etapa,
      updated_at: new Date().toISOString()
    })
  }

  return (
    <div className="p-6 space-y-6 text-white">
      <h1 className="text-2xl font-bold text-white">Abertura de Conta PJ</h1>
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${etapa >= n ? 'bg-blue-500 text-white' : 'bg-white/10 text-gray-400'}`}>{n}</div>
          ))}
        </div>
        <div className="w-full h-2 bg-white/10 rounded-full">
          <div className="h-2 bg-blue-500 rounded-full transition-all" style={{ width: `${progresso}%` }} />
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm hover:border-blue-500/30 transition-all">
        {etapa === 1 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Etapa 1 — Dados da Empresa</h2>
            <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/8 transition-all" placeholder="CNPJ" value={empresa.cnpj} onChange={(e) => setEmpresa({ ...empresa, cnpj: e.target.value })} />
            <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/8 transition-all" placeholder="Razão social" value={empresa.razao_social} onChange={(e) => setEmpresa({ ...empresa, razao_social: e.target.value })} />
            <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/8 transition-all" placeholder="CNAE" value={empresa.cnae} onChange={(e) => setEmpresa({ ...empresa, cnae: e.target.value })} />
            <input type="date" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/8 transition-all" value={empresa.data_abertura} onChange={(e) => setEmpresa({ ...empresa, data_abertura: e.target.value })} />
          </div>
        )}

        {etapa === 2 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Etapa 2 — Sócios</h2>
            {socios.map((s, i) => (
              <div key={i} className="grid md:grid-cols-3 gap-2">
                <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/8 transition-all" placeholder="Nome" value={s.nome} onChange={(e) => { const c = [...socios]; c[i].nome = e.target.value; setSocios(c) }} />
                <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/8 transition-all" placeholder="CPF" value={s.cpf} onChange={(e) => { const c = [...socios]; c[i].cpf = e.target.value; setSocios(c) }} />
                <input type="number" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-white/8 transition-all" placeholder="Participação %" value={s.participacao} onChange={(e) => { const c = [...socios]; c[i].participacao = Number(e.target.value || 0); setSocios(c) }} />
              </div>
            ))}
            <button onClick={() => setSocios([...socios, { nome: '', cpf: '', participacao: 0 }])} className="bg-white/10 hover:bg-white/15 text-white font-medium px-4 py-2.5 rounded-xl border border-white/10 transition-all">Adicionar sócio</button>
          </div>
        )}

        {etapa === 3 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Etapa 3 — Documentos</h2>
            {['contrato_social', 'rg_cnh', 'comprovante_endereco', 'alvara'].map((doc) => (
              <label key={doc} className="flex justify-between items-center bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                <span className="text-sm">{doc}</span>
                <input type="file" onChange={(e) => setDocumentos({ ...documentos, [doc]: e.target.files?.[0]?.name || '' })} />
              </label>
            ))}
          </div>
        )}

        {etapa === 4 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Etapa 4 — Banco</h2>
            <div className="grid md:grid-cols-3 gap-3">
              {['Banco Inter', 'BTG Empresas', 'Nubank PJ'].map((b) => (
                <button key={b} onClick={() => setBanco(b)} className={`text-left bg-white/5 border rounded-2xl p-4 transition-all ${banco === b ? 'border-blue-500/60 bg-blue-500/10' : 'border-white/10 hover:bg-white/10'}`}>
                  <p className="font-semibold">{b}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <button onClick={() => setEtapa(Math.max(1, etapa - 1))} disabled={etapa === 1} className="bg-white/10 hover:bg-white/15 text-white font-medium px-4 py-2.5 rounded-xl border border-white/10 transition-all disabled:opacity-40">Anterior</button>
        <div className="flex gap-2">
          <button onClick={salvarProgresso} className="bg-blue-500 hover:bg-blue-600 text-white font-medium px-4 py-2.5 rounded-xl transition-all flex items-center gap-2">Salvar</button>
          <button onClick={() => setEtapa(Math.min(4, etapa + 1))} disabled={etapa === 4} className="bg-blue-500 hover:bg-blue-600 text-white font-medium px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 disabled:opacity-40">Próxima</button>
        </div>
      </div>
    </div>
  )
}
