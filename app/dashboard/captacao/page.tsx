'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'
import toast from 'react-hot-toast'

/**
 * Captação — a "boca do funil". O usuário pluga QUALQUER ferramenta via webhook
 * (o tradutor universal): lead cai no modelo canônico (marketing_leads) →
 * converte em oportunidade (CRM) → vira pipeline (R$) → fecha → receita.
 */

type Lead = { id: string; nome: string | null; email: string | null; telefone: string | null; origem: string | null; status: string; created_at: string }

type Conector = { nome: string; icon: string; cor: string; ativo: boolean; nota: string; sistema?: string; ajudaChave?: string }
const CONECTORES: Conector[] = [
  { nome: 'Webhook / Zapier / Make', icon: 'fa-plug', cor: '#3D7A6E', ativo: true, nota: 'Cole a URL abaixo em qualquer ferramenta e conecte tudo.' },
  { nome: 'Formulário do site', icon: 'fa-window-maximize', cor: '#3D7A6E', ativo: true, nota: 'Aponte o form pra URL do webhook.' },
  { nome: 'RD Station', icon: 'fa-rocket', cor: '#7A6A9E', ativo: false, nota: 'Conecte com sua chave da RD.', sistema: 'rd_station', ajudaChave: 'Na RD Station: Integrações → Token de API.' },
  { nome: 'Meta Ads (Lead Ads)', icon: 'fa-facebook', cor: '#3D6E8E', ativo: false, nota: 'Conecte com o token da Meta.', sistema: 'meta_ads', ajudaChave: 'Token de acesso do seu App da Meta (Marketing API).' },
  { nome: 'Google Ads', icon: 'fa-google', cor: '#B08A3E', ativo: false, nota: 'Conecte com sua chave do Google Ads.', sistema: 'google_ads', ajudaChave: 'Developer token / OAuth do Google Ads.' },
  { nome: 'WhatsApp Business', icon: 'fa-whatsapp', cor: '#3D7A6E', ativo: false, nota: 'Conecte a API oficial.', sistema: 'whatsapp', ajudaChave: 'Token permanente do WhatsApp Cloud API.' },
]

