'use client'
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'
import NovoAtivoModal from '@/components/patrimonio/NovoAtivoModal'
import DetalhesAtivoModal from '@/components/patrimonio/DetalhesAtivoModal'
import BaixaAtivoModal from '@/components/patrimonio/BaixaAtivoModal'
import QRCodeAtivo from '@/components/patrimonio/QRCodeAtivo'

type Categoria = { id: string; nome: string; vida_util_anos: number; metodo_depreciacao: 'linear' | 'acelerada' | 'soma_digitos' }
type Ativo = {
  id: string
  nome: string
  categoria_id: string | null
  codigo_interno: string | null
  localizacao: string | null
  valor_aquisicao: number
  depreciacao_acumulada: number
  valor_contabil: number
  status: 'ativo' | 'em_manutencao' | 'baixado' | 'alienado' | 'perdido'
  foto_url: string | null
  responsavel_nome: string | null
  qr_code: string
  empresa_id: string
}

const STATUS_COLORS: Record<string, string> = {
  ativo: 'green',
  em_manutencao: 'gray',
  baixado: 'red',
  alienado: 'red',
  perdido: 'red',
}

function depColor(p: number) {
  if (p > 80) return 'var(--red)'
  if (p >= 50) return 'var(--gold)'
  return 'var(--teal)'
}

