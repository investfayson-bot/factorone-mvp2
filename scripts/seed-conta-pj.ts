import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(url, key)

async function run() {
  const { data: empresas } = await supabase.from('empresas').select('id').limit(1)
  const empresaId = empresas?.[0]?.id
  if (!empresaId) throw new Error('Empresa não encontrada')
  let { data: conta } = await supabase.from('contas_bancarias').select('id,saldo,saldo_disponivel').eq('empresa_id', empresaId).maybeSingle()
  if (!conta) {
    const ins = await supabase.from('contas_bancarias').insert({ empresa_id: empresaId, tipo: 'conta_pj_factorone', banco_nome: 'FactorOne Bank', banco_codigo: '399', saldo: 11877, saldo_disponivel: 11877, is_principal: true, status: 'ativa' }).select('id,saldo,saldo_disponivel').single()
    conta = ins.data as { id: string; saldo: number; saldo_disponivel: number }
  }
  const base = new Date()
  const extrato = Array.from({ length: 20 }).map((_, i) => {
    const credito = i % 3 === 0
    const valor = Number((Math.random() * 1200 + 50).toFixed(2))
    const data = new Date(base.getTime() - i * 86400000).toISOString()
    return { conta_id: conta!.id, empresa_id: empresaId, descricao: credito ? 'Recebimento PIX cliente' : 'Pagamento fornecedor', valor, tipo: credito ? 'credito' : 'debito', tipo_operacao: credito ? 'pix' : 'transferencia', data_transacao: data, saldo_apos: 11877, conciliado: true }
  })
  await supabase.from('extrato_bancario').insert(extrato)
  await supabase.from('investimentos').insert([
    { empresa_id: empresaId, conta_id: conta!.id, tipo: 'cdb', nome: 'CDB 102% CDI', valor_aplicado: 5000, valor_atual: 5210, percentual_cdi: 102, data_aplicacao: new Date().toISOString().slice(0, 10), status: 'ativo' },
    { empresa_id: empresaId, conta_id: conta!.id, tipo: 'lci', nome: 'LCI 95% CDI', valor_aplicado: 3000, valor_atual: 3098, percentual_cdi: 95, data_aplicacao: new Date().toISOString().slice(0, 10), status: 'ativo' },
    { empresa_id: empresaId, conta_id: conta!.id, tipo: 'tesouro_direto', nome: 'Tesouro Selic', valor_aplicado: 2000, valor_atual: 2075, percentual_cdi: 100, data_aplicacao: new Date().toISOString().slice(0, 10), status: 'ativo' },
  ])
  await supabase.from('transferencias_agendadas').insert([
    { empresa_id: empresaId, conta_origem_id: conta!.id, tipo: 'pix', valor: 850, destinatario_nome: 'Fornecedor Alpha', data_agendada: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10), status: 'agendado' },
    { empresa_id: empresaId, conta_origem_id: conta!.id, tipo: 'ted', valor: 1450, destinatario_nome: 'Prestador Beta', data_agendada: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10), status: 'agendado' },
  ])
  console.log('Seed Conta PJ concluído.')
}
run().catch((e) => { console.error(e); process.exit(1) })
