'use client'

import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AberturaContaWizard() {
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
      updated_at: new Date().toISOString(),
    })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Abertura de Conta PJ</h1>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${etapa >= n ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-400'}`}>{n}</div>
          ))}
        </div>
        <div className="h-2 w-full rounded-full bg-slate-100"><div className="h-2 rounded-full bg-blue-700" style={{ width: `${progresso}%` }} /></div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {etapa === 1 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-800">Etapa 1 — Dados da Empresa</h2>
            <input className="w-full rounded-xl border border-slate-200 px-4 py-2.5" placeholder="CNPJ" value={empresa.cnpj} onChange={(e) => setEmpresa({ ...empresa, cnpj: e.target.value })} />
            <input className="w-full rounded-xl border border-slate-200 px-4 py-2.5" placeholder="Razão social" value={empresa.razao_social} onChange={(e) => setEmpresa({ ...empresa, razao_social: e.target.value })} />
            <input className="w-full rounded-xl border border-slate-200 px-4 py-2.5" placeholder="CNAE" value={empresa.cnae} onChange={(e) => setEmpresa({ ...empresa, cnae: e.target.value })} />
            <input type="date" className="w-full rounded-xl border border-slate-200 px-4 py-2.5" value={empresa.data_abertura} onChange={(e) => setEmpresa({ ...empresa, data_abertura: e.target.value })} />
          </div>
        )}
        {etapa === 2 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-800">Etapa 2 — Sócios</h2>
            {socios.map((s, i) => (
              <div key={i} className="grid gap-2 md:grid-cols-3">
                <input className="rounded-xl border border-slate-200 px-4 py-2.5" placeholder="Nome" value={s.nome} onChange={(e) => { const c = [...socios]; c[i].nome = e.target.value; setSocios(c) }} />
                <input className="rounded-xl border border-slate-200 px-4 py-2.5" placeholder="CPF" value={s.cpf} onChange={(e) => { const c = [...socios]; c[i].cpf = e.target.value; setSocios(c) }} />
                <input type="number" className="rounded-xl border border-slate-200 px-4 py-2.5" placeholder="Participação %" value={s.participacao} onChange={(e) => { const c = [...socios]; c[i].participacao = Number(e.target.value || 0); setSocios(c) }} />
              </div>
            ))}
            <button onClick={() => setSocios([...socios, { nome: '', cpf: '', participacao: 0 }])} className="rounded-xl border border-slate-200 px-4 py-2.5">Adicionar sócio</button>
          </div>
        )}
        {etapa === 3 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-800">Etapa 3 — Documentos</h2>
            {['contrato_social', 'rg_cnh', 'comprovante_endereco', 'alvara'].map((doc) => (
              <label key={doc} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                <span>{doc}</span>
                <input type="file" onChange={(e) => setDocumentos({ ...documentos, [doc]: e.target.files?.[0]?.name || '' })} />
              </label>
            ))}
          </div>
        )}
        {etapa === 4 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-800">Etapa 4 — Banco</h2>
            <div className="grid gap-3 md:grid-cols-3">
              {['Banco Inter', 'BTG Empresas', 'Nubank PJ'].map((b) => (
                <button key={b} onClick={() => setBanco(b)} className={`rounded-2xl border p-4 text-left ${banco === b ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}>
                  <p className="font-semibold">{b}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <button onClick={() => setEtapa(Math.max(1, etapa - 1))} disabled={etapa === 1} className="rounded-xl border border-slate-200 px-5 py-2.5 disabled:opacity-40">Anterior</button>
        <div className="flex gap-2">
          <button onClick={() => void salvarProgresso()} className="rounded-xl bg-blue-700 px-5 py-2.5 font-semibold text-white">Salvar</button>
          <button onClick={() => setEtapa(Math.min(4, etapa + 1))} disabled={etapa === 4} className="rounded-xl bg-blue-700 px-5 py-2.5 font-semibold text-white disabled:opacity-40">Próxima</button>
        </div>
      </div>
    </div>
  )
}
