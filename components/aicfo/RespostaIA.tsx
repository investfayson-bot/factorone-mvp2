'use client'
import { useState } from 'react'
import { exportExcel, exportPDF, type RespostaData } from '@/lib/export-relatorio'
import toast from 'react-hot-toast'

export type { RespostaData }

const STATUS = {
  positivo: { bg: '#EAF5F3', border: '#5E8C87', color: '#0F6E56', icon: '↑' },
  atencao:  { bg: '#FEF3C7', border: '#F59E0B', color: '#92400E', icon: '⚠' },
  critico:  { bg: '#FEE2E2', border: '#F87171', color: '#991B1B', icon: '!' },
}
const DESTAQUE = {
  positivo: '#16A085',
  negativo: '#E74C3C',
  neutro:   '#1C2B2A',
}

export function RespostaIA({ data, pergunta = '' }: { data: RespostaData; pergunta?: string }) {
  const [expandido, setExpandido] = useState(false)
  const [exportandoPdf, setExportandoPdf] = useState(false)
  const [exportandoExcel, setExportandoExcel] = useState(false)

  async function handleExportPDF() {
    setExportandoPdf(true)
    try {
      await exportPDF(data, pergunta)
      toast.success('Relatório exportado em PDF')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao gerar PDF')
    } finally { setExportandoPdf(false) }
  }

  function handleExportExcel() {
    try {
      exportExcel(data, pergunta)
      toast.success('Relatório exportado em Excel')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao gerar Excel')
    }
  }

  const st = STATUS[data.status as keyof typeof STATUS] ?? STATUS.atencao

  const textoPlano = data.cards?.map(c =>
    c.titulo + ': ' + c.linhas?.map(l => l.label + ' ' + l.valor).join(', ')
  ).join(' | ')
  const wppUrl = 'https://wa.me/?text=' + encodeURIComponent('Relatório FactorOne CFO\n' + data.resumo + '\n\n' + textoPlano)
  const mailUrl = 'mailto:?subject=Relatório FactorOne CFO&body=' + encodeURIComponent('Resumo: ' + data.resumo + '\n\n' + textoPlano)

  function BotaoAcao({ label, onClick, bg, disabled, icon }: { label: string; onClick: () => void; bg: string; disabled?: boolean; icon?: string }) {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '5px 12px', borderRadius: 7, border: 'none',
          background: disabled ? '#AAB8B7' : bg, color: '#fff',
          fontSize: 11, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
          fontFamily: "'Inter', sans-serif", opacity: disabled ? 0.7 : 1,
          transition: 'opacity 0.15s',
        }}
      >
        {icon && <i className={`fa-solid ${icon}`} style={{ fontSize: 10 }} />}
        {label}
      </button>
    )
  }

  function BarraAcoes({ fechar }: { fechar?: boolean }) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {!fechar && (
          <button
            onClick={() => setExpandido(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, border: '0.5px solid #E2E8E7', background: '#fff', color: '#1C2B2A', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}
          >
            <i className="fa-solid fa-expand" style={{ fontSize: 10 }} />Tela cheia
          </button>
        )}
        <BotaoAcao label={exportandoExcel ? 'Gerando...' : 'Excel'} onClick={handleExportExcel} bg="#0F6E56" disabled={exportandoExcel} icon="fa-file-excel" />
        <BotaoAcao label={exportandoPdf ? 'Gerando...' : 'PDF'} onClick={() => void handleExportPDF()} bg="#E74C3C" disabled={exportandoPdf} icon="fa-file-pdf" />
        <a href={wppUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, border: 'none', background: '#25D366', color: '#fff', fontSize: 11, fontWeight: 700, textDecoration: 'none', fontFamily: "'Inter', sans-serif" }}>
          <i className="fa-brands fa-whatsapp" style={{ fontSize: 12 }} />WhatsApp
        </a>
        <a href={mailUrl} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, border: 'none', background: '#2563eb', color: '#fff', fontSize: 11, fontWeight: 700, textDecoration: 'none', fontFamily: "'Inter', sans-serif" }}>
          <i className="fa-solid fa-envelope" style={{ fontSize: 10 }} />Email
        </a>
        {fechar && (
          <button
            onClick={() => setExpandido(false)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, border: '0.5px solid #E2E8E7', background: '#fff', color: '#7A8F8E', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}
          >
            <i className="fa-solid fa-compress" style={{ fontSize: 10 }} />Fechar
          </button>
        )}
      </div>
    )
  }

  function Cards({ grande }: { grande?: boolean }) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: grande ? 'repeat(3,1fr)' : 'repeat(2,1fr)', gap: 8, marginBottom: 10 }}>
        {data.cards?.map((card, i) => (
          <div key={i} style={{ background: '#fff', border: '0.5px solid #E2E8E7', borderRadius: 12, padding: grande ? '14px 16px' : '10px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: grande ? 10 : 7 }}>
              {card.emoji && <i className={`fa-solid ${card.emoji}`} style={{ fontSize: grande ? 14 : 12, color: '#5E8C87', width: 16 }} />}
              <span style={{ fontSize: grande ? 12 : 11, fontWeight: 700, color: '#1C2B2A', fontFamily: "'Inter', sans-serif" }}>{card.titulo}</span>
            </div>
            {card.linhas?.map((l, j) => (
              <div key={j} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: j < (card.linhas?.length ?? 0) - 1 ? '0.5px solid #F0F4F3' : 'none' }}>
                <span style={{ fontSize: grande ? 11 : 10, color: '#7A8F8E' }}>{l.label}</span>
                <span style={{ fontSize: grande ? 12 : 11, fontWeight: 700, color: DESTAQUE[l.destaque as keyof typeof DESTAQUE] ?? '#1C2B2A', fontFamily: "'Inter', sans-serif" }}>{l.valor}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  function Alertas({ grande }: { grande?: boolean }) {
    if (!data.alertas?.length) return null
    return (
      <div style={{ background: '#FEF3C7', border: '0.5px solid #F59E0B', borderRadius: 10, padding: grande ? '12px 16px' : '8px 12px', marginBottom: 10 }}>
        {grande && <div style={{ fontSize: 10, fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Alertas</div>}
        {data.alertas.map((a, i) => (
          <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', marginBottom: i < data.alertas.length - 1 ? 5 : 0 }}>
            <span style={{ color: '#D97706', fontSize: 11, flexShrink: 0, marginTop: 1 }}>•</span>
            <span style={{ fontSize: grande ? 12 : 11, color: '#92400E', lineHeight: 1.5 }}>{a}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      {/* MODAL TELA CHEIA */}
      {expandido && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#F4F6F5', overflowY: 'auto' }}>
          {/* Header */}
          <div style={{ background: '#1C2B2A', padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(94,140,135,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa-solid fa-robot" style={{ fontSize: 16, color: '#7EBDB8' }} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: "'Inter', sans-serif" }}>FactorOne CFO — Análise Completa</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{data.resumo?.slice(0, 80)}{(data.resumo?.length ?? 0) > 80 ? '…' : ''}</div>
              </div>
            </div>
            <BarraAcoes fechar />
          </div>

          {/* Corpo */}
          <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 28px' }}>
            {/* Status banner */}
            <div style={{ background: st.bg, border: `0.5px solid ${st.border}`, borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: st.border, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{st.icon}</span>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: st.color, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>
                  Status: {data.status?.toUpperCase()}
                </div>
                <div style={{ fontSize: 13, color: '#1C2B2A', lineHeight: 1.5 }}>{data.resumo}</div>
              </div>
            </div>

            <Cards grande />
            <Alertas grande />

            {data.proxima_pergunta && (
              <div style={{ background: '#fff', border: '0.5px solid #E2E8E7', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#7A8F8E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Próxima análise sugerida</div>
                <div style={{ fontSize: 13, color: '#1C2B2A', lineHeight: 1.6 }}>{data.proxima_pergunta}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VERSÃO COMPACTA NO CHAT */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
        {/* Status pill */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: st.bg, border: `0.5px solid ${st.border}`, borderRadius: 8, padding: '6px 12px', alignSelf: 'flex-start' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: st.color }}>{st.icon} {data.status?.toUpperCase()}</span>
          <span style={{ fontSize: 11, color: st.color, opacity: 0.8 }}>·</span>
          <span style={{ fontSize: 11, color: st.color }}>{data.resumo?.slice(0, 60)}{(data.resumo?.length ?? 0) > 60 ? '…' : ''}</span>
        </div>

        <Cards />
        <Alertas />
        <BarraAcoes />

        {data.proxima_pergunta && (
          <div style={{ fontSize: 11, color: '#7A8F8E', fontStyle: 'italic', paddingLeft: 4 }}>
            <i className="fa-solid fa-circle-arrow-right" style={{ marginRight: 5, color: '#5E8C87', fontSize: 10 }} />
            {data.proxima_pergunta}
          </div>
        )}
      </div>
    </>
  )
}
