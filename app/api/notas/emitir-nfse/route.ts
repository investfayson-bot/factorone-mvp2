import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import {
  authorizationHeader,
  getNfeioApiKey,
  getNfeioCompanyId,
  getNfeioServiceBaseUrl,
  mapSefazMessage,
} from '@/lib/nfeio'
import { getSupabaseUser } from '@/lib/supabase-route'
import { lancarReceitaNota } from '@/lib/notas-financeiras'
import { erroDesconhecido } from '@/lib/transacao-types'

type BodyNFSe = {
  tomador: {
    cnpjCpf: string
    razaoSocial: string
    email: string
    municipio: string
  }
  servico: {
    descricao: string
    codigoServicoMunicipal: string
    valor: number
    issAliquota: number
    irRetido: boolean
    pisCofinsRetido: boolean
  }
  competencia: string
  dataEmissao?: string
}

function validar(b: BodyNFSe): string | null {
  if (!b.tomador?.cnpjCpf || !b.tomador.razaoSocial) return 'Tomador incompleto'
  if (!b.servico?.descricao || !b.servico.codigoServicoMunicipal) return 'Serviço incompleto'
  if (b.servico.valor <= 0) return 'Valor do serviço inválido'
  if (!b.competencia) return 'Competência obrigatória'
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

    const body = (await req.json()) as BodyNFSe
    const v = validar(body)
    if (v) return NextResponse.json({ error: v }, { status: 400 })

    const valorBruto = body.servico.valor
    const iss = (valorBruto * body.servico.issAliquota) / 100
    const ir = body.servico.irRetido ? (valorBruto * 1.5) / 100 : 0
    const pisCofins = body.servico.pisCofinsRetido ? (valorBruto * 4.65) / 100 : 0
    const impostos = iss + ir + pisCofins

    const federalTaxNumber = Number(body.tomador.cnpjCpf.replace(/\D/g, ''))

    const payload = {
      serviceInvoice: {
        description: body.servico.descricao,
        cityServiceCode: body.servico.codigoServicoMunicipal,
        issRate: body.servico.issAliquota,
        borrower: {
          name: body.tomador.razaoSocial,
          federalTaxNumber,
          email: body.tomador.email,
          address: {
            city: { name: body.tomador.municipio },
            country: 'BRA',
          },
        },
        issuedOn: body.dataEmissao || new Date().toISOString().slice(0, 10),
      },
    }

    const base = getNfeioServiceBaseUrl()
    const url = `${base}/v2/companies/${companyId}/serviceinvoices`

    const nfseRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authorizationHeader(),
      },
      body: JSON.stringify(payload),
    })

    const raw = (await nfseRes.json().catch(() => ({}))) as Record<string, unknown>
    if (!nfseRes.ok) {
      const code = (raw.code as number) || (raw.statusCode as number)
      const msg = mapSefazMessage(
        code,
        typeof raw.message === 'string' ? raw.message : 'Falha ao emitir NFS-e na NFe.io'
      )
      return NextResponse.json({ error: msg, details: raw }, { status: nfseRes.status >= 500 ? 502 : 400 })
    }

    const inv = (raw.serviceInvoice || raw.data || raw) as Record<string, unknown>
    const nfeioId = String(inv.id ?? inv.Id ?? randomUUID())
    const numero = inv.number != null ? String(inv.number) : null
    const statusApi = String(inv.status ?? 'processando').toLowerCase()
    const status =
      statusApi.includes('authorized') || statusApi.includes('autorizada')
        ? 'autorizada'
        : statusApi.includes('reject')
          ? 'rejeitada'
          : 'processando'

    const chave = inv.accessKey != null ? String(inv.accessKey) : null
    const xmlUrl = inv.xmlUrl != null ? String(inv.xmlUrl) : null
    const pdfUrl = inv.pdfUrl != null ? String(inv.pdfUrl) : null

    const competencia = body.competencia.length >= 7 ? `${body.competencia}-01`.slice(0, 10) : new Date().toISOString().slice(0, 10)

    const { data: inserted, error: insErr } = await supabase
      .from('notas_emitidas')
      .insert({
        empresa_id: user.id,
        tipo: 'nfse',
        numero,
        chave_acesso: chave,
        nfeio_id: nfeioId,
        status,
        destinatario_nome: body.tomador.razaoSocial,
        destinatario_cnpj_cpf: body.tomador.cnpjCpf.replace(/\D/g, ''),
        destinatario_email: body.tomador.email,
        valor_total: valorBruto,
        valor_impostos: impostos,
        xml_url: xmlUrl,
        pdf_url: pdfUrl,
        competencia,
        raw_response: raw as object,
        sefaz_motivo: status === 'rejeitada' ? String(inv.message || '') : null,
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
        destinatario: body.tomador.razaoSocial,
        valorTotal: valorBruto,
        competenciaDate: competencia,
      })
      transacaoId = tid
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
      valor_liquido: valorBruto - impostos,
    })
  } catch (e: unknown) {
    console.error('emitir-nfse', e)
    return NextResponse.json({ error: erroDesconhecido(e) }, { status: 500 })
  }
}
