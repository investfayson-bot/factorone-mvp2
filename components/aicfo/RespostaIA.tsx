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

  const BotoesCompartilhar = ({ grande }: { grande?: boolean }) => (
    <div className={`flex items-center gap-2 flex-wrap ${grande ? '' : 'mt-1'}`}>
      <button onClick={() => setExpandido(!expandido)}
        className={`rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 ${grande ? 'hidden' : ''}`}>
        {expandido ? '✕ Fechar' : '⛶ Tela cheia'}
      </button>
      <button onClick={() => exportExcel(data, pergunta)}
        className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800">
        📊 Excel
      </button>
      <button onClick={() => exportPDF(data, pergunta)}
        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700">
        📄 PDF
      </button>
      <a href={wppUrl} target="_blank"
        className="rounded-lg bg-green-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-600">
        💬 WhatsApp
      </a>
      <a href={mailUrl}
        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
        ✉️ Email
      </a>
    </div>
  )

  const Cards = ({ grande }: { grande?: boolean }) => (
    <div className={`grid grid-cols-1 gap-${grande ? '4' : '2'} sm:grid-cols-2 lg:grid-cols-3`}>
      {data.cards?.map((card, i) => (
        <div key={i} className={`rounded-${grande ? '2xl' : 'xl'} border border-gray-200 bg-white p-${grande ? '5' : '3'} shadow-sm`}>
          <div className={`mb-${grande ? '4' : '2'} flex items-center gap-2`}>
            <span className={`text-${grande ? '2xl' : 'base'}`}>{card.emoji}</span>
            <span className={`text-${grande ? 'sm' : 'xs'} font-bold text-slate-800`}>{card.titulo}</span>
          </div>
          <div className="space-y-2">
            {card.linhas?.map((l, j) => (
              <div key={j} className="flex items-center justify-between border-b border-slate-100 pb-1.5 last:border-0">
                <span className={`text-${grande ? 'sm' : '[11px]'} text-slate-500`}>{l.label}</span>
                <span className={`text-${grande ? 'sm' : '[11px]'} ${dc(l.destaque)}`}>{l.valor}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <>
      {expandido && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white overflow-y-auto">
          <div className="mx-auto w-full max-w-5xl p-6">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-800">CFO IA — Análise Completa</h2>
                <p className="text-sm text-slate-500 mt-1">{data.resumo}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <BotoesCompartilhar grande />
                <button onClick={() => exportExcel(data, pergunta)}
                  className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
                  📊 Excel
                </button>
                <button onClick={() => exportPDF(data, pergunta)}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
                  📄 PDF
                </button>
                <a href={wppUrl} target="_blank"
                  className="rounded-xl bg-green-500 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600">
                  💬 WhatsApp
                </a>
                <a href={mailUrl}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                  ✉️ Email
                </a>
                <button onClick={() => setExpandido(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                  ✕ Fechar
                </button>
              </div>
            </div>
            <div className={`rounded-xl border px-4 py-3 text-sm font-medium mb-6 ${sc}`}>
              {data.status === 'positivo' ? '✅' : data.status === 'critico' ? '🔴' : '⚠️'} {data.resumo}
            </div>
            <Cards grande />
            {data.alertas?.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 mt-4">
                <p className="text-xs font-bold text-amber-700 uppercase mb-2">⚠️ Alertas</p>
                {data.alertas.map((a, i) => <p key={i} className="text-sm text-amber-700">• {a}</p>)}
              </div>
            )}
            {data.proxima_pergunta && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 mt-4">
                <p className="text-xs font-bold text-slate-500 uppercase mb-1">💬 Próxima análise</p>
                <p className="text-sm text-slate-700">{data.proxima_pergunta}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-3 w-full">
        <div className={`rounded-xl border px-3 py-2 text-xs font-medium ${sc}`}>
          {data.status === 'positivo' ? '✅' : data.status === 'critico' ? '🔴' : '⚠️'} {data.resumo}
        </div>
        <Cards />
        {data.alertas?.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-1">
            {data.alertas.map((a, i) => <p key={i} className="text-[11px] text-amber-700">⚠️ {a}</p>)}
          </div>
        )}
        <BotoesCompartilhar />
        {data.proxima_pergunta && (
          <p className="text-[11px] text-slate-400 italic">💬 {data.proxima_pergunta}</p>
        )}
      </div>
    </>
  )
}
