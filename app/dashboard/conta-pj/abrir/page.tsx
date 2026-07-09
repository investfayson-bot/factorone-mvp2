'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

type Form = {
  cnpj: string; razao: string; faturamento: string
  resp_nome: string; resp_cpf: string; resp_email: string; resp_tel: string
  senha: string; senha2: string
}
const EMPTY: Form = { cnpj: '', razao: '', faturamento: '', resp_nome: '', resp_cpf: '', resp_email: '', resp_tel: '', senha: '', senha2: '' }

const maskCNPJ = (v: string) => v.replace(/\D/g, '').slice(0, 14).replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
const maskCPF = (v: string) => v.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
const maskTel = (v: string) => v.replace(/\D/g, '').slice(0, 11).replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min

const STEPS = ['Empresa', 'Responsável', 'Senha']

function CartaoVisual({ nome, numero, pausar }: { nome: string; numero: string; pausar?: boolean }) {
  return (
    <div style={{ width: '100%', maxWidth: 320, aspectRatio: '1.586', borderRadius: 18, padding: 22, position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, #1C2E29 0%, #13201D 55%, #0F1918 100%)', boxShadow: '0 20px 44px rgba(0,0,0,.45)', opacity: pausar ? 0.5 : 1 }}>
      <div style={{ position: 'absolute', top: -40, right: -30, width: 160, height: 160, borderRadius: '50%', background: 'rgba(126,189,184,.12)' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: '-.02em' }}>Factor<span style={{ color: '#6FA595' }}>One</span> <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.5)' }}>BANK</span></div>
        <i className="fa-solid fa-wifi" style={{ color: 'rgba(255,255,255,.5)', transform: 'rotate(90deg)', fontSize: 15 }} />
      </div>
      <div style={{ width: 40, height: 30, borderRadius: 6, background: 'linear-gradient(135deg,#D9B54A,#B08A3E)', marginTop: 18 }} />
      <div style={{ marginTop: 16, fontSize: 16, letterSpacing: '.16em', color: 'rgba(255,255,255,.92)', fontFamily: "var(--font-mono)" }}>{numero}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 12 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'rgba(255,255,255,.85)', textTransform: 'uppercase', letterSpacing: '.04em', maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome || 'SUA EMPRESA'}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', fontStyle: 'italic' }}>VISA</div>
      </div>
    </div>
  )
}