export default function PatrimonioPage() {
  const [empresaId, setEmpresaId] = useState('')
  const [ativos, setAtivos] = useState<Ativo[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [depreciacoes, setDepreciacoes] = useState<Array<{ competencia: string; valor_depreciacao: number }>>([])
  const [manutencoes, setManutencoes] = useState<Array<{ id: string; ativo_id: string; tipo: string; descricao: string; data_manutencao: string; proxima_manutencao: string | null }>>([])
  const [tab, setTab] = useState<'ativos' | 'categorias' | 'depreciacao' | 'manutencoes'>('ativos')
  const [openNovo, setOpenNovo] = useState(false)
  const [detalhes, setDetalhes] = useState<Ativo | null>(null)
  const [baixa, setBaixa] = useState<Ativo | null>(null)
  const [qr, setQr] = useState<Ativo | null>(null)
  const [fCategoria, setFCategoria] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fLocal, setFLocal] = useState('')
  const [fResp, setFResp] = useState('')
  const [loadingDep, setLoadingDep] = useState(false)

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const u = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const eid = (u.data?.empresa_id as string) || user.id
    setEmpresaId(eid)
    const [a, c, d, m] = await Promise.all([
      supabase.from('ativos').select('*').eq('empresa_id', eid).order('created_at', { ascending: false }),
      supabase.from('categorias_ativo').select('id,nome,vida_util_anos,metodo_depreciacao').eq('empresa_id', eid).order('nome'),
      supabase.from('depreciacoes').select('competencia,valor_depreciacao').eq('empresa_id', eid).order('competencia', { ascending: false }).limit(24),
      supabase.from('manutencoes_ativo').select('id,ativo_id,tipo,descricao,data_manutencao,proxima_manutencao').eq('empresa_id', eid).order('data_manutencao', { ascending: false }).limit(50),
    ])
    setAtivos((a.data || []) as Ativo[])
    setCategorias((c.data || []) as Categoria[])
    setDepreciacoes((d.data || []) as Array<{ competencia: string; valor_depreciacao: number }>)
    setManutencoes((m.data || []) as Array<{ id: string; ativo_id: string; tipo: string; descricao: string; data_manutencao: string; proxima_manutencao: string | null }>)
  }, [])

  useEffect(() => { void carregar() }, [carregar])
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab')
    if (t === 'depreciacao' || t === 'manutencoes' || t === 'categorias' || t === 'ativos') setTab(t)
  }, [])

  const ativosFiltrados = ativos.filter((a) =>
    (!fCategoria || a.categoria_id === fCategoria) &&
    (!fStatus || a.status === fStatus) &&
    (!fLocal || (a.localizacao || '').toLowerCase().includes(fLocal.toLowerCase())) &&
    (!fResp || (a.responsavel_nome || '').toLowerCase().includes(fResp.toLowerCase()))
  )
  const totalAtivos = ativosFiltrados.length
  const valorTotal = ativosFiltrados.reduce((s, a) => s + Number(a.valor_aquisicao || 0), 0)
  const valorContabil = ativosFiltrados.reduce((s, a) => s + Number(a.valor_contabil || 0), 0)
  const depMes = depreciacoes.filter((d) => d.competencia?.startsWith(new Date().toISOString().slice(0, 7))).reduce((s, d) => s + Number(d.valor_depreciacao || 0), 0)

  const porCategoria = useMemo(() => categorias.map((c) => {
    const list = ativos.filter((a) => a.categoria_id === c.id)
    const total = list.reduce((s, a) => s + Number(a.valor_aquisicao || 0), 0)
    const contabil = list.reduce((s, a) => s + Number(a.valor_contabil || 0), 0)
    const depPerc = total > 0 ? ((total - contabil) / total) * 100 : 0
    return { ...c, totalAtivos: list.length, total, contabil, depPerc }
  }), [ativos, categorias])

  async function processarDepreciacao() {
    setLoadingDep(true)
    const { data: sess } = await supabase.auth.getSession()
    const res = await fetch('/api/patrimonio/depreciar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(sess.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {}) },
      body: JSON.stringify({ empresaId, competencia: new Date().toISOString().slice(0, 7) }),
    })
    const payload = await res.json().catch(() => ({}))
    setLoadingDep(false)
    if (!res.ok) return alert(payload.error || 'Falha ao processar depreciação')
    alert(`Depreciação processada: ${payload.processados} ativos`)
    await carregar()
  }

  function categoriaNome(id: string | null): string {
    return categorias.find((c) => c.id === id)?.nome || 'Sem categoria'
  }
  function depProgress(ativo: Ativo): number {
    const total = Number(ativo.valor_aquisicao || 0)
    if (!total) return 0
    return (Number(ativo.depreciacao_acumulada || 0) / total) * 100
  }

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Patrimônio & Ativos</div>
          <div className="page-sub">Controle de ativos, depreciação e manutenções</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" onClick={() => setOpenNovo(true)}>+ Novo Ativo</button>
          <button className="btn-action" disabled={loadingDep} onClick={() => void processarDepreciacao()} style={{ opacity: loadingDep ? 0.6 : 1 }}>
            {loadingDep ? 'Processando…' : 'Processar Depreciação'}
          </button>
          <a className="btn-ghost" href="/api/patrimonio/relatorio" target="_blank">Exportar Relatório</a>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 4 }}>
        <select className="form-input" value={fCategoria} onChange={(e) => setFCategoria(e.target.value)}>
          <option value="">Todas categorias</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <select className="form-input" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="">Todos status</option>
          <option value="ativo">Ativo</option>
          <option value="em_manutencao">Em manutenção</option>
          <option value="baixado">Baixado</option>
          <option value="alienado">Alienado</option>
          <option value="perdido">Perdido</option>
        </select>
        <input className="form-input" placeholder="Localização" value={fLocal} onChange={(e) => setFLocal(e.target.value)} />
        <input className="form-input" placeholder="Responsável" value={fResp} onChange={(e) => setFResp(e.target.value)} />
      </div>

      {/* KPIs */}
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="kpi">
          <div className="kpi-lbl">Total ativos</div>
          <div className="kpi-val">{totalAtivos}</div>
          <div className="kpi-delta">cadastrados</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Valor total</div>
          <div className="kpi-val">{formatBRL(valorTotal)}</div>
          <div className="kpi-delta">aquisição</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Deprec. mês</div>
          <div className="kpi-val" style={{ color: 'var(--red)' }}>{formatBRL(depMes)}</div>
          <div className="kpi-delta dn">mês atual</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Valor contábil</div>
          <div className="kpi-val" style={{ color: 'var(--teal)' }}>{formatBRL(valorContabil)}</div>
          <div className="kpi-delta up">líquido</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
        {([['ativos', 'Lista de Ativos'], ['categorias', 'Por Categoria'], ['depreciacao', 'Depreciação'], ['manutencoes', 'Manutenções']] as [string, string][]).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k as typeof tab)}
            style={{
              padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid',
              background: tab === k ? 'var(--navy)' : '#fff',
              color: tab === k ? '#fff' : 'var(--gray-500)',
              borderColor: tab === k ? 'var(--navy)' : 'var(--gray-100)',
            }}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === 'ativos' && (
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, overflow: 'hidden' }}>
          <div className="expenses-table">
            <table>
              <thead>
                <tr>
                  <th>Foto</th>
                  <th>Código</th>
                  <th>Nome / Depreciação</th>
                  <th>Categoria</th>
                  <th>Localização</th>
                  <th style={{ textAlign: 'right' }}>Aquisição</th>
                  <th style={{ textAlign: 'right' }}>Deprec.</th>
                  <th style={{ textAlign: 'right' }}>Contábil</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {ativosFiltrados.length === 0 && (
                  <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '32px 0' }}>Nenhum ativo encontrado.</td></tr>
                )}
                {ativosFiltrados.map((a) => {
                  const p = depProgress(a)
                  return (
                    <tr key={a.id}>
                      <td>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', background: 'var(--gray-100)' }}>
                          {a.foto_url ? <img src={a.foto_url} alt={a.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                        </div>
                      </td>
                      <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 11 }}>{a.codigo_interno || '—'}</td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 12 }}>{a.nome}</div>
                        <div style={{ marginTop: 4, height: 4, borderRadius: 2, background: 'var(--gray-100)', width: 80 }}>
                          <div style={{ height: 4, borderRadius: 2, width: `${Math.min(p, 100)}%`, background: depColor(p) }} />
                        </div>
                      </td>
                      <td style={{ color: 'var(--gray-500)', fontSize: 12 }}>{categoriaNome(a.categoria_id)}</td>
                      <td style={{ color: 'var(--gray-500)', fontSize: 12 }}>{a.localizacao || '—'}</td>
                      <td style={{ textAlign: 'right', fontFamily: "'DM Mono',monospace" }}>{formatBRL(Number(a.valor_aquisicao || 0))}</td>
                      <td style={{ textAlign: 'right', fontFamily: "'DM Mono',monospace", color: 'var(--red)' }}>{formatBRL(Number(a.depreciacao_acumulada || 0))}</td>
                      <td style={{ textAlign: 'right', fontFamily: "'DM Mono',monospace", color: 'var(--teal)', fontWeight: 700 }}>{formatBRL(Number(a.valor_contabil || 0))}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`tag ${STATUS_COLORS[a.status] || 'gray'}`}>{a.status}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                          <button className="btn-ghost" style={{ padding: '3px 8px', fontSize: 10 }} onClick={() => setDetalhes(a)}>Ver</button>
                          <button className="btn-ghost" style={{ padding: '3px 8px', fontSize: 10 }} onClick={() => setBaixa(a)}>Baixar</button>
                          <button className="btn-ghost" style={{ padding: '3px 8px', fontSize: 10 }} onClick={() => setQr(a)}>QR</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'categorias' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {porCategoria.map((c) => (
            <button key={c.id} style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 16, textAlign: 'left', cursor: 'pointer' }} onClick={() => { setFCategoria(c.id); setTab('ativos') }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--navy)', marginBottom: 4 }}>{c.nome}</div>
              <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 4 }}>{c.totalAtivos} ativos</div>
              <div style={{ fontSize: 12, fontFamily: "'DM Mono',monospace", marginBottom: 8 }}>{formatBRL(c.total)} / {formatBRL(c.contabil)}</div>
              <div style={{ height: 6, borderRadius: 4, background: 'var(--gray-100)' }}>
                <div style={{ height: 6, borderRadius: 4, width: `${Math.min(c.depPerc, 100)}%`, background: depColor(c.depPerc) }} />
              </div>
            </button>
          ))}
        </div>
      )}

      {tab === 'depreciacao' && (
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)', fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>
            Histórico de depreciações
          </div>
          <div className="expenses-table">
            <table>
              <thead>
                <tr>
                  <th>Competência</th>
                  <th style={{ textAlign: 'right' }}>Valor depreciado</th>
                </tr>
              </thead>
              <tbody>
                {depreciacoes.length === 0 && (
                  <tr><td colSpan={2} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '24px 0' }}>Nenhuma depreciação processada.</td></tr>
                )}
                {depreciacoes.map((d, i) => (
                  <tr key={String(i)}>
                    <td style={{ fontFamily: "'DM Mono',monospace" }}>{d.competencia}</td>
                    <td style={{ textAlign: 'right', fontFamily: "'DM Mono',monospace", color: 'var(--red)', fontWeight: 700 }}>{formatBRL(Number(d.valor_depreciacao || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'manutencoes' && (
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)', fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>
            Manutenções
          </div>
          <div className="expenses-table">
            <table>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Descrição</th>
                  <th>Data</th>
                  <th>Próxima</th>
                </tr>
              </thead>
              <tbody>
                {manutencoes.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '24px 0' }}>Nenhuma manutenção registrada.</td></tr>
                )}
                {manutencoes.map((m) => (
                  <tr key={m.id}>
                    <td><span className="tag gray">{m.tipo}</span></td>
                    <td style={{ fontSize: 12 }}>{m.descricao}</td>
                    <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 11 }}>{m.data_manutencao}</td>
                    <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--gray-400)' }}>{m.proxima_manutencao || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <NovoAtivoModal open={openNovo} onClose={() => setOpenNovo(false)} onDone={carregar} empresaId={empresaId} categorias={categorias} />
      {detalhes && <DetalhesAtivoModal open={Boolean(detalhes)} onClose={() => setDetalhes(null)} ativo={{ id: detalhes.id, nome: detalhes.nome, categoria: categoriaNome(detalhes.categoria_id), foto_url: detalhes.foto_url, localizacao: detalhes.localizacao, responsavel_nome: detalhes.responsavel_nome, valor_contabil: Number(detalhes.valor_contabil || 0) }} />}
      {baixa && <BaixaAtivoModal open={Boolean(baixa)} onClose={() => setBaixa(null)} onDone={carregar} ativo={{ id: baixa.id, nome: baixa.nome, valor_contabil: Number(baixa.valor_contabil || 0), empresa_id: baixa.empresa_id }} />}
      {qr && <QRCodeAtivo open={Boolean(qr)} onClose={() => setQr(null)} qrCode={qr.qr_code} nome={qr.nome} />}
    </>
  )
}
