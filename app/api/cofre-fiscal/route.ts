import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseUser, getPapelParaEmpresa, empresaPertenceAoUsuario } from '@/lib/supabase-route'

export const runtime = 'nodejs'

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function makePath(empresaId: string, name: string) {
  const safe = name.replace(/[^\w.\-]/g, '_')
  return `cofre/${empresaId}/${Date.now()}_${safe}`
}

const TIPOS = new Set(['guia', 'declaracao', 'contrato', 'procuracao', 'outro'])

// Adicionar documento ao Cofre. Papel: bloqueia só 'viewer' — o CONTADOR
// pode registrar (o Cofre é justamente o histórico do que o contador fez:
// guia paga, SPED protocolado, procuração). Exceção deliberada ao
// bloquearSeLeitura, que trata contador como só-leitura no resto do app.
//
// `empresaId` no form é OPCIONAL: quando ausente, cai pra empresa ativa do
// login (comportamento original, usado pela tela do Cofre Fiscal). Quando
// presente (ex.: anexar comprovante a partir de Obrigações em visão
// Consolidado/Holding), valida que pertence ao usuário antes de gravar —
// sem isso, um documento de uma empresa do grupo era salvo silenciosamente
// na empresa ATIVA errada (achado do rls-tenant-guardian, Fase 5 Bloco 3).
export async function POST(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const form = await req.formData()
  const tipo = String(form.get('tipo') ?? '')
  const nome = String(form.get('nome') ?? '').trim()
  const descricao = String(form.get('descricao') ?? '').trim() || null
  const competencia = String(form.get('competencia') ?? '').trim() || null
  const file = form.get('file')
  const empresaIdForm = String(form.get('empresaId') ?? '').trim()

  let empresaId: string
  if (empresaIdForm) {
    const pertence = await empresaPertenceAoUsuario(supabase, user.id, empresaIdForm)
    if (!pertence) return NextResponse.json({ error: 'Empresa fora do seu acesso' }, { status: 403 })
    empresaId = empresaIdForm
  } else {
    const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
    empresaId = (u?.empresa_id as string) ?? user.id
  }

  const papel = await getPapelParaEmpresa(supabase, user.id, empresaId)
  if (papel === 'viewer') return NextResponse.json({ error: 'Papel viewer tem acesso somente-leitura.' }, { status: 403 })

  if (!TIPOS.has(tipo)) return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  if (!nome) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
  if (competencia && !/^\d{4}-\d{2}$/.test(competencia)) return NextResponse.json({ error: 'Competência inválida (use AAAA-MM)' }, { status: 400 })

  const service = svc()
  let arquivoPath: string | null = null
  if (file instanceof File && file.size > 0) {
    if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: 'Arquivo acima de 15MB' }, { status: 400 })
    arquivoPath = makePath(empresaId, file.name || 'documento')
    const buffer = Buffer.from(await file.arrayBuffer())
    const up = await service.storage.from('recibos').upload(arquivoPath, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })
    if (up.error) return NextResponse.json({ error: `Storage: ${up.error.message}` }, { status: 400 })
  }

  const { data, error } = await service
    .from('cofre_fiscal_documentos')
    .insert({ empresa_id: empresaId, tipo, nome, descricao, competencia, arquivo_path: arquivoPath, criado_por: user.id })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { registrarResultado } = await import('@/lib/action-engine/registrarResultado')
  try {
    await registrarResultado(service, {
      empresaId,
      tipo: 'document_uploaded',
      origem: 'documento',
      origemRef: `cofre_fiscal_documentos:${data.id}`,
      responsavelPapel: 'contador',
      resolvidoAutomaticamente: false,
      sugestaoIa: null,
      arquivoPath,
    })
  } catch (e) {
    console.error(`[cofre-fiscal] registrarResultado falhou para documento ${data.id}:`, e)
  }

  return NextResponse.json({ ok: true, id: data.id })
}

// Excluir registro do Cofre — aqui o gate é o padrão (contador NÃO exclui:
// registrar histórico é uma coisa, apagar histórico da empresa é outra).
export async function DELETE(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { bloquearSeLeitura } = await import('@/lib/supabase-route')
  const bloqueio = await bloquearSeLeitura(supabase, user.id)
  if (bloqueio) return NextResponse.json({ error: `Papel ${bloqueio} tem acesso somente-leitura.` }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id') ?? ''
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) ?? user.id

  const service = svc()
  const { data: doc } = await service.from('cofre_fiscal_documentos').select('arquivo_path').eq('id', id).eq('empresa_id', empresaId).maybeSingle()
  if (!doc) return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 })

  const { error } = await service.from('cofre_fiscal_documentos').delete().eq('id', id).eq('empresa_id', empresaId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (doc.arquivo_path) await service.storage.from('recibos').remove([doc.arquivo_path])

  return NextResponse.json({ ok: true })
}
