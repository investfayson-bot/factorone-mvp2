'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Solucao = { icon: string; label: string; desc: string; href?: string; cor: string; soon?: boolean }

const DISPONIVEIS: Solucao[] = [
  { icon: 'fa-building-columns', label: 'Conta PJ', desc: 'Saldo, extrato e multi-conta', href: '/dashboard/conta-pj', cor: '#1C2B2A' },
  { icon: 'fa-bolt', label: 'PIX & Transferências', desc: 'Envie PIX, TED e DOC', href: '/dashboard/conta-pj/transferencias', cor: '#5E8C87' },
  { icon: 'fa-credit-card', label: 'Cartões', desc: 'Físicos, virtuais e por colaborador', href: '/dashboard/cartoes', cor: '#7C3AED' },
  { icon: 'fa-hand-holding-dollar', label: 'Crédito & Financiamento', desc: 'Capital de giro e antecipação', href: '/dashboard/credito', cor: '#D97706' },
  { icon: 'fa-link', label: 'Open Finance (Belvo)', desc: 'Conecte seus bancos', href: '/dashboard/conexoes', cor: '#16A085' },
  { icon: 'fa-seedling', label: 'Investimentos', desc: 'Carteira da empresa', href: '/dashboard/conta-pj/investimentos', cor: '#2D9B6F' },
  { icon: 'fa-users-gear', label: 'Folha de pagamento', desc: 'Holerites e encargos', href: '/dashboard/folha', cor: '#6B21A8' },
  { icon: 'fa-circle-plus', label: 'Abrir Conta PJ', desc: 'Cadastro digital em minutos', href: '/dashboard/conta-pj/abrir', cor: '#3E6E69' },
]

const EM_BREVE: Solucao[] = [
  { icon: 'fa-globe', label: 'Câmbio & Conta internacional', desc: 'Receba e pague em outras moedas', cor: '#2563eb', soon: true },
  { icon: 'fa-shield-halved', label: 'Seguros empresariais', desc: 'Proteja frota, patrimônio e equipe', cor: '#0E7490', soon: true },
  { icon: 'fa-file-invoice-dollar', label: 'Antecipação de recebíveis', desc: 'Adiante suas vendas a prazo', cor: '#B8922A', soon: true },
  { icon: 'fa-money-bill-transfer', label: 'Maquininha / Adquirência', desc: 'Receba por cartão com taxa baixa', cor: '#C0504A', soon: true },
  { icon: 'fa-gift', label: 'Cashback corporativo', desc: 'Ganhe de volta nos gastos da empresa', cor: '#BE185D', soon: true },
  { icon: 'fa-robot', label: 'CFO com IA dedicado', desc: 'Consultoria financeira automática', cor: '#7C3AED', soon: true },
]

function Card({ s, onClick }: { s: Solucao; onClick?: () => void }) {
  const inner = (
    <div style={{ background: '#fff', border: '0.5px solid #E2E8E7', borderRadius: 14, padding: '18px', height: '100%', display: 'flex', flexDirection: 'column', gap: 10, cursor: s.soon ? 'default' : 'pointer', opacity: s.soon ? 0.72 : 1, transition: 'box-shadow .15s, transform .15s' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ width: 42, height: 42, borderRadius: 11, background: `${s.cor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className={`fa-solid ${s.icon}`} style={{ fontSize: 17, color: s.cor }} />
        </div>
        {s.soon
          ? <span style={{ fontSize: 9, fontWeight: 700, color: '#7A8F8E', background: '#EEF2F1', padding: '3px 9px', borderRadius: 20 }}>EM BREVE</span>
          : <i className="fa-solid fa-arrow-right" style={{ color: '#C4CFCE', fontSize: 13 }} />}
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1C2B2A', marginBottom: 3 }}>{s.label}</div>
        <div style={{ fontSize: 12, color: '#7A8F8E', lineHeight: 1.5 }}>{s.desc}</div>
      </div>
    </div>
  )
  if (s.soon) return inner
  return <Link href={s.href!} style={{ textDecoration: 'none' }}>{inner}</Link>
}

export default function SolucoesPage() {
  const router = useRouter()
  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Soluções financeiras</div>
          <div className="page-sub">Tudo que sua empresa precisa de banco, num só lugar</div>
        </div>
        <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => router.push('/dashboard/conta-pj')}>
          <i className="fa-solid fa-arrow-left" style={{ marginRight: 6 }} />Banco
        </button>
      </div>

      {/* Banner */}
      <div style={{ background: 'linear-gradient(135deg, #1C2B2A 0%, #243736 100%)', borderRadius: 16, padding: '22px 26px', marginBottom: 22, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: '-.02em' }}>O super-app financeiro da sua empresa</div>
          <div style={{ fontSize: 13, color: '#7EBDB8', marginTop: 4 }}>Conta, cartões, crédito, Open Finance e mais — integrados e com IA.</div>
        </div>
        <Link href="/dashboard/conexoes" style={{ background: '#5E8C87', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 700, padding: '10px 18px', borderRadius: 9 }}>
          <i className="fa-solid fa-link" style={{ marginRight: 7 }} />Conectar meu banco
        </Link>
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 12 }}>Disponível agora</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12, marginBottom: 26 }}>
        {DISPONIVEIS.map(s => <Card key={s.label} s={s} />)}
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 12 }}>Em breve</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
        {EM_BREVE.map(s => <Card key={s.label} s={s} />)}
      </div>
    </>
  )
}
