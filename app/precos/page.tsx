'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import EditorialBanner from '@/components/ui/EditorialBanner'
import toast from 'react-hot-toast'

type TabTipo = 'pf' | 'pj' | 'familia'

const PLANOS = {
  pf: [
    {
      key: 'starter_pf', nome: 'Starter PF', preco: 'Grátis', subPreco: '30 dias · sem cartão',
      badge: '30 dias grátis', badgeBg: '#F1EFE8', badgeColor: '#5F5E5A', priceId: null, destaque: false,
      features: ['Dashboard financeiro pessoal','Controle de gastos e receitas','Fluxo de caixa pessoal','FactorOne AI (5x por dia)'],
      nao: ['Metas financeiras','Relatórios exportáveis','Conexão bancária','Planejamento de IR'],
    },
    {
      key: 'pessoal', nome: 'Pessoal', preco: 'R$ 47', subPreco: '/mês',
      badge: 'Mais popular PF', badgeBg: '#EAF3DE', badgeColor: '#3B6D11',
      priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PESSOAL || '', destaque: false,
      features: ['Tudo do Starter PF','Metas financeiras','Categorias personalizadas','Relatórios PDF e Excel','FactorOne AI ilimitado','Alertas de gastos'],
      nao: ['Open Finance (bancos)','Planejamento de IR'],
    },
    {
      key: 'premium_pf', nome: 'Premium PF', preco: 'R$ 97', subPreco: '/mês',
      badge: 'Completo', badgeBg: '#E9F0ED', badgeColor: '#2B564D',
      priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_PF || '', destaque: true,
      features: ['Tudo do Pessoal','Open Finance (3 bancos)','Planejamento de investimentos','Organizador de IR','Simulador de aposentadoria','Upgrade para Conta PJ disponível'],
      nao: [],
    },
  ],
  pj: [
    {
      key: 'starter_pj', nome: 'Starter PJ', preco: 'Grátis', subPreco: '30 dias · sem cartão',
      badge: '30 dias grátis', badgeBg: '#F1EFE8', badgeColor: '#5F5E5A', priceId: null, destaque: false,
      features: ['Dashboard financeiro PJ','Contas a pagar e receber','Fluxo de caixa','DRE básico','FactorOne AI (5x por dia)'],
      nao: ['Conciliação bancária','NF-e e emissão fiscal','Portal do contador','Relatórios exportáveis'],
    },
    {
      key: 'essencial_pj', nome: 'Essencial PJ', preco: 'R$ 147', subPreco: '/mês',
      badge: 'Gestão completa', badgeBg: '#EAF3DE', badgeColor: '#3B6D11',
      priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ESSENCIAL_PJ || '', destaque: false,
      features: ['Tudo do Starter PJ','Conciliação bancária','DRE completo + relatórios','Exportação Excel e PDF','Orçamento e centros de custo','FactorOne AI ilimitado'],
      nao: ['NF-e e emissão fiscal','Portal do contador','Conta PJ marketplace'],
    },
    {
      key: 'profissional_pj', nome: 'Profissional PJ', preco: 'R$ 297', subPreco: '/mês',
      badge: 'Recomendado PME', badgeBg: '#E9F0ED', badgeColor: '#2B564D',
      priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_PJ || '', destaque: true,
      features: ['Tudo do Essencial PJ','NF-e e NFS-e (emissão)','Portal do contador','Open Finance (3 bancos)','Clientes e invoices','Portais fiscais (e-CAC, SEFAZ)','Conta PJ via marketplace'],
      nao: [],
    },
  ],
  familia: [
    {
      key: 'familia', nome: 'Família & Empresa', preco: 'R$ 397', subPreco: '/mês · tudo num só',
      badge: 'Bundle exclusivo', badgeBg: '#E9F0ED', badgeColor: '#2B564D',
      priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_FAMILIA || '', destaque: false,
      economia: 'Separado custaria R$ 685/mês — economia de R$ 288',
      features: ['1 CNPJ (módulo PJ completo)','NF-e, contador, DRE, Conta PJ','1 conta PF para o titular','Até 3 contas PF para família','Cada membro vê só o seu','FactorOne AI para todos','Open Finance (3 bancos)'],
      nao: ['Multi-empresa (mais de 1 CNPJ)'],
    },
    {
      key: 'scale', nome: 'Scale Família & Empresa', preco: 'R$ 597', subPreco: '/mês · para escalar',
      badge: 'Carro-chefe', badgeBg: '#EEEDFE', badgeColor: '#3C3489',
      priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_SCALE || '', destaque: true,
      features: ['Tudo do Família & Empresa','Até 3 CNPJs (holding, filiais)','Até 6 contas PF na família','Visão consolidada de patrimônio','FactorOne AI com modelo avançado','Gestor de equipe + RBAC','Open Finance ilimitado','SLA e suporte prioritário'],
      nao: [],
    },
  ],
}

