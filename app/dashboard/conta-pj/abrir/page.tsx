'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from 'recharts'

const CHART_DATA = [
  { mes: 'Jan', entradas: 12400, saidas: 8200 },
  { mes: 'Fev', entradas: 15800, saidas: 9100 },
  { mes: 'Mar', entradas: 11200, saidas: 10500 },
  { mes: 'Abr', entradas: 18600, saidas: 7800 },
  { mes: 'Mai', entradas: 21300, saidas: 11200 },
  { mes: 'Jun', entradas: 19800, saidas: 9600 },
]

const BALANCE_DATA = [
  { dia: '01', saldo: 8200 }, { dia: '05', saldo: 11400 }, { dia: '08', saldo: 9800 },
  { dia: '12', saldo: 14200 }, { dia: '15', saldo: 12600 }, { dia: '18', saldo: 16800 },
  { dia: '22', saldo: 15300 }, { dia: '25', saldo: 18900 }, { dia: '28', saldo: 20530 },
]

function fmtK(v: number) { return v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}` }

const FEATURES = [
  {
    step: '1',
    title: 'Adesão ao Banco Factor One',
    subtitle: 'Premium',
    desc: 'Abra sua conta PJ 100% digital e gratuita. Sem mensalidades ou tarifas escondidas.',
    icon: '🏦',
    color: 'var(--navy)',
    bg: 'rgba(26,43,74,.05)',
    items: ['Conta corrente PJ gratuita', 'Agência e número de conta', 'Cartão virtual imediato', 'Open Finance integrado'],
  },
  {
    step: '2',
    title: 'Cadastro Empresarial',
    subtitle: 'Completo',
    desc: 'Dados da empresa e sócios em poucos minutos. Documentos protegidos com criptografia.',
    icon: '📋',
    color: '#7C3AED',
    bg: 'rgba(124,58,237,.05)',
    items: ['CNPJ, Razão Social, Segmento', 'Dados do responsável e CPF', 'Endereço com busca de CEP', 'Upload de documentos seguro'],
  },
  {
    step: '3',
    title: 'Identificação & Compliance',
    subtitle: 'Global',
    desc: 'Verificação KYC completa com análise de sócios e documentos conforme regulamentação.',
    icon: '🔐',
    color: 'var(--teal)',
    bg: 'rgba(0,168,150,.05)',
    items: ['Verificação de identidade', 'Checagem de sócios/diretores', 'Documentos com criptografia', 'KYC/AML Compliance'],
  },
  {
    step: '4',
    title: 'Dashboard Financeiro',
    subtitle: 'Integrado & HUB de Serviços',
    desc: 'Gerencie todas as finanças da sua empresa em um só lugar com IA integrada.',
    icon: '📊',
    color: 'var(--green)',
    bg: 'rgba(45,155,111,.05)',
    items: ['Cash Flow em tempo real', 'PIX, TED, Boletos', 'Cartões corporativos', 'Relatórios e DRE'],
  },
]

const ECOSYSTEM = [
  {
    title: 'Serviços de Banco PJ',
    color: 'var(--navy)',
    bg: 'rgba(26,43,74,.04)',
    services: [
      { icon: '⚡', name: 'PIX e Pagamentos', href: '/dashboard/conta-pj/transferencias' },
      { icon: '📄', name: 'Boletos e Cobranças', href: '/dashboard/financeiro' },
      { icon: '💳', name: 'Cartões (Virtuais e Físicos)', href: '/dashboard/cartoes' },
    ],
  },
  {
    title: 'Serviços de Investimento',
    color: '#7C3AED',
    bg: 'rgba(124,58,237,.04)',
    services: [
      { icon: '📈', name: 'Fundos de Investimento PJ', href: '/dashboard/conta-pj' },
      { icon: '🏛️', name: 'Tesouro Direto PJ', href: '/dashboard/conta-pj' },
      { icon: '💰', name: 'Planejamento de Caixa', href: '/dashboard/cashflow' },
    ],
  },
  {
    title: 'Integrações e Ferramentas',
    color: 'var(--teal)',
    bg: 'rgba(0,168,150,.04)',
    services: [
      { icon: '🔌', name: 'ERP Full', href: '/dashboard/integracoes' },
      { icon: '🔗', name: 'Open Finance', href: '/dashboard/conta-pj/conectar-banco' },
      { icon: '🤖', name: 'Contabilidade Automática', href: '/dashboard/contabilidade' },
    ],
  },
  {
    title: 'Suporte e Relatórios',
    color: 'var(--green)',
    bg: 'rgba(45,155,111,.04)',
    services: [
      { icon: '💬', name: 'Central de Ajuda', href: '/dashboard/aicfo' },
      { icon: '🕐', name: 'Atendimento 24/7', href: '/dashboard/aicfo' },
      { icon: '📊', name: 'Módulo de Relatórios', href: '/dashboard/relatorios' },
    ],
  },
]

const MOBILE_ACTIONS = [
  { icon: '⚡', label: 'PIX' },
  { icon: '💰', label: 'Pagar' },
  { icon: '📋', label: 'Cobrar' },
  { icon: '↔️', label: 'Transferir' },
]

export default function AbrirContaPJPage() {
  const router = useRouter()

  return (
    <div>
      {/* HERO */}
      <div style={{ background: 'linear-gradient(135deg, var(--navy) 0%, #1a3a6b 100%)', borderRadius: 16, padding: '32px 36px', marginBottom: 24, color: '#fff', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,.04)' }} />
        <div style={{ position: 'absolute', bottom: -60, right: 80, width: 160, height: 160, borderRadius: '50%', background: 'rgba(0,168,150,.12)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🏦</div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Factor One Banking</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>Banco Digital Empresarial</div>
            </div>
            <div style={{ marginLeft: 'auto', background: 'var(--teal)', borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 700 }}>100% GRATUITO</div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "'Sora',sans-serif", lineHeight: 1.2, marginBottom: 10, maxWidth: 600 }}>
            O SISTEMA INTEGRADO DE GESTÃO<br />FINANCEIRA E BANCÁRIA EMPRESARIAL
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.65)', marginBottom: 24, maxWidth: 480 }}>
            Conta PJ digital completa integrada ao seu ERP financeiro. Open Finance, cartões corporativos, PIX, boletos e muito mais — tudo em um só lugar.
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => router.push('/dashboard/conta-pj')}
              style={{ background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <i className="fa-solid fa-plus-circle" />Abrir minha conta — Grátis
            </button>
            <Link href="/dashboard/conta-pj" style={{ background: 'rgba(255,255,255,.1)', color: '#fff', border: '1px solid rgba(255,255,255,.2)', borderRadius: 10, padding: '12px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="fa-solid fa-gauge-high" />Ver dashboard
            </Link>
          </div>
        </div>
      </div>

      {/* 4 FEATURE CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {FEATURES.map(f => (
          <div key={f.step} style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 14, padding: '20px 18px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: f.color, borderRadius: '14px 14px 0 0' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: f.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{f.icon}</div>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: f.color, textTransform: 'uppercase', letterSpacing: '.08em' }}>Etapa {f.step}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--navy)', lineHeight: 1.2 }}>{f.title}</div>
                <div style={{ fontSize: 10, color: f.color, fontWeight: 600 }}>{f.subtitle}</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--gray-500)', lineHeight: 1.5, marginBottom: 12 }}>{f.desc}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {f.items.map(item => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--navy)' }}>
                  <i className="fa-solid fa-check" style={{ color: f.color, fontSize: 9, flexShrink: 0 }} />
                  {item}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* MAIN CONTENT — dashboard preview + ecosystem */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, marginBottom: 24, alignItems: 'start' }}>
        {/* Left: dashboard preview mock */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* KPI preview */}
          <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 14, padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy)', fontFamily: "'Sora',sans-serif" }}>Olá, sua empresa! 👋</div>
                <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>Bem-vindo ao Banco PJ Factor One</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-100)', borderRadius: 8, padding: '5px 12px', fontSize: 11, color: 'var(--gray-400)' }}>⚡ PIX copia e cola</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { label: '💰 Saldo disponível', val: 'R$ 15.750,00', color: 'var(--navy)' },
                { label: '📥 A receber', val: 'R$ 8.230,00', color: 'var(--green)' },
                { label: '📤 A pagar', val: 'R$ 3.450,00', color: 'var(--red)' },
                { label: '💳 Saldo total', val: 'R$ 20.530,00', color: '#7C3AED' },
              ].map(k => (
                <div key={k.label} className="kpi" style={{ padding: '12px 14px' }}>
                  <div className="kpi-lbl" style={{ fontSize: 10 }}>{k.label}</div>
                  <div className="kpi-val" style={{ fontSize: 16, color: k.color }}>{k.val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Ações rápidas */}
          <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 14, padding: '16px 20px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 14 }}>Ações rápidas</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { emoji: '⚡', label: 'PIX', color: 'var(--teal)', bg: 'rgba(0,168,150,.1)' },
                { emoji: '💰', label: 'Pagar', color: 'var(--navy)', bg: 'rgba(26,43,74,.08)' },
                { emoji: '📋', label: 'Cobrar', color: 'var(--gold)', bg: 'rgba(184,146,42,.1)' },
                { emoji: '↔️', label: 'Transferir', color: '#7C3AED', bg: 'rgba(124,58,237,.08)' },
                { emoji: '📊', label: 'Extrato', color: 'var(--green)', bg: 'rgba(45,155,111,.08)' },
                { emoji: '🔗', label: 'Open Finance', color: 'var(--teal)', bg: 'rgba(0,168,150,.08)' },
              ].map(a => (
                <div key={a.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '10px 14px', borderRadius: 10, background: a.bg, flex: 1 }}>
                  <span style={{ fontSize: 20 }}>{a.emoji}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: a.color }}>{a.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Gráficos */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {/* Fluxo de caixa BarChart */}
            <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>📊 Gráfico de fluxo de caixa</span>
                <span style={{ fontSize: 9, color: 'var(--teal)', fontWeight: 600 }}>CONECTAR NOVOS BANCOS →</span>
              </div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--gray-500)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--green)' }} /> Entradas
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--gray-500)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--red)' }} /> Saídas
                </div>
              </div>
              <ResponsiveContainer width="100%" height={110}>
                <BarChart data={CHART_DATA} barGap={2} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 9, fill: 'var(--gray-300)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 8, fill: 'var(--gray-300)' }} axisLine={false} tickLine={false} tickFormatter={fmtK} width={36} />
                  <Tooltip formatter={(v: number, name: string) => [fmtK(v), name === 'entradas' ? 'Entradas' : 'Saídas']} contentStyle={{ fontSize: 10, borderRadius: 8, border: '1px solid var(--gray-100)' }} />
                  <Bar dataKey="entradas" fill="var(--green)" radius={[3, 3, 0, 0]} maxBarSize={14} />
                  <Bar dataKey="saidas" fill="var(--red)" radius={[3, 3, 0, 0]} maxBarSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Evolução do saldo AreaChart */}
            <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>📈 Evolução do saldo</span>
                <span style={{ fontSize: 9, color: 'var(--gray-400)' }}>Últimos 30 dias</span>
              </div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--gray-500)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--teal)' }} /> Saldo disponível
                </div>
              </div>
              <ResponsiveContainer width="100%" height={110}>
                <AreaChart data={BALANCE_DATA}>
                  <defs>
                    <linearGradient id="gradSaldoAbrir" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00A896" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#00A896" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" vertical={false} />
                  <XAxis dataKey="dia" tick={{ fontSize: 9, fill: 'var(--gray-300)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 8, fill: 'var(--gray-300)' }} axisLine={false} tickLine={false} tickFormatter={fmtK} width={36} />
                  <Tooltip formatter={(v: number) => [fmtK(v), 'Saldo']} contentStyle={{ fontSize: 10, borderRadius: 8, border: '1px solid var(--gray-100)' }} />
                  <Area type="monotone" dataKey="saldo" stroke="#00A896" strokeWidth={2} fill="url(#gradSaldoAbrir)" dot={false} activeDot={{ r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Movimentações preview */}
          <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>Movimentações recentes</span>
              <span style={{ fontSize: 11, color: 'var(--teal)', cursor: 'pointer' }}>Ver extrato →</span>
            </div>
            {[
              { icon: '⚡', label: 'Pix recebido', sub: 'Cliente A', val: '+R$5.300,00', color: 'var(--green)', hora: '10:00' },
              { icon: '💰', label: 'Pagamento', sub: 'Fornecedor D', val: '-R$1.200,00', color: 'var(--red)', hora: '10:30' },
              { icon: '↔️', label: 'Transferência enviada', sub: 'Conta Poupança', val: '-R$2.000,00', color: 'var(--red)', hora: '10:46' },
              { icon: '📋', label: 'Cobrança recebida', sub: 'Fulano 12365', val: '+R$9.426,00', color: 'var(--green)', hora: '11:22' },
            ].map((tx, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: '1px solid var(--gray-50)' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: tx.color === 'var(--green)' ? 'rgba(45,155,111,.1)' : 'rgba(220,53,69,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{tx.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--navy)' }}>{tx.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--gray-400)' }}>{tx.sub} · Hoje, {tx.hora}</div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 12, color: tx.color, fontFamily: 'monospace' }}>{tx.val}</div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div style={{ background: 'linear-gradient(135deg, var(--teal), #2D9B6F)', borderRadius: 14, padding: '22px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', fontFamily: "'Sora',sans-serif", marginBottom: 6 }}>Pronto para começar?</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.75)' }}>Abra sua conta PJ gratuita agora. Leva menos de 5 minutos.</div>
            </div>
            <button
              onClick={() => router.push('/dashboard/conta-pj')}
              style={{ background: '#fff', color: 'var(--teal)', border: 'none', borderRadius: 10, padding: '12px 22px', fontSize: 13, fontWeight: 800, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}
            >
              Abrir conta grátis →
            </button>
          </div>
        </div>

        {/* Right: ecosystem + mobile */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Mobile card */}
          <div style={{ background: 'var(--navy)', borderRadius: 14, padding: '18px 20px', color: '#fff' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.4)', marginBottom: 12 }}>Versão Mobile</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              {/* Phone mockup */}
              <div style={{ width: 80, flexShrink: 0, background: 'rgba(255,255,255,.1)', borderRadius: 12, padding: '8px 6px' }}>
                <div style={{ background: 'var(--teal)', borderRadius: 6, padding: '6px 8px', marginBottom: 6 }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: '#fff' }}>Factor One</div>
                  <div style={{ fontSize: 7, color: 'rgba(255,255,255,.6)' }}>Minha Empresa</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginTop: 2 }}>R$ 15.750</div>
                </div>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,.5)', marginBottom: 4 }}>Aplicar rápidas</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                  {MOBILE_ACTIONS.map(a => (
                    <div key={a.label} style={{ background: 'rgba(255,255,255,.08)', borderRadius: 4, padding: '4px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10 }}>{a.icon}</div>
                      <div style={{ fontSize: 6, color: 'rgba(255,255,255,.6)' }}>{a.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 6 }}>
                  {['+R$ 3.200', '-R$ 1.200', '+R$ 2.800'].map((v, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                      <div style={{ fontSize: 6, color: 'rgba(255,255,255,.4)' }}>Movimentação</div>
                      <div style={{ fontSize: 6, fontWeight: 700, color: v.startsWith('+') ? '#2D9B6F' : '#C0504A' }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>App disponível em breve</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.55)', lineHeight: 1.5, marginBottom: 10 }}>Gerencie suas finanças de qualquer lugar com o app Factor One.</div>
                <div style={{ display: 'flex', gap: 4, flexDirection: 'column' }}>
                  {['Interface limpa e intuitiva', 'Notificações em tempo real', 'Biometria e segurança'].map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'rgba(255,255,255,.7)' }}>
                      <i className="fa-solid fa-check" style={{ color: 'var(--teal)', fontSize: 8 }} />{f}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Ecosystem services */}
          <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 14, padding: '18px 20px' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--navy)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '.04em' }}>
              Ecossistema Integrado de Serviços
            </div>
            {ECOSYSTEM.map(cat => (
              <div key={cat.title} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: cat.color, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>{cat.title}</div>
                {cat.services.map(s => (
                  <Link key={s.name} href={s.href} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: 8, background: cat.bg, marginBottom: 4, textDecoration: 'none', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14 }}>{s.icon}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--navy)' }}>{s.name}</span>
                    </div>
                    <span style={{ fontSize: 10, color: cat.color, fontWeight: 600 }}>Acessar →</span>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BOTTOM — fluxo de abertura */}
      <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 14, padding: '24px 28px' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--navy)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>Fluxo recomendado</div>
        <div style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 20 }}>Siga este caminho para ter acesso completo ao Banco PJ Factor One</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'wrap' }}>
          {[
            { icon: '📱', label: 'Menu Principal' },
            { icon: '🏦', label: 'Banco PJ' },
            { icon: '📋', label: 'Abertura de Conta' },
            { icon: '✅', label: 'Conta Ativa' },
          ].map((step, i) => (
            <div key={step.label} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 20px', background: 'var(--gray-50)', borderRadius: 12, minWidth: 110, border: '1px solid var(--gray-100)' }}>
                <span style={{ fontSize: 24, marginBottom: 6 }}>{step.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)', textAlign: 'center' }}>{step.label}</span>
              </div>
              {i < 3 && <i className="fa-solid fa-arrow-right" style={{ color: 'var(--teal)', fontSize: 14, margin: '0 8px', flexShrink: 0 }} />}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { icon: '⚡', title: 'Rápido', desc: 'Abertura em menos de 5 minutos' },
            { icon: '🔒', title: 'Seguro', desc: 'Criptografia de ponta a ponta' },
            { icon: '💸', title: 'Gratuito', desc: 'Sem mensalidades ou tarifas' },
            { icon: '📱', title: 'Digital', title2: '', desc: 'Gerencie tudo pelo browser' },
          ].map(b => (
            <div key={b.title} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 14px', background: 'var(--gray-50)', borderRadius: 10 }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>{b.icon}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>{b.title}</div>
                <div style={{ fontSize: 10, color: 'var(--gray-400)', lineHeight: 1.4 }}>{b.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
