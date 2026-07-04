// Catálogo único do Marketplace + estado de instalação (persistido em localStorage).
// Usado pela página /dashboard/marketplace e pela sidebar (app instalado vira item de menu).

export type MarketCat = 'financeiro' | 'operacional' | 'vendas' | 'rh' | 'fiscal'

export type MarketApp = {
  id: string
  name: string
  icon: string
  iconColor: string
  iconBg: string
  rating: number
  rev: number
  desc: string
  badge: 'popular' | 'new' | ''
  cat: MarketCat
  /** Grupo da sidebar onde o app aparece quando instalado. */
  navGroup: string
  /** Destino do app. Página real quando existe; senão, placeholder /dashboard/app/[id]. */
  href: string
  /** true se há uma página dedicada (não placeholder). */
  hasPage: boolean
}

export const MARKET_APPS: MarketApp[] = [
  { id: 'classificar', name: 'Classificação IA',    icon: 'fa-layer-group',        iconColor: '#3D7A6E', iconBg: '#E9F0ED', rating: 4.9, rev: 148, desc: 'Caixa única banco+cartão. A IA categoriza, aprende com você e classifica sozinha.', badge: 'new', cat: 'financeiro', navGroup: 'Gestão financeira', href: '/dashboard/classificar', hasPage: true },
  { id: 'cfoia',       name: 'CFO IA',              icon: 'fa-robot',              iconColor: '#2B564D', iconBg: '#E9F0ED', rating: 5.0, rev: 176, desc: 'Analisa seus números, projeta o caixa e gera relatório — um CFO digital.',        badge: 'popular', cat: 'financeiro', navGroup: 'Visão geral',       href: '/dashboard/aicfo',       hasPage: true },
  { id: 'captacao',    name: 'Captação de Leads',   icon: 'fa-magnet',             iconColor: '#3D7A6E', iconBg: '#E9F0ED', rating: 4.9, rev: 64,  desc: 'Plugue qualquer ferramenta (webhook/Zapier/RD/Meta) e transforme lead em receita: captar → CRM → pipeline → DRE.', badge: 'new', cat: 'vendas', navGroup: 'Clientes & Vendas', href: '/dashboard/captacao', hasPage: true },
  { id: 'banco',       name: 'Banco PJ',            icon: 'fa-building-columns',   iconColor: '#0F6E56', iconBg: '#EAF5F3', rating: 4.9, rev: 210, desc: 'Conta, cartões, PIX, crédito e Open Finance — seu banco digital.', badge: 'popular', cat: 'financeiro', navGroup: 'Banco',              href: '/dashboard/conta-pj',      hasPage: true },
  { id: 'indicadores', name: 'Indicadores',         icon: 'fa-gauge-high',         iconColor: '#5E8C87', iconBg: '#EAF5F3', rating: 4.8, rev: 96,  desc: 'LTV, CAC, MRR, ROI, ROIC, burn e runway + taxas de mercado.',      badge: 'new',     cat: 'financeiro', navGroup: 'Gestão financeira',  href: '/dashboard/indicadores',   hasPage: true },
  { id: 'ma',          name: 'M&A',                 icon: 'fa-handshake-angle',    iconColor: '#7C3AED', iconBg: '#EDE9FE', rating: 4.7, rev: 41,  desc: 'Valuation por múltiplos + checklist de due diligence.',            badge: '',        cat: 'financeiro', navGroup: 'Gestão financeira',  href: '/dashboard/ma',            hasPage: true },
  { id: 'juridico',    name: 'Jurídico',            icon: 'fa-scale-balanced',     iconColor: '#1C2B2A', iconBg: '#EEF2F1', rating: 4.6, rev: 58,  desc: 'Contratos, societário, marca, compliance — empresa e PF.',         badge: 'new',     cat: 'fiscal',     navGroup: 'Contabilidade',      href: '/dashboard/juridico',      hasPage: true },
  { id: 'prefeituras', name: 'Prefeituras & NFS-e', icon: 'fa-landmark',           iconColor: '#B8922A', iconBg: '#FEF3C7', rating: 4.7, rev: 63,  desc: 'Todas as prefeituras do Brasil + emissão de NFS-e.',               badge: '',        cat: 'fiscal',     navGroup: 'Contabilidade',      href: '/dashboard/prefeituras',   hasPage: true },
  { id: 'crm',       name: 'CRM',                    icon: 'fa-handshake',          iconColor: '#1E40AF', iconBg: '#DBEAFE', rating: 4.8, rev: 120, desc: 'Gestão de leads, contatos e pipeline de vendas.',   badge: 'popular', cat: 'vendas',      navGroup: 'Clientes & Vendas',      href: '/dashboard/crm',                hasPage: true  },
  { id: 'mkt',       name: 'Marketing',              icon: 'fa-bullhorn',           iconColor: '#C2410C', iconBg: '#FFEDD5', rating: 4.7, rev: 105, desc: 'Automatize campanhas de email e anúncios.',         badge: 'new',     cat: 'vendas',      navGroup: 'Clientes & Vendas',      href: '/dashboard/marketing/central',  hasPage: true  },
  { id: 'logistica', name: 'Logística',              icon: 'fa-truck-fast',         iconColor: '#0E7490', iconBg: '#CFFAFE', rating: 4.7, rev: 92,  desc: 'Rotas, fretes, entregas e rastreamento GPS.',       badge: 'new',     cat: 'operacional', navGroup: 'Operacional',            href: '/dashboard/logistica',          hasPage: true  },
  { id: 'sales',     name: 'Sales Pipeline',         icon: 'fa-arrow-trend-up',     iconColor: '#166534', iconBg: '#DCFCE7', rating: 4.9, rev: 85,  desc: 'Acompanhe e preveja oportunidades de venda.',       badge: 'new',     cat: 'vendas',      navGroup: 'Clientes & Vendas',      href: '/dashboard/pipeline',           hasPage: true  },
  { id: 'prop',      name: 'Propostas Comerciais',   icon: 'fa-file-signature',     iconColor: '#BE185D', iconBg: '#FCE7F3', rating: 4.8, rev: 88,  desc: 'Crie e envie propostas e orçamentos.',              badge: '',        cat: 'vendas',      navGroup: 'Clientes & Vendas',      href: '/dashboard/propostas',          hasPage: true  },
  { id: 'ar',        name: 'Contas a Receber Plus',  icon: 'fa-file-invoice-dollar',iconColor: '#065F46', iconBg: '#D1FAE5', rating: 4.6, rev: 75,  desc: 'Automatize cobranças e controle inadimplência.',    badge: '',        cat: 'financeiro',  navGroup: 'Financeiro',             href: '/dashboard/financeiro/receber', hasPage: true  },
  { id: 'sub',       name: 'Subscription Billing',   icon: 'fa-rotate',             iconColor: '#1E3A5F', iconBg: '#E0E7FF', rating: 4.7, rev: 102, desc: 'Assinaturas e cobranças recorrentes.',              badge: 'new',     cat: 'financeiro',  navGroup: 'Financeiro',             href: '/dashboard/cobrancas',          hasPage: true  },
  { id: 'budget',    name: 'Budget & Forecast',      icon: 'fa-chart-pie',          iconColor: '#0E7490', iconBg: '#CFFAFE', rating: 4.5, rev: 64,  desc: 'Planejamento orçamentário e previsão.',             badge: '',        cat: 'financeiro',  navGroup: 'Financeiro',             href: '/dashboard/orcamento',          hasPage: true  },
  { id: 'invest',    name: 'Investimentos',          icon: 'fa-chart-line',         iconColor: '#166534', iconBg: '#DCFCE7', rating: 4.8, rev: 71,  desc: 'Carteira de investimentos da empresa: aplicado, rendimento e vencimentos.', badge: 'new', cat: 'financeiro', navGroup: 'Banco', href: '/dashboard/conta-pj/investimentos', hasPage: true },
  { id: 'inv',       name: 'Gestão de Estoque',      icon: 'fa-boxes-stacked',      iconColor: '#92400E', iconBg: '#FEF3C7', rating: 4.6, rev: 75,  desc: 'Controle de produtos, pedidos e movimentações.',    badge: '',        cat: 'operacional', navGroup: 'Operacional',            href: '/dashboard/estoque',            hasPage: true  },
  { id: 'contract',  name: 'Contratos Digitais',     icon: 'fa-file-contract',      iconColor: '#374151', iconBg: '#F3F4F6', rating: 4.4, rev: 55,  desc: 'Gestão com assinatura digital integrada.',          badge: '',        cat: 'operacional', navGroup: 'Operacional',            href: '/dashboard/contratos',          hasPage: true  },
  { id: 'payroll',   name: 'Folha de Pagamento',     icon: 'fa-users-gear',         iconColor: '#6B21A8', iconBg: '#EDE9FE', rating: 4.7, rev: 98,  desc: 'Holerites, encargos, eSocial e FGTS.',              badge: 'popular', cat: 'rh',          navGroup: 'Configurações',          href: '/dashboard/folha',              hasPage: true  },
  { id: 'hr',        name: 'RH & Benefícios',        icon: 'fa-heart-pulse',        iconColor: '#BE123C', iconBg: '#FFE4E6', rating: 4.6, rev: 90,  desc: 'Férias, ponto, benefícios e colaboradores.',        badge: '',        cat: 'rh',          navGroup: 'Configurações',          href: '/dashboard/rh',                 hasPage: true  },
  { id: 'tax',       name: 'Tax Compliance',         icon: 'fa-scale-balanced',     iconColor: '#1D4ED8', iconBg: '#DBEAFE', rating: 4.8, rev: 69,  desc: 'Conformidade fiscal e obrigações acessórias.',      badge: 'new',     cat: 'fiscal',      navGroup: 'Contabilidade & Fiscal', href: '/dashboard/tax',                hasPage: true  },
  { id: 'simples',   name: 'Simples Nacional (DAS)', icon: 'fa-calculator',         iconColor: '#1D4ED8', iconBg: '#DBEAFE', rating: 4.7, rev: 58,  desc: 'Estimador de DAS e alíquota efetiva (Anexos I–V).', badge: 'new',     cat: 'fiscal',      navGroup: 'Contabilidade & Fiscal', href: '/dashboard/simples',            hasPage: true  },
]

import { supabase } from '@/lib/supabase'

export function appById(id: string): MarketApp | undefined {
  return MARKET_APPS.find(a => a.id === id)
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
}

/** Lista os apps instalados (por empresa/usuário, via banco com RLS). */
export async function fetchInstalledIds(): Promise<string[]> {
  try {
    const res = await fetch('/api/apps', { headers: await authHeaders() })
    const d = await res.json()
    return res.ok ? (d.apps ?? []) : []
  } catch { return [] }
}

/** Instala/desinstala no banco e avisa a sidebar. */
export async function setInstalled(appId: string, install: boolean): Promise<void> {
  await fetch('/api/apps', {
    method: install ? 'POST' : 'DELETE',
    headers: await authHeaders(),
    body: JSON.stringify({ app_id: appId }),
  })
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('fo-apps-changed'))
}
