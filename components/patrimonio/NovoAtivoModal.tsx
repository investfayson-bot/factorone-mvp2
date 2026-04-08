'use client'

import { useMemo, useState } from 'react'
import { addMonths } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { formatBRL, maskBRLInput, parseBRLInput } from '@/lib/currency-brl'
import { calcularDepreciacaoLinear, calcularDepreciacaoAcelerada, calcularDepreciacaoSomaDigitos } from '@/lib/financeiro/depreciacao'

type Categoria = { id: string; nome: string; vida_util_anos: number; metodo_depreciacao: 'linear' | 'acelerada' | 'soma_digitos' }
type Props = {
  open: boolean
  onClose: () => void
  onDone: () => void
  empresaId: string
  categorias: Categoria[]
}

export default function NovoAtivoModal({ open, onClose, onDone, empresaId, categorias }: Props) {
  const [nome, setNome] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [codigoInterno, setCodigoInterno] = useState('')
  const [numeroSerie, setNumeroSerie] = useState('')
  const [fornecedor, setFornecedor] = useState('')
  const [notaFiscal, setNotaFiscal] = useState('')
  const [dataAquisicao, setDataAquisicao] = useState(new Date().toISOString().slice(0, 10))
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().slice(0, 10))
  const [valorMask, setValorMask] = useState('')
  const [residualMask, setResidualMask] = useState('')
  const [vidaUtil, setVidaUtil] = useState(5)
  const [metodo, setMetodo] = useState<'linear' | 'acelerada' | 'soma_digitos'>('linear')
  const [localizacao, setLocalizacao] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [obs, setObs] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const categoria = categorias.find((c) => c.id === categoriaId)
  const valor = parseBRLInput(valorMask)
  const residual = parseBRLInput(residualMask)
  const depMensal = useMemo(() => {
    if (!valor) return 0
    if (metodo === 'linear') return calcularDepreciacaoLinear(valor, residual, vidaUtil)
    if (metodo === 'acelerada') return calcularDepreciacaoAcelerada(valor, residual, vidaUtil, 1)
    return calcularDepreciacaoSomaDigitos(valor, residual, vidaUtil * 12, 1)
  }, [metodo, residual, valor, vidaUtil])
  const depAnual = depMensal * 12
  const depreciaTotalEm = addMonths(new Date(dataInicio), vidaUtil * 12).toLocaleDateString('pt-BR')
  const valorAno1 = Math.max(valor - depMensal * 12, residual)
  if (!open) return null

  async function salvar() {
    let fotoUrl: string | null = null
    if (file) {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${empresaId}/${crypto.randomUUID()}.${ext}`
      const up = await supabase.storage.from('ativos').upload(path, file, { upsert: false })
      if (!up.error) fotoUrl = supabase.storage.from('ativos').getPublicUrl(path).data.publicUrl
    }
    const { error } = await supabase.from('ativos').insert({
      empresa_id: empresaId,
      categoria_id: categoriaId || null,
      nome,
      codigo_interno: codigoInterno || null,
      numero_serie: numeroSerie || null,
      fornecedor: fornecedor || null,
      nota_fiscal: notaFiscal || null,
      data_aquisicao: dataAquisicao,
      data_inicio_depreciacao: dataInicio,
      valor_aquisicao: valor,
      valor_residual: residual,
      vida_util_anos: vidaUtil,
      metodo_depreciacao: metodo,
      localizacao: localizacao || null,
      responsavel_nome: responsavel || null,
      foto_url: fotoUrl,
      observacoes: obs || null,
      status: 'ativo',
    })
    if (error) return alert(error.message)
    onDone()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5">
        <h3 className="text-lg font-bold">Novo ativo</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <input className="rounded border px-3 py-2" placeholder="Nome do ativo*" value={nome} onChange={(e) => setNome(e.target.value)} />
          <select className="rounded border px-3 py-2" value={categoriaId} onChange={(e) => { setCategoriaId(e.target.value); const c = categorias.find((x) => x.id === e.target.value); if (c) { setVidaUtil(c.vida_util_anos); setMetodo(c.metodo_depreciacao) } }}>
            <option value="">Categoria*</option>{categorias.map((c) => <option value={c.id} key={c.id}>{c.nome}</option>)}
          </select>
          <input className="rounded border px-3 py-2" placeholder="Código interno" value={codigoInterno} onChange={(e) => setCodigoInterno(e.target.value)} />
          <input className="rounded border px-3 py-2" placeholder="Número de série" value={numeroSerie} onChange={(e) => setNumeroSerie(e.target.value)} />
          <input className="rounded border px-3 py-2" placeholder="Fornecedor" value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} />
          <input className="rounded border px-3 py-2" placeholder="Número NF" value={notaFiscal} onChange={(e) => setNotaFiscal(e.target.value)} />
          <input type="date" className="rounded border px-3 py-2" value={dataAquisicao} onChange={(e) => setDataAquisicao(e.target.value)} />
          <input type="date" className="rounded border px-3 py-2" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          <input className="rounded border px-3 py-2" placeholder="Valor de aquisição*" value={valorMask} onChange={(e) => setValorMask(maskBRLInput(e.target.value))} />
          <input className="rounded border px-3 py-2" placeholder="Valor residual" value={residualMask} onChange={(e) => setResidualMask(maskBRLInput(e.target.value))} />
          <input type="number" className="rounded border px-3 py-2" placeholder="Vida útil (anos)" value={vidaUtil} onChange={(e) => setVidaUtil(Number(e.target.value || 5))} />
          <select className="rounded border px-3 py-2" value={metodo} onChange={(e) => setMetodo(e.target.value as 'linear' | 'acelerada' | 'soma_digitos')}>
            <option value="linear">Linear</option><option value="acelerada">Acelerada</option><option value="soma_digitos">Soma dos dígitos</option>
          </select>
          <input className="rounded border px-3 py-2" placeholder="Localização" value={localizacao} onChange={(e) => setLocalizacao(e.target.value)} />
          <input className="rounded border px-3 py-2" placeholder="Responsável" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} />
          <input type="file" className="rounded border px-3 py-2 md:col-span-2" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <textarea className="rounded border px-3 py-2 md:col-span-2" placeholder="Observações" value={obs} onChange={(e) => setObs(e.target.value)} />
        </div>
        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">
          <p>Depreciação mensal: {formatBRL(depMensal)}</p>
          <p>Depreciação anual: {formatBRL(depAnual)}</p>
          <p>Totalmente depreciado em: {depreciaTotalEm}</p>
          <p>Valor contábil após 1 ano: {formatBRL(valorAno1)}</p>
          {categoria && <p className="text-xs text-slate-500">Categoria padrão: {categoria.nome}</p>}
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button className="rounded border px-3 py-2" onClick={onClose}>Cancelar</button>
          <button className="rounded bg-blue-700 px-3 py-2 text-white" onClick={() => void salvar()}>Salvar ativo</button>
        </div>
      </div>
    </div>
  )
}
