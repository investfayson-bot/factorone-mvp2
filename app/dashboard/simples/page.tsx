'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'
import toast from 'react-hot-toast'

type Faixa = { ate: number; aliquota: number; pd: number }

// Tabelas do Simples Nacional 2024 (RBT12, alíquota nominal, parcela a deduzir).
const ANEXOS: Record<string, { nome: string; faixas: Faixa[] }> = {
  I: {
    nome: 'Anexo I — Comércio',
    faixas: [
      { ate: 180000, aliquota: 0.04, pd: 0 },
      { ate: 360000, aliquota: 0.073, pd: 5940 },
      { ate: 720000, aliquota: 0.095, pd: 13860 },
      { ate: 1800000, aliquota: 0.107, pd: 22500 },
      { ate: 3600000, aliquota: 0.143, pd: 87300 },
      { ate: 4800000, aliquota: 0.19, pd: 378000 },
    ],
  },
  II: {
    nome: 'Anexo II — Indústria',
    faixas: [
      { ate: 180000, aliquota: 0.045, pd: 0 },
      { ate: 360000, aliquota: 0.078, pd: 5940 },
      { ate: 720000, aliquota: 0.10, pd: 13860 },
      { ate: 1800000, aliquota: 0.112, pd: 22500 },
      { ate: 3600000, aliquota: 0.147, pd: 85500 },
      { ate: 4800000, aliquota: 0.30, pd: 720000 },
    ],
  },
  III: {
    nome: 'Anexo III — Serviços',
    faixas: [
      { ate: 180000, aliquota: 0.06, pd: 0 },
      { ate: 360000, aliquota: 0.112, pd: 9360 },
      { ate: 720000, aliquota: 0.135, pd: 17640 },
      { ate: 1800000, aliquota: 0.16, pd: 35640 },
      { ate: 3600000, aliquota: 0.21, pd: 125640 },
      { ate: 4800000, aliquota: 0.33, pd: 648000 },
    ],
  },
  IV: {
    nome: 'Anexo IV — Serviços',
    faixas: [
      { ate: 180000, aliquota: 0.045, pd: 0 },
      { ate: 360000, aliquota: 0.09, pd: 8100 },
      { ate: 720000, aliquota: 0.102, pd: 12420 },
      { ate: 1800000, aliquota: 0.14, pd: 39780 },
      { ate: 3600000, aliquota: 0.22, pd: 183780 },
      { ate: 4800000, aliquota: 0.33, pd: 828000 },
    ],
  },
  V: {
    nome: 'Anexo V — Serviços',
    faixas: [
      { ate: 180000, aliquota: 0.155, pd: 0 },
      { ate: 360000, aliquota: 0.18, pd: 4500 },
      { ate: 720000, aliquota: 0.195, pd: 9900 },
      { ate: 1800000, aliquota: 0.205, pd: 17100 },
      { ate: 3600000, aliquota: 0.23, pd: 62100 },
      { ate: 4800000, aliquota: 0.305, pd: 540000 },
    ],
  },
}

function calcular(rbt12: number, receitaMes: number, anexo: string) {
  const faixas = ANEXOS[anexo].faixas
  const faixa = faixas.find(f => rbt12 <= f.ate) ?? faixas[faixas.length - 1]
  const aliqEfetiva = rbt12 > 0 ? Math.max(0, (rbt12 * faixa.aliquota - faixa.pd) / rbt12) : 0
  const das = receitaMes * aliqEfetiva
  const acimaLimite = rbt12 > 4800000
  return { faixa, aliqEfetiva, das, acimaLimite }
}

