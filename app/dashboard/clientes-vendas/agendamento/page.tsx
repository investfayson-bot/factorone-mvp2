'use client'

// Agendamento (Fase 6) — reskin sobre crm_atividades (backend já existia):
// calendário do mês + lista dos compromissos do dia selecionado.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Atividade = {
  id: string; tipo: string; titulo: string; descricao: string | null
  data: string; hora_inicio: string | null; status: string
  clientes?: { nome: string } | { nome: string }[] | null
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const ICONE_TIPO: Record<string, string> = {
  reuniao: 'fa-users', ligacao: 'fa-phone', email: 'fa-envelope',
  tarefa: 'fa-list-check', visita: 'fa-location-dot', whatsapp: 'fa-brands fa-whatsapp', outro: 'fa-circle-dot',
}

export default function AgendamentoPage() {
  const [atividades, setAtividades] = useState<Atividade[]>([])
  const [loading, setLoading] = useState(true)
  const [mesAtual, setMesAtual] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [diaSel, setDiaSel] = useState<string>(() => new Date().toISOString().slice(0, 10))

  const ano = mesAtual.getFullYear(), mes = mesAtual.getMonth()

  useEffect(() => {
    void (async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
      const eid = (u?.empresa_id as string) ?? user.id
      const ini = `${ano}-${String(mes + 1).padStart(2, '0')}-01`
      const fim = new Date(ano, mes + 1, 0).toISOString().slice(0, 10)
      const { data } = await supabase
        .from('crm_atividades')
        .select('id, tipo, titulo, descricao, data, hora_inicio, status, clientes(nome)')
        .eq('empresa_id', eid)
        .gte('data', ini).lte('data', fim)
        .order('data').order('hora_inicio')
      setAtividades((data as Atividade[]) ?? [])
      setLoading(false)
    })()
  }, [ano, mes])

  const porDia = useMemo(() => {
    const m = new Map<string, Atividade[]>()
    for (const a of atividades) m.set(a.data, [...(m.get(a.data) ?? []), a])
    return m
  }, [atividades])

  const primeiroDiaSemana = new Date(ano, mes, 1).getDay()
  const diasNoMes = new Date(ano, mes + 1, 0).getDate()
  const celulas: (number | null)[] = [...Array(primeiroDiaSemana).fill(null), ...Array.from({ length: diasNoMes }, (_, i) => i + 1)]
  const hoje = new Date().toISOString().slice(0, 10)
  const doDia = porDia.get(diaSel) ?? []

  function nomeCliente(a: Atividade): string | null {
    const c = a.clientes
    if (!c) return null
    return Array.isArray(c) ? c[0]?.nome ?? null : c.nome
  }

  return (
    <div style={{ maxWidth: 1040, paddingBottom: 30, display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 14, alignItems: 'start' }}>
      <div className="card-v2" style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)' }}>{MESES[mes]} de {ano}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn-v2" style={{ padding: '5px 10px' }} onClick={() => setMesAtual(new Date(ano, mes - 1, 1))}><i className="fa-solid fa-chevron-left" style={{ fontSize: 11 }} /></button>
            <button className="btn-v2" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => { const d = new Date(); setMesAtual(new Date(d.getFullYear(), d.getMonth(), 1)); setDiaSel(hoje) }}>Hoje</button>
            <button className="btn-v2" style={{ padding: '5px 10px' }} onClick={() => setMesAtual(new Date(ano, mes + 1, 1))}><i className="fa-solid fa-chevron-right" style={{ fontSize: 11 }} /></button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6, marginBottom: 4 }}>
          {DIAS_SEMANA.map((d, i) => <div key={i} style={{ fontSize: 9.5, textTransform: 'uppercase', color: 'var(--mut)', fontWeight: 800, textAlign: 'center', paddingBottom: 4 }}>{d}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
          {celulas.map((dia, i) => {
            if (!dia) return <div key={i} />
            const iso = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
            const itens = porDia.get(iso) ?? []
            const ehHoje = iso === hoje
            const sel = iso === diaSel
            return (
              <div key={i} onClick={() => setDiaSel(iso)} style={{
                minHeight: 52, borderRadius: 8, padding: '5px 6px', cursor: 'pointer',
                border: `1px solid ${sel ? 'var(--acc)' : 'var(--line)'}`,
                background: sel ? 'var(--acc-soft)' : 'var(--card)',
              }}>
                <div style={{ fontSize: 11, fontWeight: ehHoje ? 800 : 600, color: ehHoje ? 'var(--acc-ink)' : 'var(--mut)' }}>{dia}</div>
                {itens.slice(0, 2).map(a => (
                  <div key={a.id} style={{ fontSize: 9, fontWeight: 700, color: 'var(--acc-ink)', background: 'var(--acc-soft)', borderRadius: 4, padding: '1px 4px', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.titulo}</div>
                ))}
                {itens.length > 2 && <div style={{ fontSize: 9, color: 'var(--mut)', marginTop: 1 }}>+{itens.length - 2}</div>}
              </div>
            )
          })}
        </div>
      </div>

      <div className="card-v2" style={{ padding: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink)', marginBottom: 10 }}>
          {new Date(diaSel + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
        {loading ? (
          <div style={{ fontSize: 12, color: 'var(--mut)' }}>Carregando…</div>
        ) : doDia.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--mut)' }}>
            Nada agendado neste dia. Crie pelo CRM ou manda no Telegram: &quot;agenda reunião com fulano dia tal&quot;.
          </div>
        ) : doDia.map(a => (
          <div key={a.id} style={{ display: 'flex', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--line)', opacity: a.status === 'cancelada' ? .5 : 1 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--acc-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className={`fa-solid ${ICONE_TIPO[a.tipo] ?? 'fa-circle-dot'}`} style={{ fontSize: 12, color: 'var(--acc-ink)' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{a.titulo}</div>
              <div style={{ fontSize: 11, color: 'var(--mut)', fontWeight: 600 }}>
                {a.hora_inicio ? a.hora_inicio.slice(0, 5) : 'sem hora'}{nomeCliente(a) ? ` · ${nomeCliente(a)}` : ''}{a.status === 'realizada' ? ' · ✓ realizada' : a.status === 'cancelada' ? ' · cancelada' : ''}
              </div>
            </div>
          </div>
        ))}
        <div style={{ marginTop: 12 }}>
          <Link href="/dashboard/agenda" className="btn-v2" style={{ textDecoration: 'none', display: 'inline-block', fontSize: 12 }}>Agenda completa →</Link>
        </div>
      </div>
    </div>
  )
}