const FAQ = [
  { q: 'Posso cancelar a qualquer momento?', r: 'Sim. Sem fidelidade ou multa. Cancele quando quiser pelo painel.' },
  { q: 'Os 30 dias grátis precisam de cartão?', r: 'Não. Você testa sem informar cartão. O plano pago começa só se você decidir continuar.' },
  { q: 'O que é o plano Família & Empresa?', r: 'Um bundle que cobre sua empresa (PJ) e até 3 membros da família (PF) num único plano com desconto.' },
  { q: 'A Conta PJ é cobrada à parte?', r: 'Sim. É um produto financeiro do marketplace, ativado no plano Profissional. Sem tarifas mensais fixas.' },
  { q: 'Posso migrar de PF para PJ depois?', r: 'Sim, a qualquer momento. Seus dados são preservados e o plano é atualizado imediatamente.' },
  { q: 'Como funciona o FactorOne AI?', r: 'É um CFO digital que analisa seus dados reais — receita, despesas, runway — e responde perguntas financeiras com contexto da sua empresa.' },
]

export default function PrecosPage() {
  const [tab, setTab] = useState<TabTipo>('pj')
  const [loading, setLoading] = useState<string | null>(null)

  async function assinar(priceId: string | null, planKey: string) {
    if (!priceId) { window.location.href = '/auth'; return }
    setLoading(planKey)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const token = sess.session?.access_token
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ priceId, plano: planKey }),
      })
      const json = await res.json()
      if (json?.url) window.location.href = json.url
      else toast.error(json?.error || 'Erro ao iniciar checkout')
    } catch {
      toast.error('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(null)
    }
  }

  const planos = PLANOS[tab]

  return (
    <div style={{ minHeight: '100vh', background: '#F7F4EE', fontFamily: "var(--font-sans)" }}>
      {/* Nav */}
      <nav style={{ background: '#13201D', padding: '0 28px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', fontFamily: "var(--font-sans)", letterSpacing: '-0.03em' }}>
            Factor<span style={{ color: '#6FA595' }}>One</span>
            <span style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em', marginLeft: 8 }}>FINANCE OS</span>
          </div>
        </Link>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link href="/auth" style={{ textDecoration: 'none', fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>Entrar</Link>
          <Link href="/auth" style={{ textDecoration: 'none', fontSize: 12, fontWeight: 700, background: '#3D7A6E', color: '#fff', padding: '7px 16px', borderRadius: 8 }}>
            Começar grátis
          </Link>
        </div>
      </nav>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '48px 20px' }}>
        {/* Hero — banner editorial com cartão */}
        <EditorialBanner
          image="/img/card-product.png"
          alt="Cartão corporativo FactorOne"
          variant="split"
          imageSide="right"
          eyebrow="Planos & Preços"
          title={<>O CFO digital que<br />sua empresa merecia.</>}
          subtitle="30 dias grátis, sem cartão. Cancele quando quiser. Comece hoje e veja seus números com clareza."
          stats={[
            { valor: '30 dias', label: 'grátis' },
            { valor: 'R$ 0', label: 'sem cartão' },
            { valor: 'RLS', label: 'cripto bancária' },
          ]}
          ctas={[{ label: 'Começar grátis', href: '/auth', variant: 'solid' }]}
          focal="center"
          height={280}
          style={{ marginBottom: 40 }}
        />

        {/* Toggle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
          <div style={{ display: 'flex', background: '#F1ECE1', padding: 3, borderRadius: 12, border: '0.5px solid #D1D9D8', gap: 2 }}>
            {([
              { id: 'pj' as const, label: 'Pessoa Jurídica', icon: 'fa-building' },
              { id: 'pf' as const, label: 'Pessoa Física', icon: 'fa-user' },
              { id: 'familia' as const, label: 'Família & Empresa', icon: 'fa-people-roof' },
            ]).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                display: 'flex', alignItems: 'center', gap: 7, fontSize: 12,
                fontWeight: tab === t.id ? 700 : 500, padding: '8px 16px',
                borderRadius: 9, border: 'none', cursor: 'pointer',
                background: tab === t.id ? '#fff' : 'transparent',
                color: tab === t.id ? '#13201D' : '#7B8C88',
                boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s',
              }}>
                <i className={`fa-solid ${t.icon}`} style={{ fontSize: 12 }} />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Banner Família */}
        {tab === 'familia' && (
          <div style={{ background: '#13201D', borderRadius: 14, padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(61,122,110,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className="fa-solid fa-people-roof" style={{ fontSize: 18, color: '#6FA595' }} />
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
              <strong style={{ color: '#fff' }}>Um plano para empresa e família.</strong> O titular alterna entre painel PJ e PF no mesmo login. Membros da família têm acesso separado — cada um vê só as próprias finanças.
            </div>
          </div>
        )}

        {/* Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: tab === 'familia' ? 'repeat(2,1fr)' : 'repeat(3,1fr)',
          gap: 14, marginBottom: 48,
        }}>
          {planos.map(p => {
            const isLoading = loading === p.key
            return (
              <div key={p.key} style={{
                background: '#fff', border: p.destaque ? '2px solid #3D7A6E' : '0.5px solid #E4DCCC',
                borderRadius: 16, padding: '20px 18px', display: 'flex', flexDirection: 'column',
                position: 'relative',
              }}>
                {p.destaque && (
                  <div style={{ position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)', background: '#3D7A6E', color: '#fff', fontSize: 9, fontWeight: 700, padding: '3px 14px', borderRadius: '0 0 8px 8px', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                    MAIS POPULAR
                  </div>
                )}
                <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, display: 'inline-block', marginBottom: 12, background: p.badgeBg, color: p.badgeColor, width: 'fit-content' }}>
                  {p.badge}
                </span>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#13201D', marginBottom: 4, fontFamily: "var(--font-sans)" }}>{p.nome}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#13201D', letterSpacing: '-0.04em', lineHeight: 1, fontFamily: "var(--font-sans)" }}>{p.preco}</div>
                <div style={{ fontSize: 11, color: '#7B8C88', marginBottom: 14, marginTop: 3 }}>{p.subPreco}</div>

                {'economia' in p && p.economia && (
                  <div style={{ background: '#E9F0ED', borderRadius: 8, padding: '7px 10px', fontSize: 10, color: '#2B564D', fontWeight: 600, marginBottom: 12, lineHeight: 1.4 }}>
                    <i className="fa-solid fa-piggy-bank" style={{ marginRight: 5 }} />{p.economia}
                  </div>
                )}

                <div style={{ height: '0.5px', background: '#E4DCCC', marginBottom: 12 }} />

                <div style={{ flex: 1 }}>
                  {p.features.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '3px 0', fontSize: 12, color: '#3C4A46', lineHeight: 1.4 }}>
                      <i className="fa-solid fa-check" style={{ fontSize: 11, color: '#3D7A6E', flexShrink: 0, marginTop: 2 }} />{f}
                    </div>
                  ))}
                  {p.nao.length > 0 && (
                    <>
                      <div style={{ height: '0.5px', background: '#E4DCCC', margin: '10px 0 8px' }} />
                      {p.nao.map(f => (
                        <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '3px 0', fontSize: 11, color: '#A6B0AC', lineHeight: 1.4 }}>
                          <i className="fa-solid fa-lock" style={{ fontSize: 11, flexShrink: 0, marginTop: 2 }} />{f}
                        </div>
                      ))}
                    </>
                  )}
                </div>

                <button
                  onClick={() => void assinar(p.priceId, p.key)}
                  disabled={!!isLoading}
                  style={{
                    marginTop: 16, width: '100%', padding: '11px', borderRadius: 10,
                    fontSize: 13, fontWeight: 700, cursor: isLoading ? 'wait' : 'pointer',
                    border: 'none', transition: 'all 0.15s',
                    background: p.destaque ? '#13201D' : '#F7F4EE',
                    color: p.destaque ? '#fff' : '#13201D',
                    opacity: isLoading ? 0.7 : 1,
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  {isLoading ? 'Aguarde...' : p.priceId ? `Assinar ${p.nome}` : 'Começar grátis'}
                </button>
              </div>
            )
          })}
        </div>

        {/* Comparativo de features */}
        <div style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 14, padding: '24px 28px', marginBottom: 40 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#13201D', marginBottom: 20, fontFamily: "var(--font-sans)" }}>O que está incluído em todos os planos</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
            {[
              { icon: 'fa-robot', title: 'FactorOne AI', desc: 'CFO digital com análise em tempo real dos seus dados financeiros' },
              { icon: 'fa-shield-halved', title: 'Segurança bancária', desc: 'Dados criptografados AES-256, RLS ativo, LGPD compliant' },
              { icon: 'fa-chart-line', title: 'Dashboard em tempo real', desc: 'KPIs, gráficos interativos e alertas proativos atualizados ao vivo' },
              { icon: 'fa-file-export', title: 'Exportação PDF e Excel', desc: 'Relatórios profissionais com logo e formatação financeira' },
              { icon: 'fa-bell', title: 'Alertas automáticos', desc: 'Contas vencidas, gastos acima do orçamento, runway baixo' },
              { icon: 'fa-headset', title: 'Suporte via chat', desc: 'Time brasileiro, resposta em horário comercial' },
            ].map(item => (
              <div key={item.title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: '#E9F0ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className={`fa-solid ${item.icon}`} style={{ fontSize: 14, color: '#3D7A6E' }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#13201D', marginBottom: 3 }}>{item.title}</div>
                  <div style={{ fontSize: 11, color: '#7B8C88', lineHeight: 1.5 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#13201D', textAlign: 'center', marginBottom: 24, fontFamily: "var(--font-sans)" }}>Perguntas frequentes</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16 }}>
            {FAQ.map(item => (
              <div key={item.q} style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 12, padding: '16px 18px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#13201D', marginBottom: 6 }}>{item.q}</div>
                <div style={{ fontSize: 12, color: '#7B8C88', lineHeight: 1.6 }}>{item.r}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA final */}
        <div style={{ background: '#13201D', borderRadius: 16, padding: '36px 40px', textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 10, fontFamily: "var(--font-sans)", letterSpacing: '-0.02em' }}>
            Pronto para ter clareza financeira?
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 24, lineHeight: 1.6 }}>
            30 dias grátis, sem cartão, sem compromisso. Se não gostar, cancele com 1 clique.
          </div>
          <Link href="/auth" style={{ textDecoration: 'none', display: 'inline-block', background: '#3D7A6E', color: '#fff', padding: '13px 32px', borderRadius: 10, fontSize: 14, fontWeight: 700, fontFamily: "var(--font-sans)" }}>
            Começar grátis agora
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ background: '#13201D', padding: '20px 28px', marginTop: 40 }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', fontFamily: "var(--font-sans)" }}>
            Factor<span style={{ color: '#6FA595' }}>One</span>
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            {[['Entrar', '/auth'], ['Dashboard', '/dashboard'], ['Contato', 'mailto:contato@factorone.app']].map(([label, href]) => (
              <Link key={label} href={href} style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', textDecoration: 'none' }}>{label}</Link>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>© 2026 FactorOne Finance OS</div>
        </div>
      </footer>
    </div>
  )
}
