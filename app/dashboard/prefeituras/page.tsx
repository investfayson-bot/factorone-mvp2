'use client'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'

type Municipio = { id: number; nome: string }
type NfseStatus = { ativo: boolean; configurado: boolean; provider: string | null }

const ESTADOS: { uf: string; nome: string; regiao: string }[] = [
  { uf: 'AC', nome: 'Acre', regiao: 'Norte' }, { uf: 'AL', nome: 'Alagoas', regiao: 'Nordeste' },
  { uf: 'AP', nome: 'Amapá', regiao: 'Norte' }, { uf: 'AM', nome: 'Amazonas', regiao: 'Norte' },
  { uf: 'BA', nome: 'Bahia', regiao: 'Nordeste' }, { uf: 'CE', nome: 'Ceará', regiao: 'Nordeste' },
  { uf: 'DF', nome: 'Distrito Federal', regiao: 'Centro-Oeste' }, { uf: 'ES', nome: 'Espírito Santo', regiao: 'Sudeste' },
  { uf: 'GO', nome: 'Goiás', regiao: 'Centro-Oeste' }, { uf: 'MA', nome: 'Maranhão', regiao: 'Nordeste' },
  { uf: 'MT', nome: 'Mato Grosso', regiao: 'Centro-Oeste' }, { uf: 'MS', nome: 'Mato Grosso do Sul', regiao: 'Centro-Oeste' },
  { uf: 'MG', nome: 'Minas Gerais', regiao: 'Sudeste' }, { uf: 'PA', nome: 'Pará', regiao: 'Norte' },
  { uf: 'PB', nome: 'Paraíba', regiao: 'Nordeste' }, { uf: 'PR', nome: 'Paraná', regiao: 'Sul' },
  { uf: 'PE', nome: 'Pernambuco', regiao: 'Nordeste' }, { uf: 'PI', nome: 'Piauí', regiao: 'Nordeste' },
  { uf: 'RJ', nome: 'Rio de Janeiro', regiao: 'Sudeste' }, { uf: 'RN', nome: 'Rio Grande do Norte', regiao: 'Nordeste' },
  { uf: 'RS', nome: 'Rio Grande do Sul', regiao: 'Sul' }, { uf: 'RO', nome: 'Rondônia', regiao: 'Norte' },
  { uf: 'RR', nome: 'Roraima', regiao: 'Norte' }, { uf: 'SC', nome: 'Santa Catarina', regiao: 'Sul' },
  { uf: 'SP', nome: 'São Paulo', regiao: 'Sudeste' }, { uf: 'SE', nome: 'Sergipe', regiao: 'Nordeste' },
  { uf: 'TO', nome: 'Tocantins', regiao: 'Norte' },
]

