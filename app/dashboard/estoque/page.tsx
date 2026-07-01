'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency-brl'
import { EmptyState } from '@/components/ui/Illustration'
import toast from 'react-hot-toast'

type Produto = {
  id: string
  nome: string
  sku: string | null
  categoria: string | null
  quantidade: number
  estoque_minimo: number
  custo_unitario: number
  preco_venda: number
}

const VAZIO = { nome: '', sku: '', categoria: '', quantidade: '', estoque_minimo: '', custo_unitario: '', preco_venda: '' }

export default function EstoquePage() {
  const [empresaId, setEmpresaId] = useState('')
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...VAZIO })
  const [saving, setSaving] = useState(false)

  const carregar = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user
    if (!user) return
    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    const empresa = (u?.empresa_id as string) ?? user.id
    setEmpresaId(empresa)
    const { data } = await supabase.from('estoque_produtos').select('*').eq('empresa_id', empresa).order('created_at', { ascending: false })
    setProdutos((data ?? []) as Produto[])
    setLoading(false)
  }, [])

  useEffect(() => { void carregar() }, [carregar])

  async function salvar() {
    if (!form.nome.trim()) { toast.error('Informe o nome do produto'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('estoque_produtos').insert({
        empresa_id: empresaId,
        nome: form.nome.trim(),
        sku: form.sku.trim() || null,
        categoria: form.categoria.trim() || null,
        quantidade: Number(form.quantidade) || 0,
        estoque_minimo: Number(form.estoque_minimo) || 0,
        custo_unitario: Number(form.custo_unitario) || 0,
        preco_venda: Number(form.preco_venda) || 0,
      })
      if (error) throw error
      toast.success('Produto adicionado')
      setForm({ ...VAZIO }); setShowForm(false)
      void carregar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function remover(id: string) {
    const { error } = await supabase.from('estoque_produtos').delete().eq('id', id)
    if (error) { toast.error('Falha ao remover'); return }
    setProdutos(prev => prev.filter(p => p.id !== id))
  }

  const totalItens = produtos.reduce((s, p) => s + p.quantidade, 0)
  const valorEstoque = produtos.reduce((s, p) => s + p.quantidade * Number(p.custo_unitario), 0)
  const abaixoMinimo = produtos.filter(p => p.quantidade <= p.estoque_minimo)

  const kpis = [
    { label: 'Produtos', valor: String(produtos.length), cor: '#1C2B2A' },
    { label: 'Itens em estoque', valor: String(totalItens), cor: '#5E8C87' },
    { label: 'Valor em estoque', valor: formatBRL(valorEstoque), cor: '#1C2B2A' },
    { label: 'Abaixo do mínimo', valor: String(abaixoMinimo.length), cor: abaixoMinimo.length ? '#C0504A' : '#16A085' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 18, fontWeight: 700, color: '#1C2B2A', margin: 0 }}>Gestão de Estoque</h1>
          <div style={{ fontSize: 12, color: '#7A8F8E', marginTop: 3 }}>Produtos, quantidades e valor em estoque.</div>
        </div>
        <button className="btn-action" style={{ borderRadius: 8, padding: '9px 16px' }} onClick={() => setShowForm(v => !v)}>
          <i className="fa-solid fa-plus" style={{ marginRight: 6 }} />Novo produto
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 18 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background: '#fff', border: '0.5px solid #E2E8E7', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: '#7A8F8E', textTransform: 'uppercase', letterSpacing: .4 }}>{k.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: k.cor, marginTop: 4 }}>{k.valor}</div>
          </div>
        ))}
      </div>

      {/* Form inline */}
      {showForm && (
        <div style={{ background: '#fff', border: '0.5px solid #E2E8E7', borderRadius: 12, padding: 18, marginBottom: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
            <Campo label="Nome *"><input className="form-input" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></Campo>
            <Campo label="SKU"><input className="form-input" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} /></Campo>
            <Campo label="Categoria"><input className="form-input" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} /></Campo>
            <Campo label="Quantidade"><input className="form-input" type="number" value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} /></Campo>
            <Campo label="Estoque mínimo"><input className="form-input" type="number" value={form.estoque_minimo} onChange={e => setForm(f => ({ ...f, estoque_minimo: e.target.value }))} /></Campo>
            <Campo label="Custo unit. (R$)"><input className="form-input" type="number" step="0.01" value={form.custo_unitario} onChange={e => setForm(f => ({ ...f, custo_unitario: e.target.value }))} /></Campo>
            <Campo label="Preço venda (R$)"><input className="form-input" type="number" step="0.01" value={form.preco_venda} onChange={e => setForm(f => ({ ...f, preco_venda: e.target.value }))} /></Campo>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button className="btn-action" style={{ borderRadius: 8, opacity: saving ? .6 : 1 }} onClick={salvar} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
            <button className="btn-action btn-ghost" style={{ borderRadius: 8 }} onClick={() => { setShowForm(false); setForm({ ...VAZIO }) }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Tabela */}
      <div style={{ background: '#fff', border: '0.5px solid #E2E8E7', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 30, textAlign: 'center', color: '#7A8F8E', fontSize: 13 }}>Carregando…</div>
        ) : produtos.length === 0 ? (
          <div style={{ padding: 36, textAlign: 'center' }}>
            <EmptyState label="Nenhum produto cadastrado." />
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F8FAFA', color: '#7A8F8E', fontSize: 11, textTransform: 'uppercase' }}>
                <th style={th}>Produto</th><th style={th}>SKU</th><th style={th}>Categoria</th>
                <th style={{ ...th, textAlign: 'right' }}>Qtd</th><th style={{ ...th, textAlign: 'right' }}>Custo</th>
                <th style={{ ...th, textAlign: 'right' }}>Preço</th><th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {produtos.map(p => {
                const baixo = p.quantidade <= p.estoque_minimo
                return (
                  <tr key={p.id} style={{ borderTop: '0.5px solid #F0F4F3' }}>
                    <td style={{ ...td, fontWeight: 600, color: '#1C2B2A' }}>{p.nome}</td>
                    <td style={{ ...td, color: '#7A8F8E' }}>{p.sku || '—'}</td>
                    <td style={{ ...td, color: '#7A8F8E' }}>{p.categoria || '—'}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <span style={{ color: baixo ? '#C0504A' : '#1C2B2A', fontWeight: baixo ? 700 : 400 }}>{p.quantidade}</span>
                      {baixo && <i className="fa-solid fa-triangle-exclamation" title="Abaixo do mínimo" style={{ color: '#C0504A', fontSize: 10, marginLeft: 6 }} />}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>{formatBRL(Number(p.custo_unitario))}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{formatBRL(Number(p.preco_venda))}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <button onClick={() => remover(p.id)} title="Remover" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7A8F8E' }}>
                        <i className="fa-solid fa-trash" style={{ fontSize: 12 }} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const th: React.CSSProperties = { textAlign: 'left', padding: '10px 14px', fontWeight: 600 }
const td: React.CSSProperties = { padding: '10px 14px' }

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="form-group" style={{ margin: 0 }}>
      <label className="form-label">{label}</label>
      {children}
    </div>
  )
}
