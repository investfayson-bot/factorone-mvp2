'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

type Status = Record<string, boolean>

type Integration = {
  id: string
  icon: string
  nome: string
  desc: string
  categoria: 'core' | 'bancario' | 'fiscal' | 'erp' | 'comunicacao'
  statusKey?: string
  badge?: string
}

const INTEGRACOES: Integration[] = [
  { id: 'anthropic', icon: '🧠', nome: 'FactorOne IA (Claude)', desc: 'Motor do AI CFO — análise financeira, insights, chat.', categoria: 'core', statusKey: 'anthropic' },
  { id: 'supabase', icon: '🗄️', nome: 'Supabase', desc: 'Banco de dados, autenticação e storage da plataforma.', categoria: 'core', statusKey: 'supabase' },
  { id: 'openrouter', icon: '🔀', nome: 'OpenRouter', desc: 'Análise DRE via múltiplos modelos de IA.', categoria: 'core', statusKey: 'openrouter' },
  { id: 'stripe', icon: '💳', nome: 'Stripe', desc: 'Cobrança de assinaturas e pagamentos do FactorOne.', categoria: 'core', statusKey: 'stripe' },
  { id: 'resend', icon: '✉️', nome: 'Resend', desc: 'Emails transacionais — notificações, aprovações, alertas.', categoria: 'comunicacao', statusKey: 'resend' },
  { id: 'nfeio', icon: '🧾', nome: 'NFe.io', desc: 'Emissão automática de NF-e e NFS-e.', categoria: 'fiscal', statusKey: 'nfeio' },
  { id: 'openfinance', icon: '🏦', nome: 'Open Finance', desc: 'Conexão com bancos externos via Bacen — extrato automático.', categoria: 'bancario', badge: 'Em breve' },
  { id: 'celcoin', icon: '⚡', nome: 'Celcoin', desc: 'PIX, boleto, TED — infraestrutura de pagamentos.', categoria: 'bancario', badge: 'Em breve' },
  { id: 'remessa', icon: '🌐', nome: 'Remessa Online', desc: 'Conta Global USD — pagamentos internacionais.', categoria: 'bancario', badge: 'Em breve' },
  { id: 'omie', icon: '🗂️', nome: 'Omie ERP', desc: 'Sync contábil automático com ERP.', categoria: 'erp', badge: 'Em breve' },
  { id: 'whatsapp', icon: '💬', nome: 'WhatsApp Business', desc: 'Consultas financeiras e alertas via WhatsApp.', categoria: 'comunicacao', badge: 'Em breve' },
  { id: 'zapier', icon: '⚙️', nome: 'Zapier / Make', desc: 'Automações com mais de 5.000 apps externos.', categoria: 'erp', badge: 'Em breve' },
]

const CAT_LABELS: Record<string, string> = {
  core: 'Plataforma Core',
  bancario: 'Bancário & Pagamentos',
  fiscal: 'Fiscal & NF-e',
  erp: 'ERP & Automações',
  comunicacao: 'Comunicação',
}

export default function IntegracoesPage() {
  const [status, setStatus] = useState<Status>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/integracoes/status')
      .then(r => r.ok ? r.json() as Promise<Status> : {})
      .then(d => setStatus(d as Status))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const ativas = INTEGRACOES.filter(i => i.statusKey && status[i.statusKey]).length
  const total = INTEGRACOES.filter(i => i.statusKey).length
  const categorias = Array.from(new Set(INTEGRACOES.map(i => i.categoria)))

  function acaoConectar(id: string) {
    if (['openfinance', 'whatsapp', 'celcoin', 'remessa', 'omie', 'zapier'].includes(id)) {
      toast('Em breve! Você será notificado quando estiver disponível.'); return
    }
    toast('Configure a variável de ambiente no painel Vercel (Settings → Environment Variables) e faça um novo deploy.', { duration: 5000 })
  }

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Hub de Integrações</div>
          <div className="page-sub">{loading ? '—' : `${ativas} de ${total} integrações ativas`}</div>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="kpi">
          <div className="kpi-lbl">Ativas</div>
          <div className="kpi-val" style={{ color: 'var(--green)' }}>{loading ? '—' : ativas}</div>
          <div className="kpi-delta up">configuradas</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Em breve</div>
          <div className="kpi-val">{INTEGRACOES.filter(i => i.badge).length}</div>
          <div className="kpi-delta">roadmap</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Total</div>
          <div className="kpi-val">{INTEGRACOES.length}</div>
          <div className="kpi-delta up">integrações</div>
        </div>
      </div>

      {/* Grupos */}
      {categorias.map(cat => {
        const itens = INTEGRACOES.filter(i => i.categoria === cat)
        return (
          <div key={cat} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-400)', letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: "'DM Mono',monospace", marginBottom: 10 }}>
              {CAT_LABELS[cat] ?? cat}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
              {itens.map(item => {
                const ativo = item.statusKey ? Boolean(status[item.statusKey]) : false
                const emBreve = Boolean(item.badge)
                return (
                  <div key={item.id} style={{
                    background: '#fff',
                    border: `1px solid ${ativo ? 'rgba(45,155,111,.25)' : 'var(--gray-100)'}`,
                    borderRadius: 12, padding: '14px 16px',
                    opacity: emBreve ? 0.75 : 1,
                    transition: 'box-shadow .15s',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                      <div style={{ fontSize: 22, lineHeight: 1, marginTop: 2 }}>{item.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>{item.nome}</div>
                          {item.badge && (
                            <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: 'rgba(124,58,237,.12)', color: '#7C3AED' }}>
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--gray-400)', lineHeight: 1.5 }}>{item.desc}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      {item.statusKey ? (
                        loading ? (
                          <div style={{ height: 18, width: 80, background: 'var(--gray-100)', borderRadius: 20, animation: 'pulse 1.5s infinite' }} />
                        ) : ativo ? (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: 'rgba(45,155,111,.1)', color: 'var(--green)' }}>✓ Ativo</span>
                        ) : (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: 'var(--gray-100)', color: 'var(--gray-400)' }}>Não configurado</span>
                        )
                      ) : (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: 'rgba(184,146,42,.1)', color: 'var(--gold)' }}>Em breve</span>
                      )}
                      {!ativo && (
                        <button onClick={() => acaoConectar(item.id)} style={{
                          fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--gray-100)',
                          background: 'transparent', color: emBreve ? 'var(--gray-400)' : 'var(--teal)',
                          cursor: 'pointer', fontWeight: 600,
                        }}>
                          {emBreve ? 'Avisar →' : 'Configurar →'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Instrução */}
      {!loading && ativas < total && (
        <div style={{ background: 'rgba(94,140,135,.04)', border: '1px solid rgba(94,140,135,.15)', borderRadius: 10, padding: '12px 16px', fontSize: 12, color: 'var(--gray-400)', lineHeight: 1.7 }}>
          <strong style={{ color: 'var(--navy)' }}>Como ativar integrações:</strong> Adicione as variáveis de ambiente no painel Vercel → Settings → Environment Variables. Após salvar, dispare um novo deploy para as mudanças entrarem em vigor.
        </div>
      )}
    </>
  )
}
