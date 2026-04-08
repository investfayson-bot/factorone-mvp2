'use client'

import { useMemo, useState } from 'react'
import { buscarCep } from '@/lib/viacep'
import { maskCep, maskCpfCnpj, onlyDigits } from '@/lib/masks'
import { supabase } from '@/lib/supabase'
import { Loader2, Plus, Trash2 } from 'lucide-react'

const CFOPS = ['5102', '5405', '6102', '6404']
const UNIDADES = ['UN', 'KG', 'M', 'L', 'CX']
const ICMS = [0, 4, 7, 12, 17, 25]

type Produto = {
  id: string
  descricao: string
  ncm: string
  cfop: string
  quantidade: number
  unidade: string
  valorUnitario: number
  icmsAliquota: number
}

const produtoVazio = (): Produto => ({
  id: crypto.randomUUID(),
  descricao: '',
  ncm: '',
  cfop: '5102',
  quantidade: 1,
  unidade: 'UN',
  valorUnitario: 0,
  icmsAliquota: 17,
})

export default function EmitirNFe() {
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [dest, setDest] = useState({
    cnpjCpf: '',
    razaoSocial: '',
    email: '',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
  })

  const [produtos, setProdutos] = useState<Produto[]>([produtoVazio()])
  const [transportadora, setTransportadora] = useState({ nome: '', cnpj: '', modalidadeFrete: '' })
  const [infoAdic, setInfoAdic] = useState('')
  const [natureza, setNatureza] = useState('Venda de mercadoria')

  const totais = useMemo(() => {
    let bruto = 0
    let icms = 0
    for (const p of produtos) {
      const t = p.quantidade * p.valorUnitario
      bruto += t
      icms += (t * p.icmsAliquota) / 100
    }
    return { bruto, icms, total: bruto }
  }, [produtos])

  async function onCepBlur() {
    const c = onlyDigits(dest.cep)
    if (c.length !== 8) return
    const r = await buscarCep(c)
    if (!r) return
    setDest((d) => ({
      ...d,
      logradouro: r.logradouro || d.logradouro,
      bairro: r.bairro || d.bairro,
      cidade: r.localidade || d.cidade,
      uf: r.uf || d.uf,
    }))
  }

  async function emitir() {
    setLoading(true)
    setMsg(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/notas/emitir-nfe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          destinatario: {
            cnpjCpf: onlyDigits(dest.cnpjCpf),
            razaoSocial: dest.razaoSocial,
            email: dest.email,
            cep: onlyDigits(dest.cep),
            logradouro: dest.logradouro,
            numero: dest.numero,
            complemento: dest.complemento,
            bairro: dest.bairro,
            cidade: dest.cidade,
            uf: dest.uf,
          },
          produtos: produtos.map((p) => ({
            descricao: p.descricao,
            ncm: onlyDigits(p.ncm),
            cfop: p.cfop,
            quantidade: p.quantidade,
            unidade: p.unidade,
            valorUnitario: p.valorUnitario,
            icmsAliquota: p.icmsAliquota,
          })),
          transportadora: transportadora.nome
            ? {
                nome: transportadora.nome,
                cnpj: transportadora.cnpj,
                modalidadeFrete: transportadora.modalidadeFrete,
              }
            : undefined,
          informacoesAdicionais: infoAdic || undefined,
          naturezaOperacao: natureza,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao emitir')
      setMsg({ type: 'ok', text: `NF-e enviada. Status: ${data.status || 'ok'}. Número: ${data.numero || '—'}` })
    } catch (e: unknown) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Erro' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-slate-800">Destinatário</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
            placeholder="CNPJ/CPF"
            value={maskCpfCnpj(dest.cnpjCpf)}
            onChange={(e) => setDest({ ...dest, cnpjCpf: e.target.value })}
          />
          <input
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
            placeholder="Razão social"
            value={dest.razaoSocial}
            onChange={(e) => setDest({ ...dest, razaoSocial: e.target.value })}
          />
          <input
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
            placeholder="E-mail"
            type="email"
            value={dest.email}
            onChange={(e) => setDest({ ...dest, email: e.target.value })}
          />
          <input
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
            placeholder="CEP"
            value={maskCep(dest.cep)}
            onChange={(e) => setDest({ ...dest, cep: e.target.value })}
            onBlur={onCepBlur}
          />
          <input
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm sm:col-span-2"
            placeholder="Logradouro"
            value={dest.logradouro}
            onChange={(e) => setDest({ ...dest, logradouro: e.target.value })}
          />
          <input
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
            placeholder="Número"
            value={dest.numero}
            onChange={(e) => setDest({ ...dest, numero: e.target.value })}
          />
          <input
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
            placeholder="Complemento"
            value={dest.complemento}
            onChange={(e) => setDest({ ...dest, complemento: e.target.value })}
          />
          <input
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
            placeholder="Bairro"
            value={dest.bairro}
            onChange={(e) => setDest({ ...dest, bairro: e.target.value })}
          />
          <input
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
            placeholder="Cidade"
            value={dest.cidade}
            onChange={(e) => setDest({ ...dest, cidade: e.target.value })}
          />
          <input
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
            placeholder="UF"
            maxLength={2}
            value={dest.uf}
            onChange={(e) => setDest({ ...dest, uf: e.target.value.toUpperCase() })}
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Produtos</h2>
          <button
            type="button"
            onClick={() => setProdutos((p) => [...p, produtoVazio()])}
            className="text-sm flex items-center gap-1 text-blue-700 font-medium"
          >
            <Plus size={16} /> Adicionar
          </button>
        </div>
        {produtos.map((p, idx) => (
          <div key={p.id} className="border border-slate-100 rounded-xl p-4 space-y-2 relative">
            {produtos.length > 1 && (
              <button
                type="button"
                className="absolute top-2 right-2 text-slate-400 hover:text-red-600"
                onClick={() => setProdutos((rows) => rows.filter((x) => x.id !== p.id))}
              >
                <Trash2 size={16} />
              </button>
            )}
            <div className="grid sm:grid-cols-2 gap-2">
              <input
                className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm sm:col-span-2"
                placeholder="Descrição"
                value={p.descricao}
                onChange={(e) => {
                  const v = e.target.value
                  setProdutos((rows) => rows.map((x) => (x.id === p.id ? { ...x, descricao: v } : x)))
                }}
              />
              <input
                className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
                placeholder="NCM (8 dígitos)"
                value={p.ncm}
                onChange={(e) => {
                  const v = onlyDigits(e.target.value).slice(0, 8)
                  setProdutos((rows) => rows.map((x) => (x.id === p.id ? { ...x, ncm: v } : x)))
                }}
              />
              <select
                className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
                value={p.cfop}
                onChange={(e) => {
                  const v = e.target.value
                  setProdutos((rows) => rows.map((x) => (x.id === p.id ? { ...x, cfop: v } : x)))
                }}
              >
                {CFOPS.map((c) => (
                  <option key={c} value={c}>
                    CFOP {c}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                step={0.01}
                className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
                placeholder="Qtd"
                value={p.quantidade || ''}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setProdutos((rows) => rows.map((x) => (x.id === p.id ? { ...x, quantidade: v } : x)))
                }}
              />
              <select
                className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
                value={p.unidade}
                onChange={(e) => {
                  const v = e.target.value
                  setProdutos((rows) => rows.map((x) => (x.id === p.id ? { ...x, unidade: v } : x)))
                }}
              >
                {UNIDADES.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                step={0.01}
                className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
                placeholder="Valor unitário"
                value={p.valorUnitario || ''}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setProdutos((rows) => rows.map((x) => (x.id === p.id ? { ...x, valorUnitario: v } : x)))
                }}
              />
              <select
                className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
                value={p.icmsAliquota}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setProdutos((rows) => rows.map((x) => (x.id === p.id ? { ...x, icmsAliquota: v } : x)))
                }}
              >
                {ICMS.map((i) => (
                  <option key={i} value={i}>
                    ICMS {i}%
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-slate-500">
              Item {idx + 1}:{' '}
              {(p.quantidade * p.valorUnitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-3">
        <h2 className="font-semibold text-slate-800">Transportadora (opcional)</h2>
        <div className="grid sm:grid-cols-3 gap-2">
          <input
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
            placeholder="Nome"
            value={transportadora.nome}
            onChange={(e) => setTransportadora({ ...transportadora, nome: e.target.value })}
          />
          <input
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
            placeholder="CNPJ"
            value={transportadora.cnpj}
            onChange={(e) => setTransportadora({ ...transportadora, cnpj: e.target.value })}
          />
          <input
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
            placeholder="Modalidade frete"
            value={transportadora.modalidadeFrete}
            onChange={(e) => setTransportadora({ ...transportadora, modalidadeFrete: e.target.value })}
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-3">
        <h2 className="font-semibold text-slate-800">Natureza da operação</h2>
        <input
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
          value={natureza}
          onChange={(e) => setNatureza(e.target.value)}
        />
        <textarea
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm min-h-[80px]"
          placeholder="Informações adicionais"
          value={infoAdic}
          onChange={(e) => setInfoAdic(e.target.value)}
        />
      </div>

      <div className="bg-slate-900 text-white rounded-2xl p-6 flex flex-wrap justify-between gap-4 items-center">
        <div>
          <p className="text-slate-400 text-xs uppercase">Preview</p>
          <p className="text-lg font-semibold">
            Total: {totais.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
          <p className="text-sm text-slate-300">ICMS estimado: {totais.icms.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={emitir}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold px-6 py-3 rounded-xl flex items-center gap-2"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : null}
          Emitir NF-e
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
