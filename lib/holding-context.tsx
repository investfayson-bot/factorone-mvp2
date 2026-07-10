'use client'

// Estado do seletor Holding/PJ/PF (Fase 0 + Fase 1) — compartilhado entre o
// topbar (onde o seletor mora) e qualquer página que precise respeitar o
// escopo atual (Início, e as próximas fases). Persistido em localStorage
// pra sobreviver a navegação/refresh, mesmo padrão já usado pelo `segmento`
// em app/dashboard/layout.tsx.

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'

export type EscopoHolding = 'consolidado' | 'empresas' | 'pf'
export type Grupo = { id: string; nome: string; membros: number }

type HoldingCtx = {
  grupos: Grupo[]
  grupoAtivoId: string | null
  setGrupoAtivoId: (id: string | null) => void
  escopo: EscopoHolding
  setEscopo: (e: EscopoHolding) => void
  recarregarGrupos: () => Promise<void>
}

const Ctx = createContext<HoldingCtx | null>(null)

export function HoldingProvider({ children }: { children: ReactNode }) {
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [grupoAtivoId, setGrupoAtivoIdState] = useState<string | null>(null)
  const [escopo, setEscopoState] = useState<EscopoHolding>('consolidado')

  async function recarregarGrupos() {
    const { data: sess } = await supabase.auth.getSession()
    const tk = sess.session?.access_token
    if (!tk) return
    try {
      const r = await fetch('/api/grupos', { headers: { Authorization: `Bearer ${tk}` } })
      const j = await r.json()
      if (r.ok) {
        const lista = (j.grupos ?? []) as Grupo[]
        setGrupos(lista)
        const salvo = typeof window !== 'undefined' ? localStorage.getItem('fo_grupo_ativo') : null
        if (salvo && lista.some(g => g.id === salvo)) setGrupoAtivoIdState(salvo)
        else if (lista.length > 0) setGrupoAtivoIdState(lista[0].id)
      }
    } catch { /* sem grupo ainda — não é erro, usuário pode não ter Holding configurado */ }
  }

  useEffect(() => { void recarregarGrupos() }, [])

  function setGrupoAtivoId(id: string | null) {
    setGrupoAtivoIdState(id)
    if (typeof window !== 'undefined') {
      if (id) localStorage.setItem('fo_grupo_ativo', id)
      else localStorage.removeItem('fo_grupo_ativo')
    }
  }

  function setEscopo(e: EscopoHolding) {
    setEscopoState(e)
    if (typeof window !== 'undefined') localStorage.setItem('fo_escopo_holding', e)
  }

  useEffect(() => {
    const salvo = typeof window !== 'undefined' ? localStorage.getItem('fo_escopo_holding') : null
    if (salvo === 'consolidado' || salvo === 'empresas' || salvo === 'pf') setEscopoState(salvo)
  }, [])

  return (
    <Ctx.Provider value={{ grupos, grupoAtivoId, setGrupoAtivoId, escopo, setEscopo, recarregarGrupos }}>
      {children}
    </Ctx.Provider>
  )
}

export function useHolding(): HoldingCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useHolding precisa estar dentro de <HoldingProvider>')
  return ctx
}
