'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { maskBRLInput, parseBRLInput } from '@/lib/currency-brl'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'

type Props = {
  open: boolean
  onClose: () => void
  onDone: () => void
  ativo: { id: string; nome: string; valor_contabil: number; empresa_id: string }
}

const inp: React.CSSProperties = {
  width: '100%', border: '0.5px solid #E4DCCC', borderRadius: 8,
  padding: '9px 12px', fontSize: 14, color: '#13201D',
  background: '#fff', outline: 'none', marginTop: 8,
  fontFamily: "var(--font-sans)",
}

export default function BaixaAtivoModal({ open, onClose, onDone, ativo }: Props) {
  const [motivo, setMotivo] = useState('sucateamento')
  const [dataBaixa, setDataBaixa] = useState(new Date().toISOString().slice(0, 10))
  const [valorMask, setValorMask] = useState('')
  const [obs, setObs] = useState('')
  const [saving, setSaving] = useState(false)

  async function confirmar() {
    if (saving) return
    setSaving(true)
    try {
      const valorBaixa = parseBRLInput(valorMask)
      // Todo motivo que não for alienação mapeia para 'baixado' — consistente com
      // a lista ATIVOS_BAIXADOS da tela principal (baixado, alienado, perdido, sucateado).
      const status = motivo === 'alienacao' ? 'alienado' : 'baixado'

      const { error: updErr } = await supabase
        .from('ativos')
        .update({
          status,
          data_baixa: dataBaixa,
          motivo_baixa: motivo,
          valor_baixa: valorBaixa,
          observacoes: obs || null,
        })
        .eq('id', ativo.id)

      if (updErr) {
        toast.error(`Não foi possível dar baixa: ${updErr.message}`)
        setSaving(false)
        return
      }

      const diff = valorBaixa - Number(ativo.valor_contabil || 0)
      if (diff !== 0) {
        const { error: txErr } = await supabase.from('transacoes').insert({
          empresa_id: ativo.empresa_id,
          descricao: `Baixa de ativo: ${ativo.nome}`,
          tipo: diff >= 0 ? 'entrada' : 'saida',
          valor: Math.abs(diff),
          categoria: diff >= 0 ? 'Ganho na alienação' : 'Perda na alienação',
          status: 'pago',
          data: dataBaixa,
        })
        // A baixa do ativo já foi confirmada; se o lançamento financeiro falhar,
        // avisamos mas não revertemos o status — o usuário pode lançar manualmente.
        if (txErr) {
          toast.error('Ativo baixado, mas o lançamento financeiro falhou. Lance manualmente em Financeiro.')
        }
      }

      toast.success('Ativo baixado com sucesso')
      onDone()
      onClose()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro inesperado ao dar baixa')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Baixa de ativo"
      size="md"
      footer={
        <>
          <button
            onClick={onClose}
            disabled={saving}
            style={{ borderRadius: 8, border: '0.5px solid #E4DCCC', background: '#fff', color: '#3C4A46', padding: '8px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            Cancelar
          </button>
          <button
            onClick={() => void confirmar()}
            disabled={saving}
            style={{ borderRadius: 8, border: 'none', background: '#B0413E', color: '#fff', padding: '8px 18px', fontSize: 14, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Confirmando...' : 'Confirmar baixa'}
          </button>
        </>
      }
    >
      <div style={{ fontSize: 14, color: '#7B8C88', marginBottom: 4 }}>
        Você está dando baixa em <strong style={{ color: '#13201D' }}>{ativo.nome}</strong>. Essa ação atualiza o status do ativo e gera um lançamento financeiro de ganho/perda na alienação.
      </div>

      <label style={{ fontSize: 12, fontWeight: 600, color: '#7B8C88', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginTop: 14 }}>Motivo</label>
      <select style={inp} value={motivo} onChange={(e) => setMotivo(e.target.value)}>
        <option value="sucateamento">Sucateamento</option>
        <option value="alienacao">Alienação (venda)</option>
        <option value="roubo">Roubo</option>
        <option value="sinistro">Sinistro</option>
        <option value="doacao">Doação</option>
      </select>

      <label style={{ fontSize: 12, fontWeight: 600, color: '#7B8C88', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginTop: 12 }}>Data da baixa</label>
      <input type="date" style={inp} value={dataBaixa} onChange={(e) => setDataBaixa(e.target.value)} />

      <label style={{ fontSize: 12, fontWeight: 600, color: '#7B8C88', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginTop: 12 }}>Valor de alienação (se houver)</label>
      <input style={inp} placeholder="R$ 0,00" value={valorMask} onChange={(e) => setValorMask(maskBRLInput(e.target.value))} />

      <label style={{ fontSize: 12, fontWeight: 600, color: '#7B8C88', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginTop: 12 }}>Observações</label>
      <textarea style={{ ...inp, minHeight: 64, resize: 'vertical' }} placeholder="Detalhes adicionais sobre a baixa..." value={obs} onChange={(e) => setObs(e.target.value)} />
    </Modal>
  )
}
