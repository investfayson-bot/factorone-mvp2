import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import {
  authorizationHeader,
  getNfeioApiKey,
  getNfeioCompanyId,
  getNfeioProductBaseUrl,
  mapSefazMessage,
} from '@/lib/nfeio'
import { getSupabaseUser } from '@/lib/supabase-route'
import { lancarReceitaNota } from '@/lib/notas-financeiras'
import { recalcularDREMes } from '@/lib/financeiro/recalcularDRE'
import { erroDesconhecido } from '@/lib/transacao-types'

type Produto = {
  descricao: string
  ncm: string
  cfop: string
  quantidade: number
  unidade: string
  valorUnitario: number
  icmsAliquota: number
}

type BodyNFe = {
  destinatario: {
    cnpjCpf: string
    razaoSocial: string
    email: string
    cep: string
    logradouro: string
    numero: string
    complemento?: string
    bairro: string
    cidade: string
    uf: string
  }
  produtos: Produto[]
  transportadora?: { nome?: string; cnpj?: string; modalidadeFrete?: string }
  informacoesAdicionais?: string
  naturezaOperacao?: string
}

function validar(body: BodyNFe): string | null {
  if (!body.destinatario?.cnpjCpf || !body.destinatario.razaoSocial) return 'Destinatário incompleto'
  if (!body.produtos?.length) return 'Inclua ao menos um produto'
  for (const p of body.produtos) {
    if (!p.descricao || !p.ncm || p.ncm.replace(/\D/g, '').length !== 8) return 'NCM inválido (8 dígitos)'
    if (!p.cfop || p.quantidade <= 0 || p.valorUnitario < 0) return 'Produto com dados inválidos'
  }
  return null
}

