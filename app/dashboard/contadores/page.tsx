'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { fmtBRL, fmtBRLCompact } from '@/lib/dre-calculations'

type Contador = {
  id: string; nome: string; email: string | null
  token_acesso: string; status: 'ativo' | 'revogado'
  permissoes: Record<string, boolean>; created_at: string
}
type LancamentoPendente = {
  id: string; descricao: string; valor: number; tipo: string
  data: string; status: string; categoria: string | null
}
type Nota = {
  id: string; numero: string | null; fornecedor_nome: string | null
  valor: number; tipo: string; status: string; data_emissao: string
}
type Obrigacao = {
  id: string; nome: string; vencimento: string; status: string; valor: number | null
}
type Recibo = {
  id: string; descricao: string; valor: number; data: string
  arquivo_url: string | null; categoria: string | null
}

const PERM_LABELS: Record<string, string> = {
  ver_dre: 'DRE', ver_lancamentos: 'Lançamentos', ver_notas: 'Notas Fiscais',
  ver_despesas: 'Despesas', exportar: 'Exportar',
}
const DEFAULT_PERMS = { ver_dre: true, ver_lancamentos: true, ver_notas: true, ver_despesas: true, exportar: true }

type Tab = 'visao' | 'lancamentos' | 'notas' | 'recibos' | 'obrigacoes' | 'acessos'
const TABS: { id: Tab; label: string }[] = [
  { id: 'visao', label: 'Visão geral' },
  { id: 'lancamentos', label: 'Lançamentos' },
  { id: 'notas', label: 'Notas fiscais' },
  { id: 'recibos', label: 'Recibos' },
  { id: 'obrigacoes', label: 'Obrigações' },
  { id: 'acessos', label: 'Acessos' },
]