export default function AbrirContaPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<Form>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [pronto, setPronto] = useState<null | { agencia: string; conta: string; digito: string; ultimos4: string }>(null)
  const set = (k: keyof Form, v: string) => setForm(f => ({ ...f, [k]: v }))

  const numeroMasc = pronto ? `•••• •••• •••• ${pronto.ultimos4}` : '•••• •••• •••• ••••'

  function podeAvancar() {
    if (step === 0) return form.cnpj.replace(/\D/g, '').length === 14 && form.razao.trim() && form.faturamento
    if (step === 1) return form.resp_nome.trim() && form.resp_cpf.replace(/\D/g, '').length === 11 && form.resp_email.trim()
    if (step === 2) return form.senha.length >= 6 && form.senha === form.senha2
    return false
  }

  async function finalizar() {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
      const eid = (u?.empresa_id as string) || user.id
      const agencia = String(rand(1, 9999)).padStart(4, '0')
      const conta = String(rand(10000, 999999))
      const digito = String(rand(0, 9))
      const ultimos4 = String(rand(1000, 9999))
      // atualiza dados da empresa (best-effort) e cria a Conta PJ FactorOne
      await supabase.from('empresas').update({ nome: form.razao.trim(), cnpj: form.cnpj.replace(/\D/g, '') }).eq('id', eid).then(() => {}, () => {})
      await supabase.from('contas_bancarias').insert({
        empresa_id: eid, tipo: 'conta_pj_factorone', banco_nome: 'FactorOne Bank', banco_codigo: '399',
        agencia, numero_conta: conta, digito, saldo: 0, saldo_disponivel: 0, is_principal: true, status: 'ativa',
      }).then(() => {}, () => {})
      setPronto({ agencia, conta, digito, ultimos4 })
    } catch { toast.error('Falha ao abrir conta') }
    finally { setSaving(false) }
  }

  // ── Tela de boas-vindas ──────────────────────────────────
  if (pronto) {
    return (
      <div style={{ maxWidth: 560, margin: '10px auto', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg,#3D7A6E,#3D7A6E)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', boxShadow: '0 8px 24px rgba(61,122,110,.35)' }}>
          <i className="fa-solid fa-check" style={{ fontSize: 28, color: '#fff' }} />
        </div>
        <div style={{ fontSize: 25, fontWeight: 800, color: '#13201D', letterSpacing: '-.03em' }}>Sua Conta PJ está pronta! 🎉</div>
        <div style={{ fontSize: 15, color: '#7B8C88', marginTop: 6, marginBottom: 22 }}>Bem-vindo ao FactorOne Bank. Sua conta e seu cartão já estão ativos.</div>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}><CartaoVisual nome={form.razao} numero={numeroMasc} /></div>
        <div style={{ background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 14, padding: '18px 22px', textAlign: 'left', marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            {[['Banco', 'FactorOne · 399'], ['Agência', pronto.agencia], ['Conta', `${pronto.conta}-${pronto.digito}`]].map(([l, v]) => (
              <div key={l}><div style={{ fontSize: 12, color: '#7B8C88', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>{l}</div><div style={{ fontSize: 14, fontWeight: 700, color: '#13201D', fontFamily: "var(--font-sans)" }}>{v}</div></div>
            ))}
          </div>
        </div>
        <button className="btn-action" style={{ width: '100%', padding: '13px 0', fontSize: 14 }} onClick={() => router.push('/dashboard/banco')}>
          Ir para minha conta <i className="fa-solid fa-arrow-right" style={{ marginLeft: 8 }} />
        </button>
      </div>
    )
  }

  return (
    <>
      {/* Banco Fase 1: traga seu banco. Abrir conta PJ própria = em breve. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--gold-tint)', border: '1px solid var(--gold)', borderRadius: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <i className="fa-solid fa-clock" style={{ color: 'var(--gold)' }} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: '#13201D' }}>Abrir Conta PJ FactorOne — <span style={{ color: 'var(--gold)' }}>em breve</span></div>
          <div style={{ fontSize: 13.5, color: '#7B8C88' }}>Por enquanto, conecte o banco que você já tem (Open Finance) e gerencie cartões e transações aqui.</div>
        </div>
        <button className="btn-action" style={{ fontSize: 14 }} onClick={() => router.push('/dashboard/conexoes')}>
          <i className="fa-solid fa-link" style={{ marginRight: 6 }} />Conectar meu banco
        </button>
      </div>
    <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 0, background: '#fff', border: '0.5px solid #E4DCCC', borderRadius: 18, overflow: 'hidden', minHeight: 520 }}>
      {/* Painel esquerdo — foto premium (banco digital) */}
      <div style={{ position: 'relative', padding: '32px 30px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', minHeight: 540, backgroundImage: 'linear-gradient(180deg, rgba(28,43,42,.20) 0%, rgba(28,43,42,.55) 52%, rgba(15,25,24,.96) 100%), url(/banco-hero.jpg)', backgroundSize: 'cover', backgroundPosition: 'center top' }}>
        <div style={{ position: 'absolute', top: 28, left: 30, fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-.03em' }}>Factor<span style={{ color: '#6FA595' }}>One</span> <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.6)' }}>BANK</span></div>
        <div style={{ fontSize: 23, fontWeight: 800, color: '#fff', letterSpacing: '-.03em', lineHeight: 1.15 }}>Sua conta PJ que<br />trabalha por você</div>
        <div style={{ fontSize: 14.5, color: 'rgba(255,255,255,.72)', margin: '6px 0 18px' }}>Abra em minutos · sem tarifas · cartão na hora</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {[['fa-bolt', 'PIX ilimitado e grátis'], ['fa-credit-card', 'Cartão virtual na hora'], ['fa-percent', 'Rendimento no CDI'], ['fa-shield-halved', 'Regulado e seguro']].map(([i, t]) => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(126,189,184,.20)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className={`fa-solid ${i}`} style={{ fontSize: 13, color: '#6FA595' }} /></div>
              <span style={{ fontSize: 14.5, color: 'rgba(255,255,255,.9)' }}>{t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Formulário */}
      <div style={{ padding: '34px 36px', display: 'flex', flexDirection: 'column' }}>
        {/* Progresso */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 26 }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ flex: 1 }}>
              <div style={{ height: 4, borderRadius: 99, background: i <= step ? '#3D7A6E' : '#E4DCCC', transition: 'background .2s' }} />
              <div style={{ fontSize: 12.5, fontWeight: i === step ? 700 : 500, color: i === step ? '#13201D' : '#A6B0AC', marginTop: 6 }}>{s}</div>
            </div>
          ))}
        </div>

        <div style={{ flex: 1 }}>
          {step === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#13201D', letterSpacing: '-.02em' }}>Dados da empresa</div>
              <Field label="CNPJ *"><input className="form-input" placeholder="00.000.000/0001-00" value={form.cnpj} onChange={e => set('cnpj', maskCNPJ(e.target.value))} /></Field>
              <Field label="Razão social *"><input className="form-input" placeholder="Sua Empresa Ltda" value={form.razao} onChange={e => set('razao', e.target.value)} /></Field>
              <Field label="Faturamento mensal *">
                <select className="form-input" value={form.faturamento} onChange={e => set('faturamento', e.target.value)}>
                  <option value="">Selecione…</option>
                  <option value="10000">Até R$ 10 mil</option><option value="50000">R$ 10–50 mil</option>
                  <option value="150000">R$ 50–150 mil</option><option value="500000">R$ 150–500 mil</option><option value="999999">Acima de R$ 500 mil</option>
                </select>
              </Field>
            </div>
          )}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#13201D', letterSpacing: '-.02em' }}>Responsável pela conta</div>
              <Field label="Nome completo *"><input className="form-input" placeholder="Nome do sócio administrador" value={form.resp_nome} onChange={e => set('resp_nome', e.target.value)} /></Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="CPF *"><input className="form-input" placeholder="000.000.000-00" value={form.resp_cpf} onChange={e => set('resp_cpf', maskCPF(e.target.value))} /></Field>
                <Field label="Telefone"><input className="form-input" placeholder="(11) 99999-9999" value={form.resp_tel} onChange={e => set('resp_tel', maskTel(e.target.value))} /></Field>
              </div>
              <Field label="E-mail *"><input className="form-input" type="email" placeholder="voce@empresa.com" value={form.resp_email} onChange={e => set('resp_email', e.target.value)} /></Field>
            </div>
          )}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#13201D', letterSpacing: '-.02em' }}>Crie sua senha</div>
              <Field label="Senha *"><input className="form-input" type="password" placeholder="Mínimo 6 caracteres" value={form.senha} onChange={e => set('senha', e.target.value)} /></Field>
              <Field label="Confirmar senha *"><input className="form-input" type="password" placeholder="Repita a senha" value={form.senha2} onChange={e => set('senha2', e.target.value)} /></Field>
              {form.senha2 && form.senha !== form.senha2 && <div style={{ fontSize: 13.5, color: '#B0413E' }}>As senhas não conferem</div>}
              <div style={{ background: '#E9F0ED', borderRadius: 10, padding: '11px 14px', fontSize: 13.5, color: '#2B564D', lineHeight: 1.5 }}>
                <i className="fa-solid fa-circle-check" style={{ marginRight: 6 }} />No FactorOne Bank sua conta é aberta na hora — sem espera.
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          {step > 0 && <button className="btn-action btn-ghost" style={{ flex: 1 }} onClick={() => setStep(s => s - 1)}>Voltar</button>}
          {step < 2 ? (
            <button className="btn-action" style={{ flex: 2, opacity: podeAvancar() ? 1 : .5 }} disabled={!podeAvancar()} onClick={() => setStep(s => s + 1)}>Continuar →</button>
          ) : (
            <button className="btn-action" style={{ flex: 2, opacity: (podeAvancar() && !saving) ? 1 : .5, background: '#3D7A6E' }} disabled={!podeAvancar() || saving} onClick={() => void finalizar()}>
              {saving ? 'Abrindo conta…' : '✓ Abrir minha conta'}
            </button>
          )}
        </div>
      </div>
    </div>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12.5, fontWeight: 600, color: '#7B8C88', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</label>
      {children}
    </div>
  )
}
