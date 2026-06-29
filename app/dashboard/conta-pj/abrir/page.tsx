'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

type Step = 1 | 2 | 3 | 4 | 5

const STEPS = [
  { id: 1, label: 'Empresa', icon: 'fa-building' },
  { id: 2, label: 'Sócios', icon: 'fa-users' },
  { id: 3, label: 'Documentos', icon: 'fa-file-shield' },
  { id: 4, label: 'Selfie', icon: 'fa-camera' },
  { id: 5, label: 'Senha', icon: 'fa-lock' },
]

type Form = {
  cnpj: string; razao: string; nome_fantasia: string; email: string; telefone: string; faturamento: string
  socio_nome: string; socio_cpf: string; socio_email: string; socio_percentual: string
  doc_contrato: File | null; doc_cnpj: File | null; doc_comprovante: File | null
  selfie_ok: boolean; senha: string; senha_confirm: string
}

const EMPTY: Form = {
  cnpj: '', razao: '', nome_fantasia: '', email: '', telefone: '', faturamento: '',
  socio_nome: '', socio_cpf: '', socio_email: '', socio_percentual: '100',
  doc_contrato: null, doc_cnpj: null, doc_comprovante: null,
  selfie_ok: false, senha: '', senha_confirm: '',
}

function maskCNPJ(v: string) { return v.replace(/\D/g, '').slice(0, 14).replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') }
function maskCPF(v: string) { return v.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') }
function maskPhone(v: string) { return v.replace(/\D/g, '').slice(0, 11).replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3') }

export default function AbrirContaPJPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [form, setForm] = useState<Form>(EMPTY)
  const [saving, setSaving] = useState(false)

  function set(k: keyof Form, v: string | boolean | File | null) { setForm(f => ({ ...f, [k]: v })) }

  function next() { if (step < 5) setStep(s => (s + 1) as Step) }
  function back() { if (step > 1) setStep(s => (s - 1) as Step) }

  function canNext() {
    if (step === 1) return form.cnpj.replace(/\D/g,'').length === 14 && form.razao && form.email && form.telefone && form.faturamento
    if (step === 2) return form.socio_nome && form.socio_cpf.replace(/\D/g,'').length === 11 && form.socio_email
    if (step === 3) return true
    if (step === 4) return form.selfie_ok
    if (step === 5) return form.senha.length >= 6 && form.senha === form.senha_confirm
    return false
  }

  async function finalizar() {
    if (form.senha !== form.senha_confirm) { toast.error('Senhas não conferem'); return }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
      const eid = u?.empresa_id || user.id
      await supabase.from('conta_pj_onboarding').upsert({
        empresa_id: eid, cnpj: form.cnpj.replace(/\D/g,''),
        razao_social: form.razao, nome_fantasia: form.nome_fantasia,
        email: form.email, telefone: form.telefone.replace(/\D/g,''),
        faturamento_mensal: Number(form.faturamento.replace(/\D/g,'')),
        socio_nome: form.socio_nome, socio_cpf: form.socio_cpf.replace(/\D/g,''),
        socio_email: form.socio_email, socio_percentual: Number(form.socio_percentual),
        status: 'em_analise', created_at: new Date().toISOString(),
      })
      toast.success('Solicitação enviada! Analisaremos em até 24h.')
      router.push('/dashboard/conta-pj')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao enviar')
    } finally { setSaving(false) }
  }

  const pct = ((step - 1) / 4) * 100

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: '#1C2B2A', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
          <i className="fa-solid fa-building-columns" style={{ fontSize: 22, color: '#7EBDB8' }} />
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#1C2B2A', letterSpacing: '-0.02em' }}>Abrir Conta PJ</div>
        <div style={{ fontSize: 12, color: '#7A8F8E', marginTop: 4 }}>Powered by Celcoin · Análise em até 24h</div>
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28, gap: 0 }}>
        {STEPS.map((s, i) => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
                background: step > s.id ? '#5E8C87' : step === s.id ? '#1C2B2A' : '#E2E8E7',
                color: step >= s.id ? '#fff' : '#7A8F8E',
                transition: 'all 0.2s',
              }}>
                {step > s.id ? <i className="fa-solid fa-check" style={{ fontSize: 11 }} /> : <i className={`fa-solid ${s.icon}`} style={{ fontSize: 12 }} />}
              </div>
              <div style={{ fontSize: 9, fontWeight: 600, color: step === s.id ? '#1C2B2A' : '#AAB8B7', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{s.label}</div>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: 2, background: step > s.id ? '#5E8C87' : '#E2E8E7', margin: '0 6px 14px', transition: 'background 0.3s' }} />
            )}
          </div>
        ))}
      </div>

      {/* Card */}
      <div style={{ background: '#fff', border: '0.5px solid #E2E8E7', borderRadius: 16, padding: '24px 24px', marginBottom: 16 }}>

        {/* STEP 1 — Empresa */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1C2B2A', marginBottom: 4 }}>Dados da empresa</div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#7A8F8E', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>CNPJ *</label>
              <input className="form-input" placeholder="00.000.000/0001-00" value={form.cnpj} onChange={e => set('cnpj', maskCNPJ(e.target.value))} style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#7A8F8E', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Razão Social *</label>
              <input className="form-input" placeholder="Nome Empresarial Ltda" value={form.razao} onChange={e => set('razao', e.target.value)} style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#7A8F8E', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Nome Fantasia</label>
              <input className="form-input" placeholder="Como a empresa é conhecida" value={form.nome_fantasia} onChange={e => set('nome_fantasia', e.target.value)} style={{ width: '100%' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#7A8F8E', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>E-mail *</label>
                <input className="form-input" type="email" placeholder="financeiro@empresa.com" value={form.email} onChange={e => set('email', e.target.value)} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#7A8F8E', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Telefone *</label>
                <input className="form-input" placeholder="(11) 99999-9999" value={form.telefone} onChange={e => set('telefone', maskPhone(e.target.value))} style={{ width: '100%' }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#7A8F8E', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Faturamento mensal estimado *</label>
              <select className="form-input" value={form.faturamento} onChange={e => set('faturamento', e.target.value)} style={{ width: '100%' }}>
                <option value="">Selecione...</option>
                <option value="10000">Até R$ 10.000</option>
                <option value="50000">R$ 10.000 – R$ 50.000</option>
                <option value="150000">R$ 50.000 – R$ 150.000</option>
                <option value="500000">R$ 150.000 – R$ 500.000</option>
                <option value="999999">Acima de R$ 500.000</option>
              </select>
            </div>
          </div>
        )}

        {/* STEP 2 — Sócios */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1C2B2A', marginBottom: 4 }}>Sócio administrador</div>
            <div style={{ background: '#F8FAFA', borderRadius: 10, padding: '10px 12px', fontSize: 11, color: '#7A8F8E', lineHeight: 1.5 }}>
              <i className="fa-solid fa-circle-info" style={{ color: '#5E8C87', marginRight: 6 }} />
              Informe o sócio com poderes de administração. Para múltiplos sócios, você poderá adicionar depois.
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#7A8F8E', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Nome completo *</label>
              <input className="form-input" placeholder="Nome como no documento" value={form.socio_nome} onChange={e => set('socio_nome', e.target.value)} style={{ width: '100%' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#7A8F8E', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>CPF *</label>
                <input className="form-input" placeholder="000.000.000-00" value={form.socio_cpf} onChange={e => set('socio_cpf', maskCPF(e.target.value))} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#7A8F8E', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Participação %</label>
                <input className="form-input" type="number" min="1" max="100" placeholder="100" value={form.socio_percentual} onChange={e => set('socio_percentual', e.target.value)} style={{ width: '100%' }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#7A8F8E', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>E-mail do sócio *</label>
              <input className="form-input" type="email" placeholder="socio@email.com" value={form.socio_email} onChange={e => set('socio_email', e.target.value)} style={{ width: '100%' }} />
            </div>
          </div>
        )}

        {/* STEP 3 — Documentos */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1C2B2A', marginBottom: 4 }}>Documentos da empresa</div>
            {[
              { key: 'doc_contrato' as keyof Form, label: 'Contrato Social ou Requerimento MEI', desc: 'PDF ou imagem · máx 10MB' },
              { key: 'doc_cnpj' as keyof Form, label: 'Cartão CNPJ atualizado', desc: 'PDF ou imagem · emitido há menos de 90 dias' },
              { key: 'doc_comprovante' as keyof Form, label: 'Comprovante de endereço da empresa', desc: 'Conta de luz, água ou contrato — últimos 3 meses' },
            ].map(d => (
              <div key={d.key}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#7A8F8E', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{d.label}</label>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10,
                  border: form[d.key] ? '0.5px solid #5E8C87' : '1.5px dashed #D1D9D8',
                  background: form[d.key] ? '#EAF5F3' : '#F8FAFA', cursor: 'pointer',
                }}>
                  <i className={`fa-solid ${form[d.key] ? 'fa-file-check' : 'fa-cloud-arrow-up'}`} style={{ fontSize: 18, color: form[d.key] ? '#5E8C87' : '#C4CFCE' }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: form[d.key] ? '#0F6E56' : '#3A5150' }}>
                      {form[d.key] ? (form[d.key] as File).name : 'Clique para enviar'}
                    </div>
                    <div style={{ fontSize: 10, color: '#7A8F8E' }}>{d.desc}</div>
                  </div>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={e => set(d.key, e.target.files?.[0] ?? null)} />
                </label>
              </div>
            ))}
          </div>
        )}

        {/* STEP 4 — Selfie */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1C2B2A', marginBottom: 4 }}>Verificação de identidade</div>
            <div style={{ width: 120, height: 120, borderRadius: '50%', background: form.selfie_ok ? '#EAF5F3' : '#F4F6F5', border: `3px solid ${form.selfie_ok ? '#5E8C87' : '#E2E8E7'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '8px auto' }}>
              <i className={`fa-solid ${form.selfie_ok ? 'fa-circle-check' : 'fa-camera'}`} style={{ fontSize: 40, color: form.selfie_ok ? '#5E8C87' : '#C4CFCE' }} />
            </div>
            <div style={{ fontSize: 12, color: '#7A8F8E', lineHeight: 1.6, maxWidth: 360 }}>
              Precisamos verificar sua identidade. Tire uma selfie segurando seu documento de identidade aberto.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left', background: '#F8FAFA', borderRadius: 10, padding: '12px 16px', width: '100%', marginTop: 4 }}>
              {['Boa iluminação, sem sombras', 'Rosto e documento visíveis', 'Documento legível e sem reflexos', 'Expressão neutra, olhos abertos'].map(t => (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#3A5150' }}>
                  <i className="fa-solid fa-check" style={{ fontSize: 10, color: '#5E8C87' }} />{t}
                </div>
              ))}
            </div>
            {!form.selfie_ok ? (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#1C2B2A', color: '#fff', padding: '10px 24px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', marginTop: 8 }}>
                <i className="fa-solid fa-camera" />
                Tirar selfie / enviar foto
                <input type="file" accept="image/*" capture="user" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) set('selfie_ok', true) }} />
              </label>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#EAF5F3', color: '#0F6E56', padding: '10px 24px', borderRadius: 9, fontSize: 12, fontWeight: 700 }}>
                <i className="fa-solid fa-circle-check" />Foto enviada com sucesso
              </div>
            )}
          </div>
        )}

        {/* STEP 5 — Senha */}
        {step === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1C2B2A', marginBottom: 4 }}>Crie sua senha da conta</div>
            <div style={{ background: '#F8FAFA', borderRadius: 10, padding: '10px 12px', fontSize: 11, color: '#7A8F8E', lineHeight: 1.5 }}>
              <i className="fa-solid fa-shield-halved" style={{ color: '#5E8C87', marginRight: 6 }} />
              Senha exclusiva para a Conta PJ — diferente da senha do FactorOne.
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#7A8F8E', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Senha *</label>
              <input className="form-input" type="password" placeholder="Mínimo 6 caracteres" value={form.senha} onChange={e => set('senha', e.target.value)} style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#7A8F8E', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Confirmar senha *</label>
              <input className="form-input" type="password" placeholder="Repita a senha" value={form.senha_confirm} onChange={e => set('senha_confirm', e.target.value)} style={{ width: '100%' }} />
              {form.senha_confirm && form.senha !== form.senha_confirm && (
                <div style={{ fontSize: 11, color: '#E74C3C', marginTop: 4 }}>Senhas não conferem</div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: '#F8FAFA', borderRadius: 10, padding: '12px 14px' }}>
              {[
                { ok: form.senha.length >= 6, label: 'Mínimo 6 caracteres' },
                { ok: /[A-Z]/.test(form.senha), label: 'Uma letra maiúscula' },
                { ok: /[0-9]/.test(form.senha), label: 'Um número' },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11 }}>
                  <i className={`fa-solid ${r.ok ? 'fa-check' : 'fa-circle'}`} style={{ fontSize: 10, color: r.ok ? '#5E8C87' : '#C4CFCE' }} />
                  <span style={{ color: r.ok ? '#3A5150' : '#AAB8B7' }}>{r.label}</span>
                </div>
              ))}
            </div>
            <div style={{ background: '#EAF5F3', borderRadius: 10, padding: '12px 14px', fontSize: 11, color: '#0F6E56', lineHeight: 1.5 }}>
              <i className="fa-solid fa-circle-check" style={{ marginRight: 6 }} />
              Ao finalizar, sua solicitação será analisada pela Celcoin em até 24 horas úteis. Você receberá um e-mail com o resultado.
            </div>
          </div>
        )}
      </div>

      {/* Botões */}
      <div style={{ display: 'flex', gap: 10 }}>
        {step > 1 && (
          <button onClick={back} style={{ flex: 1, padding: '11px', borderRadius: 9, border: '0.5px solid #E2E8E7', background: '#fff', color: '#3A5150', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            ← Voltar
          </button>
        )}
        {step < 5 ? (
          <button onClick={next} disabled={!canNext()} style={{
            flex: 2, padding: '11px', borderRadius: 9, border: 'none', fontSize: 12, fontWeight: 700, cursor: canNext() ? 'pointer' : 'not-allowed',
            background: canNext() ? '#1C2B2A' : '#E2E8E7', color: canNext() ? '#fff' : '#AAB8B7', transition: 'all 0.15s',
          }}>
            Continuar →
          </button>
        ) : (
          <button onClick={finalizar} disabled={!canNext() || saving} style={{
            flex: 2, padding: '11px', borderRadius: 9, border: 'none', fontSize: 12, fontWeight: 700, cursor: canNext() ? 'pointer' : 'not-allowed',
            background: canNext() ? '#5E8C87' : '#E2E8E7', color: '#fff', transition: 'all 0.15s',
          }}>
            {saving ? 'Enviando...' : '✓ Enviar solicitação'}
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ marginTop: 16, height: 3, background: '#E2E8E7', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: '#5E8C87', borderRadius: 99, transition: 'width 0.3s' }} />
      </div>
      <div style={{ textAlign: 'center', fontSize: 10, color: '#AAB8B7', marginTop: 6 }}>
        Passo {step} de 5 · Dados criptografados com AES-256
      </div>
    </div>
  )
}
