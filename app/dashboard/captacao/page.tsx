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

const CONECTORES: { nome: string; icon: string; cor: string; ativo: boolean; nota: string }[] = [
  { nome: 'Webhook / Zapier / Make', icon: 'fa-plug', cor: '#3D7A6E', ativo: true, nota: 'Cole a URL abaixo em qualquer ferramenta e conecte tudo.' },
  { nome: 'Formulário do site', icon: 'fa-window-maximize', cor: '#3D7A6E', ativo: true, nota: 'Aponte o form pra URL do webhook.' },
  { nome: 'RD Station', icon: 'fa-rocket', cor: '#7A6A9E', ativo: false, nota: 'Conector nativo em breve.' },
  { nome: 'Meta Ads (Lead Ads)', icon: 'fa-meta', cor: '#3D6E8E', ativo: false, nota: 'Conector nativo em breve.' },
  { nome: 'Google Ads', icon: 'fa-google', cor: '#B08A3E', ativo: false, nota: 'Conector nativo em breve.' },
  { nome: 'WhatsApp Business', icon: 'fa-whatsapp', cor: '#3D7A6E', ativo: false, nota: 'API oficial em breve.' },
]

export default function CaptacaoPage() {
  const [empresaId, setEmpresaId] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [pipeline, setPipeline] = useState(0)
  const [origin, setOrigin] = useState('')

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return
    const { data: sess } = await supabase.auth.getSession(); const tk = sess.session?.access_token ?? ''
    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const eid = (u?.empresa_id as string) ?? user.id; setEmpresaId(eid)
    try { const r = await fetch('/api/captacao/token', { headers: tk ? { Authorization: `Bearer ${tk}` } : {} }); const j = await r.json(); if (j.token) setToken(j.token) } catch { /* ignore */ }
    const { data: ld } = await supabase.from('marketing_leads').select('id,nome,email,telefone,origem,status,created_at').eq('empresa_id', eid).order('created_at', { ascending: false }).limit(100)
    setLeads((ld ?? []) as Lead[])
    const { data: ops } = await supabase.from('crm_oportunidades').select('valor,etapa').eq('empresa_id', eid)
    setPipeline(((ops ?? []) as { valor: number | null; etapa: string }[]).filter(o => !['fechado_ganho', 'fechado_perdido'].includes(o.etapa)).reduce((s, o) => s + Number(o.valor ?? 0), 0))
  }, [])
  useEffect(() => { void carregar(); setOrigin(window.location.origin) }, [carregar])

  const webhookUrl = token ? `${origin}/api/inbound?token=${token}` : ''

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
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-mut)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{k.lbl}</span>
              <i className={`fa-solid ${k.ic}`} style={{ fontSize: 12, color: k.cor }} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: k.cor, marginTop: 8, fontVariantNumeric: 'tabular-nums' }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Webhook — plugue sua solução */}
      <div className="txs-card" style={{ padding: '18px 20px', marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}><i className="fa-solid fa-plug" style={{ color: 'var(--sage)', marginRight: 8 }} />Plugue sua solução</div>
        <div style={{ fontSize: 12, color: 'var(--ink-mut)', marginBottom: 12 }}>Cole esta URL no Zapier/Make, no seu formulário ou em qualquer ferramenta. Todo lead cai aqui, já normalizado — não importa a origem.</div>
        {webhookUrl ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code style={{ flex: 1, fontSize: 12, background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px', overflow: 'auto', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>{webhookUrl}</code>
            <button className="btn-action" style={{ fontSize: 12 }} onClick={() => { void navigator.clipboard.writeText(webhookUrl); toast.success('URL copiada') }}><i className="fa-solid fa-copy" style={{ marginRight: 6 }} />Copiar</button>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--gold)' }}>Gerando token… se não aparecer, rode a migração <code>inbound_tokens</code> (SQL abaixo no chat).</div>
        )}
        <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', marginTop: 10 }}>Aceita campos comuns: nome/name, email, telefone/phone/whatsapp, origem/source. Envie via POST (JSON).</div>
      </div>

      {/* Conectores */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10, marginBottom: 16 }}>
        {CONECTORES.map(c => (
          <div key={c.nome} className="int-card" style={{ opacity: c.ativo ? 1 : .7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <i className={`fa-brands ${c.icon} fa-solid`} style={{ fontSize: 16, color: c.cor }} />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{c.nome}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-mut)', marginBottom: 8, lineHeight: 1.4 }}>{c.nota}</div>
            <span style={{ fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: c.ativo ? 'var(--sage)' : 'var(--ink-mut)' }}>
              <i className="fa-solid fa-circle" style={{ fontSize: 6, marginRight: 5 }} />{c.ativo ? 'Ativo' : 'Em breve'}
            </span>
          </div>
        ))}
      </div>

      {/* Leads */}
      <div className="txs-card">
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--line)', fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>Leads captados</div>
        {leads.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-mut)', fontSize: 13 }}>
            <i className="fa-solid fa-inbox" style={{ fontSize: 24, color: 'var(--sage)', display: 'block', marginBottom: 10 }} />
            Nenhum lead ainda. Cole a URL do webhook numa ferramenta e mande um teste — ele aparece aqui na hora.
          </div>
        ) : leads.map((l, i) => (
          <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '1fr 160px 110px 140px', gap: 12, alignItems: 'center', padding: '11px 18px', borderBottom: i < leads.length - 1 ? '1px solid var(--line-soft)' : 'none' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{l.nome || 'Lead'}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-mut)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[l.email, l.telefone].filter(Boolean).join(' · ') || '—'}</div>
            </div>
            <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}><i className="fa-solid fa-tag" style={{ marginRight: 5, fontSize: 9, color: 'var(--ink-mut)' }} />{l.origem || 'Webhook'}</span>
            <span style={{ justifySelf: 'start', fontSize: 9.5, fontWeight: 600, padding: '3px 9px', borderRadius: 100, textTransform: 'uppercase', letterSpacing: '.05em', color: l.status === 'convertido' ? 'var(--sage-deep)' : 'var(--gold)', background: l.status === 'convertido' ? 'var(--sage-tint)' : 'var(--gold-tint)' }}>{l.status}</span>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              {l.status !== 'convertido' && <button className="btn-action" style={{ fontSize: 11, padding: '6px 12px' }} onClick={() => void converter(l)}><i className="fa-solid fa-arrow-right" style={{ marginRight: 5 }} />Virar oportunidade</button>}
            </div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 12, lineHeight: 1.6 }}>
        <i className="fa-solid fa-circle-info" style={{ color: 'var(--sage)', marginRight: 6 }} />
        Modelo único (canônico): não importa a ferramenta, o lead entra igual. &quot;Virar oportunidade&quot; joga no CRM → pipeline → ao fechar, vira receita na DRE. O funil inteiro num lugar só.
      </div>
    </>
  )
}