export default function PrefeiturasPage() {
  const [status, setStatus] = useState<NfseStatus>({ ativo: false, configurado: false, provider: null })
  const [ufSel, setUfSel] = useState<string | null>(null)
  const [municipios, setMunicipios] = useState<Municipio[]>([])
  const [carregando, setCarregando] = useState(false)
  const [busca, setBusca] = useState('')

  useEffect(() => { fetch('/api/nfse/status').then(r => r.json()).then(setStatus).catch(() => {}) }, [])

  async function abrirEstado(uf: string) {
    setUfSel(uf); setBusca(''); setCarregando(true); setMunicipios([])
    try {
      const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`)
      const d = (await res.json()) as Municipio[]
      setMunicipios(d ?? [])
    } catch { toast.error('Falha ao carregar municípios do IBGE') }
    finally { setCarregando(false) }
  }

  const filtrados = useMemo(
    () => municipios.filter(m => m.nome.toLowerCase().includes(busca.toLowerCase())),
    [municipios, busca],
  )

  function exportarCsv() {
    if (!ufSel || municipios.length === 0) return
    const linhas = ['Código IBGE;Município;UF', ...municipios.map(m => `${m.id};${m.nome};${ufSel}`)]
    const blob = new Blob(['﻿' + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `prefeituras-${ufSel}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  function emitir(m: Municipio) {
    if (!status.configurado) { toast.error('Conecte um provedor de NFS-e (NFE.IO) para emitir'); return }
    toast.success(`Emissão de NFS-e em ${m.nome}/${ufSel} — abrir fluxo (provedor: ${status.provider})`)
  }

  return (
    <>
      <div className="page-hdr">
        <div>
          <div className="page-title">Prefeituras &amp; NFS-e</div>
          <div className="page-sub">Todas as prefeituras do Brasil · emissão de nota de serviço por município</div>
        </div>
        {ufSel && (
          <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setUfSel(null)}>
            <i className="fa-solid fa-arrow-left" style={{ marginRight: 6 }} />Estados
          </button>
        )}
      </div>

      {/* Status da conexão */}
      <div style={{ background: status.configurado ? 'rgba(45,155,111,.08)' : 'rgba(184,146,42,.08)', border: `1px solid ${status.configurado ? 'rgba(45,155,111,.25)' : 'rgba(184,146,42,.25)'}`, borderRadius: 12, padding: '12px 16px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <i className={`fa-solid ${status.configurado ? 'fa-circle-check' : 'fa-plug'}`} style={{ color: status.configurado ? '#2D9B6F' : '#B8922A' }} />
        <span style={{ fontSize: 12.5, color: '#1C2B2A', fontWeight: 600 }}>
          {status.configurado
            ? `Emissão de NFS-e ativa via ${status.provider?.toUpperCase()} — todas as prefeituras cobertas.`
            : 'Emissão de NFS-e não conectada.'}
        </span>
        {!status.configurado && (
          <span style={{ fontSize: 11.5, color: '#7A8F8E', marginLeft: 'auto' }}>
            Conecte um agregador (NFE.IO / PlugNotas) que já integra todos os municípios.
          </span>
        )}
      </div>

      {!ufSel ? (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 10 }}>Escolha o estado</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
            {ESTADOS.map(e => (
              <button key={e.uf} onClick={() => void abrirEstado(e.uf)} style={{ background: '#fff', border: '0.5px solid #E2E8E7', borderRadius: 12, padding: '14px 16px', textAlign: 'left', cursor: 'pointer', transition: 'box-shadow .15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 9, background: '#1C2B2A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#7EBDB8', fontFamily: "'Inter', system-ui, sans-serif" }}>{e.uf}</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1C2B2A' }}>{e.nome}</div>
                    <div style={{ fontSize: 10.5, color: '#7A8F8E' }}>{e.regiao}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#1C2B2A' }}>{ESTADOS.find(e => e.uf === ufSel)?.nome} ({ufSel})</div>
            <span style={{ fontSize: 12, color: '#7A8F8E' }}>{carregando ? 'carregando…' : `${municipios.length} municípios`}</span>
            <input className="form-input" style={{ width: 220, padding: '6px 10px', fontSize: 12, marginLeft: 'auto' }} placeholder="Buscar município…" value={busca} onChange={e => setBusca(e.target.value)} />
            <button className="btn-ghost" style={{ fontSize: 12 }} onClick={exportarCsv} disabled={municipios.length === 0}>
              <i className="fa-solid fa-file-csv" style={{ marginRight: 6 }} />Baixar CSV
            </button>
          </div>

          <div style={{ background: '#fff', border: '0.5px solid #E2E8E7', borderRadius: 14, overflow: 'hidden' }}>
            {carregando ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#7A8F8E', fontSize: 12 }}>
                <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: 20, color: '#5E8C87' }} />
              </div>
            ) : filtrados.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#7A8F8E', fontSize: 12 }}>Nenhum município encontrado.</div>
            ) : filtrados.map((m, i) => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: i < filtrados.length - 1 ? '0.5px solid #F0F4F3' : 'none' }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: '#EEF2F1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className="fa-solid fa-landmark" style={{ fontSize: 12, color: '#5E8C87' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1C2B2A' }}>{m.nome}</div>
                  <div style={{ fontSize: 10, color: '#AAB8B7', fontFamily: 'monospace' }}>IBGE {m.id}</div>
                </div>
                <button onClick={() => emitir(m)} style={{ fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 8, border: 'none', background: status.configurado ? '#1C2B2A' : '#EEF2F1', color: status.configurado ? '#fff' : '#7A8F8E', cursor: 'pointer' }}>
                  <i className="fa-solid fa-file-invoice" style={{ marginRight: 5 }} />Emitir NFS-e
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ fontSize: 11, color: '#AAB8B7', marginTop: 14, lineHeight: 1.6 }}>
        <i className="fa-solid fa-circle-info" style={{ color: '#5E8C87', marginRight: 6 }} />
        Lista de municípios via IBGE (oficial). A emissão de NFS-e usa um agregador (NFE.IO / PlugNotas) que já conecta todas as prefeituras — configure a chave para ativar.
      </div>
    </>
  )
}
