'use client'

// Impostos & Regime (Fase 5, Bloco 1) — baseline: o estimador de DAS do
// Simples Nacional já existente (portado de /dashboard/simples, mesmas
// tabelas 2024). O simulador comparando Simples × Presumido × Real é o
// Bloco 4 — cálculo tributário que o Fayson quer validar com calma antes
// de ir pro ar, então aqui tem só o aviso, não uma versão de mentira.

import { useEffect, useState } from 'react'
import Link from 'next/link'
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

export default function ImpostosRegimePage() {
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
    const prox = new Date(Date.UTC(y, m, 20))
    return prox.toISOString().slice(0, 10)
  }

  async function registrarDAS() {
    if (!empresaId) return
    if (r.das <= 0) { toast.error('Calcule um DAS maior que zero antes de registrar.'); return }
    setRegistrando(true)
    try {
      const venc = vencimentoDAS(competencia)
      // via API (gate de papel: contador/viewer não registra imposto)
      const { data: sess } = await supabase.auth.getSession()
      const res = await fetch('/api/fiscal/registrar-das', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(sess.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {}) },
        body: JSON.stringify({ competencia, valor: Number(r.das.toFixed(2)), vencimento: venc }),
      })
      const d = await res.json() as { ok?: boolean; atualizado?: boolean; error?: string }
      if (!res.ok || !d.ok) throw new Error(d.error || 'Falha ao registrar')
      toast.success(`DAS de ${competencia} ${d.atualizado ? 'atualizado' : 'registrado'} (vence ${venc}).`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao registrar')
    } finally {
      setRegistrando(false)
    }
  }

  return (
    <div style={{ maxWidth: 940, paddingBottom: 30 }}>
      {/* Aviso: comparador de regimes é o Bloco 4 */}
      <div style={{ background: 'var(--acc-soft)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 12.5, color: 'var(--acc-ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <i className="fa-solid fa-circle-info" />
        Por enquanto: estimador de DAS do Simples Nacional. A comparação Simples × Lucro Presumido × Lucro Real está em construção e chega numa próxima etapa.
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--ink)' }}>Simples Nacional — Estimador de DAS</div>
          <div style={{ fontSize: 12.5, color: 'var(--mut)', marginTop: 2 }}>Alíquota efetiva e imposto do mês (tabelas 2024).</div>
        </div>
        <button onClick={() => void estimarFaturamento()} className="btn-v2" disabled={estimando}>
          {estimando ? 'Estimando…' : 'Estimar RBT12 do faturamento'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Entradas */}
        <div className="card-v2" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
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
          <button onClick={() => void registrarDAS()} className="btn-v2 primary" disabled={registrando || r.das <= 0} style={{ opacity: (registrando || r.das <= 0) ? .6 : 1 }}>
            {registrando ? 'Registrando…' : 'Registrar DAS nas obrigações'}
          </button>
        </div>

        {/* Resultado */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="card-v2" style={{ padding: '13px 16px' }}>
              <div style={{ fontSize: 11.5, color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 700 }}>DAS do mês</div>
              <div style={{ fontSize: 21, fontWeight: 800, color: '#B0413E', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{formatBRL(r.das)}</div>
            </div>
            <div className="card-v2" style={{ padding: '13px 16px' }}>
              <div style={{ fontSize: 11.5, color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 700 }}>Alíquota efetiva</div>
              <div style={{ fontSize: 21, fontWeight: 800, color: 'var(--ink)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{(r.aliqEfetiva * 100).toFixed(2)}%</div>
            </div>
          </div>

          <div className="card-v2" style={{ padding: 16 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Resumo</div>
            {[
              { label: 'Alíquota nominal da faixa', valor: `${(r.faixa.aliquota * 100).toFixed(2)}%` },
              { label: 'Parcela a deduzir', valor: formatBRL(r.faixa.pd) },
              { label: 'RBT12', valor: formatBRL(Number(rbt12) || 0) },
              { label: 'Receita do mês', valor: formatBRL(Number(receitaMes) || 0) },
            ].map(x => (
              <div key={x.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ color: 'var(--mut)' }}>{x.label}</span>
                <span style={{ color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{x.valor}</span>
              </div>
            ))}
          </div>

          {r.acimaLimite && (
            <div style={{ background: 'rgba(176,65,62,.08)', border: '1px solid rgba(176,65,62,.3)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#B0413E' }}>
              RBT12 acima de R$ 4.800.000 — fora do limite do Simples Nacional. Considere Lucro Presumido/Real.
            </div>
          )}
        </div>
      </div>

      {/* Tabela do anexo */}
      <div className="card-v2" style={{ padding: 16, marginTop: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 10 }}>{ANEXOS[anexo].nome} — faixas</div>
        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: 'var(--mut)', fontSize: 12 }}>
              <th style={{ textAlign: 'left', padding: '6px 4px' }}>RBT12 até</th>
              <th style={{ textAlign: 'right', padding: '6px 4px' }}>Alíquota</th>
              <th style={{ textAlign: 'right', padding: '6px 4px' }}>Parcela a deduzir</th>
            </tr>
          </thead>
          <tbody>
            {faixas.map((f, i) => {
              const ativa = f === r.faixa && (Number(rbt12) || 0) > 0
              return (
                <tr key={i} style={{ background: ativa ? 'var(--acc-soft)' : 'transparent' }}>
                  <td style={{ padding: '6px 4px', fontWeight: ativa ? 700 : 400, color: ativa ? 'var(--ink)' : 'var(--mut)', fontVariantNumeric: 'tabular-nums' }}>{formatBRL(f.ate)} {ativa && '←'}</td>
                  <td style={{ textAlign: 'right', padding: '6px 4px', fontWeight: ativa ? 700 : 400, fontVariantNumeric: 'tabular-nums' }}>{(f.aliquota * 100).toFixed(2)}%</td>
                  <td style={{ textAlign: 'right', padding: '6px 4px', color: 'var(--mut)', fontVariantNumeric: 'tabular-nums' }}>{formatBRL(f.pd)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div style={{ fontSize: 12, color: 'var(--mut)', marginTop: 10, lineHeight: 1.6 }}>
          Estimativa simplificada. Não considera Fator R (Anexo III × V), sublimites estaduais, ICMS/ISS por fora, nem retenções. Consulte seu contador para o valor oficial.
        </div>
      </div>

      <div style={{ marginTop: 14, fontSize: 12.5, color: 'var(--mut)' }}>
        Registrou o DAS? Acompanhe o pagamento em <Link href="/dashboard/tax" style={{ color: 'var(--acc)', fontWeight: 600 }}>Tax Compliance</Link>.
      </div>
    </div>
  )
}
