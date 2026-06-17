'use client'
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'
import NovoAtivoModal from '@/components/patrimonio/NovoAtivoModal'
import DetalhesAtivoModal from '@/components/patrimonio/DetalhesAtivoModal'
import BaixaAtivoModal from '@/components/patrimonio/BaixaAtivoModal'
import QRCodeAtivo from '@/components/patrimonio/QRCodeAtivo'

type Categoria = { id: string; nome: string; vida_util_anos: number; metodo_depreciacao: 'linear' | 'acelerada' | 'soma_digitos' }
type Ativo = {
  id: string; nome: string; categoria_id: string | null; codigo_interno: string | null
  localizacao: string | null; valor_aquisicao: number; depreciacao_acumulada: number
  valor_contabil: number; status: string; foto_url: string | null
  responsavel_nome: string | null; qr_code: string; empresa_id: string
  tipo_ativo: string; placa: string | null; modelo: string | null
  ano_fabricacao: number | null; km_atual: number; horas_operacao: number
  seguro_vencimento: string | null; ipva_vencimento: string | null
  valor_fipe: number | null; taxa_depreciacao_anual: number | null
}
type Abastecimento = {
  id: string; ativo_id: string; data: string; km_atual: number | null
  litros: number; valor_total: number; preco_litro: number | null
  posto: string | null; combustivel: string
}
type Itinerario = {
  id: string; ativo_id: string; data: string; origem: string | null
  destino: string | null; km_percorrido: number | null; valor_frete: number | null
  motorista: string | null; carga: string | null; status: string
}
type ManutencaoP = {
  id: string; ativo_id: string; tipo: string; descricao: string | null
  data: string; km_ou_horas: number | null; valor: number; oficina: string | null
  proxima_data: string | null
}
type OperacaoMaq = {
  id: string; ativo_id: string; data: string; horas_inicio: number; horas_fim: number
  operador: string | null; producao: string | null
}
type ImoveisDet = {
  id?: string; ativo_id: string; empresa_id: string
  tipo_imovel: string; area_m2: number | null; endereco: string | null
  cep: string | null; cidade: string | null; estado: string | null
  matricula: string | null; escritura_url: string | null
  valor_venal: number | null; valor_iptu: number; iptu_vencimento: string | null
  iptu_pago: boolean; alugado: boolean; inquilino: string | null
  valor_aluguel: number; contrato_inicio: string | null; contrato_vencimento: string | null
  administradora: string | null
}
type Documento = {
  id: string; ativo_id: string; tipo: string; nome: string; url: string | null
  extraido_ocr: Record<string, unknown> | null; created_at: string
}

const TAXA_DEP: Record<string, number> = {
  veiculo_pesado: 25, veiculo_leve: 20, imovel: 4, maquina: 10,
  equipamento: 20, movel: 10, outros: 10,
}
const TIPO_LABEL: Record<string, string> = {
  veiculo_leve: 'Veículo Leve', veiculo_pesado: 'Veículo Pesado', imovel: 'Imóvel',
  maquina: 'Máquina', equipamento: 'Equipamento', movel: 'Móvel', outros: 'Outros',
}
const STATUS_COLORS: Record<string, string> = {
  ativo: 'green', em_manutencao: 'gray', baixado: 'red',
  alienado: 'red', perdido: 'red', sucateado: 'red',
}
const STATUS_LABEL: Record<string, string> = {
  ativo: 'Ativo', em_manutencao: 'Em manutenção', baixado: 'Baixado',
  alienado: 'Alienado', perdido: 'Perdido', sucateado: 'Sucateado',
}
function depColor(p: number) {
  if (p > 80) return 'var(--red)'; if (p >= 50) return 'var(--gold)'; return 'var(--teal)'
}
function diasAte(d: string | null): number | null {
  if (!d) return null
  return Math.round((new Date(d).getTime() - Date.now()) / 86400000)
}
const ATIVOS_BAIXADOS = ['baixado', 'alienado', 'perdido', 'sucateado']

// ── blank form objects ──
const blankAb = { data: '', km_atual: '', litros: '', valor_total: '', preco_litro: '', posto: '', combustivel: 'diesel' }
const blankIt = { data: '', origem: '', destino: '', km_percorrido: '', valor_frete: '', motorista: '', carga: '', status: 'planejado' }
const blankMn = { tipo: 'corretiva', descricao: '', data: '', valor: '', oficina: '', km_ou_horas: '', proxima_data: '' }
const blankOp = { data: '', horas_inicio: '', horas_fim: '', operador: '', producao: '', custo_hora: '' }
const blankIm = { tipo_imovel: 'comercial', area_m2: '', endereco: '', cep: '', cidade: '', estado: '', matricula: '', valor_venal: '', valor_iptu: '', iptu_vencimento: '', iptu_pago: false, alugado: false, inquilino: '', valor_aluguel: '', contrato_inicio: '', contrato_vencimento: '', administradora: '' }

