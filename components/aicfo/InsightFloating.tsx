'use client'
import { useEffect, useState, useCallback } from 'react'
import { X, Zap, TrendingUp, AlertTriangle, DollarSign, Settings, ChevronDown, ChevronUp } from 'lucide-react'

type Insight = {
  tipo: 'alerta' | 'oportunidade' | 'tributario' | 'fluxo'
  titulo: string
  mensagem: string
  acao: string
  urgencia: 'alta' | 'media' | 'baixa'
}

const INTERVAL_OPTIONS = [
  { label: '15min', value: 15 },
  { label: '30min', value: 30 },
  { label: '1h', value: 60 },
]

const TIPO_CONFIG = {
  alerta:       { icon: AlertTriangle, bg: 'bg-red-50',     border: 'border-red-200',     iconColor: 'text-red-500',     badge: 'bg-red-100 text-red-700',         label: 'Alerta' },
  oportunidade: { icon: TrendingUp,   bg: 'bg-emerald-50', border: 'border-emerald-200', iconColor: 'text-emerald-500', badge: 'bg-emerald-100 text-emerald-700', label: 'Oportunidade' },
  tributario:   { icon: DollarSign,   bg: 'bg-blue-50',    border: 'border-blue-200',    iconColor: 'text-blue-500',    badge: 'bg-blue-100 text-blue-700',       label: 'Tributário' },
  fluxo:        { icon: Zap,          bg: 'bg-amber-50',   border: 'border-amber-200',   iconColor: 'text-amber-500',   badge: 'bg-amber-100 text-amber-700',     label: 'Fluxo de Caixa' },
}

export default function InsightFloating() {
  const [insight, setInsight] = useState<Insight | null>(null)
  const [visible, setVisible] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [intervalMin, setIntervalMin] = useState<number>(() => {
    if (typeof window !== 'undefined') return parseInt(localStorage.getItem('fo_insight_interval') || '15')
    return 15
  })

  const fetchInsight = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/aicfo-insight', { method: 'POST' })
      if (!res.ok) return
      const data = await res.json()
      if (data.titulo) { setInsight(data); setVisible(true); setExpanded(false) }
    } catch (e) { console.error('Insight error:', e) }
    finally { setLoading(false) }
  }, [])

  // Aparece após 5 segundos
  useEffect(() => {
    const t = setTimeout(fetchInsight, 5000)
    return () => clearTimeout(t)
  }, [fetchInsight])

  // Reaparece após intervalo quando fechado
  useEffect(() => {
    if (visible || loading) return
    const t = setTimeout(fetchInsight, intervalMin * 60 * 1000)
    return () => clearTimeout(t)
  }, [visible, loading, intervalMin, fetchInsight])

  function fechar(e: React.MouseEvent) {
    e.stopPropagation()
    setVisible(false)
    setExpanded(false)
    setInsight(null)
  }

  function changeInterval(val: number) {
    setIntervalMin(val)
    localStorage.setItem('fo_insight_interval', String(val))
    setShowConfig(false)
  }

  if (!visible || !insight) return null

  const cfg = TIPO_CONFIG[insight.tipo] || TIPO_CONFIG.fluxo
  const Icon = cfg.icon

  return (
    <div className={`fixed bottom-6 right-6 z-50 w-80 rounded-2xl border shadow-xl transition-all duration-300 ${cfg.bg} ${cfg.border}`}
      style={{ animation: 'slideUp .3s ease' }}>
      <style>{`@keyframes slideUp { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }`}</style>

      {/* Header [G clicável para expandir */}
      <div className="flex items-center justify-between p-4 pb-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2">
          <div className={`rounded-lg p-1.5 ${cfg.badge}`}>
            <Icon size={13} />
          </div>
          <div>
            <span className={`text-xs font-bold uppercase tracking-wide ${cfg.iconColor}`}>
              CFO IA [G {cfg.label}
            </span>
            {insight.urgencia === 'alta' && (
              <span className="ml-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white">URGENTE</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={e => { e.stopPropagation(); setShowConfig(!showConfig) }}
            className="rounded-lg p-1 text-slate-400 hover:bg-white/60 transition-colors">
            <Settings size={12} />
          </button>
          <button onClick={e => { e.stopPropagation(); setExpanded(!expanded) }}
            className="rounded-lg p-1 text-slate-400 hover:bg-white/60 transition-colors">
            {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
          <button onClick={fechar}
            className="rounded-lg p-1 text-slate-400 hover:bg-white/60 transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Config */}
      {showConfig && (
        <div className="mx-4 mb-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="mb-2 text-xs font-semibold text-slate-600">Intervalo entre insights:</p>
          <div className="flex gap-2">
            {INTERVAL_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => changeInterval(opt.value)}
                className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                  intervalMin === opt.value ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Título sempre visível */}
      <div className="px-4 pb-2">
        <p className="text-sm font-bold text-slate-800">{insight.titulo}</p>
      </div>

      {/* Detalhes [G só quando expandido */}
      {expanded && (
        <div className="px-4 pb-3 space-y-3">
          <p className="text-xs leading-relaxed text-slate-600">{insight.mensagem}</p>
          <div className="rounded-xl border border-white/70 bg-white/60 p-3">
            <p className="text-xs font-semibold text-slate-700 mb-1"> O que fazer agora:</p>
            <p className="text-xs text-slate-600">{insight.acao}</p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className={`flex items-center justify-between border-t border-white/50 p-3 ${expanded ? 'pt-2' : 'pt-0'}`}>
        <button onClick={() => setExpanded(!expanded)}
          className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 transition-colors">
          {expanded ? 'Recolher' : 'Ver detalhes'}
        </button>
        <span className="text-[10px] text-slate-400">Próximo em {intervalMin}min</span>
      </div>
    </div>
  )
}
