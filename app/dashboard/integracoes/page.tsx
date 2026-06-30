'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

type Tab = 'integracoes' | 'webhooks'
type Status = Record<string, boolean>

type Integration = {
  id: string
  icon: string
  iconColor: string
  iconBg: string
  nome: string
  desc: string
  categoria: 'core' | 'bancario' | 'fiscal' | 'erp' | 'comunicacao'
  statusKey?: string
  badge?: string
}

const INTEGRACOES: Integration[] = [
  { id: 'anthropic',   icon: 'fa-robot',            iconColor: '#5E4AEC', iconBg: '#EDE9FE', nome: 'FactorOne IA (Claude)',   desc: 'Motor do AI CFO — análise financeira, insights, chat.',          categoria: 'core',        statusKey: 'anthropic'  },
  { id: 'supabase',    icon: 'fa-database',          iconColor: '#3ECF8E', iconBg: '#D1FAE5', nome: 'Supabase',                desc: 'Banco de dados, autenticação e storage da plataforma.',           categoria: 'core',        statusKey: 'supabase'   },
  { id: 'openrouter',  icon: 'fa-network-wired',     iconColor: '#FF6B35', iconBg: '#FFEDD5', nome: 'OpenRouter',              desc: 'Análise DRE via múltiplos modelos de IA.',                        categoria: 'core',        statusKey: 'openrouter' },
  { id: 'stripe',      icon: 'fa-credit-card',       iconColor: '#635BFF', iconBg: '#EEF2FF', nome: 'Stripe',                  desc: 'Cobrança de assinaturas e pagamentos do FactorOne.',              categoria: 'core',        statusKey: 'stripe'     },
  { id: 'resend',      icon: 'fa-envelope',          iconColor: '#1E293B', iconBg: '#F1F5F9', nome: 'Resend',                  desc: 'Emails transacionais — notificações, aprovações, alertas.',       categoria: 'comunicacao', statusKey: 'resend'     },
  { id: 'whatsapp',    icon: 'fa-comment',           iconColor: '#25D366', iconBg: '#DCFCE7', nome: 'WhatsApp Business',       desc: 'Consultas financeiras e alertas via WhatsApp.',                   categoria: 'comunicacao', statusKey: 'whatsapp'   },
  { id: 'nfeio',       icon: 'fa-file-invoice',      iconColor: 'var(--teal)', iconBg: '#CFFAFE', nome: 'NFe.io',              desc: 'Emissão automática de NF-e e NFS-e.',                             categoria: 'fiscal',      statusKey: 'nfeio'      },
  { id: 'openfinance', icon: 'fa-building-columns',  iconColor: 'var(--navy)', iconBg: '#DBEAFE', nome: 'Open Finance',        desc: 'Conexão com bancos externos via Bacen — extrato automático.',     categoria: 'bancario',    badge: 'Em breve'       },
  { id: 'celcoin',     icon: 'fa-bolt',              iconColor: 'var(--gold)', iconBg: '#FEF9C3', nome: 'Celcoin',             desc: 'PIX, boleto, TED — infraestrutura de pagamentos.',                categoria: 'bancario',    badge: 'Em breve'       },
  { id: 'remessa',     icon: 'fa-globe',             iconColor: '#0891B2', iconBg: '#CFFAFE', nome: 'Remessa Online',          desc: 'Conta Global USD — pagamentos internacionais.',                   categoria: 'bancario',    badge: 'Em breve'       },
  { id: 'omie',        icon: 'fa-boxes-stacked',     iconColor: '#EA580C', iconBg: '#FFEDD5', nome: 'Omie ERP',               desc: 'Sync contábil automático com ERP.',                               categoria: 'erp',         badge: 'Em breve'       },
  { id: 'zapier',      icon: 'fa-gears',             iconColor: '#FF4A00', iconBg: '#FEF2F2', nome: 'Zapier / Make',           desc: 'Automações com mais de 5.000 apps externos.',                     categoria: 'erp',         badge: 'Em breve'       },
]

const CAT_LABELS: Record<string, string> = {
  core: 'Plataforma Core',
  bancario: 'Bancário & Pagamentos',
  fiscal: 'Fiscal & NF-e',
  erp: 'ERP & Automações',
  comunicacao: 'Comunicação',
}

