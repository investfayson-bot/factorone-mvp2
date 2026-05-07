'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import LoadingButton from '@/components/ui/LoadingButton'
import { useToast } from '@/components/ui/useToast'
import { fmtBRLCompact } from '@/lib/dre-calculations'
import { type AnexoSimples } from '@/lib/fiscal/simples-nacional'
import { formatBRL } from '@/lib/currency-brl'

type DASResult = {
  rbt12: number
  receitaMes: number
  faixa: number
  aliquotaNominal: number
  aliquotaEfetiva: number
  valorDAS: number
  vencimento: string
  competencia: string
  dentroDoLimite: boolean
  alertas: string[]
}

const TABS: [string, string][] = [
  ['visao', 'Visão Geral'],
  ['recibos', 'Recibos'],
  ['lancamentos', 'Lançamentos'],
  ['exportacoes', 'Exportações'],
  ['tributacao', 'Tributação IA'],
]

export default function ContabilidadePage() {
  const toast = useToast()
  const [tab, setTab] = useState<'visao' | 'recibos' | 'lancamentos' | 'exportacoes' | 'tributacao'>('visao')
  const [bannerAberto, setBannerAberto] = useState(false)
  const [loadingUpload, setLoadingUpload] = useState(false)
  const [recibos, setRecibos] = useState<Array<{ id: string; status: string; fornecedor_extraido: string | null; valor_extraido: number | null; data_extraida: string | null; categoria_sugerida: string | null }>>([])
  const [contadores, setContadores] = useState<Array<{ id: string; nome: string; email: string; status: string; crc: string | null; token_acesso: string }>>([])
  const [formCont, setFormCont] = useState({ nome: '', email: '', crc: '', telefone: '' })
  const [loadingConvite, setLoadingConvite] = useState(false)
  const [das, setDas] = useState<DASResult | null>(null)
  const [dasLoading, setDasLoading] = useState(false)
  const [dasAnexo, setDasAnexo] = useState<AnexoSimples>('III')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) return
      const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', auth.user.id).maybeSingle()
      const empresaId = (u?.empresa_id as string) || auth.user.id
      const [r, c] = await Promise.all([
        supabase.from('recibos_fotografados').select('id,status,fornecedor_extraido,valor_extraido,data_extraida,categoria_sugerida').eq('empresa_id', empresaId).order('created_at', { ascending: false }).limit(20),
        supabase.from('contadores').select('id,nome,email,status,crc,token_acesso').eq('empresa_id', empresaId).order('created_at', { ascending: false }),
      ])
      if (!cancelled) {
        setRecibos((r.data || []) as typeof recibos)
        setContadores((c.data || []) as typeof contadores)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const kpi = useMemo(() => {
    const total = recibos.length
    const lancados = recibos.filter((x) => x.status === 'lancado').length
    const pend = recibos.filter((x) => x.status === 'extraido' || x.status === 'processando').length
    return { total, classificadosPct: total ? (lancados / total) * 100 : 0, pend }
  }, [recibos])

  async function uploadRecibo(file: File) {
    setLoadingUpload(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const { data: sess } = await supabase.auth.getSession()
      const res = await fetch('/api/contabilidade/processar-recibo', {
        method: 'POST',
        headers: sess.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {},
        body: form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Falha no processamento')
      toast.success(data?.lancado_automaticamente ? 'Recibo lançado automaticamente' : 'Recibo extraído para revisão')
      setRecibos((prev) => [{
        id: data.recibo_id,
        status: data.lancado_automaticamente ? 'lancado' : 'extraido',
        fornecedor_extraido: data.dados_extraidos?.fornecedor || null,
        valor_extraido: data.dados_extraidos?.valor || null,
        data_extraida: data.dados_extraidos?.data || null,
        categoria_sugerida: data.dados_extraidos?.categoria || null,
      }, ...prev])
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro no upload')
    } finally {
      setLoadingUpload(false)
    }
  }

  async function convidarContador() {
    setLoadingConvite(true)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const res = await fetch('/api/contabilidade/convidar-contador', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(sess.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {}) },
        body: JSON.stringify(formCont),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Falha ao convidar')
      toast.success('Contador convidado')
      setFormCont({ nome: '', email: '', crc: '', telefone: '' })
      setContadores((prev) => [{
        id: data.contador_id,
        nome: formCont.nome,
        email: formCont.email,
        status: 'convidado',
        crc: formCont.crc || null,
        token_acesso: data.access_url?.split('/').pop() || '',
      }, ...prev])
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao convidar contador')
    } finally {
      setLoadingConvite(false)
    }
  }

  const carregarDAS = useCallback(async (anexo: AnexoSimples) => {
    setDasLoading(true)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const headers: Record<string, string> = {}
      if (sess.session?.access_token) headers['Authorization'] = `Bearer ${sess.session.access_token}`
      const res = await fetch(`/api/fiscal/das?anexo=${anexo}`, { headers })
      const data = await res.json() as DASResult
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Falha')
      setDas(data)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao calcular DAS')
    } finally {
      setDasLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (tab === 'tributacao' && !das) void carregarDAS(dasAnexo)
  }, [tab, das, dasAnexo, carregarDAS])

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Contabilidade</div>
          <div className="page-sub">Recibos, lançamentos, portal do contador e exportações</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(94,140,135,.08)', border: '1px solid rgba(94,140,135,.25)', borderRadius: 20, padding: '5px 12px' }}>
          <div className="live-dot" style={{ width: 6, height: 6 }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--teal)', letterSpacing: '.04em' }}>Tempo Real</span>
        </div>
      </div>

      {/* Banner Portal Contador */}
      <div style={{ background: 'linear-gradient(90deg, var(--navy) 0%, #1e3a5f 100%)', borderRadius: 12, padding: '16px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fa-solid fa-user-tie" style={{ color: '#fff', fontSize: 16 }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Portal do Contador</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.6)', marginTop: 2 }}>
              {contadores.length > 0 ? `${contadores.filter(c => c.status === 'ativo').length} contador(es) com acesso ativo` : 'Compartilhe acesso contábil com seu contador'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {contadores.filter(c => c.status === 'ativo').map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                const url = `${window.location.origin}/contador/${c.token_acesso}`
                void navigator.clipboard.writeText(url)
                toast.success(`Link de ${c.nome} copiado`)
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 600, color: '#fff', cursor: 'pointer' }}
            >
              <i className="fa-solid fa-link" style={{ fontSize: 10 }} />
              {c.nome}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setBannerAberto(v => !v)}
            style={{ background: 'var(--teal)', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 11, fontWeight: 700, color: '#fff', cursor: 'pointer' }}
          >
            {bannerAberto ? 'Fechar' : '+ Convidar contador'}
          </button>
        </div>
      </div>

      {bannerAberto && (
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>Novo acesso para contador</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
            <input className="form-input" placeholder="Nome" value={formCont.nome} onChange={(e) => setFormCont((f) => ({ ...f, nome: e.target.value }))} />
            <input className="form-input" placeholder="Email" value={formCont.email} onChange={(e) => setFormCont((f) => ({ ...f, email: e.target.value }))} />
            <input className="form-input" placeholder="CRC" value={formCont.crc} onChange={(e) => setFormCont((f) => ({ ...f, crc: e.target.value }))} />
            <input className="form-input" placeholder="Telefone" value={formCont.telefone} onChange={(e) => setFormCont((f) => ({ ...f, telefone: e.target.value }))} />
          </div>
          <div style={{ textAlign: 'right' }}>
            <LoadingButton loading={loadingConvite} loadingText="Convidando..." onClick={convidarContador} className="btn-action">
              Gerar link de acesso
            </LoadingButton>
          </div>
        </div>
      )}

      <div className="kpis" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="kpi">
          <div className="kpi-lbl">Lançamentos do mês</div>
          <div className="kpi-val">{kpi.total}</div>
          <div className="kpi-delta">total recibos</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Classificados %</div>
          <div className="kpi-val" style={{ color: kpi.classificadosPct >= 80 ? 'var(--teal)' : 'var(--gold)' }}>{kpi.classificadosPct.toFixed(0)}%</div>
          <div className={`kpi-delta ${kpi.classificadosPct >= 80 ? 'up' : 'warn'}`}>{kpi.classificadosPct >= 80 ? '✓ ok' : '⚠ atenção'}</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Pendentes</div>
          <div className="kpi-val" style={{ color: kpi.pend > 0 ? 'var(--gold)' : 'var(--navy)' }}>{kpi.pend}</div>
          <div className={`kpi-delta ${kpi.pend > 0 ? 'warn' : 'up'}`}>{kpi.pend > 0 ? '⚠ revisar' : '✓ ok'}</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Último fechamento</div>
          <div className="kpi-val" style={{ fontSize: 14 }}>em andamento</div>
          <div className="kpi-delta">mês atual</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id as typeof tab)}
            style={{
              padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid',
              background: tab === id ? 'var(--navy)' : '#fff',
              color: tab === id ? '#fff' : 'var(--gray-500)',
              borderColor: tab === id ? 'var(--navy)' : 'var(--gray-100)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'visao' && (
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginBottom: 16 }}>Fluxo contábil</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[['📷', 'Foto'], ['🧠', 'IA Extrai'], ['📊', 'DRE Atualizado'], ['👤', 'Contador Valida']].map(([icon, title]) => (
              <div key={title} style={{ background: 'rgba(94,140,135,.04)', border: '1px solid var(--gray-100)', borderRadius: 10, padding: '14px 12px' }}>
                <div style={{ fontSize: 20, marginBottom: 8 }}>{icon}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>{title}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'recibos' && (
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginBottom: 14 }}>Captura de recibos</div>
          <label style={{ display: 'flex', minHeight: 120, cursor: 'pointer', alignItems: 'center', justifyContent: 'center', borderRadius: 10, border: '2px dashed var(--gray-100)', background: '#fafafa', fontSize: 13, color: 'var(--gray-400)' }}>
            <span>📎 Arraste ou selecione imagem/PDF</span>
            <input
              type="file"
              accept="image/*,application/pdf"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void uploadRecibo(f)
                e.currentTarget.value = ''
              }}
            />
          </label>
          <div style={{ marginTop: 10, textAlign: 'right' }}>
            <LoadingButton loading={loadingUpload} loadingText="Processando..." className="btn-action">
              Aguardando envio
            </LoadingButton>
          </div>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recibos.map((r) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, border: '1px solid var(--gray-100)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{r.fornecedor_extraido || 'Recibo'}</span>
                <span style={{ color: 'var(--gray-400)' }}>{r.categoria_sugerida || '—'}</span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700 }}>{r.valor_extraido ? fmtBRLCompact(Number(r.valor_extraido)) : '—'}</span>
                <span className="tag gray">{r.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'lancamentos' && (
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: '20px 16px', fontSize: 13, color: 'var(--gray-400)' }}>
          Tabela de lançamentos contábeis será conectada ao livro razão na próxima etapa.
        </div>
      )}

      {tab === 'exportacoes' && (
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: '20px 16px', fontSize: 13, color: 'var(--gray-400)' }}>
          Exportações contábeis (SPED/ECD/ECF) prontas para integração em próximo bloco.
        </div>
      )}

      {tab === 'tributacao' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>Simples Nacional — DAS Estimado</div>
              <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>Baseado nas transações registradas · tabelas 2024</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>Anexo</span>
              <select
                className="form-input"
                style={{ width: 'auto', padding: '5px 10px', fontSize: 11 }}
                value={dasAnexo}
                onChange={e => { const v = e.target.value as AnexoSimples; setDasAnexo(v); setDas(null) }}
              >
                <option value="I">Anexo I — Comércio</option>
                <option value="II">Anexo II — Indústria</option>
                <option value="III">Anexo III — Serviços (geral)</option>
                <option value="IV">Anexo IV — Serviços (profissional)</option>
                <option value="V">Anexo V — Serviços (TI/publicidade)</option>
              </select>
              <LoadingButton
                loading={dasLoading}
                onClick={() => { setDas(null); void carregarDAS(dasAnexo) }}
                className="btn-ghost"
                style={{ padding: '5px 12px', fontSize: 11 }}
              >
                Recalcular
              </LoadingButton>
            </div>
          </div>

          {dasLoading && (
            <div style={{ height: 120, background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12 }} />
          )}

          {das && !dasLoading && (
            <>
              <div className="kpis" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                <div className="kpi">
                  <div className="kpi-lbl">DAS estimado</div>
                  <div className="kpi-val" style={{ color: 'var(--red)' }}>{formatBRL(das.valorDAS)}</div>
                  <div className="kpi-delta dn">Competência {das.competencia}</div>
                </div>
                <div className="kpi">
                  <div className="kpi-lbl">Alíquota efetiva</div>
                  <div className="kpi-val">{(das.aliquotaEfetiva * 100).toFixed(2)}%</div>
                  <div className="kpi-delta">Nominal {(das.aliquotaNominal * 100).toFixed(1)}% · Faixa {das.faixa}</div>
                </div>
                <div className="kpi">
                  <div className="kpi-lbl">Receita do mês</div>
                  <div className="kpi-val" style={{ color: 'var(--teal)' }}>{fmtBRLCompact(das.receitaMes)}</div>
                  <div className="kpi-delta">RBT12 {fmtBRLCompact(das.rbt12)}</div>
                </div>
                <div className="kpi">
                  <div className="kpi-lbl">Vencimento DAS</div>
                  <div className="kpi-val" style={{ fontSize: 16 }}>{das.vencimento.split('-').reverse().join('/')}</div>
                  <div className="kpi-delta">Todo dia 20</div>
                </div>
              </div>

              {das.alertas.length > 0 && (
                <div style={{ background: 'rgba(234,179,8,.06)', border: '1px solid rgba(234,179,8,.3)', borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--gold)', marginBottom: 8 }}>Alertas fiscais</div>
                  {das.alertas.map((a, i) => (
                    <div key={i} style={{ fontSize: 13, color: '#92400e', marginBottom: 4 }}>{a}</div>
                  ))}
                </div>
              )}

              <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: '18px 16px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginBottom: 12 }}>Composição da alíquota</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--gray-400)' }}>
                    <span>Receita bruta mensal</span>
                    <span style={{ fontWeight: 700, color: 'var(--navy)' }}>{formatBRL(das.receitaMes)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--gray-400)' }}>
                    <span>RBT12 (base de cálculo)</span>
                    <span style={{ fontWeight: 700, color: 'var(--navy)' }}>{formatBRL(das.rbt12)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--gray-400)' }}>
                    <span>Alíquota nominal (faixa {das.faixa})</span>
                    <span style={{ fontWeight: 700, color: 'var(--navy)' }}>{(das.aliquotaNominal * 100).toFixed(2)}%</span>
                  </div>
                  <div style={{ borderTop: '1px solid var(--gray-100)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--navy)' }}>
                    <span>DAS a recolher</span>
                    <span style={{ color: 'var(--red)' }}>{formatBRL(das.valorDAS)}</span>
                  </div>
                </div>
                <div style={{ marginTop: 14, fontSize: 11, color: 'var(--gray-400)', lineHeight: 1.6 }}>
                  Estimativa baseada nas transações registradas. Valores definitivos devem ser gerados pelo PGDAS-D no portal do Simples Nacional.
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
