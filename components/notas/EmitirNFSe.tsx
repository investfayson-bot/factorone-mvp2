'use client'

import { useMemo, useState } from 'react'
import { maskCpfCnpj, onlyDigits } from '@/lib/masks'
import { supabase } from '@/lib/supabase'
import { Loader2, Search } from 'lucide-react'

const LC116_COMUM = [
  { cod: '1.01', desc: 'Análise e desenvolvimento de sistemas' },
  { cod: '17.01', desc: 'Assessoria/consultoria' },
  { cod: '17.02', desc: 'Planejamento' },
  { cod: '17.06', desc: 'Treinamento' },
  { cod: '17.19', desc: 'Programação' },
]

const ISS_OPTS = [2, 3, 4, 5]

export default function EmitirNFSe() {
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [buscaLc, setBuscaLc] = useState('')

  const [tomador, setTomador] = useState({
    cnpjCpf: '',
    razaoSocial: '',
    email: '',
    municipio: '',
  })

  const [servico, setServico] = useState({
    descricao: '',
    codigoServicoMunicipal: '17.19',
    valor: 0,
    issAliquota: 5,
    irRetido: false,
    pisCofinsRetido: false,
  })

  const mesAtual = new Date().toISOString().slice(0, 7)
  const [competencia, setCompetencia] = useState(mesAtual)
  const [dataEmissao, setDataEmissao] = useState(new Date().toISOString().slice(0, 10))

  const preview = useMemo(() => {
    const v = servico.valor
    const iss = (v * servico.issAliquota) / 100
    const ir = servico.irRetido ? (v * 1.5) / 100 : 0
    const pc = servico.pisCofinsRetido ? (v * 4.65) / 100 : 0
    const ret = iss + ir + pc
    return { liquido: v - ret, iss, ir, pc }
  }, [servico])

  const lcFiltrados = useMemo(() => {
    const q = buscaLc.toLowerCase()
    if (!q) return LC116_COMUM
    return LC116_COMUM.filter((x) => x.cod.includes(q) || x.desc.toLowerCase().includes(q))
  }, [buscaLc])

  async function emitir() {
    setLoading(true)
    setMsg(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/notas/emitir-nfse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          tomador: {
            cnpjCpf: onlyDigits(tomador.cnpjCpf),
            razaoSocial: tomador.razaoSocial,
            email: tomador.email,
            municipio: tomador.municipio,
          },
          servico: {
            descricao: servico.descricao,
            codigoServicoMunicipal: servico.codigoServicoMunicipal,
            valor: servico.valor,
            issAliquota: servico.issAliquota,
            irRetido: servico.irRetido,
            pisCofinsRetido: servico.pisCofinsRetido,
          },
          competencia,
          dataEmissao,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao emitir')
      setMsg({ type: 'ok', text: `NFS-e enviada. ${data.numero ? `Nº ${data.numero}` : ''}` })
    } catch (e: unknown) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Erro' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-3">
        <h2 className="font-semibold text-slate-800">Tomador</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
            placeholder="CNPJ/CPF"
            value={maskCpfCnpj(tomador.cnpjCpf)}
            onChange={(e) => setTomador({ ...tomador, cnpjCpf: e.target.value })}
          />
          <input
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
            placeholder="Razão social"
            value={tomador.razaoSocial}
            onChange={(e) => setTomador({ ...tomador, razaoSocial: e.target.value })}
          />
          <input
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
            type="email"
            placeholder="E-mail"
            value={tomador.email}
            onChange={(e) => setTomador({ ...tomador, email: e.target.value })}
          />
          <input
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
            placeholder="Município"
            value={tomador.municipio}
            onChange={(e) => setTomador({ ...tomador, municipio: e.target.value })}
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-3">
        <h2 className="font-semibold text-slate-800">Serviço</h2>
        <textarea
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm min-h-[100px]"
          placeholder="Descrição do serviço"
          value={servico.descricao}
          onChange={(e) => setServico({ ...servico, descricao: e.target.value })}
        />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2 text-sm text-slate-600">
            <Search size={16} /> LC116 (busca)
          </div>
          <input
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mb-2"
            placeholder="Filtrar código ou descrição"
            value={buscaLc}
            onChange={(e) => setBuscaLc(e.target.value)}
          />
          <select
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
            value={servico.codigoServicoMunicipal}
            onChange={(e) => setServico({ ...servico, codigoServicoMunicipal: e.target.value })}
          >
            {lcFiltrados.map((x) => (
              <option key={x.cod} value={x.cod}>
                {x.cod} — {x.desc}
              </option>
            ))}
          </select>
        </div>
        <input
          type="number"
          min={0}
          step={0.01}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
          placeholder="Valor do serviço"
          value={servico.valor || ''}
          onChange={(e) => setServico({ ...servico, valor: Number(e.target.value) })}
        />
        <div className="flex flex-wrap gap-4">
          <label className="text-sm flex items-center gap-2">
            ISS %
            <select
              className="border border-slate-200 rounded-lg px-2 py-1"
              value={servico.issAliquota}
              onChange={(e) => setServico({ ...servico, issAliquota: Number(e.target.value) })}
            >
              {ISS_OPTS.map((i) => (
                <option key={i} value={i}>
                  {i}%
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm flex items-center gap-2">
            <input
              type="checkbox"
              checked={servico.irRetido}
              onChange={(e) => setServico({ ...servico, irRetido: e.target.checked })}
            />
            IR retido (1,5%)
          </label>
          <label className="text-sm flex items-center gap-2">
            <input
              type="checkbox"
              checked={servico.pisCofinsRetido}
              onChange={(e) => setServico({ ...servico, pisCofinsRetido: e.target.checked })}
            />
            PIS/COFINS retidos (est. 4,65%)
          </label>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm">
            Competência (mês/ano)
            <input
              type="month"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 mt-1"
              value={competencia}
              onChange={(e) => setCompetencia(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Data de emissão
            <input
              type="date"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 mt-1"
              value={dataEmissao}
              onChange={(e) => setDataEmissao(e.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="bg-slate-900 text-white rounded-2xl p-6 space-y-2">
        <p className="text-xs text-slate-400 uppercase">Valor líquido (após retenções)</p>
        <p className="text-2xl font-bold">
          {preview.liquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </p>
        <p className="text-xs text-slate-400">
          ISS {preview.iss.toFixed(2)} | IR {preview.ir.toFixed(2)} | PIS/COFINS {preview.pc.toFixed(2)}
        </p>
        <button
          type="button"
          disabled={loading}
          onClick={emitir}
          className="mt-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold px-6 py-3 rounded-xl flex items-center gap-2"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : null}
          Emitir NFS-e
        </button>
      </div>

      {msg && (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-red-50 text-red-900 border border-red-200'}`}
        >
          {msg.text}
        </div>
      )}
    </div>
  )
}
