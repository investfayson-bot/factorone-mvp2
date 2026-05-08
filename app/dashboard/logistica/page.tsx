'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

type Rota = {
  id: string
  codigo: string | null
  origem: string
  destino: string
  distancia_km: number | null
  tempo_estimado: number | null
  motorista: string | null
  carga: string | null
  peso_kg: number | null
  valor_frete: number | null
  cliente_id: string | null
  status: string
  data_saida: string | null
  data_chegada: string | null
  data_entrega: string | null
  lat_atual: number | null
  lng_atual: number | null
  notas: string | null
  created_at: string
}

type Pneu = {
  id: string
  veiculo_id: string
  posicao: string
  marca: string | null
  modelo: string | null
  dot: string | null
  km_instalado: number
  km_rodado: number
  km_limite: number
  data_instalacao: string | null
  status: string
  veiculo_nome?: string
}

type Checklist = {
  id: string
  veiculo_id: string
  rota_id: string | null
  motorista: string | null
  data: string
  itens: Record<string, boolean>
  status: string
  veiculo_nome?: string
}

type Ativo = { id: string; nome: string; tipo_ativo: string }

type Manutencao = {
  id: string
  ativo_id: string
  tipo: string
  descricao: string | null
  data: string
  km_ou_horas: number | null
  valor: number
  oficina: string | null
  proxima_data: string | null
  proximos_km_horas: number | null
  concluida: boolean
  veiculo_nome?: string
}

const STATUS_COLOR: Record<string, string> = {
  agendada: 'var(--gray-400)', em_transito: 'var(--teal)', entregue: 'var(--green)',
  cancelada: 'var(--red)', problema: 'var(--gold)',
}
const STATUS_BG: Record<string, string> = {
  agendada: '#f1f5f9', em_transito: '#e0f2fe', entregue: '#dcfce7',
  cancelada: '#fee2e2', problema: '#fef3c7',
}
const STATUS_LABEL: Record<string, string> = {
  agendada: 'Agendada', em_transito: 'Em Trânsito', entregue: 'Entregue',
  cancelada: 'Cancelada', problema: 'Problema',
}

const PNEU_STATUS_COLOR: Record<string, string> = {
  ativo: 'var(--green)', desgastado: 'var(--gold)', recapado: 'var(--teal)', descartado: 'var(--red)',
}

const CHECKLIST_ITENS = [
  'Pneus calibrados', 'Óleo verificado', 'Água verificada', 'Freios funcionando',
  'Luzes funcionando', 'Extintor válido', 'Documentos em dia', 'Cinto de segurança',
  'Tacógrafo funcionando', 'Carga amarrada',
]

function fmt(v: number | null) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtNum(v: number | null, dec = 1) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

