'use client'
import { useState } from 'react'
import { exportExcel, exportPDF, type RespostaData } from '@/lib/export-relatorio'

export type { RespostaData }

export function RespostaIA({ data, pergunta = '' }: { data: RespostaData; pergunta?: string }) {
  const [expandido, setExpandido] = useState(false)

  const sc = ({
    positivo: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    atencao: 'bg-amber-50 border-amber-200 text-amber-700',
    critico: 'bg-red-50 border-red-200 text-red-700',
  } as Record<string, string>)[data.status] || 'bg-slate-50 border-slate-200 text-slate-700'

  const dc = (d: string) => (({
    positivo: 'text-emerald-600 font-semibold',
    negativo: 'text-red-500 font-semibold',
    neutro: 'text-slate-600 font-medium',
  } as Record<string, string>)[d] || 'text-slate-600')

  const textoPlano = data.cards?.map(c =>
    c.titulo + ': ' + c.linhas?.map(l => l.label + ' ' + l.valor).join(', ')
  ).join(' | ')

  const wppUrl = 'https://wa.me/?text=' + encodeURIComponent(
    'Relatorio CFO IA - FactorOne\n' + data.resumo + '\n\n' + textoPlano
  )
  const mailUrl = 'mailto:?subject=Relatorio CFO IA - FactorOne&body=' + encodeURIComponent(
    'Resumo: ' + data.resumo + '\n\n' + textoPlano
  )

  const Acoes = ({ tamanho = 'sm' }: { tamanho?: 'sm' | 'lg' }) => {
    const cls = tamanho === 'lg'
      ? 'rounded-xl px-4 py-2 text-sm font-semibold text-white'
      : 'rounded-lg px-3 py-1.5 text-xs font-semibold text-white'
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {tamanho === 'sm' && (
          <button onClick={() => setExpandido(true)}
            className={`${cls} bg-slate-800 hover:bg-slate-700`}>
            ⛶ Tela cheia
          </button>
        )}
        <button onClick={() => exportExcel(data, pergunta)}
          className={`${cls} bg-emerald-700 hover:bg-emerald-800`}>
          📊 Excel
        </button>
        <button onClick={() => exportPDF(data, pergunta)}
          className={`${cls} bg-red-600 hover:bg-red-700`}>
          📄 PDF
        </button>
        <a href={wppUrl} target="_blank"
          className={`${cls} bg-green-500 hover:bg-green-600`}>
          💬 WhatsApp
        </a>
        <a href={mailUrl}
          className={`${cls} bg-blue-600 hover:bg-blue-700`}>
          ✉️ Email
        </a>
        {tamanho === 'lg' && (
          <button onClick={() => setExpandido(false)}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            ✕ Fechar
          </button>
        )}
      </div>
    )
  }

  const Cards = ({ grande }: { grande?: boolean }) => (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {data.cards?.map((card, i) => (
        <div key={i} className={`rounded-xl border border-gray-200 bg-white shadow-sm ${grande ? 'p-5' : 'p-3'}`}>
          <div className={`flex items-center gap-2 ${grande ? 'mb-4' : 'mb-2'}`}>
            <span className={grande ? 'text-2xl' : 'text-base'}>{card.emoji}</span>
            <span className={`font-bold text-slate-800 ${grande ? 'text-sm' : 'text-xs'}`}>{card.titulo}</span>
          </div>
          <div className="space-y-2">
            {card.linhas?.map((l, j) => (
              <div key={j} className="flex items-center justify-between border-b border-slate-100 pb-1.5 last:border-0">
                <span className={`text-slate-500 ${grande ? 'text-sm' : 'text-[11px]'}`}>{l.label}</span>
                <span className={`${dc(l.destaque)} ${grande ? 'text-sm' : 'text-[11px]'}`}>{l.valor}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )

  const Alertas = ({ grande }: { grande?: boolean }) => (
    data.alertas?.length > 0 ? (
      <div className={`rounded-xl border border-amber-200 bg-amber-50 ${grande ? 'p-4' : 'p-3'} space-y-1`}>
        {grande && <p className="text-xs font-bold text-amber-700 uppercase mb-2">⚠️ Alertas</p>}
        {data.alertas.map((a, i) => (
          <p key={i} className={`text-amber-700 ${grande ? 'text-sm' : 'text-[11px]'}`}>
            {grande ? '• ' : '⚠️ '}{a}
          </p>
        ))}
      </div>
    ) : null
  )

  return (
    <>
      {/* MODAL TELA CHEIA */}
      {expandido && (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
          <div className="mx-auto w-full max-w-5xl p-6">
            <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
              <div>
                <h2 className="text-xl font-bold text-slate-800">CFO IA — Análise Completa</h2>
                <p className="text-sm text-slate-500 mt-1">{data.resumo}</p>
              </div>
              <Acoes tamanho="lg" />
            </div>
            <div className={`rounded-xl border px-4 py-3 text-sm font-medium mb-6 ${sc}`}>
              {data.status === 'positivo' ? '✅' : data.status === 'critico' ? '🔴' : '⚠️'} {data.resumo}
            </div>
            <Cards grande />
            <div className="mt-4 space-y-4">
              <Alertas grande />
              {data.proxima_pergunta && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold text-slate-500 uppercase mb-1">💬 Próxima análise sugerida</p>
                  <p className="text-sm text-slate-700">{data.proxima_pergunta}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VERSÃO COMPACTA NO CHAT */}
      <div className="space-y-3 w-full">
        <div className={`rounded-xl border px-3 py-2 text-xs font-medium ${sc}`}>
          {data.status === 'positivo' ? '✅' : data.status === 'critico' ? '🔴' : '⚠️'} {data.resumo}
        </div>
        <Cards />
        <Alertas />
        <Acoes />
        {data.proxima_pergunta && (
          <p className="text-[11px] text-slate-400 italic">💬 {data.proxima_pergunta}</p>
        )}
      </div>
    </>
  )
}
