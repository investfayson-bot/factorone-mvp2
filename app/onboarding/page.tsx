'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

type Screen = 'splash' | 'perfil' | 'empresa' | 'financeiro' | 'pronto'
type FinOpcao = 'open_finance' | 'pular' | null

const SETORES = ['Tecnologia', 'Comércio', 'Serviços', 'Indústria', 'Saúde', 'Educação', 'Construção', 'Agronegócio', 'Transporte / Logística', 'Alimentação', 'Outro']

const PJ_STEPS = [
  { key: 'perfil',     label: 'Tipo de conta'   },
  { key: 'empresa',    label: 'Dados da empresa' },
  { key: 'financeiro', label: 'Dados bancários'  },
  { key: 'pronto',     label: 'Finalizar'        },
] as const

export default function OnboardingPage() {
  const router = useRouter()
  const [screen, setScreen]     = useState<Screen>('splash')
  const [loading, setLoading]   = useState(false)
  const [userName, setUserName] = useState('')
  const [empresaId, setEmpresaId] = useState('')
  const [isPJ, setIsPJ]         = useState(false)

  const [empresa, setEmpresa] = useState({ nome: '', cnpj: '', setor: '', telefone: '' })
  const [finOpcao, setFinOpcao] = useState<FinOpcao>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      const n = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split('@')[0] ?? ''
      setUserName(n)
    })
  }, [])

  // Tipo de conta escolhido ANTES do login (tela de auth) — pula a etapa de seleção.
  const [tipoConsumido, setTipoConsumido] = useState(false)
  useEffect(() => {
    if (tipoConsumido) return
    const tipo = localStorage.getItem('fo_account_type')
    if (tipo !== 'pessoal' && tipo !== 'empresarial') return
    setTipoConsumido(true)
    localStorage.removeItem('fo_account_type')
    if (tipo === 'pessoal') void escolherPessoal()
    else void escolherEmpresarial()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoConsumido])

  /* ── helpers ── */
  async function iniciar() { setScreen('perfil') }

  async function escolherPessoal() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      await supabase.from('perfil_usuario').upsert({ user_id: user.id, tipo: 'pessoal' }, { onConflict: 'user_id' })
      router.push('/dashboard-pessoal')
    } catch { toast.error('Falha ao salvar') }
    finally { setLoading(false) }
  }

  async function escolherEmpresarial() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      await supabase.from('perfil_usuario').upsert({ user_id: user.id, tipo: 'empresarial' }, { onConflict: 'user_id' })
      const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
      setEmpresaId(u?.empresa_id ?? user.id)
      setIsPJ(true)
      setScreen('empresa')
    } catch { toast.error('Falha ao salvar') }
    finally { setLoading(false) }
  }

  async function salvarEmpresa() {
    if (!empresa.nome.trim()) { toast.error('Informe o nome da empresa'); return }
    setLoading(true)
    try {
      await supabase.from('empresas').update({
        nome: empresa.nome.trim(),
        ...(empresa.cnpj    ? { cnpj:  empresa.cnpj.replace(/\D/g, '') } : {}),
        ...(empresa.setor   ? { setor: empresa.setor }   : {}),
      }).eq('id', empresaId)
      setScreen('financeiro')
    } catch { toast.error('Falha ao salvar empresa') }
    finally { setLoading(false) }
  }

  async function salvarFinanceiro() {
    setLoading(true)
    try {
      setScreen('pronto')
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.access_token) {
          fetch('/api/email/boas-vindas', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` } }).catch(() => {})
        }
      })
    } catch { toast.error('Falha ao salvar dados bancários') }
    finally { setLoading(false) }
  }

  /* ── step index for sidebar ── */
  const stepIdx = PJ_STEPS.findIndex(s => s.key === screen)
  const showSidebar = isPJ && screen !== 'splash' && screen !== 'pronto'

  /* ── layout ── */
  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#F5F7FA' }}>

      {/* ── Sidebar (wizard PJ) ── */}
      {showSidebar && (
        <aside style={{ width: 260, background: 'var(--navy)', display: 'flex', flexDirection: 'column', padding: '32px 24px', flexShrink: 0 }}>
          {/* Logo */}
          <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-.04em', marginBottom: 6 }}>
            Factor<span style={{ color: 'var(--teal)' }}>One</span>
          </div>
          {empresa.nome && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', marginTop: 4, fontWeight: 500 }}>
              {empresa.nome}
            </div>
          )}
          {userName && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', marginBottom: 36 }}>{userName}</div>
          )}

          {/* Steps */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {PJ_STEPS.map((s, i) => {
              const done   = i < stepIdx
              const active = i === stepIdx
              return (
                <div key={s.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, paddingBottom: i < PJ_STEPS.length - 1 ? 0 : 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, flexShrink: 0, zIndex: 1,
                      background: done ? 'var(--teal)' : active ? '#fff' : 'rgba(255,255,255,.1)',
                      color: done ? '#fff' : active ? 'var(--navy)' : 'rgba(255,255,255,.4)',
                      border: active ? '2px solid rgba(255,255,255,.3)' : 'none',
                    }}>
                      {done ? <i className="fa-solid fa-check" style={{ fontSize: 10 }} /> : i + 1}
                    </div>
                    {i < PJ_STEPS.length - 1 && (
                      <div style={{ width: 2, height: 32, background: done ? 'var(--teal)' : 'rgba(255,255,255,.1)', margin: '2px 0' }} />
                    )}
                  </div>
                  <div style={{ paddingTop: 4, paddingBottom: i < PJ_STEPS.length - 1 ? 30 : 0 }}>
                    <div style={{ fontSize: 12, fontWeight: active ? 700 : 500, color: active ? '#fff' : done ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.35)' }}>
                      {s.label}
                    </div>
                  </div>
                </div>
              )
            })}
          </nav>

          <div style={{ marginTop: 'auto', fontSize: 10, color: 'rgba(255,255,255,.2)', lineHeight: 1.6 }}>
            © 2026 FactorOne<br />Termos · Privacidade
          </div>
        </aside>
      )}

      {/* ── Main content ── */}
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>

        {/* SPLASH */}
        {screen === 'splash' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: 560, width: '100%', textAlign: 'center' }}>
            {/* Ilustração */}
            <div style={{ width: 120, height: 120, background: 'linear-gradient(135deg, var(--navy) 0%, #2A4A7A 100%)', borderRadius: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28, boxShadow: '0 8px 32px rgba(26,43,74,.2)' }}>
              <i className="fa-solid fa-chart-line" style={{ color: 'var(--teal)', fontSize: 48 }} />
            </div>

            {/* Logo */}
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 600, color: 'var(--gray-400)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>
              Finance OS
            </div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 28, fontWeight: 800, color: 'var(--navy)', letterSpacing: '-.03em', marginBottom: 6 }}>
              {userName ? `Bem-vindo, ${userName.split(' ')[0]}!` : 'Bem-vindo ao FactorOne'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--gray-400)', lineHeight: 1.7, marginBottom: 32, maxWidth: 420 }}>
              Este é o primeiro passo para simplificar a gestão financeira da sua empresa ou vida pessoal.
            </div>

            {/* Value props */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 400, marginBottom: 32, textAlign: 'left' }}>
              {[
                { icon: 'fa-gauge-high',    color: 'var(--teal)',  title: 'Gestão financeira completa', desc: 'DRE, Fluxo de Caixa, Contas a Pagar e Receber' },
                { icon: 'fa-robot',         color: 'var(--navy)',  title: 'AI CFO em tempo real',       desc: 'Insights automáticos e análises inteligentes' },
                { icon: 'fa-file-invoice',  color: 'var(--gold)',  title: 'Fiscal & Contabilidade',     desc: 'NF-e, DAS automático e portal do contador' },
              ].map(v => (
                <div key={v.title} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '12px 16px', background: '#fff', borderRadius: 10, border: '1px solid var(--gray-100)', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: `${v.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className={`fa-solid ${v.icon}`} style={{ color: v.color, fontSize: 15 }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 1 }}>{v.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{v.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <button className="btn-action" style={{ width: '100%', maxWidth: 400, padding: '13px 0', fontSize: 14 }} onClick={() => void iniciar()}>
              Iniciar configuração <i className="fa-solid fa-arrow-right" style={{ marginLeft: 8 }} />
            </button>
          </div>
        )}

        {/* STEP: Tipo de conta */}
        {screen === 'perfil' && (
          <div style={{ width: '100%', maxWidth: 600 }}>
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 22, fontFamily: "'Sora',sans-serif", fontWeight: 800, color: 'var(--navy)', marginBottom: 6 }}>Como você vai usar o FactorOne?</div>
              <div style={{ fontSize: 13, color: 'var(--gray-400)' }}>Escolha o modo principal. Você pode usar os dois.</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {/* PJ */}
              <button
                onClick={() => void escolherEmpresarial()}
                disabled={loading}
                style={{ background: '#fff', border: '2px solid var(--teal)', borderRadius: 14, padding: '24px 22px', textAlign: 'left', cursor: 'pointer', opacity: loading ? .6 : 1, transition: 'box-shadow .15s', boxShadow: '0 2px 10px rgba(94,140,135,.1)' }}
              >
                <div style={{ width: 46, height: 46, background: 'var(--teal)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <i className="fa-solid fa-building" style={{ color: '#fff', fontSize: 18 }} />
                </div>
                <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>Empresarial (PJ)</div>
                <div style={{ fontSize: 12, color: 'var(--gray-400)', lineHeight: 1.6, marginBottom: 16 }}>PMEs, startups e agências que precisam de gestão financeira completa.</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {['DRE & Fluxo de Caixa', 'AI CFO + Relatórios', 'NF-e, DAS, Contador'].map(f => (
                    <div key={f} style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--gray-500)', alignItems: 'center' }}>
                      <i className="fa-solid fa-circle-check" style={{ color: 'var(--teal)', fontSize: 11 }} /> {f}
                    </div>
                  ))}
                </div>
              </button>
              {/* PF */}
              <button
                onClick={() => void escolherPessoal()}
                disabled={loading}
                style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 14, padding: '24px 22px', textAlign: 'left', cursor: 'pointer', opacity: loading ? .6 : 1 }}
              >
                <div style={{ width: 46, height: 46, background: 'var(--gray-100)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <i className="fa-solid fa-user" style={{ color: 'var(--gray-500)', fontSize: 18 }} />
                </div>
                <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>Pessoa Física</div>
                <div style={{ fontSize: 12, color: 'var(--gray-400)', lineHeight: 1.6, marginBottom: 16 }}>Organização financeira pessoal, metas e controle de gastos.</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {['Controle de gastos & metas', 'IRPF & investimentos', 'Orçamento mensal'].map(f => (
                    <div key={f} style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--gray-500)', alignItems: 'center' }}>
                      <i className="fa-solid fa-circle" style={{ color: 'var(--gray-300)', fontSize: 5 }} /> {f}
                    </div>
                  ))}
                </div>
              </button>
            </div>
            <button className="btn-action btn-ghost" style={{ marginTop: 16, fontSize: 12 }} onClick={() => setScreen('splash')}>
              <i className="fa-solid fa-arrow-left" style={{ marginRight: 6 }} /> Voltar
            </button>
          </div>
        )}

        {/* STEP: Dados da Empresa */}
        {screen === 'empresa' && (
          <div style={{ width: '100%', maxWidth: 520 }}>
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 22, fontFamily: "'Sora',sans-serif", fontWeight: 800, color: 'var(--navy)', marginBottom: 6 }}>Quais são os dados da sua empresa?</div>
              <div style={{ fontSize: 13, color: 'var(--gray-400)' }}>Insira o CNPJ e o nome conforme registrado na Receita Federal.</div>
            </div>

            <div style={{ background: '#fff', borderRadius: 12, padding: '24px', border: '1px solid var(--gray-100)', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">CNPJ</label>
                <input className="form-input" placeholder="00.000.000/0001-00" value={empresa.cnpj} onChange={e => setEmpresa(p => ({ ...p, cnpj: e.target.value }))} style={{ fontSize: 14 }} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Razão social <span style={{ color: 'var(--red)' }}>*</span></label>
                <input className="form-input" placeholder="Ex: Acme Tecnologia Ltda" value={empresa.nome} onChange={e => setEmpresa(p => ({ ...p, nome: e.target.value }))} style={{ fontSize: 14 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Setor</label>
                  <select className="form-input" value={empresa.setor} onChange={e => setEmpresa(p => ({ ...p, setor: e.target.value }))}>
                    <option value="">Tipo de empresa</option>
                    {SETORES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Telefone</label>
                  <input className="form-input" placeholder="(11) 9 9999-9999" value={empresa.telefone} onChange={e => setEmpresa(p => ({ ...p, telefone: e.target.value }))} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn-action btn-ghost" style={{ flex: 1 }} onClick={() => setScreen('perfil')}>Voltar</button>
              <button className="btn-action" style={{ flex: 2, opacity: loading ? .6 : 1 }} onClick={() => void salvarEmpresa()} disabled={loading}>
                {loading ? 'Salvando…' : 'Continuar'}
              </button>
            </div>
          </div>
        )}

        {/* STEP: Dados financeiros */}
        {screen === 'financeiro' && (
          <div style={{ width: '100%', maxWidth: 520 }}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 22, fontFamily: "'Sora',sans-serif", fontWeight: 800, color: 'var(--navy)', marginBottom: 6 }}>Traga seus dados financeiros</div>
              <div style={{ fontSize: 13, color: 'var(--gray-400)', lineHeight: 1.6 }}>Escolha como conectar sua conta bancária — você pode mudar isso depois.</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* HERO: Conectar meu banco */}
              <button
                onClick={() => setFinOpcao(finOpcao === 'open_finance' ? null : 'open_finance')}
                style={{ display: 'flex', gap: 16, padding: '18px 20px', borderRadius: 12, cursor: 'pointer', border: finOpcao === 'open_finance' ? '2px solid var(--teal)' : '1.5px solid var(--gray-100)', background: finOpcao === 'open_finance' ? 'rgba(94,140,135,.05)' : 'linear-gradient(135deg,#f8fffe 0%,#f0faf9 100%)', textAlign: 'left', width: '100%', position: 'relative', overflow: 'hidden' }}
              >
                <div style={{ position: 'absolute', top: 10, right: 12, fontSize: 9, fontWeight: 700, background: 'var(--teal)', color: '#fff', padding: '2px 8px', borderRadius: 20 }}>RECOMENDADO</div>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(94,140,135,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className="fa-solid fa-building-columns" style={{ color: 'var(--teal)', fontSize: 18 }} />
                </div>
                <div style={{ flex: 1, paddingRight: 60 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--navy)', marginBottom: 4 }}>Conectar meu banco</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-400)', lineHeight: 1.6 }}>Sincronize automaticamente via Open Finance — saldo, extrato e transações em tempo real.</div>
                  {finOpcao === 'open_finance' && (
                    <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(94,140,135,.08)', borderRadius: 7, fontSize: 11, color: 'var(--teal)' }}>
                      <i className="fa-solid fa-circle-info" style={{ marginRight: 6 }} />
                      Finalize o setup — configure a conexão em <strong>Conta PJ</strong>.
                    </div>
                  )}
                </div>
                {finOpcao === 'open_finance' && <i className="fa-solid fa-circle-check" style={{ color: 'var(--teal)', fontSize: 20, alignSelf: 'center', flexShrink: 0 }} />}
              </button>

            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn-action btn-ghost" style={{ flex: 1 }} onClick={() => setScreen('empresa')}>Voltar</button>
              <button className="btn-action" style={{ flex: 2, opacity: (loading || !finOpcao) ? .6 : 1 }} onClick={() => void salvarFinanceiro()} disabled={loading || !finOpcao}>
                {loading ? 'Salvando…' : 'Continuar'}
              </button>
            </div>
            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <button onClick={() => { setFinOpcao('pular'); void salvarFinanceiro() }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--gray-400)', textDecoration: 'underline' }}>
                Configurar isso depois
              </button>
            </div>
          </div>
        )}

        {/* PRONTO */}
        {screen === 'pronto' && (
          <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, background: 'linear-gradient(135deg, var(--teal), #3A7A74)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 6px 20px rgba(94,140,135,.3)' }}>
              <i className="fa-solid fa-check" style={{ color: '#fff', fontSize: 26 }} />
            </div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 24, fontWeight: 800, color: 'var(--navy)', marginBottom: 6 }}>
              {empresa.nome || 'Tudo pronto'}!
            </div>
            {userName && (
              <div style={{ fontSize: 13, color: 'var(--gray-400)', marginBottom: 4 }}>
                Boa sorte, <span style={{ fontWeight: 700, color: 'var(--teal)' }}>{userName.split(' ')[0]}</span>!
              </div>
            )}
            <div style={{ fontSize: 13, color: 'var(--gray-400)', lineHeight: 1.7, marginBottom: 28 }}>
              Conta configurada. Explore o dashboard, cadastre transações e use o AI CFO para insights em tempo real.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24, textAlign: 'left' }}>
              {[
                { icon: 'fa-gauge-high',   label: 'Dashboard',         desc: 'Visão geral do caixa e KPIs' },
                { icon: 'fa-robot',        label: 'AI CFO',            desc: 'Análises inteligentes em tempo real' },
                { icon: 'fa-file-invoice', label: 'DRE & Relatórios',  desc: 'Demonstrativo de resultados' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '11px 14px', background: '#fff', borderRadius: 10, border: '1px solid var(--gray-100)' }}>
                  <div style={{ width: 34, height: 34, background: 'var(--teal)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className={`fa-solid ${item.icon}`} style={{ color: '#fff', fontSize: 13 }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn-action" style={{ width: '100%', padding: '13px 0', fontSize: 14 }} onClick={() => router.push('/dashboard')}>
              Acessar o dashboard <i className="fa-solid fa-arrow-right" style={{ marginLeft: 8 }} />
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
