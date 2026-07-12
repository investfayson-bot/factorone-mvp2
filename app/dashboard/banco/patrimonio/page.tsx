'use client'

// Patrimônio (Fase 7) — evolução da tela existente, agora como sub-aba do
// Banco: cadastro por FOTO (OCR), PLANILHA (xlsx/csv) ou MANUAL, sempre com
// prévia editável antes de salvar. Detalhe do imóvel calcula ITBI com
// alíquota confirmável e LEMBRADA por cidade (itbi_aliquotas — nunca
// adivinhamos a alíquota municipal), e estimativa de ganho de capital na
// venda (15% IR, com avisos de isenção — estimativa, não cálculo oficial).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'

type Imovel = {
  id: string; endereco: string | null; cidade: string | null; estado: string | null
  area_m2: number | null; tipo_imovel: string | null; matricula: string | null
  valor_aquisicao: number | null; data_aquisicao: string | null; valor_venal: number | null
  vendido: boolean; valor_venda: number | null; data_venda: string | null
}
type Linha = {
  endereco: string | null; cidade: string | null; uf: string | null
  area_m2: number | null; valor_aquisicao: number | null; data_aquisicao: string | null
  tipo_imovel: string | null; matricula: string | null
}
type Aliquota = { cidade: string; uf: string | null; aliquota_pct: number }

const TIPOS = ['comercial', 'residencial', 'rural', 'terreno', 'industrial']
const LINHA_VAZIA: Linha = { endereco: null, cidade: null, uf: null, area_m2: null, valor_aquisicao: null, data_aquisicao: null, tipo_imovel: 'comercial', matricula: null }

async function authHeaders(json = true): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const t = data.session?.access_token
  return { ...(json ? { 'Content-Type': 'application/json' } : {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) }
}

