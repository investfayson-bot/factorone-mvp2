'use client'

import { useMemo, useState } from 'react'
import { addMonths } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { formatBRL, maskBRLInput, parseBRLInput } from '@/lib/currency-brl'
import { calcularDepreciacaoLinear, calcularDepreciacaoAcelerada, calcularDepreciacaoSomaDigitos } from '@/lib/financeiro/depreciacao'

type Categoria = { id: string; nome: string; vida_util_anos: number; metodo_depreciacao: 'linear' | 'acelerada' | 'soma_digitos' }
type Props = {
  open: boolean
  onClose: () => void
  onDone: (tipoAtivo?: string) => void
  empresaId: string
  categorias: Categoria[]
}

const TAXA_DEP: Record<string, number> = {
  veiculo_leve: 20, veiculo_pesado: 25, imovel: 4,
  maquina: 10, equipamento: 20, movel: 10, outros: 10,
}

const TIPOS_ATIVO = [
  { value: 'veiculo_leve',   label: 'Veículo Leve',  icon: 'fa-car',     vidaUtil: 5 },
  { value: 'veiculo_pesado', label: 'Veículo Pesado', icon: 'fa-truck',   vidaUtil: 4 },
  { value: 'imovel',         label: 'Imóvel',          icon: 'fa-building',vidaUtil: 25 },
  { value: 'maquina',        label: 'Máquina',         icon: 'fa-gears',   vidaUtil: 10 },
  { value: 'equipamento',    label: 'Equipamento',     icon: 'fa-laptop',  vidaUtil: 5 },
  { value: 'movel',          label: 'Móvel',           icon: 'fa-couch',   vidaUtil: 10 },
  { value: 'outros',         label: 'Outros',          icon: 'fa-cube',    vidaUtil: 10 },
]

const IS_VEICULO = (t: string) => t === 'veiculo_leve' || t === 'veiculo_pesado'
const IS_MAQUINA = (t: string) => t === 'maquina' || t === 'equipamento'