export default function LogisticaPage() {
  const [tab, setTab] = useState<'dashboard' | 'rotas' | 'pneus' | 'checklist' | 'manutencao'>('dashboard')
  const [rotas, setRotas] = useState<Rota[]>([])
  const [pneus, setPneus] = useState<Pneu[]>([])
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [ativos, setAtivos] = useState<Ativo[]>([])
  const [empresaId, setEmpresaId] = useState('')
  const [loading, setLoading] = useState(true)

  // modals
  const [manutencoes, setManutencoes] = useState<Manutencao[]>([])
  const [showManut, setShowManut] = useState(false)
  const [manuForm, setManuForm] = useState({ ativo_id: '', tipo: 'preventiva', descricao: '', data: new Date().toISOString().slice(0, 10), km_ou_horas: '', valor: '', oficina: '', proxima_data: '', proximos_km_horas: '' })

  const [showRota, setShowRota] = useState(false)
  const [showPneu, setShowPneu] = useState(false)
  const [showChecklist, setShowChecklist] = useState(false)
  const [rotaDetalhe, setRotaDetalhe] = useState<Rota | null>(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrResult, setOcrResult] = useState<Record<string, string> | null>(null)
  const romaneioRef = useRef<HTMLInputElement>(null)

  // rota form
  const [rotaForm, setRotaForm] = useState({
    codigo: '', origem: '', destino: '', distancia_km: '', tempo_estimado: '',
    motorista: '', carga: '', peso_kg: '', valor_frete: '', veiculo_id: '',
    status: 'agendada', data_saida: '', data_chegada: '', notas: '',
  })

  // pneu form
  const [pneuForm, setPneuForm] = useState({
    veiculo_id: '', posicao: '', marca: '', modelo: '', dot: '',
    km_instalado: '0', km_rodado: '0', km_limite: '70000',
    data_instalacao: '', status: 'ativo',
  })

  // checklist form
  const [ckForm, setCkForm] = useState({
    veiculo_id: '', rota_id: '', motorista: '', data: new Date().toISOString().slice(0, 10),
    itens: {} as Record<string, boolean>,
  })

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: ur } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
      const eid = ur?.empresa_id ?? user.id
      setEmpresaId(eid)

      const [rotasR, pneusR, cksR, ativosR, manutR] = await Promise.all([
        supabase.from('logistica_rotas').select('*').eq('empresa_id', eid).order('created_at', { ascending: false }),
        supabase.from('logistica_pneus').select('*, ativos(nome)').eq('empresa_id', eid),
        supabase.from('logistica_checklist').select('*, ativos(nome)').eq('empresa_id', eid).order('data', { ascending: false }),
        supabase.from('ativos').select('id, nome, tipo_ativo').eq('empresa_id', eid).in('tipo_ativo', ['veiculo_leve', 'veiculo_pesado']),
        supabase.from('patrimonio_manutencoes').select('*, ativos(nome, tipo_ativo)').eq('empresa_id', eid).in('ativos.tipo_ativo', ['veiculo_leve', 'veiculo_pesado']).order('data', { ascending: false }),
      ])

      setRotas((rotasR.data ?? []) as Rota[])
      setPneus(((pneusR.data ?? []) as unknown as Array<Pneu & { ativos: { nome: string } | null }>).map(p => ({
        ...p, veiculo_nome: p.ativos?.nome ?? '—',
      })))
      setChecklists(((cksR.data ?? []) as unknown as Array<Checklist & { ativos: { nome: string } | null }>).map(c => ({
        ...c, veiculo_nome: c.ativos?.nome ?? '—',
      })))
      setAtivos((ativosR.data ?? []) as Ativo[])
      setManutencoes(((manutR.data ?? []) as unknown as Array<Manutencao & { ativos: { nome: string; tipo_ativo: string } | null }>)
        .filter(m => m.ativos?.tipo_ativo === 'veiculo_leve' || m.ativos?.tipo_ativo === 'veiculo_pesado')
        .map(m => ({ ...m, veiculo_nome: m.ativos?.nome ?? '—' })))
    } finally {
      setLoading(false)
    }
  }

  // KPIs
  const totalFretes = rotas.length
  const receitaFrete = rotas.reduce((s, r) => s + (r.valor_frete ?? 0), 0)
  const rotasAtivas = rotas.filter(r => r.status === 'em_transito').length
  const entregues = rotas.filter(r => r.status === 'entregue').length
  const pneusAlerta = pneus.filter(p => p.km_rodado >= p.km_limite * 0.9).length
  const kmTotal = rotas.reduce((s, r) => s + (r.distancia_km ?? 0), 0)

  async function salvarRota() {
    if (!rotaForm.origem || !rotaForm.destino) return
    const payload = {
      empresa_id: empresaId,
      codigo: rotaForm.codigo || null,
      origem: rotaForm.origem,
      destino: rotaForm.destino,
      distancia_km: rotaForm.distancia_km ? parseFloat(rotaForm.distancia_km) : null,
      tempo_estimado: rotaForm.tempo_estimado ? parseInt(rotaForm.tempo_estimado) : null,
      motorista: rotaForm.motorista || null,
      carga: rotaForm.carga || null,
      peso_kg: rotaForm.peso_kg ? parseFloat(rotaForm.peso_kg) : null,
      valor_frete: rotaForm.valor_frete ? parseFloat(rotaForm.valor_frete.replace(/\./g, '').replace(',', '.')) : null,
      veiculo_id: rotaForm.veiculo_id || null,
      status: rotaForm.status,
      data_saida: rotaForm.data_saida || null,
      data_chegada: rotaForm.data_chegada || null,
      notas: rotaForm.notas || null,
    }
    if (rotaDetalhe) {
      await supabase.from('logistica_rotas').update(payload).eq('id', rotaDetalhe.id)
    } else {
      await supabase.from('logistica_rotas').insert(payload)
    }
    setShowRota(false)
    setRotaDetalhe(null)
    setRotaForm({ codigo: '', origem: '', destino: '', distancia_km: '', tempo_estimado: '', motorista: '', carga: '', peso_kg: '', valor_frete: '', veiculo_id: '', status: 'agendada', data_saida: '', data_chegada: '', notas: '' })
    await carregar()
  }

  async function atualizarStatus(id: string, status: string) {
    const update: Record<string, string> = { status }
    if (status === 'entregue') update.data_entrega = new Date().toISOString()
    await supabase.from('logistica_rotas').update(update).eq('id', id)
    await carregar()
  }

  async function salvarPneu() {
    if (!pneuForm.veiculo_id || !pneuForm.posicao) return
    await supabase.from('logistica_pneus').insert({
      empresa_id: empresaId,
      veiculo_id: pneuForm.veiculo_id,
      posicao: pneuForm.posicao,
      marca: pneuForm.marca || null,
      modelo: pneuForm.modelo || null,
      dot: pneuForm.dot || null,
      km_instalado: parseFloat(pneuForm.km_instalado) || 0,
      km_rodado: parseFloat(pneuForm.km_rodado) || 0,
      km_limite: parseFloat(pneuForm.km_limite) || 70000,
      data_instalacao: pneuForm.data_instalacao || null,
      status: pneuForm.status,
    })
    setShowPneu(false)
    setPneuForm({ veiculo_id: '', posicao: '', marca: '', modelo: '', dot: '', km_instalado: '0', km_rodado: '0', km_limite: '70000', data_instalacao: '', status: 'ativo' })
    await carregar()
  }

  async function salvarChecklist() {
    if (!ckForm.veiculo_id || !ckForm.data) return
    const aprovado = Object.values(ckForm.itens).every(v => v)
    await supabase.from('logistica_checklist').insert({
      empresa_id: empresaId,
      veiculo_id: ckForm.veiculo_id,
      rota_id: ckForm.rota_id || null,
      motorista: ckForm.motorista || null,
      data: ckForm.data,
      itens: ckForm.itens,
      status: aprovado ? 'aprovado' : 'reprovado',
    })
    setShowChecklist(false)
    setCkForm({ veiculo_id: '', rota_id: '', motorista: '', data: new Date().toISOString().slice(0, 10), itens: {} })
    await carregar()
  }

  async function ocrRomaneio(file: File) {
    setOcrLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/logistica/ocr-romaneio', { method: 'POST', body: fd })
      if (res.ok) {
        const data = await res.json()
        setOcrResult(data)
        setRotaForm(f => ({
          ...f,
          origem: data.origem ?? f.origem,
          destino: data.destino ?? f.destino,
          carga: data.carga ?? f.carga,
          peso_kg: data.peso_kg ?? f.peso_kg,
          valor_frete: data.valor_frete ?? f.valor_frete,
          motorista: data.motorista ?? f.motorista,
        }))
      }
    } finally {
      setOcrLoading(false)
    }
  }

  async function salvarManutencao() {
    if (!manuForm.ativo_id || !manuForm.data) return
    await supabase.from('patrimonio_manutencoes').insert({
      empresa_id: empresaId,
      ativo_id: manuForm.ativo_id,
      tipo: manuForm.tipo,
      descricao: manuForm.descricao || null,
      data: manuForm.data,
      km_ou_horas: manuForm.km_ou_horas ? parseFloat(manuForm.km_ou_horas) : null,
      valor: parseFloat(manuForm.valor.replace(/\./g, '').replace(',', '.')) || 0,
      oficina: manuForm.oficina || null,
      proxima_data: manuForm.proxima_data || null,
      proximos_km_horas: manuForm.proximos_km_horas ? parseFloat(manuForm.proximos_km_horas) : null,
      concluida: true,
    })
    setShowManut(false)
    setManuForm({ ativo_id: '', tipo: 'preventiva', descricao: '', data: new Date().toISOString().slice(0, 10), km_ou_horas: '', valor: '', oficina: '', proxima_data: '', proximos_km_horas: '' })
    await carregar()
  }

  function abrirEditarRota(r: Rota) {
    setRotaDetalhe(r)
    setRotaForm({
      codigo: r.codigo ?? '',
      origem: r.origem,
      destino: r.destino,
      distancia_km: r.distancia_km?.toString() ?? '',
      tempo_estimado: r.tempo_estimado?.toString() ?? '',
      motorista: r.motorista ?? '',
      carga: r.carga ?? '',
      peso_kg: r.peso_kg?.toString() ?? '',
      valor_frete: r.valor_frete?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) ?? '',
      veiculo_id: '',
      status: r.status,
      data_saida: r.data_saida?.slice(0, 16) ?? '',
      data_chegada: r.data_chegada?.slice(0, 16) ?? '',
      notas: r.notas ?? '',
    })
    setShowRota(true)
  }

  const TABS = [
    { key: 'dashboard', icon: 'fa-gauge', label: 'Dashboard' },
    { key: 'rotas', icon: 'fa-route', label: 'Rotas' },
    { key: 'pneus', icon: 'fa-circle-dot', label: 'Pneus' },
    { key: 'manutencao', icon: 'fa-wrench', label: 'Manutenção' },
    { key: 'checklist', icon: 'fa-clipboard-check', label: 'Checklist' },
  ]

  const custoManutMes = manutencoes.filter(m => m.data.startsWith(new Date().toISOString().slice(0, 7))).reduce((s, m) => s + Number(m.valor), 0)
  const proximasManut = manutencoes.filter(m => m.proxima_data && m.proxima_data >= new Date().toISOString().slice(0, 10) && m.proxima_data <= new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10))

  return (
    <div className="page-hdr" style={{ display: 'block', padding: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 0' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Logística</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" onClick={() => { setShowChecklist(true); setCkForm({ veiculo_id: '', rota_id: '', motorista: '', data: new Date().toISOString().slice(0, 10), itens: {} }) }}>
            <i className="fa-solid fa-clipboard-check" /> Checklist
          </button>
          <button className="btn-ghost" onClick={() => setShowPneu(true)}>
            <i className="fa-solid fa-circle-dot" /> Pneu
          </button>
          <button className="btn-ghost" onClick={() => setShowManut(true)}>
            <i className="fa-solid fa-wrench" /> Manutenção
          </button>
          <button className="btn-action" onClick={() => { setRotaDetalhe(null); setOcrResult(null); setShowRota(true) }}>
            <i className="fa-solid fa-plus" /> Nova Rota
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpis" style={{ padding: '16px 24px 0' }}>
        <div className="kpi">
          <div className="kpi-label">Receita Fretes</div>
          <div className="kpi-val">{fmt(receitaFrete)}</div>
          <div className="kpi-sub">{totalFretes} rotas total</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Em Trânsito</div>
          <div className="kpi-val" style={{ color: 'var(--teal)' }}>{rotasAtivas}</div>
          <div className="kpi-sub">{entregues} entregues</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Km Rodados</div>
          <div className="kpi-val">{fmtNum(kmTotal, 0)} km</div>
          <div className="kpi-sub">todas as rotas</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Pneus Alerta</div>
          <div className="kpi-val" style={{ color: pneusAlerta > 0 ? 'var(--red)' : 'var(--green)' }}>{pneusAlerta}</div>
          <div className="kpi-sub">≥90% do limite</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Manutenção/mês</div>
          <div className="kpi-val" style={{ color: 'var(--gold)' }}>{fmt(custoManutMes)}</div>
          <div className="kpi-sub">{proximasManut.length} agendadas 30d</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #e2e8f0', margin: '16px 24px 0', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as typeof tab)} style={{
            padding: '8px 20px', border: 'none', background: 'none', cursor: 'pointer',
            borderBottom: tab === t.key ? '2px solid var(--teal)' : '2px solid transparent',
            color: tab === t.key ? 'var(--teal)' : 'var(--gray-400)', fontWeight: tab === t.key ? 600 : 400,
            fontSize: 13, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <i className={`fa-solid ${t.icon}`} style={{ fontSize: 11 }} /> {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '20px 24px' }}>
        {loading && <div style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 40 }}>Carregando...</div>}

        {/* ── DASHBOARD ── */}
        {!loading && tab === 'dashboard' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Rotas por status */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Status das Rotas</div>
              {(['agendada', 'em_transito', 'entregue', 'problema', 'cancelada'] as const).map(s => {
                const count = rotas.filter(r => r.status === s).length
                const pct = totalFretes ? Math.round(count / totalFretes * 100) : 0
                return (
                  <div key={s} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[s], display: 'inline-block' }} />
                        {STATUS_LABEL[s]}
                      </span>
                      <span style={{ fontWeight: 600 }}>{count}</span>
                    </div>
                    <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: STATUS_COLOR[s], borderRadius: 3, transition: 'width .4s' }} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Receita por rota */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Top Rotas por Receita</div>
              {rotas.sort((a, b) => (b.valor_frete ?? 0) - (a.valor_frete ?? 0)).slice(0, 5).map(r => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{r.origem} → {r.destino}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{r.motorista ?? 'Motorista não definido'}</div>
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--teal)' }}>{fmt(r.valor_frete)}</div>
                </div>
              ))}
              {rotas.length === 0 && <div style={{ color: 'var(--gray-400)', fontSize: 13 }}>Nenhuma rota cadastrada</div>}
            </div>

            {/* Pneus críticos */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Rodízio de Pneus</div>
              {pneus.filter(p => p.status === 'ativo').slice(0, 6).map(p => {
                const pct = Math.min(100, Math.round(p.km_rodado / p.km_limite * 100))
                const alerta = pct >= 90
                return (
                  <div key={p.id} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                      <span>{p.veiculo_nome} — Pos. {p.posicao}</span>
                      <span style={{ fontWeight: 600, color: alerta ? 'var(--red)' : 'inherit' }}>{pct}%</span>
                    </div>
                    <div style={{ height: 5, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: alerta ? 'var(--red)' : 'var(--green)', borderRadius: 3 }} />
                    </div>
                  </div>
                )
              })}
              {pneus.length === 0 && <div style={{ color: 'var(--gray-400)', fontSize: 13 }}>Nenhum pneu cadastrado</div>}
            </div>

            {/* Checklists recentes */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Checklists Recentes</div>
              {checklists.slice(0, 5).map(c => {
                const total = CHECKLIST_ITENS.length
                const ok = Object.values(c.itens).filter(Boolean).length
                return (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{c.veiculo_nome}</div>
                      <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{c.data} — {c.motorista}</div>
                    </div>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: c.status === 'aprovado' ? '#dcfce7' : '#fee2e2', color: c.status === 'aprovado' ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                      {ok}/{total}
                    </span>
                  </div>
                )
              })}
              {checklists.length === 0 && <div style={{ color: 'var(--gray-400)', fontSize: 13 }}>Nenhum checklist realizado</div>}
            </div>
          </div>
        )}

        {/* ── ROTAS ── */}
        {!loading && tab === 'rotas' && (
          <div>
            {rotas.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--gray-400)' }}>
                <i className="fa-solid fa-route" style={{ fontSize: 40, marginBottom: 12, display: 'block' }} />
                Nenhuma rota cadastrada
              </div>
            ) : (
              <table className="expenses-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Código</th><th>Origem → Destino</th><th>Motorista</th><th>Carga</th>
                    <th>Valor Frete</th><th>Status</th><th>Saída</th><th>GPS</th><th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rotas.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{r.codigo ?? '—'}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{r.origem} → {r.destino}</div>
                        {r.distancia_km && <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{fmtNum(r.distancia_km, 0)} km</div>}
                      </td>
                      <td>{r.motorista ?? '—'}</td>
                      <td>
                        <div>{r.carga ?? '—'}</div>
                        {r.peso_kg && <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{fmtNum(r.peso_kg, 0)} kg</div>}
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--teal)', fontFamily: 'DM Mono, monospace' }}>{fmt(r.valor_frete)}</td>
                      <td>
                        <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 12, background: STATUS_BG[r.status], color: STATUS_COLOR[r.status], fontWeight: 600 }}>
                          {STATUS_LABEL[r.status]}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>{r.data_saida ? new Date(r.data_saida).toLocaleDateString('pt-BR') : '—'}</td>
                      <td>
                        {r.lat_atual && r.lng_atual ? (
                          <a href={`https://www.google.com/maps?q=${r.lat_atual},${r.lng_atual}`} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 11, color: 'var(--teal)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <i className="fa-solid fa-location-dot" /> Ver
                          </a>
                        ) : <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>—</span>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 5 }}>
                          {r.status === 'agendada' && (
                            <button className="btn-action" style={{ fontSize: 10, padding: '3px 10px' }} onClick={() => atualizarStatus(r.id, 'em_transito')}>
                              <i className="fa-solid fa-play" style={{ marginRight: 4 }} />Iniciar
                            </button>
                          )}
                          {r.status === 'em_transito' && (
                            <button className="btn-action" style={{ fontSize: 10, padding: '3px 10px', background: 'var(--green)', border: 'none' }} onClick={() => atualizarStatus(r.id, 'entregue')}>
                              <i className="fa-solid fa-check" style={{ marginRight: 4 }} />Entregar
                            </button>
                          )}
                          <button className="btn-ghost" style={{ fontSize: 10, padding: '3px 8px' }} onClick={() => abrirEditarRota(r)}>
                            <i className="fa-solid fa-pen" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── PNEUS ── */}
        {!loading && tab === 'pneus' && (
          <div>
            <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--gray-400)' }}>
              <i className="fa-solid fa-circle-info" style={{ marginRight: 6 }} />
              Monitore o km rodado de cada pneu por posição. Troque quando atingir o limite.
            </div>
            {pneus.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--gray-400)' }}>
                <i className="fa-solid fa-circle-dot" style={{ fontSize: 40, marginBottom: 12, display: 'block' }} />
                Nenhum pneu cadastrado
              </div>
            ) : (
              <table className="expenses-table" style={{ width: '100%' }}>
                <thead>
                  <tr><th>Veículo</th><th>Posição</th><th>Marca/Modelo</th><th>DOT</th><th>Km Instalado</th><th>Km Rodado</th><th>Limite</th><th>% Uso</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {pneus.map(p => {
                    const pct = Math.min(100, Math.round(p.km_rodado / p.km_limite * 100))
                    const alerta = pct >= 90
                    return (
                      <tr key={p.id} style={{ background: alerta ? '#fff5f5' : undefined }}>
                        <td style={{ fontWeight: 600 }}>{p.veiculo_nome}</td>
                        <td><span style={{ fontFamily: 'DM Mono, monospace', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>{p.posicao}</span></td>
                        <td>{p.marca} {p.modelo}</td>
                        <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{p.dot ?? '—'}</td>
                        <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{fmtNum(p.km_instalado, 0)}</td>
                        <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 600 }}>{fmtNum(p.km_rodado, 0)}</td>
                        <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{fmtNum(p.km_limite, 0)}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 60, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: alerta ? 'var(--red)' : 'var(--green)', borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 600, color: alerta ? 'var(--red)' : 'inherit' }}>{pct}%</span>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 12, background: alerta ? '#fee2e2' : '#dcfce7', color: alerta ? 'var(--red)' : PNEU_STATUS_COLOR[p.status], fontWeight: 600 }}>
                            {alerta ? 'Trocar' : p.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── CHECKLIST ── */}
        {/* ── MANUTENÇÃO ── */}
        {!loading && tab === 'manutencao' && (
          <div>
            {proximasManut.length > 0 && (
              <div style={{ background: '#fffbeb', border: '1px solid rgba(184,146,42,.3)', borderRadius: 10, padding: '10px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ color: 'var(--gold)' }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{proximasManut.length} manutenção{proximasManut.length > 1 ? 'ões' : ''} agendada{proximasManut.length > 1 ? 's' : ''} nos próximos 30 dias</span>
                <span style={{ fontSize: 12, color: 'var(--gray-400)', marginLeft: 4 }}>
                  {proximasManut.map(m => m.veiculo_nome).join(', ')}
                </span>
              </div>
            )}
            {manutencoes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--gray-400)' }}>
                <i className="fa-solid fa-wrench" style={{ fontSize: 40, marginBottom: 12, display: 'block' }} />
                Nenhuma manutenção registrada
              </div>
            ) : (
              <table className="expenses-table" style={{ width: '100%' }}>
                <thead>
                  <tr><th>Data</th><th>Veículo</th><th>Tipo</th><th>Descrição</th><th>Km/Horas</th><th>Oficina</th><th>Custo</th><th>Próxima</th></tr>
                </thead>
                <tbody>
                  {manutencoes.map(m => (
                    <tr key={m.id}>
                      <td style={{ fontSize: 12 }}>{new Date(m.data + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                      <td style={{ fontWeight: 600 }}>{m.veiculo_nome}</td>
                      <td>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: m.tipo === 'preventiva' ? '#dcfce7' : m.tipo === 'corretiva' ? '#fee2e2' : '#e0f2fe', color: m.tipo === 'preventiva' ? 'var(--green)' : m.tipo === 'corretiva' ? 'var(--red)' : 'var(--teal)', fontWeight: 600 }}>
                          {m.tipo}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>{m.descricao ?? '—'}</td>
                      <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{m.km_ou_horas ? fmtNum(m.km_ou_horas, 0) : '—'}</td>
                      <td style={{ fontSize: 12 }}>{m.oficina ?? '—'}</td>
                      <td style={{ fontWeight: 700, color: 'var(--red)', fontFamily: 'DM Mono, monospace' }}>{fmt(m.valor)}</td>
                      <td style={{ fontSize: 12, color: m.proxima_data && m.proxima_data <= new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) ? 'var(--red)' : 'inherit' }}>
                        {m.proxima_data ? new Date(m.proxima_data + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {!loading && tab === 'checklist' && (
          <div>
            {checklists.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--gray-400)' }}>
                <i className="fa-solid fa-clipboard-check" style={{ fontSize: 40, marginBottom: 12, display: 'block' }} />
                Nenhum checklist realizado
              </div>
            ) : (
              <table className="expenses-table" style={{ width: '100%' }}>
                <thead>
                  <tr><th>Data</th><th>Veículo</th><th>Motorista</th><th>Itens OK</th><th>Status</th><th>Detalhes</th></tr>
                </thead>
                <tbody>
                  {checklists.map(c => {
                    const okCount = Object.values(c.itens).filter(Boolean).length
                    const total = Object.keys(c.itens).length || CHECKLIST_ITENS.length
                    return (
                      <tr key={c.id}>
                        <td style={{ fontSize: 12 }}>{new Date(c.data).toLocaleDateString('pt-BR')}</td>
                        <td style={{ fontWeight: 600 }}>{c.veiculo_nome}</td>
                        <td>{c.motorista ?? '—'}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 60, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${total ? Math.round(okCount / total * 100) : 0}%`, background: 'var(--green)', borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: 12 }}>{okCount}/{total}</span>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 12, background: c.status === 'aprovado' ? '#dcfce7' : '#fee2e2', color: c.status === 'aprovado' ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                            {c.status === 'aprovado' ? 'Aprovado' : 'Reprovado'}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>
                            {Object.entries(c.itens).filter(([, v]) => !v).map(([k]) => k).join(', ') || '—'}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ── MODAL NOVA ROTA ── */}
      {showRota && (
        <div className="modal-bg" onClick={() => setShowRota(false)}>
          <div className="modal-box" style={{ maxWidth: 640, width: '95%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              {rotaDetalhe ? 'Editar Rota' : 'Nova Rota'}
              <button className="modal-close" onClick={() => { setShowRota(false); setRotaDetalhe(null); setOcrResult(null) }}>×</button>
            </div>

            {/* OCR Romaneio */}
            {!rotaDetalhe && (
              <div
                onClick={() => romaneioRef.current?.click()}
                style={{ border: '2px dashed var(--teal)', borderRadius: 10, padding: '14px 20px', marginBottom: 20, cursor: 'pointer', background: ocrResult ? '#e0fdf4' : '#f0fdfa', display: 'flex', alignItems: 'center', gap: 12 }}
              >
                <i className="fa-solid fa-file-image" style={{ fontSize: 24, color: 'var(--teal)' }} />
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--teal)', fontSize: 13 }}>
                    {ocrLoading ? 'Lendo romaneio com IA...' : ocrResult ? 'Romaneio lido! Campos preenchidos.' : 'OCR Romaneio — clique para enviar imagem'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>JPG, PNG ou PDF — FactorOne IA extrai origem, destino, carga e valor</div>
                </div>
                {ocrLoading && <i className="fa-solid fa-spinner fa-spin" style={{ color: 'var(--teal)', marginLeft: 'auto' }} />}
                {ocrResult && <i className="fa-solid fa-circle-check" style={{ color: 'var(--green)', marginLeft: 'auto', fontSize: 20 }} />}
              </div>
            )}
            <input ref={romaneioRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) ocrRomaneio(e.target.files[0]) }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Código</label>
                <input className="form-input" value={rotaForm.codigo} onChange={e => setRotaForm(f => ({ ...f, codigo: e.target.value }))} placeholder="ROT-001" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Veículo</label>
                <select className="form-input" value={rotaForm.veiculo_id} onChange={e => setRotaForm(f => ({ ...f, veiculo_id: e.target.value }))}>
                  <option value="">Selecionar veículo</option>
                  {ativos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Origem *</label>
                <input className="form-input" value={rotaForm.origem} onChange={e => setRotaForm(f => ({ ...f, origem: e.target.value }))} placeholder="Cidade, Estado" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Destino *</label>
                <input className="form-input" value={rotaForm.destino} onChange={e => setRotaForm(f => ({ ...f, destino: e.target.value }))} placeholder="Cidade, Estado" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Distância (km)</label>
                <input className="form-input" type="number" value={rotaForm.distancia_km} onChange={e => setRotaForm(f => ({ ...f, distancia_km: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Tempo Est. (min)</label>
                <input className="form-input" type="number" value={rotaForm.tempo_estimado} onChange={e => setRotaForm(f => ({ ...f, tempo_estimado: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Motorista</label>
                <input className="form-input" value={rotaForm.motorista} onChange={e => setRotaForm(f => ({ ...f, motorista: e.target.value }))} placeholder="Nome do motorista" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Status</label>
                <select className="form-input" value={rotaForm.status} onChange={e => setRotaForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="agendada">Agendada</option>
                  <option value="em_transito">Em Trânsito</option>
                  <option value="entregue">Entregue</option>
                  <option value="problema">Problema</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Carga</label>
                <input className="form-input" value={rotaForm.carga} onChange={e => setRotaForm(f => ({ ...f, carga: e.target.value }))} placeholder="Descrição da carga" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Peso (kg)</label>
                <input className="form-input" type="number" value={rotaForm.peso_kg} onChange={e => setRotaForm(f => ({ ...f, peso_kg: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Valor do Frete (R$)</label>
                <input className="form-input" value={rotaForm.valor_frete} onChange={e => setRotaForm(f => ({ ...f, valor_frete: e.target.value }))} placeholder="0,00" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Data de Saída</label>
                <input className="form-input" type="datetime-local" value={rotaForm.data_saida} onChange={e => setRotaForm(f => ({ ...f, data_saida: e.target.value }))} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Notas</label>
                <textarea className="form-input" rows={2} value={rotaForm.notas} onChange={e => setRotaForm(f => ({ ...f, notas: e.target.value }))} placeholder="Observações..." style={{ resize: 'vertical' }} />
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => { setShowRota(false); setRotaDetalhe(null); setOcrResult(null) }}>Cancelar</button>
              <button className="btn-action" onClick={salvarRota}>
                <i className="fa-solid fa-floppy-disk" /> Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL PNEU ── */}
      {showPneu && (
        <div className="modal-bg" onClick={() => setShowPneu(false)}>
          <div className="modal-box" style={{ maxWidth: 520, width: '95%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              Cadastrar Pneu
              <button className="modal-close" onClick={() => setShowPneu(false)}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Veículo *</label>
                <select className="form-input" value={pneuForm.veiculo_id} onChange={e => setPneuForm(f => ({ ...f, veiculo_id: e.target.value }))}>
                  <option value="">Selecionar veículo</option>
                  {ativos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Posição *</label>
                <select className="form-input" value={pneuForm.posicao} onChange={e => setPneuForm(f => ({ ...f, posicao: e.target.value }))}>
                  <option value="">Selecionar posição</option>
                  {['DD', 'DE', 'TD', 'TE', 'TDE', 'TDD', 'Estepe'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Marca</label>
                <input className="form-input" value={pneuForm.marca} onChange={e => setPneuForm(f => ({ ...f, marca: e.target.value }))} placeholder="Bridgestone, Michelin..." />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Modelo</label>
                <input className="form-input" value={pneuForm.modelo} onChange={e => setPneuForm(f => ({ ...f, modelo: e.target.value }))} placeholder="275/80R22.5" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>DOT</label>
                <input className="form-input" value={pneuForm.dot} onChange={e => setPneuForm(f => ({ ...f, dot: e.target.value }))} placeholder="2023" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Km Instalado</label>
                <input className="form-input" type="number" value={pneuForm.km_instalado} onChange={e => setPneuForm(f => ({ ...f, km_instalado: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Km Rodado</label>
                <input className="form-input" type="number" value={pneuForm.km_rodado} onChange={e => setPneuForm(f => ({ ...f, km_rodado: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Limite (km)</label>
                <input className="form-input" type="number" value={pneuForm.km_limite} onChange={e => setPneuForm(f => ({ ...f, km_limite: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Data Instalação</label>
                <input className="form-input" type="date" value={pneuForm.data_instalacao} onChange={e => setPneuForm(f => ({ ...f, data_instalacao: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Status</label>
                <select className="form-input" value={pneuForm.status} onChange={e => setPneuForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="ativo">Ativo</option>
                  <option value="desgastado">Desgastado</option>
                  <option value="recapado">Recapado</option>
                  <option value="descartado">Descartado</option>
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowPneu(false)}>Cancelar</button>
              <button className="btn-action" onClick={salvarPneu}>
                <i className="fa-solid fa-floppy-disk" /> Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CHECKLIST ── */}
      {showChecklist && (
        <div className="modal-bg" onClick={() => setShowChecklist(false)}>
          <div className="modal-box" style={{ maxWidth: 520, width: '95%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              Checklist Veículo
              <button className="modal-close" onClick={() => setShowChecklist(false)}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Veículo *</label>
                <select className="form-input" value={ckForm.veiculo_id} onChange={e => setCkForm(f => ({ ...f, veiculo_id: e.target.value }))}>
                  <option value="">Selecionar</option>
                  {ativos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Data</label>
                <input className="form-input" type="date" value={ckForm.data} onChange={e => setCkForm(f => ({ ...f, data: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Motorista</label>
                <input className="form-input" value={ckForm.motorista} onChange={e => setCkForm(f => ({ ...f, motorista: e.target.value }))} placeholder="Nome" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Rota</label>
                <select className="form-input" value={ckForm.rota_id} onChange={e => setCkForm(f => ({ ...f, rota_id: e.target.value }))}>
                  <option value="">Selecionar rota</option>
                  {rotas.filter(r => r.status !== 'entregue').map(r => <option key={r.id} value={r.id}>{r.origem} → {r.destino}</option>)}
                </select>
              </div>
            </div>
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 10 }}>Itens de Verificação</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {CHECKLIST_ITENS.map(item => (
                  <label key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={!!ckForm.itens[item]}
                      onChange={e => setCkForm(f => ({ ...f, itens: { ...f.itens, [item]: e.target.checked } }))}
                    />
                    {item}
                  </label>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowChecklist(false)}>Cancelar</button>
              <button className="btn-action" onClick={salvarChecklist}>
                <i className="fa-solid fa-floppy-disk" /> Salvar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── MODAL MANUTENÇÃO ── */}
      {showManut && (
        <div className="modal-bg" onClick={() => setShowManut(false)}>
          <div className="modal-box" style={{ maxWidth: 540, width: '95%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              Registrar Manutenção
              <button className="modal-close" onClick={() => setShowManut(false)}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Veículo *</label>
                <select className="form-input" value={manuForm.ativo_id} onChange={e => setManuForm(f => ({ ...f, ativo_id: e.target.value }))}>
                  <option value="">Selecionar veículo</option>
                  {ativos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Tipo</label>
                <select className="form-input" value={manuForm.tipo} onChange={e => setManuForm(f => ({ ...f, tipo: e.target.value }))}>
                  <option value="preventiva">Preventiva</option>
                  <option value="corretiva">Corretiva</option>
                  <option value="calibracao">Calibração</option>
                  <option value="vistoria">Vistoria</option>
                  <option value="seguro">Seguro</option>
                  <option value="ipva">IPVA</option>
                  <option value="outros">Outros</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Data *</label>
                <input className="form-input" type="date" value={manuForm.data} onChange={e => setManuForm(f => ({ ...f, data: e.target.value }))} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Descrição</label>
                <input className="form-input" value={manuForm.descricao} onChange={e => setManuForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Troca de óleo, revisão 50.000km..." />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Km / Horas</label>
                <input className="form-input" type="number" value={manuForm.km_ou_horas} onChange={e => setManuForm(f => ({ ...f, km_ou_horas: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Custo (R$) *</label>
                <input className="form-input" value={manuForm.valor} onChange={e => setManuForm(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Oficina</label>
                <input className="form-input" value={manuForm.oficina} onChange={e => setManuForm(f => ({ ...f, oficina: e.target.value }))} placeholder="Nome da oficina" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Próxima Manutenção</label>
                <input className="form-input" type="date" value={manuForm.proxima_data} onChange={e => setManuForm(f => ({ ...f, proxima_data: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Próximos Km/Horas</label>
                <input className="form-input" type="number" value={manuForm.proximos_km_horas} onChange={e => setManuForm(f => ({ ...f, proximos_km_horas: e.target.value }))} placeholder="0" />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowManut(false)}>Cancelar</button>
              <button className="btn-action" onClick={salvarManutencao}>
                <i className="fa-solid fa-floppy-disk" /> Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