export default function PatrimonioPage() {
  const [imoveis, setImoveis] = useState<Imovel[]>([])
  const [aliquotas, setAliquotas] = useState<Aliquota[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroCidade, setFiltroCidade] = useState('todas')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [aberto, setAberto] = useState<Imovel | null>(null)

  // prévia de importação
  const [previa, setPrevia] = useState<Linha[]>([])
  const [importando, setImportando] = useState(false)
  const [salvandoPrevia, setSalvandoPrevia] = useState(false)
  const fileFoto = useRef<HTMLInputElement>(null)
  const filePlanilha = useRef<HTMLInputElement>(null)

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const eid = (u?.empresa_id as string) ?? user.id
    const [imRes, alRes] = await Promise.all([
      supabase.from('imoveis_detalhes').select('id, endereco, cidade, estado, area_m2, tipo_imovel, matricula, valor_aquisicao, data_aquisicao, valor_venal, vendido, valor_venda, data_venda').eq('empresa_id', eid).order('created_at', { ascending: false }).limit(300),
      supabase.from('itbi_aliquotas').select('cidade, uf, aliquota_pct').eq('empresa_id', eid),
    ])
    setImoveis((imRes.data as Imovel[]) ?? [])
    setAliquotas((alRes.data as Aliquota[]) ?? [])
    setLoading(false)
  }, [])
  useEffect(() => { void carregar() }, [carregar])

  async function importar(file: File) {
    setImportando(true)
    try {
      const fd = new FormData(); fd.set('file', file)
      const r = await fetch('/api/patrimonio/importar', { method: 'POST', headers: await authHeaders(false), body: fd })
      const d = await r.json() as { imoveis?: Linha[]; error?: string }
      if (!r.ok || !d.imoveis) throw new Error(d.error || 'Falha na importação')
      setPrevia(d.imoveis)
      toast.success(`${d.imoveis.length} imóve${d.imoveis.length === 1 ? 'l lido' : 'is lidos'} — confira antes de salvar`)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro') }
    finally { setImportando(false) }
  }

  async function salvarPrevia() {
    setSalvandoPrevia(true)
    try {
      const r = await fetch('/api/patrimonio/confirmar', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ imoveis: previa }) })
      const d = await r.json() as { ok?: boolean; salvos?: number; error?: string }
      if (!r.ok || !d.ok) throw new Error(d.error || 'Falha ao salvar')
      toast.success(`${d.salvos} imóve${d.salvos === 1 ? 'l salvo' : 'is salvos'}`)
      setPrevia([])
      void carregar()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro') }
    finally { setSalvandoPrevia(false) }
  }

  const cidades = useMemo(() => Array.from(new Set(imoveis.map(i => i.cidade).filter(Boolean))) as string[], [imoveis])
  const filtrados = useMemo(() => imoveis.filter(i =>
    (filtroCidade === 'todas' || i.cidade === filtroCidade) &&
    (filtroTipo === 'todos' || i.tipo_imovel === filtroTipo)
  ), [imoveis, filtroCidade, filtroTipo])

  const totalAquisicao = filtrados.reduce((s, i) => s + Number(i.valor_aquisicao ?? 0), 0)

  function setPreviaCampo(idx: number, campo: keyof Linha, valor: string) {
    setPrevia(prev => prev.map((l, i) => {
      if (i !== idx) return l
      if (campo === 'area_m2' || campo === 'valor_aquisicao') return { ...l, [campo]: valor ? Number(valor) : null }
      return { ...l, [campo]: valor || null }
    }))
  }

  return (
    <div style={{ paddingBottom: 30 }}>
      {/* Entrada: foto / planilha / manual */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <input ref={fileFoto} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) void importar(f); e.target.value = '' }} />
        <input ref={filePlanilha} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) void importar(f); e.target.value = '' }} />
        <button className="btn-v2 primary" disabled={importando} onClick={() => fileFoto.current?.click()}>
          <i className="fa-solid fa-camera" style={{ marginRight: 6 }} />{importando ? 'Lendo…' : 'Foto do documento'}
        </button>
        <button className="btn-v2" disabled={importando} onClick={() => filePlanilha.current?.click()}>
          <i className="fa-solid fa-file-excel" style={{ marginRight: 6 }} />Planilha (xlsx/csv)
        </button>
        <button className="btn-v2" onClick={() => setPrevia(p => [...p, { ...LINHA_VAZIA }])}>
          <i className="fa-solid fa-plus" style={{ marginRight: 6 }} />Cadastro manual
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <select className="form-input" style={{ width: 'auto', height: 32, fontSize: 12 }} value={filtroCidade} onChange={e => setFiltroCidade(e.target.value)}>
            <option value="todas">Todas as cidades</option>
            {cidades.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="form-input" style={{ width: 'auto', height: 32, fontSize: 12 }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
            <option value="todos">Todos os tipos</option>
            {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Prévia editável */}
      {previa.length > 0 && (
        <div className="card-v2" style={{ padding: 16, marginBottom: 14, border: '1px solid var(--acc)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink)' }}>Conferência antes de salvar — {previa.length} imóve{previa.length === 1 ? 'l' : 'is'}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-v2" onClick={() => setPrevia([])}>Descartar</button>
              <button className="btn-v2 primary" disabled={salvandoPrevia} onClick={() => void salvarPrevia()}>{salvandoPrevia ? 'Salvando…' : 'Salvar tudo'}</button>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead><tr style={{ color: 'var(--mut)', fontSize: 10.5, textTransform: 'uppercase' }}>
                {['Endereço', 'Cidade', 'UF', 'Área m²', 'Valor aquisição', 'Data', 'Tipo', 'Matrícula', ''].map(h => <th key={h} style={{ textAlign: 'left', padding: '4px 6px' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {previa.map((l, i) => (
                  <tr key={i}>
                    <td style={{ padding: 3 }}><input className="form-input" style={{ height: 30, fontSize: 12, minWidth: 180 }} value={l.endereco ?? ''} onChange={e => setPreviaCampo(i, 'endereco', e.target.value)} /></td>
                    <td style={{ padding: 3 }}><input className="form-input" style={{ height: 30, fontSize: 12, width: 110 }} value={l.cidade ?? ''} onChange={e => setPreviaCampo(i, 'cidade', e.target.value)} /></td>
                    <td style={{ padding: 3 }}><input className="form-input" style={{ height: 30, fontSize: 12, width: 44 }} value={l.uf ?? ''} onChange={e => setPreviaCampo(i, 'uf', e.target.value)} /></td>
                    <td style={{ padding: 3 }}><input className="form-input" type="number" style={{ height: 30, fontSize: 12, width: 76 }} value={l.area_m2 ?? ''} onChange={e => setPreviaCampo(i, 'area_m2', e.target.value)} /></td>
                    <td style={{ padding: 3 }}><input className="form-input" type="number" style={{ height: 30, fontSize: 12, width: 110 }} value={l.valor_aquisicao ?? ''} onChange={e => setPreviaCampo(i, 'valor_aquisicao', e.target.value)} /></td>
                    <td style={{ padding: 3 }}><input className="form-input" type="date" style={{ height: 30, fontSize: 12 }} value={l.data_aquisicao ?? ''} onChange={e => setPreviaCampo(i, 'data_aquisicao', e.target.value)} /></td>
                    <td style={{ padding: 3 }}>
                      <select className="form-input" style={{ height: 30, fontSize: 12 }} value={l.tipo_imovel ?? 'comercial'} onChange={e => setPreviaCampo(i, 'tipo_imovel', e.target.value)}>
                        {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: 3 }}><input className="form-input" style={{ height: 30, fontSize: 12, width: 90 }} value={l.matricula ?? ''} onChange={e => setPreviaCampo(i, 'matricula', e.target.value)} /></td>
                    <td style={{ padding: 3 }}><button className="btn-v2" style={{ padding: '4px 8px' }} onClick={() => setPrevia(p => p.filter((_, j) => j !== i))}><i className="fa-solid fa-trash" style={{ fontSize: 11, color: '#B0413E' }} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lista */}
      <div style={{ fontSize: 12, color: 'var(--mut)', fontWeight: 600, marginBottom: 8 }}>
        {filtrados.length} imóve{filtrados.length === 1 ? 'l' : 'is'} · valor de aquisição somado: <b style={{ color: 'var(--ink)' }}>{formatBRL(totalAquisicao)}</b>
        {' '}· <Link href="/dashboard/patrimonio" style={{ color: 'var(--acc)' }}>Patrimônio completo (veículos, obras, sócios) →</Link>
      </div>
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--mut)', fontSize: 13 }}>Carregando…</div>
      ) : filtrados.length === 0 ? (
        <div className="card-v2" style={{ padding: '34px 20px', textAlign: 'center' }}>
          <i className="fa-solid fa-building" style={{ fontSize: 26, color: 'var(--acc)', marginBottom: 10, display: 'block' }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Nenhum imóvel cadastrado</div>
          <div style={{ fontSize: 12.5, color: 'var(--mut)' }}>Manda uma foto do contrato/matrícula, sobe a planilha, ou cadastra manual — a IA organiza por endereço, cidade, preço e metragem.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 }}>
          {filtrados.map(im => (
            <div key={im.id} className="card-v2" style={{ padding: 14, cursor: 'pointer', opacity: im.vendido ? .65 : 1 }} onClick={() => setAberto(im)}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--acc-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className="fa-solid fa-building" style={{ fontSize: 15, color: 'var(--acc-ink)' }} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{im.endereco || 'Sem endereço'}</div>
                  <div style={{ fontSize: 11, color: 'var(--mut)', fontWeight: 600 }}>{[im.cidade, im.estado].filter(Boolean).join('/')}{im.area_m2 ? ` · ${im.area_m2} m²` : ''} · {im.tipo_imovel}</div>
                </div>
                {im.vendido && <span className="chip-v2">Vendido</span>}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 12 }}>
                <span style={{ color: 'var(--mut)', fontWeight: 600 }}>Aquisição</span>
                <b style={{ fontVariantNumeric: 'tabular-nums' }}>{im.valor_aquisicao != null ? formatBRL(Number(im.valor_aquisicao)) : '—'}</b>
              </div>
            </div>
          ))}
        </div>
      )}

      {aberto && <DetalheImovel imovel={aberto} aliquotas={aliquotas} onFechar={() => setAberto(null)} onMudou={() => { setAberto(null); void carregar() }} />}
    </div>
  )
}

// ── Detalhe: ITBI (alíquota lembrada por cidade) + estimativa de venda ──
function DetalheImovel({ imovel, aliquotas, onFechar, onMudou }: {
  imovel: Imovel; aliquotas: Aliquota[]; onFechar: () => void; onMudou: () => void
}) {
  const lembrada = aliquotas.find(a => a.cidade === imovel.cidade && (a.uf ?? '') === (imovel.estado ?? ''))
  const [aliquota, setAliquota] = useState<number>(lembrada?.aliquota_pct ?? 2)
  const [salvandoAliq, setSalvandoAliq] = useState(false)
  const [vendaValor, setVendaValor] = useState(imovel.valor_venda != null ? String(imovel.valor_venda) : '')
  const [salvandoVenda, setSalvandoVenda] = useState(false)

  const aquisicao = Number(imovel.valor_aquisicao ?? 0)
  const itbi = aquisicao > 0 ? aquisicao * (aliquota / 100) : null
  const venda = Number(vendaValor) || Number(imovel.valor_venda ?? 0)
  const ganho = venda > 0 && aquisicao > 0 ? venda - aquisicao : null
  const irVenda = ganho != null && ganho > 0 ? ganho * 0.15 : null

  async function confirmarAliquota() {
    if (!imovel.cidade) { toast.error('Imóvel sem cidade cadastrada'); return }
    setSalvandoAliq(true)
    try {
      const r = await fetch('/api/patrimonio/confirmar', { method: 'PUT', headers: await authHeaders(), body: JSON.stringify({ cidade: imovel.cidade, uf: imovel.estado, aliquota_pct: aliquota }) })
      const d = await r.json() as { ok?: boolean; error?: string }
      if (!r.ok || !d.ok) throw new Error(d.error || 'Falha')
      toast.success(`Alíquota de ${imovel.cidade} salva — não pergunto de novo`)
      onMudou()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro') }
    finally { setSalvandoAliq(false) }
  }

  async function marcarVenda(vendido: boolean) {
    setSalvandoVenda(true)
    try {
      const r = await fetch('/api/patrimonio/confirmar', { method: 'PATCH', headers: await authHeaders(), body: JSON.stringify({ id: imovel.id, vendido, valor_venda: Number(vendaValor) || undefined, data_venda: new Date().toISOString().slice(0, 10) }) })
      const d = await r.json() as { ok?: boolean; error?: string }
      if (!r.ok || !d.ok) throw new Error(d.error || 'Falha')
      toast.success(vendido ? 'Venda registrada' : 'Venda desfeita')
      onMudou()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro') }
    finally { setSalvandoVenda(false) }
  }

  return (
    <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) onFechar() }}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 520, maxHeight: '86vh', overflowY: 'auto' }}>
        <h2 style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--ink)', marginBottom: 2 }}>{imovel.endereco || 'Imóvel'}</h2>
        <div style={{ fontSize: 12, color: 'var(--mut)', fontWeight: 600, marginBottom: 14 }}>
          {[imovel.cidade, imovel.estado].filter(Boolean).join('/')}{imovel.area_m2 ? ` · ${imovel.area_m2} m²` : ''} · {imovel.tipo_imovel}{imovel.matricula ? ` · matrícula ${imovel.matricula}` : ''}
        </div>

        {[
          ['Valor de aquisição', imovel.valor_aquisicao != null ? formatBRL(Number(imovel.valor_aquisicao)) : '—'],
          ['Data de aquisição', imovel.data_aquisicao ? new Date(imovel.data_aquisicao + 'T12:00:00').toLocaleDateString('pt-BR') : '—'],
          ['Valor venal (IPTU)', imovel.valor_venal != null ? formatBRL(Number(imovel.valor_venal)) : '—'],
        ].map(([l, v]) => (
          <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
            <span style={{ color: 'var(--mut)', fontWeight: 600 }}>{l}</span><b style={{ fontVariantNumeric: 'tabular-nums' }}>{v}</b>
          </div>
        ))}

        {/* ITBI */}
        <div style={{ background: 'var(--acc-soft)', borderRadius: 10, padding: '12px 14px', margin: '14px 0' }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--acc-ink)', marginBottom: 6 }}>ITBI na aquisição</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 600 }}>Alíquota de {imovel.cidade || 'sua cidade'}:</span>
            <input type="number" step="0.1" min={0} max={10} className="form-input" style={{ width: 70, height: 30, fontSize: 12.5 }} value={aliquota} onChange={e => setAliquota(Number(e.target.value))} />
            <span style={{ fontSize: 12, fontWeight: 700 }}>%</span>
            {!lembrada && <button className="btn-v2" style={{ fontSize: 11 }} disabled={salvandoAliq} onClick={() => void confirmarAliquota()}>{salvandoAliq ? '…' : 'Confirmar e lembrar'}</button>}
            {lembrada && <span className="chip-v2 g" style={{ fontSize: 9.5 }}>lembrada</span>}
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)' }}>ITBI estimado: {itbi != null ? formatBRL(itbi) : '— (sem valor de aquisição)'}</div>
          <div style={{ fontSize: 10.5, color: 'var(--mut)', marginTop: 4 }}>
            {lembrada ? `Usando a alíquota que você confirmou pra ${imovel.cidade}.` : 'Sugestão padrão de 2% — confirme a alíquota real do município (varia tipicamente entre 2% e 3%).'}
          </div>
        </div>

        {/* Venda */}
        <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--ink)', marginBottom: 6 }}>{imovel.vendido ? 'Venda registrada' : 'Simular / registrar venda'}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <input type="number" className="form-input" placeholder="Valor de venda (R$)" style={{ flex: 1, height: 32, fontSize: 12.5 }} value={vendaValor} onChange={e => setVendaValor(e.target.value)} />
            <button className="btn-v2 primary" style={{ fontSize: 11.5 }} disabled={salvandoVenda || (!imovel.vendido && !Number(vendaValor))} onClick={() => void marcarVenda(!imovel.vendido)}>
              {salvandoVenda ? '…' : imovel.vendido ? 'Desfazer venda' : 'Marcar como vendido'}
            </button>
          </div>
          {ganho != null && (
            <div style={{ fontSize: 12, lineHeight: 1.7 }}>
              Ganho de capital estimado: <b style={{ color: ganho >= 0 ? 'var(--acc-ink)' : '#B0413E' }}>{formatBRL(ganho)}</b><br />
              {irVenda != null
                ? <>IR estimado sobre a venda (15%): <b>{formatBRL(irVenda)}</b></>
                : 'Sem ganho — sem IR sobre a venda.'}
            </div>
          )}
          <div style={{ fontSize: 10.5, color: 'var(--mut)', marginTop: 6, lineHeight: 1.5 }}>
            ⚠ Estimativa simplificada. Há isenções comuns (ex.: único imóvel até R$ 440 mil; venda de residencial com compra de outro em 180 dias) e fatores de redução por tempo — valide com seu contador antes de decidir.
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn-v2" onClick={onFechar}>Fechar</button>
        </div>
      </div>
    </div>
  )
}