export default function SimplesPage() {
  const [empresaId, setEmpresaId] = useState('')
  const [anexo, setAnexo] = useState('III')
  const [rbt12, setRbt12] = useState('')
  const [receitaMes, setReceitaMes] = useState('')
  const [competencia, setCompetencia] = useState(new Date().toISOString().slice(0, 7))
  const [estimando, setEstimando] = useState(false)
  const [registrando, setRegistrando] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
      setEmpresaId((u?.empresa_id as string) ?? user.id)
    })
  }, [])

  async function estimarFaturamento() {
    if (!empresaId) return
    setEstimando(true)
    try {
      const { data } = await supabase
        .from('metricas_financeiras')
        .select('receita_bruta, competencia')
        .eq('empresa_id', empresaId)
        .order('competencia', { ascending: false })
        .limit(12)
      const linhas = data ?? []
      if (!linhas.length) { toast('Sem dados de faturamento. Preencha manualmente.'); return }
      const soma = linhas.reduce((s, r) => s + Number(r.receita_bruta ?? 0), 0)
      setRbt12(String(Math.round(soma)))
      if (!receitaMes) setReceitaMes(String(Math.round(Number(linhas[0].receita_bruta ?? 0))))
      toast.success(`RBT12 estimado de ${linhas.length} meses: ${formatBRL(soma)}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao estimar')
    } finally {
      setEstimando(false)
    }
  }

  const r = calcular(Number(rbt12) || 0, Number(receitaMes) || 0, anexo)
  const faixas = ANEXOS[anexo].faixas

  // DAS vence no dia 20 do mês seguinte à competência.
  function vencimentoDAS(comp: string): string {
    const [y, m] = comp.split('-').map(Number)
    const prox = new Date(Date.UTC(y, m, 20)) // m (0-based+1) = mês seguinte
    return prox.toISOString().slice(0, 10)
  }

  async function registrarDAS() {
    if (!empresaId) return
    if (r.das <= 0) { toast.error('Calcule um DAS maior que zero antes de registrar.'); return }
    setRegistrando(true)
    try {
      const nome = `DAS Simples Nacional ${competencia}`
      const venc = vencimentoDAS(competencia)
      const payload = { empresa_id: empresaId, nome, tipo: 'DAS', competencia, vencimento: venc, valor: Number(r.das.toFixed(2)), status: 'pendente' }
      // evita duplicar a mesma competência
      const { data: existente } = await supabase
        .from('tax_obrigacoes')
        .select('id').eq('empresa_id', empresaId).eq('tipo', 'DAS').eq('competencia', competencia).maybeSingle()
      const { error } = existente
        ? await supabase.from('tax_obrigacoes').update(payload).eq('id', existente.id)
        : await supabase.from('tax_obrigacoes').insert(payload)
      if (error) throw error
      toast.success(`DAS de ${competencia} ${existente ? 'atualizado' : 'registrado'} no Tax Compliance (vence ${venc}).`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao registrar')
    } finally {
      setRegistrando(false)
    }
  }

  return (
    <div style={{ maxWidth: 920 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: "'Space Grotesk', 'Sora', sans-serif", fontSize: 18, fontWeight: 700, color: 'var(--navy)', margin: 0 }}>Simples Nacional — Estimador de DAS</h1>
          <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 3 }}>Calcule a alíquota efetiva e o imposto do mês (tabelas 2024).</div>
        </div>
        <button onClick={estimarFaturamento} className="btn-action btn-ghost" disabled={estimando} style={{ borderRadius: 8 }}>
          {estimando ? 'Estimando…' : 'Estimar RBT12 do faturamento'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Entradas */}
        <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Anexo (atividade)</label>
            <select className="form-input" value={anexo} onChange={e => setAnexo(e.target.value)}>
              {Object.entries(ANEXOS).map(([k, v]) => <option key={k} value={k}>{v.nome}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">RBT12 — Receita bruta dos últimos 12 meses (R$)</label>
            <input className="form-input" type="number" value={rbt12} onChange={e => setRbt12(e.target.value)} placeholder="Ex.: 600000" />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Receita do mês (R$)</label>
            <input className="form-input" type="number" value={receitaMes} onChange={e => setReceitaMes(e.target.value)} placeholder="Ex.: 50000" />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Competência</label>
            <input className="form-input" type="month" value={competencia} onChange={e => setCompetencia(e.target.value)} />
          </div>
          <button onClick={registrarDAS} className="btn-action" disabled={registrando || r.das <= 0} style={{ borderRadius: 8, opacity: (registrando || r.das <= 0) ? .6 : 1 }}>
            {registrando ? 'Registrando…' : 'Registrar DAS no Tax Compliance'}
          </button>
        </div>

        {/* Resultado */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase' }}>DAS do mês</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--red)', marginTop: 4 }}>{formatBRL(r.das)}</div>
            </div>
            <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase' }}>Alíquota efetiva</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--navy)', marginTop: 4 }}>{(r.aliqEfetiva * 100).toFixed(2)}%</div>
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>Resumo</div>
            {[
              { label: 'Alíquota nominal da faixa', valor: `${(r.faixa.aliquota * 100).toFixed(2)}%` },
              { label: 'Parcela a deduzir', valor: formatBRL(r.faixa.pd) },
              { label: 'RBT12', valor: formatBRL(Number(rbt12) || 0) },
              { label: 'Receita do mês', valor: formatBRL(Number(receitaMes) || 0) },
            ].map(x => (
              <div key={x.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 0', borderBottom: '1px solid var(--gray-100)' }}>
                <span style={{ color: 'var(--gray-400)' }}>{x.label}</span>
                <span style={{ color: 'var(--navy)', fontFamily: "'Manrope', 'Inter', sans-serif" }}>{x.valor}</span>
              </div>
            ))}
          </div>

          {r.acimaLimite && (
            <div style={{ background: 'rgba(192,80,74,.08)', border: '1px solid rgba(192,80,74,.3)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#991B1B' }}>
              RBT12 acima de R$ 4.800.000 — fora do limite do Simples Nacional. Considere Lucro Presumido/Real.
            </div>
          )}
        </div>
      </div>

      {/* Tabela do anexo */}
      <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 12, padding: 16, marginTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>{ANEXOS[anexo].nome} — faixas</div>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: 'var(--gray-400)', fontSize: 11 }}>
              <th style={{ textAlign: 'left', padding: '6px 4px' }}>RBT12 até</th>
              <th style={{ textAlign: 'right', padding: '6px 4px' }}>Alíquota</th>
              <th style={{ textAlign: 'right', padding: '6px 4px' }}>Parcela a deduzir</th>
            </tr>
          </thead>
          <tbody>
            {faixas.map((f, i) => {
              const ativa = f === r.faixa && (Number(rbt12) || 0) > 0
              return (
                <tr key={i} style={{ background: ativa ? 'rgba(94,140,135,.08)' : 'transparent' }}>
                  <td style={{ padding: '6px 4px', fontWeight: ativa ? 700 : 400, color: ativa ? 'var(--navy)' : 'var(--gray-500)' }}>{formatBRL(f.ate)} {ativa && '←'}</td>
                  <td style={{ textAlign: 'right', padding: '6px 4px', fontWeight: ativa ? 700 : 400 }}>{(f.aliquota * 100).toFixed(2)}%</td>
                  <td style={{ textAlign: 'right', padding: '6px 4px', color: 'var(--gray-500)' }}>{formatBRL(f.pd)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div style={{ fontSize: 10, color: 'var(--gray-400)', marginTop: 10, lineHeight: 1.6 }}>
          Estimativa simplificada. Não considera Fator R (Anexo III × V), sublimites estaduais, ICMS/ISS por fora, nem retenções. Consulte seu contador para o valor oficial.
        </div>
      </div>
    </div>
  )
}