export default function PatrimonioPage() {
  const [empresaId, setEmpresaId] = useState('')
  const [ativos, setAtivos] = useState<Ativo[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [depreciacoes, setDepreciacoes] = useState<Array<{ competencia: string; valor_depreciacao: number }>>([])
  const [tab, setTab] = useState<'visaogeral' | 'frota' | 'maquinas' | 'imoveis' | 'todos' | 'baixados'>('visaogeral')

  // Frota
  const [frotatab, setFrotatab] = useState<'lista' | 'abastecimentos' | 'itinerarios' | 'manutencoes' | 'documentos'>('lista')
  const [frotaSel, setFrotaSel] = useState<Ativo | null>(null)
  const [abastecimentos, setAbastecimentos] = useState<Abastecimento[]>([])
  const [itinerarios, setItinerarios] = useState<Itinerario[]>([])
  const [manutencoesF, setManutencoesF] = useState<ManutencaoP[]>([])
  const [docsF, setDocsF] = useState<Documento[]>([])

  // Máquinas
  const [maqtab, setMaqtab] = useState<'lista' | 'operacao' | 'manutencoes' | 'documentos'>('lista')
  const [maqSel, setMaqSel] = useState<Ativo | null>(null)
  const [operacoes, setOperacoes] = useState<OperacaoMaq[]>([])
  const [manutencoesM, setManutencoesM] = useState<ManutencaoP[]>([])
  const [docsM, setDocsM] = useState<Documento[]>([])

  // Imóveis
  const [imovelSel, setImovelSel] = useState<Ativo | null>(null)
  const [imovelDet, setImovelDet] = useState<ImoveisDet | null>(null)
  const [formIm, setFormIm] = useState<typeof blankIm>(blankIm)
  const [editandoIm, setEditandoIm] = useState(false)

  // Forms
  const [formAb, setFormAb] = useState(blankAb)
  const [formIt, setFormIt] = useState(blankIt)
  const [formMn, setFormMn] = useState(blankMn)
  const [formOp, setFormOp] = useState(blankOp)
  const [showFormAb, setShowFormAb] = useState(false)
  const [showFormIt, setShowFormIt] = useState(false)
  const [showFormMn, setShowFormMn] = useState(false)
  const [showFormOp, setShowFormOp] = useState(false)

  // OCR
  const [scanResult, setScanResult] = useState<Record<string, unknown> | null>(null)
  const [scanning, setScanning] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [docNome, setDocNome] = useState('')

  // Filters
  const [fTipo, setFTipo] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fLocal, setFLocal] = useState('')

  // Modals
  const [openNovo, setOpenNovo] = useState(false)
  const [detalhes, setDetalhes] = useState<Ativo | null>(null)
  const [baixa, setBaixa] = useState<Ativo | null>(null)
  const [qr, setQr] = useState<Ativo | null>(null)
  const [loadingDep, setLoadingDep] = useState(false)

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const u = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const eid = (u.data?.empresa_id as string) || user.id
    setEmpresaId(eid)
    const [a, c, d] = await Promise.all([
      supabase.from('ativos').select('*').eq('empresa_id', eid).order('created_at', { ascending: false }),
      supabase.from('categorias_ativo').select('id,nome,vida_util_anos,metodo_depreciacao').eq('empresa_id', eid).order('nome'),
      supabase.from('depreciacoes').select('competencia,valor_depreciacao').eq('empresa_id', eid).order('competencia', { ascending: false }).limit(24),
    ])
    setAtivos((a.data || []) as Ativo[])
    setCategorias((c.data || []) as Categoria[])
    setDepreciacoes((d.data || []) as Array<{ competencia: string; valor_depreciacao: number }>)
  }, [])

  async function carregarFrota(ativoId: string) {
    const [ab, it, mn, dc] = await Promise.all([
      supabase.from('frota_abastecimentos').select('*').eq('ativo_id', ativoId).order('data', { ascending: false }).limit(50),
      supabase.from('frota_itinerarios').select('*').eq('ativo_id', ativoId).order('data', { ascending: false }).limit(50),
      supabase.from('patrimonio_manutencoes').select('*').eq('ativo_id', ativoId).order('data', { ascending: false }).limit(30),
      supabase.from('patrimonio_documentos').select('*').eq('ativo_id', ativoId).order('created_at', { ascending: false }),
    ])
    setAbastecimentos((ab.data || []) as Abastecimento[])
    setItinerarios((it.data || []) as Itinerario[])
    setManutencoesF((mn.data || []) as ManutencaoP[])
    setDocsF((dc.data || []) as Documento[])
  }

  async function carregarMaq(ativoId: string) {
    const [op, mn, dc] = await Promise.all([
      supabase.from('maquinas_operacao').select('*').eq('ativo_id', ativoId).order('data', { ascending: false }).limit(50),
      supabase.from('patrimonio_manutencoes').select('*').eq('ativo_id', ativoId).order('data', { ascending: false }).limit(30),
      supabase.from('patrimonio_documentos').select('*').eq('ativo_id', ativoId).order('created_at', { ascending: false }),
    ])
    setOperacoes((op.data || []) as OperacaoMaq[])
    setManutencoesM((mn.data || []) as ManutencaoP[])
    setDocsM((dc.data || []) as Documento[])
  }

  async function carregarImovel(ativoId: string) {
    const { data } = await supabase.from('imoveis_detalhes').select('*').eq('ativo_id', ativoId).maybeSingle()
    if (data) {
      setImovelDet(data as ImoveisDet)
      setFormIm({
        tipo_imovel: data.tipo_imovel || 'comercial',
        area_m2: data.area_m2 ?? '', endereco: data.endereco || '', cep: data.cep || '',
        cidade: data.cidade || '', estado: data.estado || '', matricula: data.matricula || '',
        valor_venal: data.valor_venal ?? '', valor_iptu: data.valor_iptu ?? '',
        iptu_vencimento: data.iptu_vencimento || '', iptu_pago: data.iptu_pago || false,
        alugado: data.alugado || false, inquilino: data.inquilino || '',
        valor_aluguel: data.valor_aluguel ?? '', contrato_inicio: data.contrato_inicio || '',
        contrato_vencimento: data.contrato_vencimento || '', administradora: data.administradora || '',
      } as typeof blankIm)
    } else {
      setImovelDet(null)
      setFormIm(blankIm)
      setEditandoIm(true)
    }
  }

  useEffect(() => { void carregar() }, [carregar])

  function selecionarVeiculo(v: Ativo) { setFrotaSel(v); setFrotatab('lista'); setScanResult(null); void carregarFrota(v.id) }
  function selecionarMaquina(m: Ativo) { setMaqSel(m); setMaqtab('lista'); setScanResult(null); void carregarMaq(m.id) }
  function selecionarImovel(i: Ativo) { setImovelSel(i); setEditandoIm(false); void carregarImovel(i.id) }

  // ── save functions ──
  async function salvarAbastecimento() {
    if (!frotaSel || !formAb.litros || !formAb.valor_total) return
    const litros = parseFloat(formAb.litros); const valor = parseFloat(formAb.valor_total)
    await supabase.from('frota_abastecimentos').insert({
      ativo_id: frotaSel.id, empresa_id: empresaId,
      data: formAb.data || new Date().toISOString().slice(0, 10),
      km_atual: formAb.km_atual ? parseFloat(formAb.km_atual) : null,
      litros, valor_total: valor,
      preco_litro: formAb.preco_litro ? parseFloat(formAb.preco_litro) : (valor / litros),
      posto: formAb.posto || null, combustivel: formAb.combustivel,
    })
    setFormAb(blankAb); setShowFormAb(false); void carregarFrota(frotaSel.id)
  }

  async function salvarItinerario() {
    if (!frotaSel || !formIt.data) return
    await supabase.from('frota_itinerarios').insert({
      ativo_id: frotaSel.id, empresa_id: empresaId, data: formIt.data,
      origem: formIt.origem || null, destino: formIt.destino || null,
      km_percorrido: formIt.km_percorrido ? parseFloat(formIt.km_percorrido) : null,
      valor_frete: formIt.valor_frete ? parseFloat(formIt.valor_frete) : 0,
      motorista: formIt.motorista || null, carga: formIt.carga || null, status: formIt.status,
    })
    setFormIt(blankIt); setShowFormIt(false); void carregarFrota(frotaSel.id)
  }

  async function salvarManutencaoF() {
    if (!frotaSel || !formMn.data) return
    await supabase.from('patrimonio_manutencoes').insert({
      ativo_id: frotaSel.id, empresa_id: empresaId, tipo: formMn.tipo,
      descricao: formMn.descricao || null, data: formMn.data,
      km_ou_horas: formMn.km_ou_horas ? parseFloat(formMn.km_ou_horas) : null,
      valor: formMn.valor ? parseFloat(formMn.valor) : 0,
      oficina: formMn.oficina || null, proxima_data: formMn.proxima_data || null,
    })
    setFormMn(blankMn); setShowFormMn(false); void carregarFrota(frotaSel.id)
  }

  async function salvarManutencaoM() {
    if (!maqSel || !formMn.data) return
    await supabase.from('patrimonio_manutencoes').insert({
      ativo_id: maqSel.id, empresa_id: empresaId, tipo: formMn.tipo,
      descricao: formMn.descricao || null, data: formMn.data,
      km_ou_horas: formMn.km_ou_horas ? parseFloat(formMn.km_ou_horas) : null,
      valor: formMn.valor ? parseFloat(formMn.valor) : 0,
      oficina: formMn.oficina || null, proxima_data: formMn.proxima_data || null,
    })
    setFormMn(blankMn); setShowFormMn(false); void carregarMaq(maqSel.id)
  }

  async function salvarOperacao() {
    if (!maqSel || !formOp.data || !formOp.horas_inicio || !formOp.horas_fim) return
    await supabase.from('maquinas_operacao').insert({
      ativo_id: maqSel.id, empresa_id: empresaId, data: formOp.data,
      horas_inicio: parseFloat(formOp.horas_inicio), horas_fim: parseFloat(formOp.horas_fim),
      operador: formOp.operador || null, producao: formOp.producao || null,
      custo_hora: formOp.custo_hora ? parseFloat(formOp.custo_hora) : 0,
    })
    setFormOp(blankOp); setShowFormOp(false); void carregarMaq(maqSel.id)
  }

  async function salvarImovelDet() {
    if (!imovelSel) return
    const payload: Omit<ImoveisDet, 'id'> = {
      ativo_id: imovelSel.id, empresa_id: empresaId,
      tipo_imovel: formIm.tipo_imovel,
      area_m2: formIm.area_m2 ? parseFloat(String(formIm.area_m2)) : null,
      endereco: formIm.endereco || null, cep: formIm.cep || null,
      cidade: formIm.cidade || null, estado: formIm.estado || null,
      matricula: formIm.matricula || null, escritura_url: null,
      valor_venal: formIm.valor_venal ? parseFloat(String(formIm.valor_venal)) : null,
      valor_iptu: formIm.valor_iptu ? parseFloat(String(formIm.valor_iptu)) : 0,
      iptu_vencimento: formIm.iptu_vencimento || null, iptu_pago: formIm.iptu_pago,
      alugado: formIm.alugado,
      inquilino: formIm.inquilino || null,
      valor_aluguel: formIm.valor_aluguel ? parseFloat(String(formIm.valor_aluguel)) : 0,
      contrato_inicio: formIm.contrato_inicio || null,
      contrato_vencimento: formIm.contrato_vencimento || null,
      administradora: formIm.administradora || null,
    }
    if (imovelDet?.id) {
      await supabase.from('imoveis_detalhes').update(payload).eq('id', imovelDet.id)
    } else {
      await supabase.from('imoveis_detalhes').insert(payload)
    }
    setEditandoIm(false); void carregarImovel(imovelSel.id)
  }

  // ── OCR ──
  async function scanDocumento(ativoId: string, onDone: () => void) {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setScanning(true); setScanResult(null)
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1]
      const mediaType = file.type || 'image/jpeg'
      try {
        const { data: sess } = await supabase.auth.getSession()
        const res = await fetch('/api/patrimonio/ocr-documento', {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...(sess.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {}) },
          body: JSON.stringify({ imageBase64: base64, mediaType }),
        })
        const { extracted } = await res.json() as { extracted: Record<string, unknown> }
        setScanResult(extracted)
        setDocNome(String(extracted.nome || file.name))
        // auto-save to patrimonio_documentos
        await supabase.from('patrimonio_documentos').insert({
          ativo_id: ativoId, empresa_id: empresaId,
          tipo: String(extracted.tipo || 'outro'),
          nome: String(extracted.nome || file.name),
          url: null, extraido_ocr: extracted,
        })
        onDone()
      } finally {
        setScanning(false)
        if (fileRef.current) fileRef.current.value = ''
      }
    }
    reader.readAsDataURL(file)
  }

  async function processarDepreciacao() {
    setLoadingDep(true)
    const { data: sess } = await supabase.auth.getSession()
    const res = await fetch('/api/patrimonio/depreciar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(sess.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {}) },
      body: JSON.stringify({ empresaId, competencia: new Date().toISOString().slice(0, 7) }),
    })
    const payload = await res.json().catch(() => ({})) as { processados?: number; error?: string }
    setLoadingDep(false)
    if (!res.ok) return alert(payload.error || 'Falha ao processar depreciação')
    alert(`Depreciação processada: ${payload.processados} ativos`)
    void carregar()
  }

  // ── Derived ──
  const ativosAtivos = useMemo(() => ativos.filter(a => !ATIVOS_BAIXADOS.includes(a.status)), [ativos])
  const ativosBaixados = useMemo(() => ativos.filter(a => ATIVOS_BAIXADOS.includes(a.status)), [ativos])
  const frota = useMemo(() => ativosAtivos.filter(a => a.tipo_ativo === 'veiculo_leve' || a.tipo_ativo === 'veiculo_pesado'), [ativosAtivos])
  const maquinas = useMemo(() => ativosAtivos.filter(a => a.tipo_ativo === 'maquina'), [ativosAtivos])
  const imoveis = useMemo(() => ativosAtivos.filter(a => a.tipo_ativo === 'imovel'), [ativosAtivos])

  const valorTotal = ativosAtivos.reduce((s, a) => s + Number(a.valor_aquisicao || 0), 0)
  const valorContabil = ativosAtivos.reduce((s, a) => s + Number(a.valor_contabil || 0), 0)
  const depMes = depreciacoes.filter(d => d.competencia?.startsWith(new Date().toISOString().slice(0, 7))).reduce((s, d) => s + Number(d.valor_depreciacao || 0), 0)

  const alertas = useMemo(() => {
    const em30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
    return ativosAtivos.filter(a =>
      (a.seguro_vencimento && a.seguro_vencimento <= em30) ||
      (a.ipva_vencimento && a.ipva_vencimento <= em30)
    ).map(a => {
      const msgs: string[] = []
      if (a.seguro_vencimento && a.seguro_vencimento <= em30) {
        const d = diasAte(a.seguro_vencimento)
        msgs.push(`Seguro ${d !== null && d < 0 ? `vencido há ${Math.abs(d)}d` : `vence em ${d}d`}`)
      }
      if (a.ipva_vencimento && a.ipva_vencimento <= em30) {
        const d = diasAte(a.ipva_vencimento)
        msgs.push(`IPVA ${d !== null && d < 0 ? `vencido há ${Math.abs(d)}d` : `vence em ${d}d`}`)
      }
      return { ativo: a, msgs }
    })
  }, [ativosAtivos])

  // Frota KPIs
  const kmTotal = useMemo(() => itinerarios.reduce((s, i) => s + Number(i.km_percorrido || 0), 0), [itinerarios])
  const freteTotal = useMemo(() => itinerarios.reduce((s, i) => s + Number(i.valor_frete || 0), 0), [itinerarios])
  const gastoAb = useMemo(() => abastecimentos.reduce((s, a) => s + Number(a.valor_total || 0), 0), [abastecimentos])
  const litrosTotal = useMemo(() => abastecimentos.reduce((s, a) => s + Number(a.litros || 0), 0), [abastecimentos])
  const custoPorKm = kmTotal > 0 ? (gastoAb / kmTotal) : 0
  const kmPorLitro = litrosTotal > 0 ? (kmTotal / litrosTotal) : 0

  // Máquinas KPIs
  const horasTotal = useMemo(() => operacoes.reduce((s, o) => s + (Number(o.horas_fim || 0) - Number(o.horas_inicio || 0)), 0), [operacoes])

  function categoriaNome(id: string | null) { return categorias.find(c => c.id === id)?.nome || '—' }
  function depProgress(a: Ativo) {
    const total = Number(a.valor_aquisicao || 0)
    if (!total) return 0
    return (Number(a.depreciacao_acumulada || 0) / total) * 100
  }

  const todosF = ativosAtivos.filter(a =>
    (!fTipo || a.tipo_ativo === fTipo) &&
    (!fStatus || a.status === fStatus) &&
    (!fLocal || (a.localizacao || '').toLowerCase().includes(fLocal.toLowerCase()))
  )
  const baixadosF = ativosBaixados.filter(a =>
    (!fTipo || a.tipo_ativo === fTipo) &&
    (!fLocal || (a.localizacao || '').toLowerCase().includes(fLocal.toLowerCase()))
  )

  const TABS = [
    ['visaogeral', 'Visão Geral'],
    ['frota', `Frota (${frota.length})`],
    ['maquinas', `Máquinas (${maquinas.length})`],
    ['imoveis', `Imóveis (${imoveis.length})`],
    ['todos', `Todos (${ativosAtivos.length})`],
    ['baixados', `Baixados (${ativosBaixados.length})`],
  ] as [string, string][]

  const inlineFormStyle: React.CSSProperties = {
    background: 'var(--gray-50)', border: '1px solid var(--gray-100)', borderRadius: 10,
    padding: 16, marginBottom: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8,
  }

  // ── OCR panel component (inline) ──
  function OcrPanel({ ativoId, docs, onRefresh }: { ativoId: string; docs: Documento[]; onRefresh: () => void }) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>Documentos do ativo</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11, color: 'var(--teal)', fontWeight: 600 }}>
            <i className="fa-solid fa-camera" />
            {scanning ? 'Analisando…' : 'Scan documento'}
            <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
              onChange={() => void scanDocumento(ativoId, onRefresh)} />
          </label>
        </div>

        {scanning && (
          <div style={{ background: 'rgba(6,182,212,.06)', border: '1px solid rgba(6,182,212,.2)', borderRadius: 8, padding: 12, marginBottom: 8, fontSize: 12, color: 'var(--teal)' }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }} /> FactorOne IA analisando o documento…
          </div>
        )}

        {scanResult && !scanning && (
          <div style={{ background: 'rgba(6,182,212,.06)', border: '1px solid rgba(6,182,212,.2)', borderRadius: 8, padding: 12, marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--teal)', marginBottom: 6 }}>Resultado do scan</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {Object.entries(scanResult).filter(([, v]) => v !== null).map(([k, v]) => (
                <div key={k} style={{ fontSize: 11 }}>
                  <span style={{ color: 'var(--gray-400)', textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}: </span>
                  <span style={{ fontWeight: 600 }}>{String(v)}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10, color: 'var(--gray-400)', marginTop: 6 }}>
              <i className="fa-solid fa-check-circle" style={{ color: 'var(--green)', marginRight: 4 }} />
              Salvo automaticamente em Documentos
            </div>
          </div>
        )}

        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 10, overflow: 'hidden' }}>
          <div className="expenses-table">
            <table>
              <thead><tr><th>Tipo</th><th>Nome</th><th>Dados extraídos</th><th>Data</th></tr></thead>
              <tbody>
                {docs.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '24px 0', fontSize: 12 }}>Nenhum documento. Use "Scan documento" para extrair dados com IA.</td></tr>}
                {docs.map(doc => {
                  const ocr = doc.extraido_ocr
                  return (
                    <tr key={doc.id}>
                      <td><span className="tag gray" style={{ fontSize: 9 }}>{doc.tipo}</span></td>
                      <td style={{ fontSize: 12, fontWeight: 600 }}>{doc.nome}</td>
                      <td style={{ fontSize: 11, color: 'var(--gray-500)' }}>
                        {ocr ? (
                          <span>
                            {ocr.data_vencimento ? `Venc. ${String(ocr.data_vencimento)} · ` : ''}
                            {ocr.valor ? `${formatBRL(Number(ocr.valor))} · ` : ''}
                            {ocr.emissor ? String(ocr.emissor) : ''}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 11 }}>{doc.created_at?.slice(0, 10)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
    void docNome
  }

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} />

      <div className="page-hdr">
        <div>
          <div className="page-title">Patrimônio & Ativos</div>
          <div className="page-sub">Frota, máquinas, imóveis e controle de ativos</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" onClick={() => setOpenNovo(true)}>+ Novo Ativo</button>
          <button className="btn-action" disabled={loadingDep} onClick={() => void processarDepreciacao()} style={{ opacity: loadingDep ? 0.6 : 1 }}>
            {loadingDep ? 'Processando…' : 'Processar Depreciação'}
          </button>
          <a className="btn-ghost" href="/api/patrimonio/relatorio" target="_blank">Exportar</a>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as typeof tab)} style={{
            padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid',
            background: tab === k ? 'var(--navy)' : '#fff', color: tab === k ? '#fff' : 'var(--gray-500)',
            borderColor: tab === k ? 'var(--navy)' : 'var(--gray-100)',
          }}>{l}</button>
        ))}
      </div>

      {/* ── VISÃO GERAL ── */}
      {tab === 'visaogeral' && (
        <>
          <div className="kpis" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 16 }}>
            <div className="kpi"><div className="kpi-lbl">Ativos ativos</div><div className="kpi-val">{ativosAtivos.length}</div><div className="kpi-delta">cadastrados</div></div>
            <div className="kpi"><div className="kpi-lbl">Valor total</div><div className="kpi-val">{formatBRL(valorTotal)}</div><div className="kpi-delta">aquisição</div></div>
            <div className="kpi"><div className="kpi-lbl">Deprec. mês</div><div className="kpi-val" style={{ color: 'var(--red)' }}>{formatBRL(depMes)}</div><div className="kpi-delta dn">mês atual</div></div>
            <div className="kpi"><div className="kpi-lbl">Valor contábil</div><div className="kpi-val" style={{ color: 'var(--teal)' }}>{formatBRL(valorContabil)}</div><div className="kpi-delta up">líquido</div></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <i className="fa-solid fa-truck" style={{ color: 'var(--navy)' }} />
                <div style={{ fontWeight: 700, fontSize: 13 }}>Frota</div>
                <span style={{ marginLeft: 'auto', background: 'var(--navy)', color: '#fff', borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 700 }}>{frota.length}</span>
              </div>
              {frota.length === 0 ? <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>Nenhum veículo.</div> : frota.slice(0, 4).map(v => (
                <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, marginBottom: 4 }}>
                  <span className={`tag ${STATUS_COLORS[v.status] || 'gray'}`} style={{ fontSize: 9 }}>{STATUS_LABEL[v.status]}</span>
                  <span style={{ flex: 1, fontWeight: 600 }}>{v.nome}</span>
                  <span style={{ fontFamily: "'DM Mono',monospace" }}>{v.placa || '—'}</span>
                </div>
              ))}
            </div>
            <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <i className="fa-solid fa-gear" style={{ color: 'var(--teal)' }} />
                <div style={{ fontWeight: 700, fontSize: 13 }}>Máquinas</div>
                <span style={{ marginLeft: 'auto', background: 'var(--teal)', color: '#fff', borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 700 }}>{maquinas.length}</span>
              </div>
              {maquinas.length === 0 ? <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>Nenhuma máquina.</div> : maquinas.slice(0, 4).map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, marginBottom: 4 }}>
                  <span className={`tag ${STATUS_COLORS[m.status] || 'gray'}`} style={{ fontSize: 9 }}>{STATUS_LABEL[m.status]}</span>
                  <span style={{ flex: 1, fontWeight: 600 }}>{m.nome}</span>
                  <span style={{ fontFamily: "'DM Mono',monospace", color: 'var(--gray-400)' }}>{Number(m.horas_operacao || 0).toLocaleString('pt-BR')}h</span>
                </div>
              ))}
            </div>
            <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <i className="fa-solid fa-building" style={{ color: 'var(--gold)' }} />
                <div style={{ fontWeight: 700, fontSize: 13 }}>Imóveis</div>
                <span style={{ marginLeft: 'auto', background: 'var(--gold)', color: '#fff', borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 700 }}>{imoveis.length}</span>
              </div>
              {imoveis.length === 0 ? <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>Nenhum imóvel.</div> : imoveis.slice(0, 4).map(i => (
                <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, marginBottom: 4 }}>
                  <span style={{ flex: 1, fontWeight: 600 }}>{i.nome}</span>
                  <span style={{ color: 'var(--teal)', fontWeight: 700 }}>{formatBRL(Number(i.valor_contabil || 0))}</span>
                </div>
              ))}
            </div>
          </div>

          {alertas.length > 0 && (
            <div style={{ background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--red)', marginBottom: 10 }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 6 }} />{alertas.length} alerta{alertas.length > 1 ? 's' : ''} de vencimento
              </div>
              {alertas.map(({ ativo, msgs }) => (
                <div key={ativo.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>{ativo.nome}</span>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--gray-400)' }}>{ativo.placa || ''}</span>
                  {msgs.map((m, i) => <span key={i} style={{ color: 'var(--red)', background: 'rgba(239,68,68,.1)', borderRadius: 4, padding: '1px 6px', fontSize: 11 }}>{m}</span>)}
                </div>
              ))}
            </div>
          )}

          <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Taxas de depreciação (Receita Federal)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
              {Object.entries(TAXA_DEP).map(([tipo, taxa]) => (
                <div key={tipo} style={{ background: 'var(--gray-50)', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{TIPO_LABEL[tipo]}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'DM Mono',monospace", color: 'var(--navy)' }}>{taxa}% a.a.</div>
                  <div style={{ fontSize: 10, color: 'var(--gray-400)' }}>Vida útil: {Math.round(100 / taxa)} anos</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── FROTA ── */}
      {tab === 'frota' && (
        <>
          {frotaSel ? (
            <div>
              <button className="btn-ghost" style={{ marginBottom: 12, fontSize: 11 }} onClick={() => { setFrotaSel(null); setScanResult(null) }}>← Voltar</button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fa-solid fa-truck" style={{ color: '#fff', fontSize: 16 }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{frotaSel.nome}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>{frotaSel.placa || 'Sem placa'} · {frotaSel.modelo || ''} {frotaSel.ano_fabricacao || ''}</div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 16 }}>
                  <div style={{ textAlign: 'right', fontSize: 11 }}><div style={{ color: 'var(--gray-400)' }}>Odômetro</div><div style={{ fontWeight: 700 }}>{Number(frotaSel.km_atual || 0).toLocaleString('pt-BR')} km</div></div>
                  <div style={{ textAlign: 'right', fontSize: 11 }}><div style={{ color: 'var(--gray-400)' }}>Contábil</div><div style={{ fontWeight: 700, color: 'var(--teal)' }}>{formatBRL(Number(frotaSel.valor_contabil || 0))}</div></div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {(['lista', 'abastecimentos', 'itinerarios', 'manutencoes', 'documentos'] as const).map(k => (
                  <button key={k} onClick={() => { setFrotatab(k); setScanResult(null) }} style={{
                    padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid',
                    background: frotatab === k ? 'var(--teal)' : '#fff', color: frotatab === k ? '#fff' : 'var(--gray-500)',
                    borderColor: frotatab === k ? 'var(--teal)' : 'var(--gray-100)',
                  }}>{k === 'lista' ? 'KPIs' : k.charAt(0).toUpperCase() + k.slice(1)}</button>
                ))}
              </div>

              {frotatab === 'lista' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                  <div className="kpi"><div className="kpi-lbl">KM percorridos</div><div className="kpi-val">{kmTotal.toLocaleString('pt-BR')}</div><div className="kpi-delta">histórico</div></div>
                  <div className="kpi"><div className="kpi-lbl">Custo/km</div><div className="kpi-val">{custoPorKm > 0 ? `R$ ${custoPorKm.toFixed(2)}` : '—'}</div><div className="kpi-delta">combustível</div></div>
                  <div className="kpi"><div className="kpi-lbl">KM/litro</div><div className="kpi-val">{kmPorLitro > 0 ? kmPorLitro.toFixed(1) : '—'}</div><div className="kpi-delta">eficiência</div></div>
                  <div className="kpi"><div className="kpi-lbl">Receita frete</div><div className="kpi-val" style={{ color: 'var(--green)' }}>{formatBRL(freteTotal)}</div><div className="kpi-delta up">histórico</div></div>
                </div>
              )}

              {frotatab === 'abastecimentos' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                    <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => setShowFormAb(!showFormAb)}>+ Abastecimento</button>
                  </div>
                  {showFormAb && (
                    <div style={inlineFormStyle}>
                      <div style={{ gridColumn: '1/-1', fontWeight: 700, fontSize: 12 }}>Novo abastecimento</div>
                      <input type="date" className="form-input" value={formAb.data} onChange={e => setFormAb(p => ({ ...p, data: e.target.value }))} />
                      <input className="form-input" placeholder="KM atual" type="number" value={formAb.km_atual} onChange={e => setFormAb(p => ({ ...p, km_atual: e.target.value }))} />
                      <input className="form-input" placeholder="Litros *" type="number" value={formAb.litros} onChange={e => setFormAb(p => ({ ...p, litros: e.target.value }))} />
                      <input className="form-input" placeholder="Valor total R$ *" type="number" value={formAb.valor_total} onChange={e => setFormAb(p => ({ ...p, valor_total: e.target.value }))} />
                      <input className="form-input" placeholder="Posto" value={formAb.posto} onChange={e => setFormAb(p => ({ ...p, posto: e.target.value }))} />
                      <select className="form-input" value={formAb.combustivel} onChange={e => setFormAb(p => ({ ...p, combustivel: e.target.value }))}>
                        <option value="diesel">Diesel</option><option value="gasolina">Gasolina</option>
                        <option value="etanol">Etanol</option><option value="gnv">GNV</option>
                      </select>
                      <div style={{ display: 'flex', gap: 6, gridColumn: '1/-1' }}>
                        <button className="btn-action" style={{ fontSize: 11 }} onClick={() => void salvarAbastecimento()}>Salvar</button>
                        <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => setShowFormAb(false)}>Cancelar</button>
                      </div>
                    </div>
                  )}
                  <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 10, overflow: 'hidden' }}>
                    <div className="expenses-table"><table>
                      <thead><tr><th>Data</th><th>KM</th><th>Litros</th><th style={{ textAlign: 'right' }}>Valor</th><th style={{ textAlign: 'right' }}>R$/L</th><th>Posto</th><th>Comb.</th></tr></thead>
                      <tbody>
                        {abastecimentos.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '24px 0' }}>Nenhum abastecimento.</td></tr>}
                        {abastecimentos.map(ab => (
                          <tr key={ab.id}>
                            <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 11 }}>{ab.data}</td>
                            <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 11 }}>{ab.km_atual ? Number(ab.km_atual).toLocaleString('pt-BR') : '—'}</td>
                            <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 11 }}>{Number(ab.litros).toFixed(1)}L</td>
                            <td style={{ textAlign: 'right', fontFamily: "'DM Mono',monospace" }}>{formatBRL(Number(ab.valor_total))}</td>
                            <td style={{ textAlign: 'right', fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--gray-400)' }}>{ab.preco_litro ? `R$ ${Number(ab.preco_litro).toFixed(3)}` : '—'}</td>
                            <td style={{ fontSize: 11 }}>{ab.posto || '—'}</td>
                            <td><span className="tag gray" style={{ fontSize: 9 }}>{ab.combustivel}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table></div>
                  </div>
                </>
              )}

              {frotatab === 'itinerarios' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                    <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => setShowFormIt(!showFormIt)}>+ Itinerário</button>
                  </div>
                  {showFormIt && (
                    <div style={inlineFormStyle}>
                      <div style={{ gridColumn: '1/-1', fontWeight: 700, fontSize: 12 }}>Novo itinerário</div>
                      <input type="date" className="form-input" value={formIt.data} onChange={e => setFormIt(p => ({ ...p, data: e.target.value }))} />
                      <input className="form-input" placeholder="Origem" value={formIt.origem} onChange={e => setFormIt(p => ({ ...p, origem: e.target.value }))} />
                      <input className="form-input" placeholder="Destino" value={formIt.destino} onChange={e => setFormIt(p => ({ ...p, destino: e.target.value }))} />
                      <input className="form-input" placeholder="KM percorrido" type="number" value={formIt.km_percorrido} onChange={e => setFormIt(p => ({ ...p, km_percorrido: e.target.value }))} />
                      <input className="form-input" placeholder="Valor frete R$" type="number" value={formIt.valor_frete} onChange={e => setFormIt(p => ({ ...p, valor_frete: e.target.value }))} />
                      <input className="form-input" placeholder="Motorista" value={formIt.motorista} onChange={e => setFormIt(p => ({ ...p, motorista: e.target.value }))} />
                      <input className="form-input" placeholder="Carga" value={formIt.carga} onChange={e => setFormIt(p => ({ ...p, carga: e.target.value }))} />
                      <select className="form-input" value={formIt.status} onChange={e => setFormIt(p => ({ ...p, status: e.target.value }))}>
                        <option value="planejado">Planejado</option><option value="em_rota">Em rota</option>
                        <option value="concluido">Concluído</option><option value="cancelado">Cancelado</option>
                      </select>
                      <div style={{ display: 'flex', gap: 6, gridColumn: '1/-1' }}>
                        <button className="btn-action" style={{ fontSize: 11 }} onClick={() => void salvarItinerario()}>Salvar</button>
                        <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => setShowFormIt(false)}>Cancelar</button>
                      </div>
                    </div>
                  )}
                  <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 10, overflow: 'hidden' }}>
                    <div className="expenses-table"><table>
                      <thead><tr><th>Data</th><th>Rota</th><th>KM</th><th style={{ textAlign: 'right' }}>Frete</th><th>Motorista</th><th>Status</th></tr></thead>
                      <tbody>
                        {itinerarios.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '24px 0' }}>Nenhum itinerário.</td></tr>}
                        {itinerarios.map(it => (
                          <tr key={it.id}>
                            <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 11 }}>{it.data}</td>
                            <td style={{ fontSize: 12 }}>{it.origem || '—'} → {it.destino || '—'}</td>
                            <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 11 }}>{it.km_percorrido ? `${Number(it.km_percorrido).toLocaleString('pt-BR')} km` : '—'}</td>
                            <td style={{ textAlign: 'right', fontFamily: "'DM Mono',monospace", color: 'var(--green)', fontWeight: 700 }}>{formatBRL(Number(it.valor_frete || 0))}</td>
                            <td style={{ fontSize: 11 }}>{it.motorista || '—'}</td>
                            <td><span className={`tag ${it.status === 'concluido' ? 'green' : 'gray'}`} style={{ fontSize: 9 }}>{it.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table></div>
                  </div>
                </>
              )}

              {frotatab === 'manutencoes' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                    <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => setShowFormMn(!showFormMn)}>+ Manutenção</button>
                  </div>
                  {showFormMn && <ManutForm form={formMn} setForm={setFormMn} onSave={() => void salvarManutencaoF()} onCancel={() => setShowFormMn(false)} showHoras />}
                  <ManutencaoTable manutencoes={manutencoesF} />
                </>
              )}

              {frotatab === 'documentos' && (
                <OcrPanel ativoId={frotaSel.id} docs={docsF} onRefresh={() => void carregarFrota(frotaSel.id)} />
              )}
            </div>
          ) : (
            frota.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--gray-400)', fontSize: 13 }}>
                Nenhum veículo. Clique em <strong>+ Novo Ativo</strong> e selecione tipo Veículo.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                {frota.map(v => {
                  const segD = diasAte(v.seguro_vencimento); const ipvaD = diasAte(v.ipva_vencimento); const p = depProgress(v)
                  return (
                    <button key={v.id} onClick={() => selecionarVeiculo(v)} style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 16, textAlign: 'left', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <i className={`fa-solid ${v.tipo_ativo === 'veiculo_pesado' ? 'fa-truck' : 'fa-car'}`} style={{ color: '#fff', fontSize: 14 }} />
                        </div>
                        <div><div style={{ fontWeight: 700, fontSize: 13 }}>{v.nome}</div><div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{v.placa || '—'}</div></div>
                        <span className={`tag ${STATUS_COLORS[v.status] || 'gray'}`} style={{ marginLeft: 'auto', fontSize: 9 }}>{STATUS_LABEL[v.status]}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11, marginBottom: 8 }}>
                        <div><span style={{ color: 'var(--gray-400)' }}>Modelo</span><br /><span style={{ fontWeight: 600 }}>{v.modelo || '—'}</span></div>
                        <div><span style={{ color: 'var(--gray-400)' }}>Ano</span><br /><span style={{ fontWeight: 600 }}>{v.ano_fabricacao || '—'}</span></div>
                        <div><span style={{ color: 'var(--gray-400)' }}>Odômetro</span><br /><span style={{ fontFamily: "'DM Mono',monospace" }}>{Number(v.km_atual || 0).toLocaleString('pt-BR')} km</span></div>
                        <div><span style={{ color: 'var(--gray-400)' }}>Contábil</span><br /><span style={{ color: 'var(--teal)', fontWeight: 700 }}>{formatBRL(Number(v.valor_contabil || 0))}</span></div>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: 'var(--gray-100)', marginBottom: 6 }}>
                        <div style={{ height: 4, borderRadius: 2, width: `${Math.min(p, 100)}%`, background: depColor(p) }} />
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {segD !== null && segD <= 30 && <span style={{ fontSize: 9, background: 'rgba(239,68,68,.1)', color: 'var(--red)', borderRadius: 4, padding: '1px 5px', fontWeight: 600 }}>Seguro {segD < 0 ? `vencido` : `${segD}d`}</span>}
                        {ipvaD !== null && ipvaD <= 30 && <span style={{ fontSize: 9, background: 'rgba(245,158,11,.1)', color: 'var(--gold)', borderRadius: 4, padding: '1px 5px', fontWeight: 600 }}>IPVA {ipvaD < 0 ? `vencido` : `${ipvaD}d`}</span>}
                      </div>
                    </button>
                  )
                })}
              </div>
            )
          )}
        </>
      )}

      {/* ── MÁQUINAS ── */}
      {tab === 'maquinas' && (
        <>
          {maqSel ? (
            <div>
              <button className="btn-ghost" style={{ marginBottom: 12, fontSize: 11 }} onClick={() => { setMaqSel(null); setScanResult(null) }}>← Voltar</button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fa-solid fa-gear" style={{ color: '#fff', fontSize: 16 }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{maqSel.nome}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>{maqSel.modelo || ''} · {maqSel.localizacao || ''}</div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 16 }}>
                  <div style={{ textAlign: 'right', fontSize: 11 }}><div style={{ color: 'var(--gray-400)' }}>Horas totais</div><div style={{ fontWeight: 700 }}>{Number(maqSel.horas_operacao || 0).toLocaleString('pt-BR')} h</div></div>
                  <div style={{ textAlign: 'right', fontSize: 11 }}><div style={{ color: 'var(--gray-400)' }}>Contábil</div><div style={{ fontWeight: 700, color: 'var(--teal)' }}>{formatBRL(Number(maqSel.valor_contabil || 0))}</div></div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {(['lista', 'operacao', 'manutencoes', 'documentos'] as const).map(k => (
                  <button key={k} onClick={() => { setMaqtab(k); setScanResult(null) }} style={{
                    padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid',
                    background: maqtab === k ? 'var(--teal)' : '#fff', color: maqtab === k ? '#fff' : 'var(--gray-500)',
                    borderColor: maqtab === k ? 'var(--teal)' : 'var(--gray-100)',
                  }}>{k === 'lista' ? 'KPIs' : k.charAt(0).toUpperCase() + k.slice(1)}</button>
                ))}
              </div>
              {maqtab === 'lista' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  <div className="kpi"><div className="kpi-lbl">Horas registradas</div><div className="kpi-val">{horasTotal.toFixed(1)}</div><div className="kpi-delta">total</div></div>
                  <div className="kpi"><div className="kpi-lbl">Registros</div><div className="kpi-val">{operacoes.length}</div><div className="kpi-delta">operações</div></div>
                  <div className="kpi"><div className="kpi-lbl">Manutenções</div><div className="kpi-val">{manutencoesM.length}</div><div className="kpi-delta">registradas</div></div>
                </div>
              )}
              {maqtab === 'operacao' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                    <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => setShowFormOp(!showFormOp)}>+ Operação</button>
                  </div>
                  {showFormOp && (
                    <div style={inlineFormStyle}>
                      <div style={{ gridColumn: '1/-1', fontWeight: 700, fontSize: 12 }}>Nova operação</div>
                      <input type="date" className="form-input" value={formOp.data} onChange={e => setFormOp(p => ({ ...p, data: e.target.value }))} />
                      <input className="form-input" placeholder="Hora início" type="number" value={formOp.horas_inicio} onChange={e => setFormOp(p => ({ ...p, horas_inicio: e.target.value }))} />
                      <input className="form-input" placeholder="Hora fim" type="number" value={formOp.horas_fim} onChange={e => setFormOp(p => ({ ...p, horas_fim: e.target.value }))} />
                      <input className="form-input" placeholder="Operador" value={formOp.operador} onChange={e => setFormOp(p => ({ ...p, operador: e.target.value }))} />
                      <input className="form-input" placeholder="Produção" value={formOp.producao} onChange={e => setFormOp(p => ({ ...p, producao: e.target.value }))} />
                      <input className="form-input" placeholder="Custo/hora R$" type="number" value={formOp.custo_hora} onChange={e => setFormOp(p => ({ ...p, custo_hora: e.target.value }))} />
                      <div style={{ display: 'flex', gap: 6, gridColumn: '1/-1' }}>
                        <button className="btn-action" style={{ fontSize: 11 }} onClick={() => void salvarOperacao()}>Salvar</button>
                        <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => setShowFormOp(false)}>Cancelar</button>
                      </div>
                    </div>
                  )}
                  <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 10, overflow: 'hidden' }}>
                    <div className="expenses-table"><table>
                      <thead><tr><th>Data</th><th>H. Início</th><th>H. Fim</th><th style={{ textAlign: 'right' }}>Duração</th><th>Operador</th><th>Produção</th></tr></thead>
                      <tbody>
                        {operacoes.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '24px 0' }}>Nenhuma operação.</td></tr>}
                        {operacoes.map(op => (
                          <tr key={op.id}>
                            <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 11 }}>{op.data}</td>
                            <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 11 }}>{Number(op.horas_inicio).toFixed(1)}h</td>
                            <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 11 }}>{Number(op.horas_fim).toFixed(1)}h</td>
                            <td style={{ textAlign: 'right', fontFamily: "'DM Mono',monospace", color: 'var(--teal)', fontWeight: 700 }}>{(Number(op.horas_fim) - Number(op.horas_inicio)).toFixed(1)}h</td>
                            <td style={{ fontSize: 11 }}>{op.operador || '—'}</td>
                            <td style={{ fontSize: 11 }}>{op.producao || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table></div>
                  </div>
                </>
              )}
              {maqtab === 'manutencoes' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                    <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => setShowFormMn(!showFormMn)}>+ Manutenção</button>
                  </div>
                  {showFormMn && <ManutForm form={formMn} setForm={setFormMn} onSave={() => void salvarManutencaoM()} onCancel={() => setShowFormMn(false)} showHoras />}
                  <ManutencaoTable manutencoes={manutencoesM} />
                </>
              )}
              {maqtab === 'documentos' && (
                <OcrPanel ativoId={maqSel.id} docs={docsM} onRefresh={() => void carregarMaq(maqSel.id)} />
              )}
            </div>
          ) : (
            maquinas.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--gray-400)', fontSize: 13 }}>Nenhuma máquina. Clique em <strong>+ Novo Ativo</strong> e selecione tipo Máquina.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                {maquinas.map(m => {
                  const p = depProgress(m)
                  return (
                    <button key={m.id} onClick={() => selecionarMaquina(m)} style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 16, textAlign: 'left', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <i className="fa-solid fa-gear" style={{ color: '#fff', fontSize: 14 }} />
                        </div>
                        <div><div style={{ fontWeight: 700, fontSize: 13 }}>{m.nome}</div><div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{m.localizacao || '—'}</div></div>
                        <span className={`tag ${STATUS_COLORS[m.status] || 'gray'}`} style={{ marginLeft: 'auto', fontSize: 9 }}>{STATUS_LABEL[m.status]}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11, marginBottom: 8 }}>
                        <div><span style={{ color: 'var(--gray-400)' }}>Horas</span><br /><span style={{ fontFamily: "'DM Mono',monospace" }}>{Number(m.horas_operacao || 0).toLocaleString('pt-BR')} h</span></div>
                        <div><span style={{ color: 'var(--gray-400)' }}>Contábil</span><br /><span style={{ color: 'var(--teal)', fontWeight: 700 }}>{formatBRL(Number(m.valor_contabil || 0))}</span></div>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: 'var(--gray-100)' }}>
                        <div style={{ height: 4, borderRadius: 2, width: `${Math.min(p, 100)}%`, background: depColor(p) }} />
                      </div>
                    </button>
                  )
                })}
              </div>
            )
          )}
        </>
      )}

      {/* ── IMÓVEIS ── */}
      {tab === 'imoveis' && (
        <>
          {imovelSel ? (
            <div>
              <button className="btn-ghost" style={{ marginBottom: 12, fontSize: 11 }} onClick={() => { setImovelSel(null); setImovelDet(null); setEditandoIm(false) }}>← Voltar</button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fa-solid fa-building" style={{ color: '#fff', fontSize: 16 }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{imovelSel.nome}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>{imovelSel.localizacao || ''}</div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 16 }}>
                  <div style={{ textAlign: 'right', fontSize: 11 }}><div style={{ color: 'var(--gray-400)' }}>Valor aquisição</div><div style={{ fontWeight: 700 }}>{formatBRL(Number(imovelSel.valor_aquisicao || 0))}</div></div>
                  <div style={{ textAlign: 'right', fontSize: 11 }}><div style={{ color: 'var(--gray-400)' }}>Valor contábil</div><div style={{ fontWeight: 700, color: 'var(--teal)' }}>{formatBRL(Number(imovelSel.valor_contabil || 0))}</div></div>
                </div>
              </div>

              {/* KPIs imóvel */}
              {imovelDet && (
                <div className="kpis" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 16 }}>
                  <div className="kpi"><div className="kpi-lbl">Aluguel/mês</div><div className="kpi-val" style={{ color: 'var(--green)' }}>{imovelDet.alugado ? formatBRL(Number(imovelDet.valor_aluguel || 0)) : '—'}</div><div className="kpi-delta up">{imovelDet.alugado ? 'alugado' : 'vago'}</div></div>
                  <div className="kpi"><div className="kpi-lbl">IPTU anual</div><div className="kpi-val" style={{ color: imovelDet.iptu_pago ? 'var(--green)' : 'var(--red)' }}>{formatBRL(Number(imovelDet.valor_iptu || 0))}</div><div className="kpi-delta">{imovelDet.iptu_pago ? 'pago' : 'pendente'}</div></div>
                  <div className="kpi"><div className="kpi-lbl">Valor venal</div><div className="kpi-val">{imovelDet.valor_venal ? formatBRL(Number(imovelDet.valor_venal)) : '—'}</div><div className="kpi-delta">referência</div></div>
                  <div className="kpi"><div className="kpi-lbl">Área</div><div className="kpi-val">{imovelDet.area_m2 ? `${Number(imovelDet.area_m2).toLocaleString('pt-BR')} m²` : '—'}</div><div className="kpi-delta">total</div></div>
                </div>
              )}

              {/* Detalhes imóvel */}
              <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Ficha do Imóvel</div>
                  <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => setEditandoIm(!editandoIm)}>
                    {editandoIm ? 'Cancelar' : 'Editar'}
                  </button>
                </div>

                {editandoIm ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                    <div><label style={{ fontSize: 10, color: 'var(--gray-400)' }}>Tipo</label>
                      <select className="form-input" value={formIm.tipo_imovel} onChange={e => setFormIm(p => ({ ...p, tipo_imovel: e.target.value }))}>
                        <option value="comercial">Comercial</option><option value="residencial">Residencial</option>
                        <option value="rural">Rural</option><option value="terreno">Terreno</option><option value="industrial">Industrial</option>
                      </select></div>
                    <div><label style={{ fontSize: 10, color: 'var(--gray-400)' }}>Área m²</label><input className="form-input" type="number" value={formIm.area_m2} onChange={e => setFormIm(p => ({ ...p, area_m2: e.target.value }))} /></div>
                    <div><label style={{ fontSize: 10, color: 'var(--gray-400)' }}>Matrícula</label><input className="form-input" value={formIm.matricula} onChange={e => setFormIm(p => ({ ...p, matricula: e.target.value }))} /></div>
                    <div><label style={{ fontSize: 10, color: 'var(--gray-400)' }}>Endereço</label><input className="form-input" value={formIm.endereco} onChange={e => setFormIm(p => ({ ...p, endereco: e.target.value }))} /></div>
                    <div><label style={{ fontSize: 10, color: 'var(--gray-400)' }}>CEP</label><input className="form-input" value={formIm.cep} onChange={e => setFormIm(p => ({ ...p, cep: e.target.value }))} /></div>
                    <div><label style={{ fontSize: 10, color: 'var(--gray-400)' }}>Cidade</label><input className="form-input" value={formIm.cidade} onChange={e => setFormIm(p => ({ ...p, cidade: e.target.value }))} /></div>
                    <div><label style={{ fontSize: 10, color: 'var(--gray-400)' }}>Estado</label><input className="form-input" value={formIm.estado} onChange={e => setFormIm(p => ({ ...p, estado: e.target.value }))} /></div>
                    <div><label style={{ fontSize: 10, color: 'var(--gray-400)' }}>Valor venal</label><input className="form-input" type="number" value={formIm.valor_venal} onChange={e => setFormIm(p => ({ ...p, valor_venal: e.target.value }))} /></div>
                    <div><label style={{ fontSize: 10, color: 'var(--gray-400)' }}>IPTU anual R$</label><input className="form-input" type="number" value={formIm.valor_iptu} onChange={e => setFormIm(p => ({ ...p, valor_iptu: e.target.value }))} /></div>
                    <div><label style={{ fontSize: 10, color: 'var(--gray-400)' }}>Vencim. IPTU</label><input className="form-input" type="date" value={formIm.iptu_vencimento} onChange={e => setFormIm(p => ({ ...p, iptu_vencimento: e.target.value }))} /></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
                      <input type="checkbox" checked={formIm.iptu_pago} onChange={e => setFormIm(p => ({ ...p, iptu_pago: e.target.checked }))} />
                      <label style={{ fontSize: 12 }}>IPTU pago</label>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
                      <input type="checkbox" checked={formIm.alugado} onChange={e => setFormIm(p => ({ ...p, alugado: e.target.checked }))} />
                      <label style={{ fontSize: 12 }}>Alugado</label>
                    </div>
                    {formIm.alugado && (
                      <>
                        <div><label style={{ fontSize: 10, color: 'var(--gray-400)' }}>Inquilino</label><input className="form-input" value={formIm.inquilino} onChange={e => setFormIm(p => ({ ...p, inquilino: e.target.value }))} /></div>
                        <div><label style={{ fontSize: 10, color: 'var(--gray-400)' }}>Aluguel/mês R$</label><input className="form-input" type="number" value={formIm.valor_aluguel} onChange={e => setFormIm(p => ({ ...p, valor_aluguel: e.target.value }))} /></div>
                        <div><label style={{ fontSize: 10, color: 'var(--gray-400)' }}>Início contrato</label><input className="form-input" type="date" value={formIm.contrato_inicio} onChange={e => setFormIm(p => ({ ...p, contrato_inicio: e.target.value }))} /></div>
                        <div><label style={{ fontSize: 10, color: 'var(--gray-400)' }}>Fim contrato</label><input className="form-input" type="date" value={formIm.contrato_vencimento} onChange={e => setFormIm(p => ({ ...p, contrato_vencimento: e.target.value }))} /></div>
                        <div><label style={{ fontSize: 10, color: 'var(--gray-400)' }}>Administradora</label><input className="form-input" value={formIm.administradora} onChange={e => setFormIm(p => ({ ...p, administradora: e.target.value }))} /></div>
                      </>
                    )}
                    <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8 }}>
                      <button className="btn-action" onClick={() => void salvarImovelDet()}>Salvar</button>
                      <button className="btn-ghost" onClick={() => setEditandoIm(false)}>Cancelar</button>
                    </div>
                  </div>
                ) : imovelDet ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                    {[
                      ['Tipo', TIPO_LABEL[imovelDet.tipo_imovel] || imovelDet.tipo_imovel],
                      ['Área', imovelDet.area_m2 ? `${Number(imovelDet.area_m2).toLocaleString('pt-BR')} m²` : '—'],
                      ['Matrícula', imovelDet.matricula || '—'],
                      ['Endereço', imovelDet.endereco || '—'],
                      ['Cidade', `${imovelDet.cidade || '—'}/${imovelDet.estado || ''}`],
                      ['Valor venal', imovelDet.valor_venal ? formatBRL(Number(imovelDet.valor_venal)) : '—'],
                      ['Inquilino', imovelDet.alugado ? (imovelDet.inquilino || '—') : 'Vago'],
                      ['Contrato vence', imovelDet.contrato_vencimento || '—'],
                    ].map(([k, v]) => (
                      <div key={k}><div style={{ fontSize: 10, color: 'var(--gray-400)' }}>{k}</div><div style={{ fontSize: 12, fontWeight: 600 }}>{v}</div></div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--gray-400)', textAlign: 'center', padding: 16 }}>
                    Nenhuma ficha cadastrada. Clique em Editar para preencher.
                  </div>
                )}
              </div>
            </div>
          ) : (
            imoveis.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--gray-400)', fontSize: 13 }}>Nenhum imóvel. Clique em <strong>+ Novo Ativo</strong> e selecione tipo Imóvel.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                {imoveis.map(im => {
                  const p = depProgress(im)
                  return (
                    <button key={im.id} onClick={() => selecionarImovel(im)} style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 16, textAlign: 'left', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <i className="fa-solid fa-building" style={{ color: '#fff', fontSize: 14 }} />
                        </div>
                        <div><div style={{ fontWeight: 700, fontSize: 13 }}>{im.nome}</div><div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{im.localizacao || '—'}</div></div>
                        <span className={`tag ${STATUS_COLORS[im.status] || 'gray'}`} style={{ marginLeft: 'auto', fontSize: 9 }}>{STATUS_LABEL[im.status]}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11, marginBottom: 8 }}>
                        <div><span style={{ color: 'var(--gray-400)' }}>Aquisição</span><br /><span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 600 }}>{formatBRL(Number(im.valor_aquisicao || 0))}</span></div>
                        <div><span style={{ color: 'var(--gray-400)' }}>Contábil</span><br /><span style={{ color: 'var(--teal)', fontWeight: 700 }}>{formatBRL(Number(im.valor_contabil || 0))}</span></div>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: 'var(--gray-100)' }}>
                        <div style={{ height: 4, borderRadius: 2, width: `${Math.min(p, 100)}%`, background: depColor(p) }} />
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--gray-400)', marginTop: 4 }}>Deprec. {p.toFixed(0)}%</div>
                    </button>
                  )
                })}
              </div>
            )
          )}
        </>
      )}

      {/* ── TODOS ── */}
      {tab === 'todos' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
            <select className="form-input" value={fTipo} onChange={e => setFTipo(e.target.value)}>
              <option value="">Todos os tipos</option>
              {Object.entries(TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select className="form-input" value={fStatus} onChange={e => setFStatus(e.target.value)}>
              <option value="">Todos os status</option>
              <option value="ativo">Ativo</option><option value="em_manutencao">Em manutenção</option>
            </select>
            <input className="form-input" placeholder="Localização" value={fLocal} onChange={e => setFLocal(e.target.value)} />
          </div>
          <AtivoTable ativos={todosF} categorias={categorias} onDetalhes={setDetalhes} onBaixa={setBaixa} onQr={setQr} />
        </>
      )}

      {/* ── BAIXADOS ── */}
      {tab === 'baixados' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 8 }}>
            <select className="form-input" value={fTipo} onChange={e => setFTipo(e.target.value)}>
              <option value="">Todos os tipos</option>
              {Object.entries(TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input className="form-input" placeholder="Localização" value={fLocal} onChange={e => setFLocal(e.target.value)} />
          </div>
          {baixadosF.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--gray-400)', fontSize: 13 }}>Nenhum ativo baixado/alienado/sucateado.</div>
          ) : (
            <AtivoTable ativos={baixadosF} categorias={categorias} onDetalhes={setDetalhes} onBaixa={() => {}} onQr={setQr} />
          )}
        </>
      )}

      <NovoAtivoModal open={openNovo} onClose={() => setOpenNovo(false)} onDone={(tipo) => { void carregar(); if (tipo === 'veiculo_leve' || tipo === 'veiculo_pesado') setTab('frota'); else if (tipo === 'maquina' || tipo === 'equipamento') setTab('maquinas'); else if (tipo === 'imovel') setTab('imoveis'); }} empresaId={empresaId} categorias={categorias} />
      {detalhes && <DetalhesAtivoModal open={Boolean(detalhes)} onClose={() => setDetalhes(null)} ativo={{ id: detalhes.id, nome: detalhes.nome, categoria: categoriaNome(detalhes.categoria_id), foto_url: detalhes.foto_url, localizacao: detalhes.localizacao, responsavel_nome: detalhes.responsavel_nome, valor_contabil: Number(detalhes.valor_contabil || 0) }} />}
      {baixa && <BaixaAtivoModal open={Boolean(baixa)} onClose={() => setBaixa(null)} onDone={carregar} ativo={{ id: baixa.id, nome: baixa.nome, valor_contabil: Number(baixa.valor_contabil || 0), empresa_id: baixa.empresa_id }} />}
      {qr && <QRCodeAtivo open={Boolean(qr)} onClose={() => setQr(null)} qrCode={qr.qr_code} nome={qr.nome} />}
    </>
  )
}