export default function CaptacaoPage() {
  const [empresaId, setEmpresaId] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [pipeline, setPipeline] = useState(0)
  const [origin, setOrigin] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [configurados, setConfigurados] = useState<string[]>([])
  const [plugFor, setPlugFor] = useState<Conector | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [salvandoKey, setSalvandoKey] = useState(false)

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return
    const { data: sess } = await supabase.auth.getSession(); const tk = sess.session?.access_token ?? ''; setAuthToken(tk)
    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const eid = (u?.empresa_id as string) ?? user.id; setEmpresaId(eid)
    try { const r = await fetch('/api/captacao/token', { headers: tk ? { Authorization: `Bearer ${tk}` } : {} }); const j = await r.json(); if (j.token) setToken(j.token) } catch { /* ignore */ }
    try { const { data: ic } = await supabase.from('integracoes_config').select('sistema').eq('empresa_id', eid); setConfigurados(((ic ?? []) as { sistema: string }[]).map(x => x.sistema)) } catch { /* ignore */ }
    const { data: ld } = await supabase.from('marketing_leads').select('id,nome,email,telefone,origem,status,created_at').eq('empresa_id', eid).order('created_at', { ascending: false }).limit(100)
    setLeads((ld ?? []) as Lead[])
    const { data: ops } = await supabase.from('crm_oportunidades').select('valor,etapa').eq('empresa_id', eid)
    setPipeline(((ops ?? []) as { valor: number | null; etapa: string }[]).filter(o => !['fechado_ganho', 'fechado_perdido'].includes(o.etapa)).reduce((s, o) => s + Number(o.valor ?? 0), 0))
  }, [])
  useEffect(() => { void carregar(); setOrigin(window.location.origin) }, [carregar])

  const webhookUrl = token ? `${origin}/api/inbound?token=${token}` : ''
  const formUrl = token ? `${origin}/form/${token}` : ''
  const embedCode = formUrl ? `<iframe src="${formUrl}" width="440" height="560" style="border:none;max-width:100%"></iframe>` : ''

  async function plugarChave() {
    if (!plugFor?.sistema || !apiKey.trim()) { toast.error('Cole a chave da ferramenta'); return }
    setSalvandoKey(true)
    try {
      const r = await fetch('/api/integracoes/configurar', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) }, body: JSON.stringify({ sistema: plugFor.sistema, api_key: apiKey.trim() }) })
      if (!r.ok) throw new Error((await r.json()).error || 'Falha')
      toast.success(`${plugFor.nome} conectado ✓`)
      setPlugFor(null); setApiKey(''); void carregar()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro') }
    finally { setSalvandoKey(false) }
  }

  async function converter(l: Lead) {
    const { error } = await supabase.from('crm_oportunidades').insert({ empresa_id: empresaId, titulo: l.nome || 'Lead', etapa: 'prospeccao', probabilidade: 20, valor: null })
    if (error) { toast.error('Falha ao converter'); return }
    await supabase.from('marketing_leads').update({ status: 'convertido' }).eq('id', l.id)
    toast.success('Virou oportunidade no CRM — defina o valor lá')
    void carregar()
  }

  const captados = leads.length
  const convertidos = leads.filter(l => l.status === 'convertido').length
  const novos = leads.filter(l => l.status === 'novo').length

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Captação</div>
          <div className="page-sub">Plugue qualquer ferramenta e veja o lead virar dinheiro: captar → converter → pipeline → receita.</div>
        </div>
      </div>

      {/* Esteira / resultado */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 18 }}>
        {[
          { lbl: 'Leads captados', val: String(captados), cor: 'var(--navy)', ic: 'fa-inbox' },
          { lbl: 'Novos (a tratar)', val: String(novos), cor: 'var(--gold)', ic: 'fa-bell' },
          { lbl: 'Convertidos', val: String(convertidos), cor: 'var(--sage)', ic: 'fa-arrow-right-arrow-left' },
          { lbl: 'Pipeline (CRM)', val: formatBRL(pipeline), cor: 'var(--sage-deep)', ic: 'fa-sack-dollar' },
        ].map(k => (
          <div key={k.lbl} className="kpi" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-mut)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{k.lbl}</span>
              <i className={`fa-solid ${k.ic}`} style={{ fontSize: 14, color: k.cor }} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: k.cor, marginTop: 8, fontVariantNumeric: 'tabular-nums' }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Webhook — plugue sua solução */}
      <div className="txs-card" style={{ padding: '18px 20px', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}><i className="fa-solid fa-plug" style={{ color: 'var(--sage)', marginRight: 8 }} />Plugue sua solução</div>
        <div style={{ fontSize: 14, color: 'var(--ink-mut)', marginBottom: 12 }}>Cole esta URL no Zapier/Make, no seu formulário ou em qualquer ferramenta. Todo lead cai aqui, já normalizado — não importa a origem.</div>
        {webhookUrl ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code style={{ flex: 1, fontSize: 14, background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px', overflow: 'auto', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>{webhookUrl}</code>
            <button className="btn-action" style={{ fontSize: 14 }} onClick={() => { void navigator.clipboard.writeText(webhookUrl); toast.success('URL copiada') }}><i className="fa-solid fa-copy" style={{ marginRight: 6 }} />Copiar</button>
          </div>
        ) : (
          <div style={{ fontSize: 14, color: 'var(--gold)' }}>Gerando token… se não aparecer, rode a migração <code>inbound_tokens</code> (SQL abaixo no chat).</div>
        )}
        <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 10 }}>Aceita campos comuns: nome/name, email, telefone/phone/whatsapp, origem/source. Envie via POST (JSON).</div>
        {formUrl && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line-soft)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}><i className="fa-solid fa-window-maximize" style={{ color: 'var(--sage)', marginRight: 8 }} />Formulário pronto (não precisa nem ter site)</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a href={formUrl} target="_blank" rel="noreferrer" className="btn-ghost" style={{ fontSize: 14, textDecoration: 'none' }}><i className="fa-solid fa-arrow-up-right-from-square" style={{ marginRight: 6 }} />Abrir formulário</a>
              <button className="btn-ghost" style={{ fontSize: 14 }} onClick={() => { void navigator.clipboard.writeText(formUrl); toast.success('Link do formulário copiado') }}><i className="fa-solid fa-link" style={{ marginRight: 6 }} />Copiar link</button>
              <button className="btn-ghost" style={{ fontSize: 14 }} onClick={() => { void navigator.clipboard.writeText(embedCode); toast.success('Código de incorporação copiado') }}><i className="fa-solid fa-code" style={{ marginRight: 6 }} />Copiar embed</button>
            </div>
          </div>
        )}
      </div>

      {/* Conectores */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10, marginBottom: 16 }}>
        {CONECTORES.map(c => (
          <div key={c.nome} className="int-card" style={{ opacity: c.ativo ? 1 : .7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <i className={`fa-brands ${c.icon} fa-solid`} style={{ fontSize: 16, color: c.cor }} />
              <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink)' }}>{c.nome}</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-mut)', marginBottom: 8, lineHeight: 1.4 }}>{c.nota}</div>
            {c.ativo ? (
              <span style={{ fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--sage)' }}><i className="fa-solid fa-circle" style={{ fontSize: 6, marginRight: 5 }} />Ativo</span>
            ) : c.sistema && configurados.includes(c.sistema) ? (
              <span style={{ fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--sage-deep)' }}><i className="fa-solid fa-circle-check" style={{ marginRight: 5 }} />Conectado</span>
            ) : c.sistema ? (
              <button className="btn-ghost" style={{ fontSize: 13, padding: '5px 12px' }} onClick={() => { setPlugFor(c); setApiKey('') }}><i className="fa-solid fa-key" style={{ marginRight: 6 }} />Conectar</button>
            ) : (
              <span style={{ fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-mut)' }}>Em breve</span>
            )}
          </div>
        ))}
      </div>

      {/* Leads */}
      <div className="txs-card">
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--line)', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Leads captados</div>
        {leads.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-mut)', fontSize: 15 }}>
            <i className="fa-solid fa-inbox" style={{ fontSize: 24, color: 'var(--sage)', display: 'block', marginBottom: 10 }} />
            Nenhum lead ainda. Cole a URL do webhook numa ferramenta e mande um teste — ele aparece aqui na hora.
          </div>
        ) : leads.map((l, i) => (
          <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '1fr 160px 110px 140px', gap: 12, alignItems: 'center', padding: '11px 18px', borderBottom: i < leads.length - 1 ? '1px solid var(--line-soft)' : 'none' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>{l.nome || 'Lead'}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-mut)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[l.email, l.telefone].filter(Boolean).join(' · ') || '—'}</div>
            </div>
            <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}><i className="fa-solid fa-tag" style={{ marginRight: 5, fontSize: 11, color: 'var(--ink-mut)' }} />{l.origem || 'Webhook'}</span>
            <span style={{ justifySelf: 'start', fontSize: 11.5, fontWeight: 600, padding: '3px 9px', borderRadius: 100, textTransform: 'uppercase', letterSpacing: '.05em', color: l.status === 'convertido' ? 'var(--sage-deep)' : 'var(--gold)', background: l.status === 'convertido' ? 'var(--sage-tint)' : 'var(--gold-tint)' }}>{l.status}</span>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              {l.status !== 'convertido' && <button className="btn-action" style={{ fontSize: 13, padding: '6px 12px' }} onClick={() => void converter(l)}><i className="fa-solid fa-arrow-right" style={{ marginRight: 5 }} />Virar oportunidade</button>}
            </div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 13, color: 'var(--ink-faint)', marginTop: 12, lineHeight: 1.6 }}>
        <i className="fa-solid fa-circle-info" style={{ color: 'var(--sage)', marginRight: 6 }} />
        Modelo único (canônico): não importa a ferramenta, o lead entra igual. &quot;Virar oportunidade&quot; joga no CRM → pipeline → ao fechar, vira receita na DRE. O funil inteiro num lugar só.
      </div>

      {/* Modal — plugar a chave do conector */}
      {plugFor && (
        <div className="modal-bg" onClick={() => setPlugFor(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div className="modal-title">Conectar {plugFor.nome}</div>
              <button className="modal-close" onClick={() => setPlugFor(null)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div style={{ fontSize: 14, color: 'var(--ink-mut)', marginBottom: 16 }}>Cole a chave/token da ferramenta. Fica guardada com segurança na sua conta.{plugFor.ajudaChave ? ` ${plugFor.ajudaChave}` : ''}</div>
            <div className="form-group"><label className="form-label">Chave / Token de API</label><input className="form-input" type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="cole aqui" autoFocus /></div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginBottom: 4 }}>A sincronização automática do lead entra em breve — a chave já fica plugada e pronta.</div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setPlugFor(null)}>Cancelar</button>
              <button className="btn-action" disabled={salvandoKey} onClick={() => void plugarChave()}>{salvandoKey ? 'Salvando…' : 'Conectar'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