export async function POST(req: NextRequest) {
  try {
    const key = getNfeioApiKey()
    const companyId = getNfeioCompanyId()
    if (!key) {
      return NextResponse.json({ error: 'NFEIO_API_KEY ou NEXT_PUBLIC_NFEIO_API_KEY não configurada no servidor' }, { status: 500 })
    }
    if (!companyId) {
      return NextResponse.json({ error: 'NFEIO_COMPANY_ID não configurada' }, { status: 500 })
    }

    const { user, supabase } = await getSupabaseUser(req)
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = (await req.json()) as BodyNFe
    const v = validar(body)
    if (v) return NextResponse.json({ error: v }, { status: 400 })

    const valorProdutos = body.produtos.reduce(
      (s, p) => s + p.quantidade * p.valorUnitario,
      0
    )
    const valorIcms = body.produtos.reduce(
      (s, p) => s + (p.quantidade * p.valorUnitario * p.icmsAliquota) / 100,
      0
    )

    const federalTaxNumber = Number(body.destinatario.cnpjCpf.replace(/\D/g, ''))

    const payload = {
      productInvoice: {
        nature: body.naturezaOperacao || 'Venda de mercadoria',
        borrower: {
          name: body.destinatario.razaoSocial,
          federalTaxNumber,
          email: body.destinatario.email,
          address: {
            street: body.destinatario.logradouro,
            number: body.destinatario.numero,
            district: body.destinatario.bairro,
            city: { name: body.destinatario.cidade },
            state: body.destinatario.uf,
            postalCode: body.destinatario.cep.replace(/\D/g, ''),
            country: 'BRA',
          },
        },
        items: body.produtos.map((p) => ({
          description: p.descricao,
          ncm: p.ncm.replace(/\D/g, ''),
          cfop: p.cfop,
          quantity: p.quantidade,
          unit: p.unidade,
          unitAmount: p.valorUnitario,
          icmsRate: p.icmsAliquota,
        })),
        additionalInformation: body.informacoesAdicionais || undefined,
        transporter: body.transportadora?.nome
          ? {
              name: body.transportadora.nome,
              federalTaxNumber: body.transportadora.cnpj?.replace(/\D/g, ''),
            }
          : undefined,
      },
    }

    const base = getNfeioProductBaseUrl()
    const url = `${base}/v2/companies/${companyId}/productinvoices`

    const nfeRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authorizationHeader(),
      },
      body: JSON.stringify(payload),
    })

    const raw = (await nfeRes.json().catch(() => ({}))) as Record<string, unknown>
    if (!nfeRes.ok) {
      const code = (raw.code as number) || (raw.statusCode as number)
      const msg =
        mapSefazMessage(
          code,
          typeof raw.message === 'string' ? raw.message : 'Falha ao emitir NF-e na NFe.io'
        ) || 'Erro na API NFe.io'
      return NextResponse.json({ error: msg, details: raw }, { status: nfeRes.status >= 500 ? 502 : 400 })
    }

    const inv = (raw.productInvoice || raw.data || raw) as Record<string, unknown>
    const nfeioId = String(inv.id ?? inv.Id ?? '')
    const numero = inv.number != null ? String(inv.number) : null
    const statusApi = String(inv.status ?? 'processando').toLowerCase()
    const status =
      statusApi.includes('authorized') || statusApi.includes('autorizada')
        ? 'autorizada'
        : statusApi.includes('reject')
          ? 'rejeitada'
          : 'processando'

    const chave = inv.accessKey != null ? String(inv.accessKey) : null
    const xmlUrl = inv.xmlUrl != null ? String(inv.xmlUrl) : inv.xml_url != null ? String(inv.xml_url) : null
    const pdfUrl = inv.pdfUrl != null ? String(inv.pdfUrl) : inv.danfeUrl != null ? String(inv.danfeUrl) : null

    const competencia = new Date().toISOString().slice(0, 10)

    const { data: inserted, error: insErr } = await supabase
      .from('notas_emitidas')
      .insert({
        empresa_id: user.id,
        tipo: 'nfe',
        numero,
        chave_acesso: chave,
        nfeio_id: nfeioId || randomUUID(),
        status,
        destinatario_nome: body.destinatario.razaoSocial,
        destinatario_cnpj_cpf: body.destinatario.cnpjCpf.replace(/\D/g, ''),
        destinatario_email: body.destinatario.email,
        valor_total: valorProdutos,
        valor_impostos: valorIcms,
        xml_url: xmlUrl,
        pdf_url: pdfUrl,
        competencia,
        raw_response: raw as object,
        sefaz_motivo: status === 'rejeitada' ? String(inv.message || inv.motivo || '') : null,
      })
      .select('id')
      .single()

    if (insErr || !inserted?.id) {
      return NextResponse.json({ error: insErr?.message || 'Erro ao salvar nota' }, { status: 500 })
    }

    let transacaoId: string | null = null
    if (status === 'autorizada') {
      const { transacaoId: tid } = await lancarReceitaNota(supabase, {
        empresaId: user.id,
        notaEmitidaId: inserted.id,
        numero,
        destinatario: body.destinatario.razaoSocial,
        valorTotal: valorProdutos,
        competenciaDate: competencia,
      })
      transacaoId = tid
      await supabase.from('lancamentos').insert({
        empresa_id: user.id,
        descricao: `Receita NF-e ${numero || ''}`.trim(),
        valor: valorProdutos,
        tipo: 'credito',
        competencia,
        transaction_id: transacaoId,
        nota_id: inserted.id,
        origem: 'nfe',
      })
      await recalcularDREMes(user.id, new Date(competencia))
    }

    return NextResponse.json({
      success: true,
      nfe_id: nfeioId,
      numero,
      xml_url: xmlUrl,
      pdf_url: pdfUrl,
      nota_emitida_id: inserted.id,
      transacao_id: transacaoId,
      status,
    })
  } catch (e: unknown) {
    console.error('emitir-nfe', e)
    return NextResponse.json({ error: erroDesconhecido(e) }, { status: 500 })
  }
}
