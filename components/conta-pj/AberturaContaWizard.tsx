'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { maskCpfCnpj } from '@/lib/masks'

export default function AberturaContaWizard() {
  const [etapa, setEtapa] = useState(1)
  const [empresaId, setEmpresaId] = useState('')
  const [empresa, setEmpresa] = useState({ cnpj: '', razao_social: '', cnae: '', data_abertura: '' })
  const [socios, setSocios] = useState([{ nome: '', cpf: '', participacao: 0 }])
  const [documentos, setDocumentos] = useState<Record<string, string>>({})
  const [banco, setBanco] = useState('FactorOne Bank')
  const [aceite, setAceite] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const progresso = useMemo(() => (etapa / 4) * 100, [etapa])

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const u = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
      const id = (u.data?.empresa_id as string) || user.id
      setEmpresaId(id)
      const e = await supabase.from('empresas').select('cnpj,nome').eq('id', id).maybeSingle()
      setEmpresa((prev) => ({ ...prev, cnpj: e.data?.cnpj || prev.cnpj, razao_social: e.data?.nome || prev.razao_social }))
    })()
  }, [])

  async function salvarProgresso() {
    setSaving(true)
    setMsg('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !empresaId) return
    const { error } = await supabase.from('abertura_conta_pj').upsert({
      empresa_id: empresaId,
      cnpj: empresa.cnpj,
      razao_social: empresa.razao_social,
      cnae: empresa.cnae,
      data_abertura: empresa.data_abertura,
      socios,
      documentos,
      banco_escolhido: banco,
      etapa_atual: etapa,
      updated_at: new Date().toISOString(),
    })
    setSaving(false)
    setMsg(error ? error.message : 'Progresso salvo com sucesso.')
  }

  async function concluirSolicitacao() {
    if (!aceite) return setMsg('Confirme os termos para continuar.')
    setSaving(true)
    const { error } = await supabase.from('contas_bancarias').insert({
      empresa_id: empresaId,
      tipo: 'conta_pj_factorone',
      banco_nome: banco,
      banco_codigo: '399',
      is_principal: true,
      status: 'pendente',
      saldo: 0,
      saldo_disponivel: 0,
      saldo_bloqueado: 0,
    })
    setSaving(false)
    setMsg(error ? error.message : 'Solicitação enviada. Conta em análise bancária.')
  }

  const card: React.CSSProperties = { background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 20, marginBottom: 14 }
  const sectionTitle: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginBottom: 14 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 17, fontWeight: 700, color: 'var(--navy)' }}>Abertura de Conta PJ</div>
        <div style={{ fontSize: 11, color: 'var(--gray-400)', fontFamily: "'DM Mono',monospace" }}>Fluxo profissional de onboarding bancário (KYB, sócios e compliance).</div>
      </div>

      {/* Progress */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          {[1, 2, 3, 4].map((n) => (
            <div key={n} style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, background: etapa >= n ? 'var(--teal)' : 'var(--gray-100)', color: etapa >= n ? '#fff' : 'var(--gray-400)' }}>{n}</div>
          ))}
        </div>
        <div style={{ height: 6, background: 'var(--gray-100)', borderRadius: 4 }}>
          <div style={{ height: 6, borderRadius: 4, background: 'var(--teal)', width: `${progresso}%`, transition: 'width .3s' }} />
        </div>
      </div>

      {/* Step content */}
      <div style={card}>
        {etapa === 1 && (
          <div>
            <div style={sectionTitle}>Etapa 1 — Dados da Empresa</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input className="form-input" placeholder="CNPJ" value={empresa.cnpj} onChange={(e) => setEmpresa({ ...empresa, cnpj: maskCpfCnpj(e.target.value) })} />
              <input className="form-input" placeholder="Razão social" value={empresa.razao_social} onChange={(e) => setEmpresa({ ...empresa, razao_social: e.target.value })} />
              <input className="form-input" placeholder="CNAE principal" value={empresa.cnae} onChange={(e) => setEmpresa({ ...empresa, cnae: e.target.value })} />
              <input type="date" className="form-input" value={empresa.data_abertura} onChange={(e) => setEmpresa({ ...empresa, data_abertura: e.target.value })} />
            </div>
          </div>
        )}
        {etapa === 2 && (
          <div>
            <div style={sectionTitle}>Etapa 2 — Quadro societário</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {socios.map((s, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <input className="form-input" placeholder="Nome completo" value={s.nome} onChange={(e) => { const c = [...socios]; c[i].nome = e.target.value; setSocios(c) }} />
                  <input className="form-input" placeholder="CPF" value={s.cpf} onChange={(e) => { const c = [...socios]; c[i].cpf = e.target.value; setSocios(c) }} />
                  <input type="number" className="form-input" placeholder="Participação %" value={s.participacao} onChange={(e) => { const c = [...socios]; c[i].participacao = Number(e.target.value || 0); setSocios(c) }} />
                </div>
              ))}
              <button className="btn-action btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setSocios([...socios, { nome: '', cpf: '', participacao: 0 }])}>+ Adicionar sócio</button>
            </div>
          </div>
        )}
        {etapa === 3 && (
          <div>
            <div style={sectionTitle}>Etapa 3 — Documentos e Compliance</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {['contrato_social', 'rg_cnh', 'comprovante_endereco', 'alvara'].map((doc) => (
                <label key={doc} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--gray-50, #fafafa)', border: '1px solid var(--gray-100)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--navy)', cursor: 'pointer' }}>
                  <span>{doc.replace(/_/g, ' ')}</span>
                  <input type="file" style={{ fontSize: 11 }} onChange={(e) => setDocumentos({ ...documentos, [doc]: e.target.files?.[0]?.name || '' })} />
                </label>
              ))}
            </div>
          </div>
        )}
        {etapa === 4 && (
          <div>
            <div style={sectionTitle}>Etapa 4 — Plano da Conta</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
              {['FactorOne Bank', 'FactorOne Premium', 'FactorOne Cash+'].map((b) => (
                <button key={b} onClick={() => setBanco(b)} style={{ borderRadius: 10, border: banco === b ? '2px solid var(--teal)' : '1px solid var(--gray-100)', background: banco === b ? 'rgba(94,140,135,.08)' : '#fff', padding: 14, textAlign: 'left', cursor: 'pointer' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>{b}</div>
                </button>
              ))}
            </div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'var(--gray-400)', border: '1px solid var(--gray-100)', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
              <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} style={{ marginTop: 2 }} />
              Declaro que os dados informados são verdadeiros e aceito os termos de abertura da conta PJ.
            </label>
            <button disabled={saving} onClick={() => void concluirSolicitacao()} className="btn-action" style={{ opacity: saving ? .6 : 1 }}>Enviar solicitação</button>
          </div>
        )}
      </div>

      {/* Nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <button onClick={() => setEtapa(Math.max(1, etapa - 1))} disabled={etapa === 1} className="btn-action btn-ghost" style={{ opacity: etapa === 1 ? .4 : 1 }}>← Anterior</button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button disabled={saving} onClick={() => void salvarProgresso()} className="btn-action btn-ghost" style={{ opacity: saving ? .6 : 1 }}>Salvar</button>
          <button onClick={() => setEtapa(Math.min(4, etapa + 1))} disabled={etapa === 4} className="btn-action" style={{ opacity: etapa === 4 ? .4 : 1 }}>Próxima →</button>
        </div>
      </div>

      {msg && (
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--navy)' }}>{msg}</div>
      )}
    </div>
  )
}
