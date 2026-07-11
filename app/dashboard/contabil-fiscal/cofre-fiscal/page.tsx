'use client'

// Cofre Fiscal (Fase 5, Bloco 2) — arquivo permanente de documentos
// fiscais, por competência e tipo, seguindo o mockup 05-contabil.html
// (vault-row: ícone por tipo, nome, descrição, ações imprimir/reenviar).
// Além dos documentos anexados, as guias já registradas em tax_obrigacoes
// (ex.: DAS do estimador) entram na lista automaticamente como registro
// sem arquivo — o histórico não começa vazio.

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'

type Doc = {
  id: string; tipo: string; nome: string; descricao: string | null
  competencia: string | null; arquivo_path: string | null; created_at: string
  origem: 'cofre' | 'obrigacao'
}

const TIPOS: { id: string; label: string; icone: string }[] = [
  { id: 'todos', label: 'Todos', icone: 'fa-folder-open' },
  { id: 'guia', label: 'Guias', icone: 'fa-file-invoice-dollar' },
  { id: 'declaracao', label: 'Declarações', icone: 'fa-file-lines' },
  { id: 'contrato', label: 'Contratos', icone: 'fa-file-signature' },
  { id: 'procuracao', label: 'Procurações', icone: 'fa-stamp' },
  { id: 'outro', label: 'Outros', icone: 'fa-file' },
]

const ICONE_TIPO: Record<string, string> = {
  guia: 'fa-file-invoice-dollar', declaracao: 'fa-file-lines',
  contrato: 'fa-file-signature', procuracao: 'fa-stamp', outro: 'fa-file',
}

