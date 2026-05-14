'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

type Step = 'perfil' | 'empresa' | 'banco' | 'pronto'

const FEAT_EMP = ['Gestão financeira completa', 'NF-e / DRE automático', 'Cartões corporativos', 'Módulo fiscal & contador', 'AI CFO em tempo real']
const FEAT_PES = ['Controle de gastos', 'Contas a pagar/receber', 'Orçamento mensal', 'Onde vai meu dinheiro', 'Assinaturas e fixos']

const SETORES = ['Tecnologia', 'Comércio', 'Serviços', 'Indústria', 'Saúde', 'Educação', 'Construção', 'Agronegócio', 'Transporte / Logística', 'Alimentação', 'Outro']
const BANCOS = ['Banco do Brasil', 'Bradesco', 'Caixa Econômica', 'Itaú', 'Santander', 'Nubank', 'Inter', 'Sicoob', 'XP', 'BTG Pactual', 'Outro']

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('perfil')
  const [loading, setLoading] = useState(false)
  const [empresaId, setEmpresaId] = useState('')

  const [empresa, setEmpresa] = useState({ nome: '', cnpj: '', setor: '' })
  const [banco, setBanco] = useState({ nome: '', tipo: 'corrente', saldo: '' })
  const [skipBanco, setSkipBanco] = useState(false)

  async function escolherPessoal() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      await supabase.from('perfil_usuario').upsert({ user_id: user.id, tipo: 'pessoal' }, { onConflict: 'user_id' })
      router.push('/dashboard-pessoal')
    } catch {
      toast.error('Falha ao salvar perfil')
    } finally {
      setLoading(false)
    }
  }

  async function escolherEmpresarial() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      await supabase.from('perfil_usuario').upsert({ user_id: user.id, tipo: 'empresarial' }, { onConflict: 'user_id' })
      // Resolve empresa_id do usuário
      const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
      setEmpresaId(u?.empresa_id ?? user.id)
      setStep('empresa')
    } catch {
      toast.error('Falha ao salvar perfil')
    } finally {
      setLoading(false)
    }
  }

  async function salvarEmpresa() {
    if (!empresa.nome.trim()) { toast.error('Informe o nome da empresa'); return }
    setLoading(true)
    try {
      await supabase.from('empresas').update({
        nome: empresa.nome.trim(),
        ...(empresa.cnpj ? { cnpj: empresa.cnpj.replace(/\D/g, '') } : {}),
        ...(empresa.setor ? { setor: empresa.setor } : {}),
      }).eq('id', empresaId)
      setStep('banco')
    } catch {
      toast.error('Falha ao salvar dados da empresa')
    } finally {
      setLoading(false)
    }
  }

  async function salvarBanco() {
    setLoading(true)
    try {
      if (!skipBanco && banco.nome) {
        await supabase.from('contas_bancarias').insert({
          empresa_id: empresaId,
          nome: banco.nome,
          tipo: banco.tipo,
          saldo_atual: Number(banco.saldo.replace(',', '.') || 0),
          saldo_disponivel: Number(banco.saldo.replace(',', '.') || 0),
          ativa: true,
        })
      }
      setStep('pronto')
    } catch {
      toast.error('Falha ao salvar conta bancária')
    } finally {
      setLoading(false)
    }
  }

  const stepNum = step === 'empresa' ? 1 : step === 'banco' ? 2 : step === 'pronto' ? 3 : 0
  const totalSteps = 3

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      {/* Logo */}
      <div style={{ marginBottom: 28, textAlign: 'center' }}>
        <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 24, fontWeight: 800, color: 'var(--navy)', letterSpacing: '-.04em', marginBottom: 6 }}>
          Factor<span style={{ color: 'var(--teal)' }}>One</span>
        </div>
        {step !== 'perfil' && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
            {[1, 2, 3].map(n => (
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                  background: n < stepNum ? 'var(--teal)' : n === stepNum ? 'var(--navy)' : 'var(--gray-100)',
                  color: n <= stepNum ? '#fff' : 'var(--gray-400)',
                }}>{n < stepNum ? '✓' : n}</div>
                {n < 3 && <div style={{ width: 24, height: 2, background: n < stepNum ? 'var(--teal)' : 'var(--gray-100)', borderRadius: 1 }} />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* STEP: Perfil */}
      {step === 'perfil' && (
        <>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 18, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>Como você quer usar a FactorOne?</div>
            <div style={{ fontSize: 11, color: 'var(--gray-400)', fontFamily: "'DM Mono',monospace" }}>Escolha seu modo principal — você pode alterar depois.</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, width: '100%', maxWidth: 680 }}>
            <div style={{ background: '#fff', border: '2px solid var(--teal)', borderRadius: 12, padding: '22px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
              <div style={{ width: 40, height: 40, background: 'var(--teal)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <i className="fa-solid fa-building" style={{ color: '#fff', fontSize: 16 }} />
              </div>
              <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>Empresarial</div>
              <div style={{ fontSize: 11, color: 'var(--gray-400)', fontFamily: "'DM Mono',monospace", marginBottom: 16 }}>Para PMEs e empresas</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 20 }}>
                {FEAT_EMP.map(f => (
                  <div key={f} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--gray-500)' }}>
                    <span style={{ color: 'var(--teal)', fontWeight: 700, flexShrink: 0 }}>✓</span> {f}
                  </div>
                ))}
              </div>
              <button className="btn-action" style={{ width: '100%', padding: '10px 0', fontSize: 13, opacity: loading ? .6 : 1 }} onClick={() => void escolherEmpresarial()} disabled={loading}>
                {loading ? 'Salvando…' : 'Começar como Empresa'}
              </button>
            </div>
            <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: '22px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
              <div style={{ width: 40, height: 40, background: 'var(--gray-100)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <i className="fa-solid fa-user" style={{ color: 'var(--gray-500)', fontSize: 16 }} />
              </div>
              <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>Pessoa Física</div>
              <div style={{ fontSize: 11, color: 'var(--gray-400)', fontFamily: "'DM Mono',monospace", marginBottom: 16 }}>Para finanças pessoais</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 20 }}>
                {FEAT_PES.map(f => (
                  <div key={f} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--gray-500)' }}>
                    <span style={{ color: 'var(--gray-400)', fontWeight: 700, flexShrink: 0 }}>·</span> {f}
                  </div>
                ))}
              </div>
              <button className="btn-action btn-ghost" style={{ width: '100%', padding: '10px 0', fontSize: 13, opacity: loading ? .6 : 1 }} onClick={() => void escolherPessoal()} disabled={loading}>
                {loading ? 'Salvando…' : 'Começar como Pessoa'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* STEP 1: Dados da Empresa */}
      {step === 'empresa' && (
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 16, padding: '28px 32px', width: '100%', maxWidth: 480, boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 17, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>Dados da sua empresa</div>
            <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>Essas informações aparecerão nos relatórios e documentos fiscais.</div>
          </div>
          <div className="form-group">
            <label className="form-label">Nome da empresa <span style={{ color: 'var(--red)' }}>*</span></label>
            <input className="form-input" placeholder="Ex: Acme Tecnologia Ltda" value={empresa.nome} onChange={e => setEmpresa(p => ({ ...p, nome: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">CNPJ</label>
            <input className="form-input" placeholder="00.000.000/0000-00" value={empresa.cnpj} onChange={e => setEmpresa(p => ({ ...p, cnpj: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Setor de atuação</label>
            <select className="form-input" value={empresa.setor} onChange={e => setEmpresa(p => ({ ...p, setor: e.target.value }))}>
              <option value="">Selecione</option>
              {SETORES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>
            <button className="btn-action btn-ghost" style={{ flex: 1 }} onClick={() => setStep('perfil')}>Voltar</button>
            <button className="btn-action" style={{ flex: 2, opacity: loading ? .6 : 1 }} onClick={() => void salvarEmpresa()} disabled={loading}>
              {loading ? 'Salvando…' : 'Continuar'}
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Conta Bancária */}
      {step === 'banco' && (
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 16, padding: '28px 32px', width: '100%', maxWidth: 480, boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 17, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>Conta bancária principal</div>
            <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>Adicione agora para ver seu saldo e fluxo de caixa. Pode pular e fazer depois.</div>
          </div>

          {!skipBanco && (
            <>
              <div className="form-group">
                <label className="form-label">Banco</label>
                <select className="form-input" value={banco.nome} onChange={e => setBanco(p => ({ ...p, nome: e.target.value }))}>
                  <option value="">Selecione</option>
                  {BANCOS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tipo de conta</label>
                <select className="form-input" value={banco.tipo} onChange={e => setBanco(p => ({ ...p, tipo: e.target.value }))}>
                  <option value="corrente">Conta Corrente</option>
                  <option value="poupanca">Poupança</option>
                  <option value="pagamentos">Conta de Pagamentos</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Saldo inicial (R$)</label>
                <input className="form-input" placeholder="0,00" value={banco.saldo} onChange={e => setBanco(p => ({ ...p, saldo: e.target.value }))} />
              </div>
            </>
          )}

          <div style={{ marginTop: skipBanco ? 0 : 8, marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--gray-500)', cursor: 'pointer' }}>
              <input type="checkbox" checked={skipBanco} onChange={e => setSkipBanco(e.target.checked)} />
              Pular por agora, configurar depois
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-action btn-ghost" style={{ flex: 1 }} onClick={() => setStep('empresa')}>Voltar</button>
            <button className="btn-action" style={{ flex: 2, opacity: loading ? .6 : 1 }} onClick={() => void salvarBanco()} disabled={loading}>
              {loading ? 'Salvando…' : skipBanco ? 'Pular e continuar' : 'Adicionar e continuar'}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Pronto */}
      {step === 'pronto' && (
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 16, padding: '36px 32px', width: '100%', maxWidth: 440, textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
          <div style={{ width: 56, height: 56, background: 'var(--teal)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <i className="fa-solid fa-check" style={{ color: '#fff', fontSize: 22 }} />
          </div>
          <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 20, fontWeight: 800, color: 'var(--navy)', marginBottom: 8 }}>
            {empresa.nome || 'Empresa'} pronta!
          </div>
          <div style={{ fontSize: 12, color: 'var(--gray-400)', lineHeight: 1.7, marginBottom: 28 }}>
            Sua conta está configurada. Explore o dashboard, cadastre transações e use o AI CFO para análises em tempo real.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20, textAlign: 'left' }}>
            {[
              { icon: 'fa-chart-line', label: 'Dashboard financeiro', desc: 'Visão geral do caixa e métricas' },
              { icon: 'fa-robot', label: 'AI CFO', desc: 'Análises e insights inteligentes' },
              { icon: 'fa-file-invoice', label: 'DRE & Relatórios', desc: 'Demonstrativo de resultados' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 14px', background: 'rgba(94,140,135,.05)', borderRadius: 8, border: '1px solid rgba(94,140,135,.12)' }}>
                <div style={{ width: 32, height: 32, background: 'var(--teal)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className={`fa-solid ${item.icon}`} style={{ color: '#fff', fontSize: 13 }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <button className="btn-action" style={{ width: '100%', padding: '12px 0', fontSize: 14 }} onClick={() => router.push('/dashboard')}>
            Acessar o dashboard <i className="fa-solid fa-arrow-right" style={{ marginLeft: 6 }} />
          </button>
        </div>
      )}
    </div>
  )
}
