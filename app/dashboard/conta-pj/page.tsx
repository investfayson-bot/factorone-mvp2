'use client'

import { useEffect, useMemo, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

type Socio = { nome: string; cpf: string; participacao: number }

const BANCOS = [
  { nome: 'Banco Inter', taxa: 'Pix grátis', destaque: 'Conta PJ sem mensalidade' },
  { nome: 'BTG Empresas', taxa: 'Tarifa variável', destaque: 'Mais opções de crédito' },
  { nome: 'Nubank PJ', taxa: 'Sem tarifa mensal', destaque: 'UX simples e rápida' }
]

export default function ContaPJPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'public-anon-key'
  )
  const [etapa, setEtapa] = useState(1)
  const [idRegistro, setIdRegistro] = useState<string | null>(null)
  const [empresa, setEmpresa] = useState({ cnpj: '', razao_social: '', cnae: '', data_abertura: '', nome_fantasia: '' })
  const [socios, setSocios] = useState<Socio[]>([{ nome: '', cpf: '', participacao: 0 }])
  const [documentos, setDocumentos] = useState<Record<string, string>>({})
  const [banco, setBanco] = useState('')

  useEffect(() => {
    carregarProgresso()
  }, [])

  async function carregarProgresso() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('abertura_conta_pj')
      .select('*')
      .eq('empresa_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!data) return
    setIdRegistro(data.id)
    setEtapa(data.etapa_atual || 1)
    setEmpresa({
      cnpj: data.cnpj || '',
      razao_social: data.razao_social || '',
      nome_fantasia: data.nome_fantasia || '',
      cnae: data.cnae || '',
      data_abertura: data.data_abertura || ''
    })
    setSocios(data.socios || [{ nome: '', cpf: '', participacao: 0 }])
    setDocumentos(data.documentos || {})
    setBanco(data.banco_escolhido || '')
  }

  async function salvar() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const payload = {
      empresa_id: user.id,
      cnpj: empresa.cnpj,
      razao_social: empresa.razao_social,
      nome_fantasia: empresa.nome_fantasia,
      cnae: empresa.cnae,
      data_abertura: empresa.data_abertura,
      socios,
      documentos,
      banco_escolhido: banco,
      etapa_atual: etapa,
      updated_at: new Date().toISOString()
    }
    if (idRegistro) {
      await supabase.from('abertura_conta_pj').update(payload).eq('id', idRegistro)
      return
    }
    const { data } = await supabase.from('abertura_conta_pj').insert(payload).select('id').single()
    if (data?.id) setIdRegistro(data.id)
  }

  const progresso = useMemo(() => (etapa / 4) * 100, [etapa])
  const docsChecklist = ['contrato_social', 'rg_cnh', 'comprovante_endereco', 'alvara']

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white p-6">
      <h1 className="text-2xl font-bold mb-3">Abertura de Conta PJ</h1>
      <div className="w-full h-2 bg-[#1E1E2E] rounded-full mb-6">
        <div className="h-2 bg-[#0066FF] rounded-full transition-all" style={{ width: `${progresso}%` }} />
      </div>

      <div className="bg-[#111118] border border-[#1E1E2E] rounded-xl p-6 space-y-5">
        {etapa === 1 && (
          <div className="space-y-3">
            <h2 className="font-semibold">Etapa 1: Dados da empresa</h2>
            <input className="w-full bg-[#0A0A0F] border border-[#2A2A35] rounded p-2" placeholder="CNPJ" value={empresa.cnpj} onChange={(e) => setEmpresa({ ...empresa, cnpj: e.target.value })} />
            <input className="w-full bg-[#0A0A0F] border border-[#2A2A35] rounded p-2" placeholder="Razão social" value={empresa.razao_social} onChange={(e) => setEmpresa({ ...empresa, razao_social: e.target.value })} />
            <input className="w-full bg-[#0A0A0F] border border-[#2A2A35] rounded p-2" placeholder="Nome fantasia" value={empresa.nome_fantasia} onChange={(e) => setEmpresa({ ...empresa, nome_fantasia: e.target.value })} />
            <input className="w-full bg-[#0A0A0F] border border-[#2A2A35] rounded p-2" placeholder="CNAE" value={empresa.cnae} onChange={(e) => setEmpresa({ ...empresa, cnae: e.target.value })} />
            <input type="date" className="w-full bg-[#0A0A0F] border border-[#2A2A35] rounded p-2" value={empresa.data_abertura} onChange={(e) => setEmpresa({ ...empresa, data_abertura: e.target.value })} />
          </div>
        )}

        {etapa === 2 && (
          <div className="space-y-3">
            <h2 className="font-semibold">Etapa 2: Sócios</h2>
            {socios.map((s, idx) => (
              <div key={idx} className="grid md:grid-cols-3 gap-2">
                <input className="bg-[#0A0A0F] border border-[#2A2A35] rounded p-2" placeholder="Nome" value={s.nome} onChange={(e) => {
                  const clone = [...socios]; clone[idx].nome = e.target.value; setSocios(clone)
                }} />
                <input className="bg-[#0A0A0F] border border-[#2A2A35] rounded p-2" placeholder="CPF" value={s.cpf} onChange={(e) => {
                  const clone = [...socios]; clone[idx].cpf = e.target.value; setSocios(clone)
                }} />
                <input type="number" className="bg-[#0A0A0F] border border-[#2A2A35] rounded p-2" placeholder="Participação %" value={s.participacao} onChange={(e) => {
                  const clone = [...socios]; clone[idx].participacao = Number(e.target.value) || 0; setSocios(clone)
                }} />
              </div>
            ))}
            <button className="bg-[#0066FF] px-3 py-2 rounded" onClick={() => setSocios([...socios, { nome: '', cpf: '', participacao: 0 }])}>Adicionar sócio</button>
          </div>
        )}

        {etapa === 3 && (
          <div className="space-y-3">
            <h2 className="font-semibold">Etapa 3: Documentos</h2>
            {docsChecklist.map((doc) => (
              <label key={doc} className="flex items-center justify-between bg-[#0A0A0F] border border-[#2A2A35] rounded p-3">
                <span>{doc.replace('_', ' ')}</span>
                <input type="file" onChange={(e) => setDocumentos({ ...documentos, [doc]: e.target.files?.[0]?.name || '' })} />
              </label>
            ))}
          </div>
        )}

        {etapa === 4 && (
          <div className="space-y-3">
            <h2 className="font-semibold">Etapa 4: Escolher banco</h2>
            <div className="grid md:grid-cols-3 gap-3">
              {BANCOS.map((b) => (
                <button
                  key={b.nome}
                  onClick={() => setBanco(b.nome)}
                  className={`text-left border rounded-xl p-4 ${banco === b.nome ? 'border-[#0066FF] bg-[#0066FF]/10' : 'border-[#2A2A35] bg-[#0A0A0F]'}`}
                >
                  <p className="font-semibold">{b.nome}</p>
                  <p className="text-sm text-gray-400">{b.taxa}</p>
                  <p className="text-sm text-gray-300 mt-1">{b.destaque}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-between pt-2">
          <button disabled={etapa === 1} className="px-3 py-2 rounded bg-[#2A2A35] disabled:opacity-50" onClick={() => setEtapa(v => Math.max(1, v - 1))}>Voltar</button>
          <div className="flex gap-2">
            <button className="px-3 py-2 rounded bg-[#0066FF]" onClick={salvar}>Salvar progresso</button>
            <button disabled={etapa === 4} className="px-3 py-2 rounded bg-[#0066FF] disabled:opacity-50" onClick={() => setEtapa(v => Math.min(4, v + 1))}>Próxima</button>
          </div>
        </div>
      </div>
    </div>
  )
}