// ── Sub-components ──

function ManutForm({ form, setForm, onSave, onCancel, showHoras }: {
  form: typeof blankMn
  setForm: React.Dispatch<React.SetStateAction<typeof blankMn>>
  onSave: () => void; onCancel: () => void; showHoras: boolean
}) {
  return (
    <div style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-100)', borderRadius: 10, padding: 16, marginBottom: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
      <div style={{ gridColumn: '1/-1', fontWeight: 700, fontSize: 12 }}>Nova manutenção</div>
      <select className="form-input" value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}>
        <option value="preventiva">Preventiva</option><option value="corretiva">Corretiva</option>
        <option value="calibracao">Calibração</option><option value="vistoria">Vistoria</option>
        <option value="seguro">Seguro</option><option value="ipva">IPVA</option><option value="outros">Outros</option>
      </select>
      <input type="date" className="form-input" value={form.data} onChange={e => setForm(p => ({ ...p, data: e.target.value }))} />
      <input className="form-input" placeholder="Descrição" value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} />
      <input className="form-input" placeholder="Valor R$" type="number" value={form.valor} onChange={e => setForm(p => ({ ...p, valor: e.target.value }))} />
      <input className="form-input" placeholder="Oficina" value={form.oficina} onChange={e => setForm(p => ({ ...p, oficina: e.target.value }))} />
      {showHoras && <input className="form-input" placeholder="KM ou horas" type="number" value={form.km_ou_horas} onChange={e => setForm(p => ({ ...p, km_ou_horas: e.target.value }))} />}
      <input type="date" className="form-input" value={form.proxima_data} onChange={e => setForm(p => ({ ...p, proxima_data: e.target.value }))} />
      <div style={{ display: 'flex', gap: 6, gridColumn: '1/-1' }}>
        <button className="btn-action" style={{ fontSize: 11 }} onClick={onSave}>Salvar</button>
        <button className="btn-ghost" style={{ fontSize: 11 }} onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  )
}