export default function NovoAtivoModal({ open, onClose, onDone, empresaId, categorias }: Props) {
  const [tipoAtivo, setTipoAtivo] = useState('outros')
  const [nome, setNome] = useState('')
  const [setor, setSetor] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [codigoInterno, setCodigoInterno] = useState('')
  const [numeroSerie, setNumeroSerie] = useState('')
  const [fornecedor, setFornecedor] = useState('')
  const [notaFiscal, setNotaFiscal] = useState('')
  const [dataAquisicao, setDataAquisicao] = useState(new Date().toISOString().slice(0, 10))
  const [valorMask, setValorMask] = useState('')
  const [residualMask, setResidualMask] = useState('')
  const [vidaUtil, setVidaUtil] = useState(5)
  const [metodo, setMetodo] = useState<'linear' | 'acelerada' | 'soma_digitos'>('linear')
  const [localizacao, setLocalizacao] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [obs, setObs] = useState('')
  const [file, setFile] = useState<File | null>(null)
  // Veículo
  const [placa, setPlaca] = useState('')
  const [modelo, setModelo] = useState('')
  const [anoFab, setAnoFab] = useState(new Date().getFullYear())
  const [kmAtual, setKmAtual] = useState(0)
  const [seguroVenc, setSeguroVenc] = useState('')
  const [ipvaVenc, setIpvaVenc] = useState('')
  // Máquina
  const [horasOp, setHorasOp] = useState(0)
  // Imóvel
  const [endereco, setEndereco] = useState('')
  const [areaM2, setAreaM2] = useState('')
  const [saving, setSaving] = useState(false)

  const valor = parseBRLInput(valorMask)
  const residual = parseBRLInput(residualMask)

  const depMensal = useMemo(() => {
    if (!valor) return 0
    if (metodo === 'linear') return calcularDepreciacaoLinear(valor, residual, vidaUtil)
    if (metodo === 'acelerada') return calcularDepreciacaoAcelerada(valor, residual, vidaUtil, 1)
    return calcularDepreciacaoSomaDigitos(valor, residual, vidaUtil * 12, 1)
  }, [metodo, residual, valor, vidaUtil])

  const depAnual = depMensal * 12
  const depreciaTotalEm = addMonths(new Date(dataAquisicao), vidaUtil * 12).toLocaleDateString('pt-BR')
  const valorAno1 = Math.max(valor - depMensal * 12, residual)

  function selecionarTipo(tv: string) {
    setTipoAtivo(tv)
    const cfg = TIPOS_ATIVO.find(t => t.value === tv)
    if (cfg) setVidaUtil(cfg.vidaUtil)
  }

  if (!open) return null

  async function salvar() {
    if (!nome.trim()) return alert('Informe o nome do ativo')
    if (valor <= 0) return alert('Informe o valor de aquisição')
    setSaving(true)
    try {
      let fotoUrl: string | null = null
      if (file) {
        const ext = file.name.split('.').pop() || 'jpg'
        const path = `${empresaId}/${crypto.randomUUID()}.${ext}`
        const up = await supabase.storage.from('ativos').upload(path, file, { upsert: false })
        if (!up.error) fotoUrl = supabase.storage.from('ativos').getPublicUrl(path).data.publicUrl
      }
      const { error } = await supabase.from('ativos').insert({
        empresa_id: empresaId,
        tipo_ativo: tipoAtivo,
        categoria_id: categoriaId || null,
        nome,
        setor: setor || null,
        codigo_interno: codigoInterno || null,
        numero_serie: numeroSerie || null,
        fornecedor: fornecedor || null,
        nota_fiscal: notaFiscal || null,
        data_aquisicao: dataAquisicao,
        data_inicio_depreciacao: dataAquisicao,
        valor_aquisicao: valor,
        valor_residual: residual,
        vida_util_anos: vidaUtil,
        metodo_depreciacao: metodo,
        taxa_depreciacao_anual: TAXA_DEP[tipoAtivo] ?? 10,
        localizacao: localizacao || null,
        responsavel_nome: responsavel || null,
        foto_url: fotoUrl,
        observacoes: obs || null,
        status: 'ativo',
        // veículo
        placa: IS_VEICULO(tipoAtivo) ? placa || null : null,
        modelo: (IS_VEICULO(tipoAtivo) || IS_MAQUINA(tipoAtivo)) ? modelo || null : null,
        ano_fabricacao: IS_VEICULO(tipoAtivo) ? anoFab : null,
        km_atual: IS_VEICULO(tipoAtivo) ? kmAtual : null,
        seguro_vencimento: IS_VEICULO(tipoAtivo) ? seguroVenc || null : null,
        ipva_vencimento: tipoAtivo === 'veiculo_leve' || tipoAtivo === 'veiculo_pesado' ? ipvaVenc || null : null,
        // máquina
        horas_operacao: IS_MAQUINA(tipoAtivo) ? horasOp : null,
      })
      if (error) return alert(error.message)
      onDone(tipoAtivo)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', border: '1px solid var(--gray-100)', borderRadius: 8,
    padding: '8px 12px', fontSize: 13, color: 'var(--navy)',
    background: '#fff', boxSizing: 'border-box', outline: 'none',
  }
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 4, display: 'block' }

  return (
    <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 680, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 className="modal-title">Novo Ativo</h3>
          <button className="modal-close" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>

        {/* Tipo do ativo */}
        <div style={{ marginBottom: 20 }}>
          <label style={lbl}>Tipo de ativo *</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {TIPOS_ATIVO.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => selecionarTipo(t.value)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  padding: '10px 8px', borderRadius: 10, cursor: 'pointer', fontSize: 11, fontWeight: 600,
                  border: tipoAtivo === t.value ? '2px solid var(--teal)' : '1px solid var(--gray-100)',
                  background: tipoAtivo === t.value ? 'rgba(16,185,129,0.08)' : '#fafafa',
                  color: tipoAtivo === t.value ? 'var(--teal)' : 'var(--gray-500)',
                  transition: 'all 0.15s',
                }}
              >
                <i className={`fa-solid ${t.icon}`} style={{ fontSize: 18 }} />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {/* Nome */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>Nome do ativo *</label>
            <input style={inp} placeholder="Ex.: Caminhão Iveco Daily" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>

          {/* Setor */}
          <div>
            <label style={lbl}>Setor / Departamento</label>
            <input style={inp} placeholder="Ex.: Logística, TI, Produção" value={setor} onChange={(e) => setSetor(e.target.value)} />
          </div>

          {/* Categoria */}
          <div>
            <label style={lbl}>Categoria contábil</label>
            <select style={inp} value={categoriaId} onChange={(e) => { setCategoriaId(e.target.value); const c = categorias.find(x => x.id === e.target.value); if (c) { setVidaUtil(c.vida_util_anos); setMetodo(c.metodo_depreciacao) } }}>
              <option value="">— Sem categoria —</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>

          {/* Campos condicionais: Veículo */}
          {IS_VEICULO(tipoAtivo) && <>
            <div>
              <label style={lbl}>Placa</label>
              <input style={inp} placeholder="ABC-1234" value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())} />
            </div>
            <div>
              <label style={lbl}>Modelo / Fabricante</label>
              <input style={inp} placeholder="Ex.: Iveco Daily 35S14" value={modelo} onChange={(e) => setModelo(e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Ano de fabricação</label>
              <input style={inp} type="number" min={1990} max={2030} value={anoFab} onChange={(e) => setAnoFab(Number(e.target.value))} />
            </div>
            <div>
              <label style={lbl}>KM atual</label>
              <input style={inp} type="number" min={0} value={kmAtual} onChange={(e) => setKmAtual(Number(e.target.value))} />
            </div>
            <div>
              <label style={lbl}>Vencimento do seguro</label>
              <input style={inp} type="date" value={seguroVenc} onChange={(e) => setSeguroVenc(e.target.value)} />
            </div>
            {(tipoAtivo === 'veiculo_leve') && (
              <div>
                <label style={lbl}>Vencimento IPVA</label>
                <input style={inp} type="date" value={ipvaVenc} onChange={(e) => setIpvaVenc(e.target.value)} />
              </div>
            )}
          </>}

          {/* Campos condicionais: Máquina/Equipamento */}
          {IS_MAQUINA(tipoAtivo) && <>
            <div>
              <label style={lbl}>Modelo / Fabricante</label>
              <input style={inp} placeholder="Ex.: Trator Valtra A114" value={modelo} onChange={(e) => setModelo(e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Horas de operação iniciais</label>
              <input style={inp} type="number" min={0} value={horasOp} onChange={(e) => setHorasOp(Number(e.target.value))} />
            </div>
          </>}

          {/* Campos condicionais: Imóvel */}
          {tipoAtivo === 'imovel' && <>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>Endereço</label>
              <input style={inp} placeholder="Rua, número, bairro, cidade/UF" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Área (m²)</label>
              <input style={inp} type="number" min={0} step={0.01} placeholder="0,00" value={areaM2} onChange={(e) => setAreaM2(e.target.value)} />
            </div>
          </>}

          {/* Dados financeiros */}
          <div>
            <label style={lbl}>Valor de aquisição *</label>
            <input style={inp} placeholder="0,00" value={valorMask} onChange={(e) => setValorMask(maskBRLInput(e.target.value))} inputMode="decimal" />
          </div>
          <div>
            <label style={lbl}>Valor residual</label>
            <input style={inp} placeholder="0,00" value={residualMask} onChange={(e) => setResidualMask(maskBRLInput(e.target.value))} inputMode="decimal" />
          </div>
          <div>
            <label style={lbl}>Data de aquisição</label>
            <input style={inp} type="date" value={dataAquisicao} onChange={(e) => setDataAquisicao(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Vida útil (anos)</label>
            <input style={inp} type="number" min={1} max={50} value={vidaUtil} onChange={(e) => setVidaUtil(Number(e.target.value || 5))} />
          </div>
          <div>
            <label style={lbl}>Método de depreciação</label>
            <select style={inp} value={metodo} onChange={(e) => setMetodo(e.target.value as 'linear' | 'acelerada' | 'soma_digitos')}>
              <option value="linear">Linear</option>
              <option value="acelerada">Acelerada</option>
              <option value="soma_digitos">Soma dos dígitos</option>
            </select>
          </div>
          <div>
            <label style={lbl}>Taxa Receita Federal (%/ano)</label>
            <input style={{ ...inp, background: 'var(--gray-100)', color: 'var(--gray-500)' }} readOnly value={`${TAXA_DEP[tipoAtivo] ?? 10}%`} />
          </div>

          {/* Dados adicionais */}
          <div>
            <label style={lbl}>Código interno</label>
            <input style={inp} placeholder="Código de patrimônio" value={codigoInterno} onChange={(e) => setCodigoInterno(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Número de série</label>
            <input style={inp} placeholder="S/N" value={numeroSerie} onChange={(e) => setNumeroSerie(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Fornecedor</label>
            <input style={inp} placeholder="Nome do fornecedor" value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Número NF</label>
            <input style={inp} placeholder="Nota fiscal" value={notaFiscal} onChange={(e) => setNotaFiscal(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Localização</label>
            <input style={inp} placeholder="Almoxarifado, Galpão A…" value={localizacao} onChange={(e) => setLocalizacao(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Responsável</label>
            <input style={inp} placeholder="Nome do responsável" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>Foto do ativo</label>
            <input style={inp} type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>Observações</label>
            <textarea style={{ ...inp, resize: 'vertical', minHeight: 60 }} placeholder="Observações gerais" value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
        </div>

        {/* Preview depreciação */}
        {valor > 0 && (
          <div style={{ margin: '16px 0', padding: 14, borderRadius: 10, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--teal)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prévia de depreciação</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px 16px' }}>
              {[
                ['Depreciação mensal', formatBRL(depMensal)],
                ['Depreciação anual', formatBRL(depAnual)],
                ['Totalmente depreciado em', depreciaTotalEm],
                ['Valor contábil após 1 ano', formatBRL(valorAno1)],
              ].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--gray-500)' }}>{l}</span>
                  <span style={{ fontWeight: 600, color: 'var(--navy)', fontFamily: 'DM Mono, monospace' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-action" onClick={() => void salvar()} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar ativo'}
          </button>
        </div>
      </div>
    </div>
  )
}
