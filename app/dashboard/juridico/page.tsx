'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

type Servico = { icon: string; label: string; desc: string; href?: string; cor: string; soon?: boolean }

const EMPRESARIAL: Servico[] = [
  { icon: 'fa-file-signature', label: 'Contratos digitais', desc: 'Crie, envie e assine contratos com validade jurídica', href: '/dashboard/contratos', cor: '#1C2B2A' },
  { icon: 'fa-building-flag', label: 'Constituição & societário', desc: 'Abertura, alteração e encerramento de empresa', cor: '#10B981', soon: true },
  { icon: 'fa-trademark', label: 'Registro de marca (INPI)', desc: 'Proteja a marca e a propriedade intelectual', cor: '#7C3AED', soon: true },
  { icon: 'fa-shield-halved', label: 'LGPD & Compliance', desc: 'Adequação à LGPD, políticas e termos', cor: '#2563eb', soon: true },
  { icon: 'fa-user-group', label: 'Trabalhista', desc: 'Contratos, rescisões e acordos trabalhistas', cor: '#D97706', soon: true },
  { icon: 'fa-scale-balanced', label: 'Tributário & recuperação', desc: 'Defesa fiscal e recuperação de créditos', cor: '#16A085', soon: true },
]

const PESSOAFISICA: Servico[] = [
  { icon: 'fa-file-contract', label: 'Contratos & procurações', desc: 'Modelos pessoais com assinatura digital', cor: '#1C2B2A', soon: true },
  { icon: 'fa-scroll', label: 'Testamento & sucessão', desc: 'Planejamento sucessório e patrimonial', cor: '#7C3AED', soon: true },
  { icon: 'fa-people-roof', label: 'Família & divórcio', desc: 'Acordos, pensão e partilha', cor: '#BE185D', soon: true },
  { icon: 'fa-comments', label: 'Consultoria jurídica', desc: 'Fale com um advogado parceiro', cor: '#10B981', soon: true },
]

function Card({ s, onEmBreve }: { s: Servico; onEmBreve: () => void }) {
  const inner = (
    <div style={{ background: '#fff', border: '0.5px solid #E2E8E7', borderRadius: 14, padding: '18px', height: '100%', display: 'flex', flexDirection: 'column', gap: 10, cursor: 'pointer', opacity: s.soon ? 0.72 : 1 }}>
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
  if (s.soon) return <button onClick={onEmBreve} style={{ padding: 0, border: 'none', background: 'none', textAlign: 'left', width: '100%' }}>{inner}</button>
  return <Link href={s.href!} style={{ textDecoration: 'none' }}>{inner}</Link>
}

export default function JuridicoPage() {
  const router = useRouter()
  const [aba, setAba] = useState<'empresarial' | 'pf'>('empresarial')
  const lista = aba === 'empresarial' ? EMPRESARIAL : PESSOAFISICA

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Jurídico</div>
          <div className="page-sub">Contratos, societário, marca, compliance e mais — empresa e pessoa física</div>
        </div>
        <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => router.push('/dashboard/contratos')}>
          <i className="fa-solid fa-file-signature" style={{ marginRight: 6 }} />Meus contratos
        </button>
      </div>

      {/* Banner */}
      <div style={{ background: 'linear-gradient(135deg, #1C2B2A 0%, #243736 100%)', borderRadius: 16, padding: '22px 26px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: '-.02em' }}>Rede jurídica do FactorOne</div>
          <div style={{ fontSize: 13, color: '#6EE7B7', marginTop: 4 }}>Contratos digitais, societário, marca e consultoria — em um só lugar, integrado às suas finanças.</div>
        </div>
        <Link href="/dashboard/contratos" style={{ background: '#10B981', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 700, padding: '10px 18px', borderRadius: 9 }}>
          <i className="fa-solid fa-file-signature" style={{ marginRight: 7 }} />Novo contrato
        </Link>
      </div>

      {/* Abas Empresarial / PF */}
      <div style={{ display: 'flex', gap: 2, background: '#E8EDEC', padding: 3, borderRadius: 10, width: 'fit-content', marginBottom: 16 }}>
        {([
          { key: 'empresarial', label: 'Empresarial', icon: 'fa-building' },
          { key: 'pf', label: 'Pessoa Física', icon: 'fa-user' },
        ] as { key: typeof aba; label: string; icon: string }[]).map(t => (
          <button key={t.key} onClick={() => setAba(t.key)} style={{
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: aba === t.key ? 700 : 500,
            padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: aba === t.key ? '#fff' : 'transparent', color: aba === t.key ? '#1C2B2A' : '#7A8F8E',
          }}>
            <i className={`fa-solid ${t.icon}`} style={{ fontSize: 11 }} />{t.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
        {lista.map(s => <Card key={s.label} s={s} onEmBreve={() => toast('Em breve — quer priorizar? Nos avise.', { icon: '⚖️' })} />)}
      </div>

      <div style={{ fontSize: 11, color: '#AAB8B7', marginTop: 16, lineHeight: 1.6 }}>
        <i className="fa-solid fa-circle-info" style={{ color: '#10B981', marginRight: 6 }} />
        Serviços marcados como &quot;em breve&quot; serão prestados por advogados/parceiros credenciados. O FactorOne não presta serviço de advocacia — conecta você a quem presta.
      </div>
    </>
  )
}