function ManutencaoTable({ manutencoes }: { manutencoes: ManutencaoP[] }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 10, overflow: 'hidden' }}>
      <div className="expenses-table"><table>
        <thead><tr><th>Tipo</th><th>Descrição</th><th>Data</th><th style={{ textAlign: 'right' }}>Valor</th><th>Oficina</th><th>Próxima</th></tr></thead>
        <tbody>
          {manutencoes.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '24px 0' }}>Nenhuma manutenção.</td></tr>}
          {manutencoes.map(m => (
            <tr key={m.id}>
              <td><span className="tag gray" style={{ fontSize: 9 }}>{m.tipo}</span></td>
              <td style={{ fontSize: 12 }}>{m.descricao || '—'}</td>
              <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 11 }}>{m.data}</td>
              <td style={{ textAlign: 'right', fontFamily: "'DM Mono',monospace" }}>{formatBRL(Number(m.valor || 0))}</td>
              <td style={{ fontSize: 11 }}>{m.oficina || '—'}</td>
              <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--gray-400)' }}>{m.proxima_data || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  )
}

function AtivoTable({ ativos, categorias, onDetalhes, onBaixa, onQr }: {
  ativos: Ativo[]
  categorias: { id: string; nome: string }[]
  onDetalhes: (a: Ativo) => void; onBaixa: (a: Ativo) => void; onQr: (a: Ativo) => void
}) {
  function depProgress(a: Ativo) {
    const total = Number(a.valor_aquisicao || 0); if (!total) return 0
    return (Number(a.depreciacao_acumulada || 0) / total) * 100
  }
  return (
    <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, overflow: 'hidden' }}>
      <div className="expenses-table"><table>
        <thead><tr>
          <th>Tipo</th><th>Código</th><th>Nome / Deprec.</th><th>Categoria</th>
          <th style={{ textAlign: 'right' }}>Aquisição</th><th style={{ textAlign: 'right' }}>Contábil</th>
          <th style={{ textAlign: 'center' }}>Status</th><th style={{ textAlign: 'center' }}>Ações</th>
        </tr></thead>
        <tbody>
          {ativos.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '32px 0' }}>Nenhum ativo.</td></tr>}
          {ativos.map(a => {
            const p = depProgress(a)
            return (
              <tr key={a.id}>
                <td><span className="tag gray" style={{ fontSize: 9 }}>{TIPO_LABEL[a.tipo_ativo] || a.tipo_ativo}</span></td>
                <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 11 }}>{a.codigo_interno || '—'}</td>
                <td>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>{a.nome}</div>
                  {a.placa && <div style={{ fontSize: 10, color: 'var(--gray-400)' }}>{a.placa}</div>}
                  <div style={{ marginTop: 4, height: 4, borderRadius: 2, background: 'var(--gray-100)', width: 80 }}>
                    <div style={{ height: 4, borderRadius: 2, width: `${Math.min(p, 100)}%`, background: depColor(p) }} />
                  </div>
                </td>
                <td style={{ fontSize: 12 }}>{categorias.find(c => c.id === a.categoria_id)?.nome || '—'}</td>
                <td style={{ textAlign: 'right', fontFamily: "'DM Mono',monospace" }}>{formatBRL(Number(a.valor_aquisicao || 0))}</td>
                <td style={{ textAlign: 'right', fontFamily: "'DM Mono',monospace", color: 'var(--teal)', fontWeight: 700 }}>{formatBRL(Number(a.valor_contabil || 0))}</td>
                <td style={{ textAlign: 'center' }}><span className={`tag ${STATUS_COLORS[a.status] || 'gray'}`}>{STATUS_LABEL[a.status] || a.status}</span></td>
                <td style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                    <button className="btn-ghost" style={{ padding: '3px 8px', fontSize: 10 }} onClick={() => onDetalhes(a)}>Ver</button>
                    {!ATIVOS_BAIXADOS.includes(a.status) && <button className="btn-ghost" style={{ padding: '3px 8px', fontSize: 10 }} onClick={() => onBaixa(a)}>Baixar</button>}
                    <button className="btn-ghost" style={{ padding: '3px 8px', fontSize: 10 }} onClick={() => onQr(a)}>QR</button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table></div>
    </div>
  )
}