const WEBHOOKS = [
  { id: 'gps', nome: 'GPS de Frota', path: '/api/logistica/gps-update', method: 'POST', auth: 'x-api-key: $LOGISTICA_GPS_SECRET', desc: 'Recebe atualizações de posição e status de rotas.', modulo: 'Logística', icon: 'fa-location-dot', color: 'var(--teal)' },
  { id: 'whatsapp', nome: 'WhatsApp Business', path: '/api/webhooks/whatsapp', method: 'POST/GET', auth: 'WHATSAPP_VERIFY_TOKEN', desc: 'Mensagens do WhatsApp Business API para o AI CFO.', modulo: 'Comunicação', icon: 'fa-comment', color: '#25D366' },
  { id: 'lifeos', nome: 'LifeOS / n8n', path: '/api/lifeos/webhook', method: 'POST', auth: 'x-lifeos-secret: $LIFEOS_WEBHOOK_SECRET', desc: 'Webhook para automações externas via LifeOS ou n8n.', modulo: 'Automação', icon: 'fa-bolt', color: 'var(--gold)' },
  { id: 'fornecedor', nome: 'Portal Fornecedor', path: '/fornecedor/[token]', method: 'GET/POST', auth: 'token na URL', desc: 'Fornecedores submetem dados e contas a pagar sem login.', modulo: 'Financeiro', icon: 'fa-truck', color: 'var(--navy)' },
  { id: 'cliente', nome: 'Portal do Cliente', path: '/cliente/[token]', method: 'GET', auth: 'token na URL', desc: 'Clientes visualizam faturas, entregas e contratos.', modulo: 'Clientes', icon: 'fa-users', color: '#7C3AED' },
]

export default function IntegracoesPage() {
  const [tab, setTab] = useState<Tab>('integracoes')
  const [status, setStatus] = useState<Status>({})
  const [loading, setLoading] = useState(true)
  const [baseUrl, setBaseUrl] = useState('')

  useEffect(() => {
    setBaseUrl(window.location.origin)
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

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {([['integracoes', 'Integrações'], ['webhooks', 'Webhooks & Endpoints']] as [Tab, string][]).map(([k, l]) => (
          <button key={k} className={`btn-action${tab !== k ? ' btn-ghost' : ''}`} style={{ fontSize: 11, padding: '5px 12px' }} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {/* ── Integrações ── */}
      {tab === 'integracoes' && <>

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
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-400)', letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: "'Manrope', 'Inter', sans-serif", marginBottom: 10 }}>
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
                      <div style={{ width: 38, height: 38, borderRadius: 9, background: item.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <i className={`fa-solid ${item.icon}`} style={{ color: item.iconColor, fontSize: 15 }} />
                      </div>
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
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: 'rgba(45,155,111,.1)', color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 }}><i className="fa-solid fa-circle-check" style={{ fontSize: 9 }} /> Ativo</span>
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

      </>}

      {/* ── Webhooks & Endpoints ── */}
      {tab === 'webhooks' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 4, lineHeight: 1.7 }}>
            Endpoints públicos e webhooks ativos no FactorOne. Copie a URL completa para configurar em sistemas externos.
          </div>
          {WEBHOOKS.map(wh => (
            <div key={wh.id} style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: `${wh.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                <i className={`fa-solid ${wh.icon}`} style={{ color: wh.color, fontSize: 15 }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>{wh.nome}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: 'var(--gray-100)', color: 'var(--gray-500)' }}>{wh.modulo}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: 'rgba(94,140,135,.1)', color: 'var(--teal)' }}>{wh.method}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 8 }}>{wh.desc}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', borderRadius: 6, padding: '6px 10px' }}>
                  <code style={{ fontSize: 11, color: 'var(--navy)', flex: 1, wordBreak: 'break-all' }}>{baseUrl}{wh.path}</code>
                  <button
                    className="btn-ghost"
                    style={{ fontSize: 10, padding: '2px 8px', flexShrink: 0 }}
                    onClick={() => { void navigator.clipboard.writeText(`${baseUrl}${wh.path}`); toast.success('URL copiada') }}
                  >
                    <i className="fa-regular fa-copy" />
                  </button>
                </div>
                <div style={{ fontSize: 10, color: 'var(--gray-400)', marginTop: 6 }}>
                  <i className="fa-solid fa-lock" style={{ marginRight: 4 }} />Auth: {wh.auth}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
