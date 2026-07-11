'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { formatBRL } from '@/lib/currency-brl'
import { supabase } from '@/lib/supabase'
import { useHolding, type EscopoHolding } from '@/lib/holding-context'

type Linha = {
  id: string; titularidade: 'pj' | 'pf'; empresa_id: string | null; empresa_nome: string | null
  descricao: string; valor: number; tipo: 'entrada' | 'saida'; data: string
  categoria: string | null; status_classificacao: 'sugerida' | 'aguardando_ok' | 'confirmada'
  origem_documento: string | null; documento_anexo_url: string | null
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const t = data.session?.access_token
  return t ? { Authorization: `Bearer ${t}` } : {}
}

function chipStatus(s: Linha['status_classificacao']) {
  if (s === 'confirmada') return { texto: 'Confirmado', classe: 'chip-v2 g' }
  if (s === 'aguardando_ok') return { texto: 'Aguardando OK', classe: 'chip-v2 y' }
  return { texto: 'Sugestão da IA, revisar', classe: 'chip-v2 y' }
}
function origemBadge(o: string | null) {
  if (o === 'foto') return '📷 OCR'
  if (o === 'manual') return '✏️ Manual'
  if (o === 'pdf') return '📄 PDF'
  return '🏦 Open Finance'
}

export default function BancoExtratoPage() {
  const { grupoAtivoId, escopo, setEscopo, grupos } = useHolding()
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [loading, setLoading] = useState(true)
  const [tipoFiltro, setTipoFiltro] = useState<'todas' | 'entrada' | 'saida'>('todas')
  const [statusFiltro, setStatusFiltro] = useState<'todas' | 'classificadas' | 'pendentes'>('todas')
  const [linhaAberta, setLinhaAberta] = useState<string | null>(null)
  const [enviandoExtrato, setEnviandoExtrato] = useState(false)
  const [enviandoFoto, setEnviandoFoto] = useState(false)
  const fileExtratoRef = useRef<HTMLInputElement>(null)
  const fileFotoRef = useRef<HTMLInputElement>(null)

  async function carregar() {
    setLoading(true)
    const h = await authHeaders()
    const qs = new URLSearchParams({ escopo, status: statusFiltro, tipo: tipoFiltro })
    if (grupoAtivoId) qs.set('grupoId', grupoAtivoId)
    const r = await fetch(`/api/banco/extrato?${qs}`, { headers: h }).then(x => x.json()).catch(() => null)
    if (r && !r.error) setLinhas(r.linhas ?? [])
    setLoading(false)
  }

  useEffect(() => { void carregar() }, [grupoAtivoId, escopo, statusFiltro, tipoFiltro])

  const aguardandoOk = useMemo(() => linhas.filter(l => l.status_classificacao === 'aguardando_ok'), [linhas])

  async function confirmar(itens: Linha[]) {
    const h = await authHeaders()
    const r = await fetch('/api/banco/extrato/confirmar', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...h },
      body: JSON.stringify({ itens: itens.map(l => ({ id: l.id, titularidade: l.titularidade, empresa_id: l.empresa_id, descricao: l.descricao, categoria: l.categoria || 'Outros' })) }),
    })
    const j = await r.json()
    if (r.ok) { toast.success(`${j.confirmados} confirmada(s)`); void carregar() }
    else toast.error(j.error || 'Falha ao confirmar')
  }

  async function trocarCategoria(l: Linha, categoria: string) {
    setLinhas(prev => prev.map(x => x.id === l.id ? { ...x, categoria } : x))
    await confirmar([{ ...l, categoria }])
  }

  async function enviarExtrato(file: File) {
    setEnviandoExtrato(true)
    try {
      const h = await authHeaders()
      const fd = new FormData()
      fd.append('file', file)
      // /api/conta-pj/importar-extrato não tem etapa de prévia — insere
      // direto no extrato_bancario numa chamada só (import falso-duplo foi
      // um bug corrigido aqui: essa rota nunca leu um campo "confirm").
      const r = await fetch('/api/conta-pj/importar-extrato', { method: 'POST', headers: h, body: fd })
      const j = await r.json()
      if (r.ok) { toast.success(`${j.importadas ?? ''} lançamento(s) importado(s)`.trim()); void carregar() }
      else toast.error(j.error || 'Falha ao importar extrato')
    } finally {
      setEnviandoExtrato(false)
      if (fileExtratoRef.current) fileExtratoRef.current.value = ''
    }
  }

  async function enviarFoto(file: File) {
    setEnviandoFoto(true)
    try {
      const h = await authHeaders()
      const fd = new FormData()
      fd.append('file', file)
      const r = await fetch('/api/contabilidade/processar-recibo', { method: 'POST', headers: h, body: fd })
      const j = await r.json()
      if (r.ok) {
        toast.success(j.lancado_automaticamente ? 'Comprovante lançado automaticamente' : 'Comprovante processado — revisar em Despesas')
        void carregar()
      } else toast.error(j.error || 'Falha ao processar comprovante')
    } finally {
      setEnviandoFoto(false)
      if (fileFotoRef.current) fileFotoRef.current.value = ''
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div className="seg-v2">
          {(['consolidado', 'empresas', 'pf'] as EscopoHolding[]).map(e => (
            <span key={e} className={escopo === e ? 'on' : ''} onClick={() => setEscopo(e)}>
              {e === 'consolidado' ? 'Consolidado (PJ+PF)' : e === 'empresas' ? 'Só empresas' : 'Só pessoa física'}
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input ref={fileExtratoRef} type="file" accept=".ofx,.ofc,.csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) void enviarExtrato(f) }} />
          <button className="btn-v2" disabled={enviandoExtrato} onClick={() => fileExtratoRef.current?.click()}>{enviandoExtrato ? 'Enviando…' : '+ Anexar extrato'}</button>
          <input ref={fileFotoRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) void enviarFoto(f) }} />
          <button className="btn-v2" disabled={enviandoFoto} onClick={() => fileFotoRef.current?.click()}>{enviandoFoto ? 'Processando…' : '+ Registrar com foto'}</button>
        </div>
      </div>
      {grupos.length === 0 && <small style={{ color: 'var(--mut)', fontWeight: 700, fontSize: 11 }}>Sem Holding criada, mostrando sua empresa.</small>}

      {aguardandoOk.length > 0 && (
        <div className="card-v2" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--acc-soft)', border: '1px solid var(--acc)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--acc-ink)' }}>{aguardandoOk.length} transação(ões) prontas para confirmar</div>
          <button className="btn-v2 primary" onClick={() => void confirmar(aguardandoOk)}>Confirmar em lote</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div className="seg-v2">
          {(['todas', 'entrada', 'saida'] as const).map(t => (
            <span key={t} className={tipoFiltro === t ? 'on' : ''} onClick={() => setTipoFiltro(t)}>{t === 'todas' ? 'Todas' : t === 'entrada' ? 'Entradas' : 'Saídas'}</span>
          ))}
        </div>
        <div className="seg-v2">
          {(['todas', 'classificadas', 'pendentes'] as const).map(s => (
            <span key={s} className={statusFiltro === s ? 'on' : ''} onClick={() => setStatusFiltro(s)}>{s === 'todas' ? 'Todas' : s === 'classificadas' ? 'Classificadas' : 'Pendentes de confirmação'}</span>
          ))}
        </div>
      </div>

      <div className="card-v2" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--mut)', fontSize: 13 }}>Carregando…</div>
        ) : linhas.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--mut)', fontSize: 13 }}>Nenhuma movimentação encontrada.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                {['Data', 'Descrição', 'Categoria', 'Valor', 'Origem', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--mut)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map(l => {
                const chip = chipStatus(l.status_classificacao)
                return (
                  <>
                    <tr key={l.id} onClick={() => setLinhaAberta(v => v === l.id ? null : l.id)} style={{ borderBottom: '1px solid var(--line)', cursor: 'pointer' }}>
                      <td style={{ padding: '9px 12px', color: 'var(--mut)' }}>{new Date(l.data + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                      <td style={{ padding: '9px 12px', fontWeight: 600, color: 'var(--ink)' }}>
                        {l.descricao}
                        {l.titularidade === 'pf' && <span style={{ marginLeft: 6, fontSize: 10, color: '#4F46E5', fontWeight: 700 }}>PF</span>}
                        {l.empresa_nome && <span style={{ marginLeft: 6, fontSize: 10.5, color: 'var(--mut)' }}>· {l.empresa_nome}</span>}
                      </td>
                      <td style={{ padding: '9px 12px', color: 'var(--mut)' }}>{l.categoria || '—'}</td>
                      <td style={{ padding: '9px 12px', fontWeight: 700, color: l.tipo === 'entrada' ? 'var(--acc-ink)' : 'var(--ink)' }}>{l.tipo === 'entrada' ? '+' : '–'}{formatBRL(l.valor)}</td>
                      <td style={{ padding: '9px 12px', fontSize: 11.5 }}>{origemBadge(l.origem_documento)}{l.documento_anexo_url && <a href={l.documento_anexo_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ marginLeft: 6 }}><i className="fa-solid fa-paperclip" /></a>}</td>
                      <td style={{ padding: '9px 12px' }}><span className={chip.classe}>{chip.texto}</span></td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--mut)' }}><i className={`fa-solid fa-chevron-${linhaAberta === l.id ? 'up' : 'down'}`} style={{ fontSize: 10 }} /></td>
                    </tr>
                    {linhaAberta === l.id && l.status_classificacao !== 'confirmada' && (
                      <tr key={`${l.id}-exp`} style={{ borderBottom: '1px solid var(--line)', background: 'var(--bg)' }}>
                        <td colSpan={7} style={{ padding: '10px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <button className="btn-v2 primary" onClick={(e) => { e.stopPropagation(); void confirmar([l]) }}>✓ Confirmar: {l.categoria || 'Outros'}</button>
                            <span style={{ fontSize: 12, color: 'var(--mut)' }}>não é isso,</span>
                            <select
                              defaultValue=""
                              onClick={e => e.stopPropagation()}
                              onChange={e => { if (e.target.value) void trocarCategoria(l, e.target.value) }}
                              style={{ fontSize: 12, border: '1px solid var(--line)', borderRadius: 7, padding: '4px 8px' }}
                            >
                              <option value="" disabled>trocar categoria</option>
                              {(l.titularidade === 'pj'
                                ? ['Fornecedores', 'Marketing', 'Impostos/Taxas', 'Folha de Pagamento', 'Serviços de Terceiros', 'Aluguel/Infraestrutura', 'Tecnologia/Software', 'Consultoria', 'Outros']
                                : ['Mercado', 'Lazer', 'Saúde', 'Transporte', 'Moradia', 'Educação', 'Outros']
                              ).map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