export default function CofreFiscalPage() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [tipoFiltro, setTipoFiltro] = useState('todos')
  const [compFiltro, setCompFiltro] = useState('')

  const [modal, setModal] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({ tipo: 'guia', nome: '', descricao: '', competencia: new Date().toISOString().slice(0, 7) })
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [acaoEm, setAcaoEm] = useState<string | null>(null)

  async function auth() {
    const { data: sess } = await supabase.auth.getSession()
    const tk = sess.session?.access_token ?? ''
    return tk ? { Authorization: `Bearer ${tk}` } : {}
  }

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
      const eid = (u?.empresa_id as string) ?? user.id

      const [cofreRes, obrigRes] = await Promise.all([
        supabase.from('cofre_fiscal_documentos').select('id, tipo, nome, descricao, competencia, arquivo_path, created_at').eq('empresa_id', eid).order('created_at', { ascending: false }).limit(200),
        supabase.from('tax_obrigacoes').select('id, nome, tipo, competencia, vencimento, valor, status').eq('empresa_id', eid).in('status', ['entregue', 'pago']).order('vencimento', { ascending: false }).limit(100),
      ])

      const doCofre: Doc[] = ((cofreRes.data ?? []) as Omit<Doc, 'origem'>[]).map(d => ({ ...d, origem: 'cofre' as const }))
      const deObrig: Doc[] = ((obrigRes.data ?? []) as { id: string; nome: string; tipo: string | null; competencia: string | null; vencimento: string | null; valor: number | null }[]).map(o => ({
        id: `obr-${o.id}`,
        tipo: 'guia',
        nome: o.nome,
        descricao: `${o.tipo ?? 'Guia'} recolhida${o.vencimento ? ` · venc. ${new Date(o.vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}` : ''}${o.valor != null ? ` · ${formatBRL(Number(o.valor))}` : ''}`,
        competencia: o.competencia,
        arquivo_path: null,
        created_at: o.vencimento ?? '',
        origem: 'obrigacao' as const,
      }))
      setDocs([...doCofre, ...deObrig])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void carregar() }, [carregar])

  const filtrados = useMemo(() => docs.filter(d =>
    (tipoFiltro === 'todos' || d.tipo === tipoFiltro) &&
    (!compFiltro || d.competencia === compFiltro)
  ), [docs, tipoFiltro, compFiltro])

  async function salvar() {
    if (!form.nome.trim()) { toast.error('Dê um nome ao documento'); return }
    setSalvando(true)
    try {
      const fd = new FormData()
      fd.set('tipo', form.tipo)
      fd.set('nome', form.nome.trim())
      fd.set('descricao', form.descricao.trim())
      fd.set('competencia', form.competencia)
      if (arquivo) fd.set('file', arquivo)
      const res = await fetch('/api/cofre-fiscal', { method: 'POST', headers: await auth(), body: fd })
      const d = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || !d.ok) throw new Error(d.error || 'Falha ao salvar')
      toast.success('Documento guardado no Cofre')
      setModal(false)
      setForm({ tipo: 'guia', nome: '', descricao: '', competencia: new Date().toISOString().slice(0, 7) })
      setArquivo(null)
      void carregar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    } finally { setSalvando(false) }
  }

  async function abrir(doc: Doc, imprimir: boolean) {
    if (!doc.arquivo_path) { toast('Este registro não tem arquivo anexado.'); return }
    setAcaoEm(doc.id)
    try {
      const res = await fetch(`/api/cofre-fiscal/${doc.id}/url`, { headers: await auth() })
      const d = await res.json() as { url?: string; error?: string }
      if (!res.ok || !d.url) throw new Error(d.error || 'Falha ao abrir')
      const win = window.open(d.url, '_blank')
      if (imprimir && win) win.addEventListener('load', () => win.print())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    } finally { setAcaoEm(null) }
  }

  async function reenviar(doc: Doc) {
    if (!doc.arquivo_path) { toast('Este registro não tem arquivo anexado.'); return }
    const email = prompt('Enviar para qual e-mail?', '')
    if (email === null) return
    setAcaoEm(doc.id)
    try {
      const res = await fetch(`/api/cofre-fiscal/${doc.id}/reenviar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await auth()) },
        body: JSON.stringify({ email: email.trim() }),
      })
      const d = await res.json() as { ok?: boolean; destino?: string; error?: string }
      if (!res.ok || !d.ok) throw new Error(d.error || 'Falha no envio')
      toast.success(`Enviado para ${d.destino}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro no envio')
    } finally { setAcaoEm(null) }
  }

  async function excluir(doc: Doc) {
    if (doc.origem !== 'cofre') return
    if (!confirm(`Excluir "${doc.nome}" do Cofre? O arquivo anexado também será removido.`)) return
    setAcaoEm(doc.id)
    try {
      const res = await fetch(`/api/cofre-fiscal?id=${encodeURIComponent(doc.id)}`, { method: 'DELETE', headers: await auth() })
      const d = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || !d.ok) throw new Error(d.error || 'Falha ao excluir')
      toast.success('Excluído')
      void carregar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    } finally { setAcaoEm(null) }
  }

  return (
    <div style={{ maxWidth: 940, paddingBottom: 30 }}>
      {/* Filtros + ação */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {TIPOS.map(t => (
            <button key={t.id} onClick={() => setTipoFiltro(t.id)} style={{
              fontSize: 12, padding: '5px 12px', borderRadius: 20, border: '1px solid var(--line)', cursor: 'pointer', fontWeight: 600,
              background: tipoFiltro === t.id ? 'var(--acc)' : 'var(--card)', color: tipoFiltro === t.id ? '#fff' : 'var(--mut)',
            }}><i className={`fa-solid ${t.icone}`} style={{ marginRight: 5, fontSize: 11 }} />{t.label}</button>
          ))}
        </div>
        <input type="month" className="form-input" value={compFiltro} onChange={e => setCompFiltro(e.target.value)} style={{ width: 'auto', height: 32, fontSize: 12.5 }} title="Filtrar por competência" />
        {compFiltro && <button className="btn-v2" style={{ fontSize: 12 }} onClick={() => setCompFiltro('')}>Limpar mês</button>}
        <button className="btn-v2 primary" style={{ marginLeft: 'auto' }} onClick={() => setModal(true)}>
          <i className="fa-solid fa-plus" style={{ marginRight: 6 }} />Guardar documento
        </button>
      </div>

      {/* Lista */}
      <div className="card-v2" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '34px 16px', textAlign: 'center', color: 'var(--mut)', fontSize: 13 }}>Carregando…</div>
        ) : filtrados.length === 0 ? (
          <div style={{ padding: '38px 20px', textAlign: 'center' }}>
            <i className="fa-solid fa-vault" style={{ fontSize: 26, color: 'var(--acc)', marginBottom: 10, display: 'block' }} />
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Cofre vazio {tipoFiltro !== 'todos' || compFiltro ? 'com esses filtros' : ''}</div>
            <div style={{ fontSize: 12.5, color: 'var(--mut)', maxWidth: 420, margin: '0 auto' }}>
              Guarde aqui cada guia paga, declaração protocolada, contrato e procuração — o histórico fiscal completo da empresa num lugar só.
            </div>
          </div>
        ) : filtrados.map(d => (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: '1px solid var(--line)' }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--acc-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className={`fa-solid ${ICONE_TIPO[d.tipo] ?? 'fa-file'}`} style={{ fontSize: 14, color: 'var(--acc-ink)' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>
                {d.nome}
                {d.competencia && <span style={{ fontWeight: 500, color: 'var(--mut)' }}> — {d.competencia}</span>}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--mut)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {d.descricao || TIPOS.find(t => t.id === d.tipo)?.label || d.tipo}
                {!d.arquivo_path && <span style={{ color: '#B08A3E' }}> · sem arquivo anexado</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0, opacity: acaoEm === d.id ? .5 : 1 }}>
              <button title="Imprimir" className="btn-v2" style={{ padding: '5px 9px' }} disabled={!!acaoEm} onClick={() => void abrir(d, true)}><i className="fa-solid fa-print" style={{ fontSize: 12 }} /></button>
              <button title="Baixar / abrir" className="btn-v2" style={{ padding: '5px 9px' }} disabled={!!acaoEm} onClick={() => void abrir(d, false)}><i className="fa-solid fa-arrow-down" style={{ fontSize: 12 }} /></button>
              <button title="Reenviar por e-mail" className="btn-v2" style={{ padding: '5px 9px' }} disabled={!!acaoEm} onClick={() => void reenviar(d)}><i className="fa-solid fa-paper-plane" style={{ fontSize: 12 }} /></button>
              {d.origem === 'cofre' && (
                <button title="Excluir" className="btn-v2" style={{ padding: '5px 9px' }} disabled={!!acaoEm} onClick={() => void excluir(d)}><i className="fa-solid fa-trash" style={{ fontSize: 12, color: '#B0413E' }} /></button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal guardar documento */}
      {modal && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) setModal(false) }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 26, width: '100%', maxWidth: 480 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', marginBottom: 16 }}>Guardar documento no Cofre</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--mut)', display: 'block', marginBottom: 5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>Tipo</label>
                  <select className="form-input" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} style={{ width: '100%' }}>
                    {TIPOS.filter(t => t.id !== 'todos').map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--mut)', display: 'block', marginBottom: 5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>Competência</label>
                  <input type="month" className="form-input" value={form.competencia} onChange={e => setForm(f => ({ ...f, competencia: e.target.value }))} style={{ width: '100%' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--mut)', display: 'block', marginBottom: 5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>Nome *</label>
                <input className="form-input" placeholder="Ex: DAS Simples Nacional — Junho/2026" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--mut)', display: 'block', marginBottom: 5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>Descrição (protocolo, quem enviou…)</label>
                <input className="form-input" placeholder="Ex: Guia paga em 20/06 · protocolo gov.br 884213" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--mut)', display: 'block', marginBottom: 5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>Arquivo (PDF/imagem, até 15MB)</label>
                <input type="file" accept=".pdf,image/*" onChange={e => setArquivo(e.target.files?.[0] ?? null)} style={{ fontSize: 12.5 }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
              <button className="btn-v2" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn-v2 primary" onClick={() => void salvar()} disabled={salvando || !form.nome.trim()}>
                {salvando ? 'Guardando…' : 'Guardar no Cofre'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