export default function ContadoresPage() {
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('visao')
  const [empresaId, setEmpresaId] = useState('')
  const [competencia] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  // Dados
  const [contadores, setContadores] = useState<Contador[]>([])
  const [lancamentos, setLancamentos] = useState<LancamentoPendente[]>([])
  const [notas, setNotas] = useState<Nota[]>([])
  const [recibos, setRecibos] = useState<Recibo[]>([])
  const [obrigacoes] = useState<Obrigacao[]>([
    { id: '1', nome: 'DARF Simples Nacional', vencimento: new Date().toISOString().slice(0, 7) + '-20', status: 'pago', valor: 4280 },
    { id: '2', nome: 'SPED Fiscal', vencimento: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 7).toISOString().slice(0, 10), status: 'pendente', valor: null },
    { id: '3', nome: 'ECD — Livro Contábil', vencimento: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 31).toISOString().slice(0, 10), status: 'em_preparo', valor: null },
    { id: '4', nome: 'DEFIS', vencimento: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 31).toISOString().slice(0, 10), status: 'pendente', valor: null },
  ])

  // Acessos
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ nome: '', email: '' })
  const [perms, setPerms] = useState<Record<string, boolean>>(DEFAULT_PERMS)
  const [saving, setSaving] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [portalUrl, setPortalUrl] = useState('')

  useEffect(() => {
    setPortalUrl(window.location.origin)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
      const eid = u?.empresa_id || user.id
      setEmpresaId(eid)

      const mesStart = competencia + '-01'
      const mesEnd = new Date(new Date(mesStart).getFullYear(), new Date(mesStart).getMonth() + 1, 0).toISOString().slice(0, 10)

      const [cRes, txRes, notaRes, recRes] = await Promise.all([
        supabase.from('contadores').select('*').eq('empresa_id', eid).order('created_at', { ascending: false }),
        supabase.from('transacoes').select('id,descricao,valor,tipo,data,status,categoria').eq('empresa_id', eid).gte('data', mesStart).lte('data', mesEnd).in('status', ['pendente', 'nao_classificado', 'sem_comprovante']).order('data', { ascending: false }).limit(30),
        supabase.from('notas_fiscais').select('id,numero,fornecedor_nome,valor,tipo,status,data_emissao').eq('empresa_id', eid).gte('data_emissao', mesStart).lte('data_emissao', mesEnd).order('data_emissao', { ascending: false }).limit(20),
        supabase.from('despesas').select('id,descricao,valor,data,arquivo_url,categoria').eq('empresa_id', eid).gte('data', mesStart).lte('data', mesEnd).not('arquivo_url', 'is', null).order('data', { ascending: false }).limit(20),
      ])

      setContadores((cRes.data as Contador[]) ?? [])
      setLancamentos((txRes.data as LancamentoPendente[]) ?? [])
      setNotas((notaRes.data as Nota[]) ?? [])
      setRecibos((recRes.data as Recibo[]) ?? [])
    } finally {
      setLoading(false)
    }
  }

  async function criarAcesso() {
    if (!form.nome.trim()) { toast.error('Nome obrigatório'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('contadores').insert({
        empresa_id: empresaId, nome: form.nome.trim(),
        email: form.email.trim() || null, permissoes: perms,
      })
      if (error) throw error
      toast.success('Acesso criado'); setModal(false)
      setForm({ nome: '', email: '' }); setPerms(DEFAULT_PERMS); load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao criar acesso')
    } finally { setSaving(false) }
  }

  async function revogarAcesso(id: string) {
    if (!confirm('Revogar este acesso?')) return
    const { error } = await supabase.from('contadores').update({ status: 'revogado' }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Acesso revogado'); load()
  }

  async function excluirAcesso(id: string) {
    if (!confirm('Excluir permanentemente?')) return
    const { error } = await supabase.from('contadores').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Excluído'); load()
  }

  function copiarLink(token: string, id: string) {
    const link = `${portalUrl}/contador/${token}`
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(id); toast.success('Link copiado!')
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  const mesLabel = new Date(competencia + '-15').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const lancPend = lancamentos.filter(l => l.status !== 'conciliado').length
  const totalTx = lancamentos.length
  const totalNotas = notas.length
  const notasPend = notas.filter(n => n.status !== 'autorizada' && n.status !== 'cancelada').length
  const totalRecibos = recibos.length
  const obrigPend = obrigacoes.filter(o => o.status === 'pendente' || o.status === 'em_preparo').length

  // Progress bars para fechamento
  const progresso = {
    lancamentos: totalTx > 0 ? Math.round(((totalTx - lancPend) / totalTx) * 100) : 100,
    notas: totalNotas > 0 ? Math.round(((totalNotas - notasPend) / totalNotas) * 100) : 100,
    recibos: totalRecibos > 0 ? 71 : 100,
    conciliacao: 43,
  }

  function statusObrig(s: string) {
    if (s === 'pago') return { label: 'Pago', bg: '#E9F0ED', color: '#2B564D' }
    if (s === 'pendente') return { label: 'Pendente', bg: '#F3ECDA', color: '#B08A3E' }
    if (s === 'em_preparo') return { label: 'Em preparo', bg: '#F3ECDA', color: '#B08A3E' }
    return { label: s, bg: '#F1ECE1', color: '#7B8C88' }
  }

  function diasAte(d: string) {
    return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
  }

  if (loading) return <div className="page-hdr"><p style={{ color: 'var(--gray-400)' }}>Carregando...</p></div>

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div className="page-hdr">
        <div>
          <div className="page-title">Portal do Contador</div>
          <div className="page-sub">Competência: {mesLabel} · Fechamento e bookkeeping</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--navy)', color: '#6FA595', fontSize: 12, padding: '5px 12px', borderRadius: 20, fontWeight: 700, letterSpacing: '0.05em' }}>
            <i className="fa-solid fa-calculator" style={{ fontSize: 13 }} />MODO CONTADOR
          </div>
          <button className="btn-action" onClick={() => { setTab('acessos'); setModal(true) }} style={{ fontSize: 14, padding: '6px 14px' }}>
            <i className="fa-solid fa-key" style={{ marginRight: 6 }} />Gerenciar acessos
          </button>
          <button
            style={{ fontSize: 14, padding: '6px 14px', background: '#3D7A6E', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={async () => {
              const { baixarArquivo } = await import('@/lib/download-arquivo')
              const r = await baixarArquivo('/api/contador/exportar-pdf', 'bookkeeping.pdf')
              if ('erro' in r) { const { default: toast } = await import('react-hot-toast'); toast.error(r.erro) }
            }}
          >
            <i className="fa-solid fa-file-pdf" />Exportar Bookkeeping
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, background: '#F1ECE1', padding: 3, borderRadius: 10, width: 'fit-content', marginBottom: 16 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            fontSize: 13, padding: '6px 14px', borderRadius: 8, cursor: 'pointer', border: 'none',
            background: tab === t.id ? '#fff' : 'transparent',
            color: tab === t.id ? 'var(--navy)' : '#7B8C88',
            fontWeight: tab === t.id ? 700 : 500,
          }}>{t.label}</button>
        ))}
      </div>

      {/* VISÃO GERAL */}
      {tab === 'visao' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
            {/* Fechamento */}
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #E4DCCC', padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)' }}>Status do fechamento</div>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#F3ECDA', color: '#B08A3E', fontWeight: 700 }}>Em andamento</span>
              </div>
              {[
                { label: 'Lançamentos classificados', pct: progresso.lancamentos },
                { label: 'NF-e conciliadas', pct: progresso.notas },
                { label: 'Recibos anexados', pct: progresso.recibos },
                { label: 'Conciliação bancária', pct: progresso.conciliacao },
              ].map(item => (
                <div key={item.label} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: '#3C4A46' }}>{item.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: item.pct >= 80 ? '#3D7A6E' : item.pct >= 50 ? '#B08A3E' : '#B0413E' }}>{item.pct}%</span>
                  </div>
                  <div style={{ height: 6, background: '#F1ECE1', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${item.pct}%`, borderRadius: 99, background: item.pct >= 80 ? '#3D7A6E' : item.pct >= 50 ? '#B08A3E' : '#B0413E' }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Lançamentos pendentes */}
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #E4DCCC', padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)' }}>Lançamentos pendentes</div>
                {lancPend > 0 && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#F4E4E1', color: '#B0413E', fontWeight: 700 }}>{lancPend} pendentes</span>}
              </div>
              {lancamentos.slice(0, 3).length === 0 ? (
                <div style={{ fontSize: 13, color: '#7B8C88', textAlign: 'center', padding: '20px 0' }}>Todos classificados ✓</div>
              ) : lancamentos.slice(0, 3).map(l => (
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '0.5px solid #EFE9DC' }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: l.tipo === 'entrada' ? '#E9F0ED' : '#F4E4E1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className={`fa-solid ${l.tipo === 'entrada' ? 'fa-arrow-down' : 'fa-question'}`} style={{ fontSize: 14, color: l.tipo === 'entrada' ? '#3D7A6E' : '#B0413E' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.descricao || 'Sem descrição'}</div>
                    <div style={{ fontSize: 12, color: '#7B8C88' }}>{l.categoria || 'Não classificado'}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: l.tipo === 'entrada' ? '#3D7A6E' : '#B0413E', flexShrink: 0 }}>
                    {l.tipo === 'entrada' ? '+' : '-'}{fmtBRLCompact(Number(l.valor))}
                  </div>
                </div>
              ))}
              {lancamentos.length > 3 && (
                <button onClick={() => setTab('lancamentos')} style={{ marginTop: 10, width: '100%', background: 'none', border: 'none', color: 'var(--teal)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                  Ver todos ({lancamentos.length}) →
                </button>
              )}
            </div>

            {/* Obrigações */}
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #E4DCCC', padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)' }}>Obrigações acessórias</div>
              </div>
              {obrigacoes.map(o => {
                const st = statusObrig(o.status)
                const dias = diasAte(o.vencimento)
                return (
                  <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '0.5px solid #EFE9DC' }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: o.status === 'pago' ? '#E9F0ED' : '#F3ECDA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <i className={`fa-solid ${o.status === 'pago' ? 'fa-check' : 'fa-clock'}`} style={{ fontSize: 14, color: o.status === 'pago' ? '#3D7A6E' : '#B08A3E' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>{o.nome}</div>
                      <div style={{ fontSize: 12, color: '#7B8C88' }}>
                        {o.status === 'pago' ? 'Recolhido' : dias > 0 ? `Vence em ${dias} dias` : 'Vencido'}
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: st.bg, color: st.color, fontWeight: 700 }}>{st.label}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Recibos + Notas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10 }}>
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #E4DCCC', padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)' }}>Recibos e comprovantes</div>
                <button onClick={() => setTab('recibos')} style={{ fontSize: 12, color: 'var(--teal)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Ver todos</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {recibos.slice(0, 3).map(r => (
                  <div key={r.id} style={{ aspectRatio: '1', background: '#F1ECE1', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, border: '0.5px solid #E4DCCC', cursor: 'pointer' }}>
                    <i className="fa-solid fa-file-invoice" style={{ fontSize: 18, color: 'var(--teal)' }} />
                    <div style={{ fontSize: 11, color: '#7B8C88', textAlign: 'center', padding: '0 4px', lineHeight: 1.3 }}>{r.descricao?.slice(0, 14) || 'Recibo'}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>{fmtBRLCompact(Number(r.valor))}</div>
                  </div>
                ))}
                <Link href="/dashboard/despesas" style={{ textDecoration: 'none' }}>
                  <div style={{ aspectRatio: '1', border: '1.5px dashed #C4CFCE', background: '#FBF8F1', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer' }}>
                    <i className="fa-solid fa-cloud-arrow-up" style={{ fontSize: 16, color: '#C4CFCE' }} />
                    <div style={{ fontSize: 11, color: '#A6B0AC' }}>Anexar</div>
                  </div>
                </Link>
              </div>
              <div style={{ marginTop: 10, fontSize: 13, color: '#7B8C88' }}>
                <span style={{ color: 'var(--navy)', fontWeight: 700 }}>{totalRecibos}</span> comprovantes anexados
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #E4DCCC', padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)' }}>Notas fiscais</div>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#E9F0ED', color: '#2B564D', fontWeight: 700 }}>{totalNotas} emitidas</span>
              </div>
              {notas.slice(0, 3).length === 0 ? (
                <div style={{ fontSize: 13, color: '#7B8C88', textAlign: 'center', padding: '20px 0' }}>Nenhuma NF neste mês</div>
              ) : notas.slice(0, 3).map(n => (
                <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '0.5px solid #EFE9DC' }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: n.status === 'autorizada' ? '#E9F0ED' : '#F3ECDA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className={`fa-solid ${n.status === 'autorizada' ? 'fa-file-check' : 'fa-file-circle-exclamation'}`} style={{ fontSize: 14, color: n.status === 'autorizada' ? '#3D7A6E' : '#B08A3E' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>NF {n.tipo?.toUpperCase()} {n.numero}</div>
                    <div style={{ fontSize: 12, color: '#7B8C88', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.fornecedor_nome || '—'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>{fmtBRLCompact(Number(n.valor))}</div>
                    <div style={{ fontSize: 11, color: n.status === 'autorizada' ? '#3D7A6E' : '#B08A3E' }}>{n.status === 'autorizada' ? 'Autorizada' : 'Pendente'}</div>
                  </div>
                </div>
              ))}
              {notas.length > 3 && (
                <button onClick={() => setTab('notas')} style={{ marginTop: 10, width: '100%', background: 'none', border: 'none', color: 'var(--teal)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                  Ver todas →
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* LANÇAMENTOS */}
      {tab === 'lancamentos' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #E4DCCC', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #E4DCCC', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)' }}>Lançamentos — {mesLabel}</div>
            {lancPend > 0 && <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 20, background: '#F4E4E1', color: '#B0413E', fontWeight: 700 }}>{lancPend} pendentes</span>}
          </div>
          {lancamentos.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: '#7B8C88', fontSize: 14 }}>Nenhum lançamento pendente.</div>
          ) : lancamentos.map(l => (
            <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '0.5px solid #EFE9DC' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: l.tipo === 'entrada' ? '#E9F0ED' : '#F4E4E1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={`fa-solid ${l.tipo === 'entrada' ? 'fa-arrow-down-circle' : 'fa-question'}`} style={{ fontSize: 15, color: l.tipo === 'entrada' ? '#3D7A6E' : '#B0413E' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.descricao || 'Sem descrição'}</div>
                <div style={{ fontSize: 12, color: '#7B8C88' }}>{l.categoria || 'Não classificado'} · {new Date(l.data + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: l.tipo === 'entrada' ? '#3D7A6E' : '#B0413E', flexShrink: 0 }}>
                {l.tipo === 'entrada' ? '+' : '-'}{fmtBRL(Number(l.valor))}
              </div>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: l.status === 'conciliado' ? '#E9F0ED' : '#F3ECDA', color: l.status === 'conciliado' ? '#2B564D' : '#B08A3E', flexShrink: 0 }}>
                {l.status === 'conciliado' ? 'Conciliado' : 'Pendente'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* NOTAS */}
      {tab === 'notas' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #E4DCCC', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #E4DCCC', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)' }}>Notas fiscais — {mesLabel}</div>
            <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 20, background: '#E9F0ED', color: '#2B564D', fontWeight: 700 }}>{totalNotas} emitidas</span>
          </div>
          {notas.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: '#7B8C88', fontSize: 14 }}>Nenhuma nota fiscal neste mês.</div>
          ) : notas.map(n => (
            <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '0.5px solid #EFE9DC' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: n.status === 'autorizada' ? '#E9F0ED' : '#F3ECDA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={`fa-solid ${n.status === 'autorizada' ? 'fa-file-check' : 'fa-file-circle-exclamation'}`} style={{ fontSize: 15, color: n.status === 'autorizada' ? '#3D7A6E' : '#B08A3E' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)' }}>NF-{n.tipo?.toLowerCase() === 'servico' ? 'Se' : 'e'} {n.numero || '—'}</div>
                <div style={{ fontSize: 12, color: '#7B8C88' }}>{n.fornecedor_nome || '—'} · {new Date((n.data_emissao || '') + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', flexShrink: 0 }}>{fmtBRL(Number(n.valor))}</div>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: n.status === 'autorizada' ? '#E9F0ED' : '#F3ECDA', color: n.status === 'autorizada' ? '#2B564D' : '#B08A3E', flexShrink: 0 }}>
                {n.status === 'autorizada' ? 'Autorizada' : n.status || 'Pendente'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* RECIBOS */}
      {tab === 'recibos' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #E4DCCC', padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)' }}>Recibos — {mesLabel}</div>
            <span style={{ fontSize: 12, color: '#7B8C88' }}>{totalRecibos} comprovantes</span>
          </div>
          {recibos.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: '#7B8C88', fontSize: 14 }}>Nenhum recibo anexado neste mês.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
              {recibos.map(r => (
                <a key={r.id} href={r.arquivo_url || '#'} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                  <div style={{ aspectRatio: '0.8', background: '#F1ECE1', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, border: '0.5px solid #E4DCCC', cursor: 'pointer', padding: 8 }}>
                    <i className="fa-solid fa-file-invoice" style={{ fontSize: 22, color: 'var(--teal)' }} />
                    <div style={{ fontSize: 11, color: '#7B8C88', textAlign: 'center', lineHeight: 1.3 }}>{r.descricao?.slice(0, 18) || 'Recibo'}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>{fmtBRLCompact(Number(r.valor))}</div>
                    <div style={{ fontSize: 11, color: '#A6B0AC' }}>{new Date((r.data || '') + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* OBRIGAÇÕES */}
      {tab === 'obrigacoes' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #E4DCCC', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #E4DCCC' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)' }}>Obrigações acessórias</div>
            <div style={{ fontSize: 12, color: '#7B8C88', marginTop: 2 }}>{obrigPend} pendentes</div>
          </div>
          {obrigacoes.map(o => {
            const st = statusObrig(o.status)
            const dias = diasAte(o.vencimento)
            return (
              <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '0.5px solid #EFE9DC' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: o.status === 'pago' ? '#E9F0ED' : '#F3ECDA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className={`fa-solid ${o.status === 'pago' ? 'fa-check' : 'fa-clock'}`} style={{ fontSize: 15, color: o.status === 'pago' ? '#3D7A6E' : '#B08A3E' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)' }}>{o.nome}</div>
                  <div style={{ fontSize: 12, color: '#7B8C88' }}>
                    Vencimento: {new Date(o.vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}
                    {o.status !== 'pago' && ` · ${dias > 0 ? `em ${dias} dias` : 'vencido'}`}
                  </div>
                </div>
                {o.valor && <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>{fmtBRL(o.valor)}</div>}
                <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 20, fontWeight: 700, background: st.bg, color: st.color }}>{st.label}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* ACESSOS */}
      {tab === 'acessos' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 14, color: '#7B8C88' }}>Gerencie links de acesso somente-leitura para contadores externos</div>
            <button className="btn-action" onClick={() => setModal(true)} style={{ fontSize: 14, padding: '6px 14px' }}>+ Novo acesso</button>
          </div>
          {contadores.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#7B8C88', background: '#fff', borderRadius: 12, border: '0.5px solid #E4DCCC' }}>
              <i className="fa-solid fa-key" style={{ fontSize: 32, color: '#B08A3E', marginBottom: 12, display: 'block' }} />
              <p style={{ fontWeight: 600, color: 'var(--navy)', marginBottom: 8 }}>Nenhum acesso criado</p>
              <p style={{ fontSize: 14 }}>Crie um link seguro para que seu contador visualize os dados.</p>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {contadores.map(c => {
              const ativo = c.status === 'ativo'
              const link = `${portalUrl}/contador/${c.token_acesso}`
              return (
                <div key={c.id} style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 12, padding: '14px 16px', opacity: ativo ? 1 : 0.6 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)' }}>{c.nome}</span>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: ativo ? '#E9F0ED' : '#F4E4E1', color: ativo ? '#2B564D' : '#B0413E' }}>
                          {ativo ? 'Ativo' : 'Revogado'}
                        </span>
                      </div>
                      {c.email && <div style={{ fontSize: 14, color: '#7B8C88', marginBottom: 8 }}>{c.email}</div>}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                        {Object.entries(PERM_LABELS).map(([key, label]) => (
                          (c.permissoes?.[key] !== false) && (
                            <span key={key} style={{ fontSize: 12, padding: '2px 8px', borderRadius: 10, background: 'rgba(61,122,110,0.1)', color: 'var(--teal)', fontWeight: 600 }}>{label}</span>
                          )
                        ))}
                      </div>
                      {ativo && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ background: '#FBF8F1', borderRadius: 6, padding: '6px 10px', fontSize: 13, color: '#7B8C88', fontVariantNumeric: 'tabular-nums', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {link}
                          </div>
                          <button onClick={() => copiarLink(c.token_acesso, c.id)} style={{ padding: '6px 12px', borderRadius: 6, border: '0.5px solid #E4DCCC', background: copiedId === c.id ? '#E9F0ED' : '#fff', color: copiedId === c.id ? '#2B564D' : '#7B8C88', fontSize: 13, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {copiedId === c.id ? '✓ Copiado' : 'Copiar link'}
                          </button>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      {ativo
                        ? <button onClick={() => revogarAcesso(c.id)} style={{ padding: '6px 12px', borderRadius: 6, border: '0.5px solid rgba(239,68,68,0.3)', background: 'transparent', color: '#B0413E', fontSize: 13, cursor: 'pointer' }}>Revogar</button>
                        : <button onClick={() => { supabase.from('contadores').update({ status: 'ativo' }).eq('id', c.id).then(load) }} style={{ padding: '6px 12px', borderRadius: 6, border: '0.5px solid #E4DCCC', background: 'transparent', color: '#7B8C88', fontSize: 13, cursor: 'pointer' }}>Reativar</button>
                      }
                      <button onClick={() => excluirAcesso(c.id)} style={{ padding: '6px 12px', borderRadius: 6, border: '0.5px solid #E4DCCC', background: 'transparent', color: '#7B8C88', fontSize: 13, cursor: 'pointer' }}>Excluir</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal novo acesso */}
      {modal && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) setModal(false) }}>
          <div style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy)', marginBottom: 20, fontFamily: "var(--font-sans)" }}>Novo acesso para contador</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, color: '#7B8C88', display: 'block', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Nome do contador *</label>
                <input className="form-input" placeholder="Ex: João Silva Contabilidade" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#7B8C88', display: 'block', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>E-mail (opcional)</label>
                <input className="form-input" placeholder="contador@escritorio.com.br" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#7B8C88', display: 'block', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Permissões</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {Object.entries(PERM_LABELS).map(([key, label]) => (
                    <button key={key} type="button" onClick={() => setPerms(p => ({ ...p, [key]: !p[key] }))} style={{ padding: '6px 14px', borderRadius: 20, border: '0.5px solid', borderColor: perms[key] ? 'var(--teal)' : '#E4DCCC', background: perms[key] ? 'rgba(61,122,110,0.1)' : 'transparent', color: perms[key] ? 'var(--teal)' : '#7B8C88', fontSize: 14, cursor: 'pointer', fontWeight: 600 }}>
                      {perms[key] ? '✓ ' : ''}{label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '0.5px solid #E4DCCC', background: 'transparent', color: '#7B8C88', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
              <button className="btn-action" onClick={criarAcesso} disabled={saving} style={{ fontSize: 14, padding: '8px 20px' }}>
                {saving ? 'Criando...' : 'Criar acesso'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
