import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validarEstado, trocarCodigoPorToken } from '@/lib/google-oauth'
import { obterPerfil } from '@/lib/gmail-client'
import { cifrar } from '@/lib/cofre-crypto'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// Rota pública — o Google chama direto via redirect do navegador (302), sem
// Authorization header. A identidade da empresa vem do `state` assinado.
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const erro = req.nextUrl.searchParams.get('error')

  const falhar = (motivo: string) => NextResponse.redirect(`${origin}/dashboard/agentes/donna?erro=${encodeURIComponent(motivo)}`)

  if (erro) return falhar('Autorização recusada no Google')
  if (!code || !state) return falhar('Retorno inválido do Google')

  const validado = validarEstado(state)
  if (!validado) return falhar('Sessão de conexão expirada — tente de novo')

  try {
    const tokens = await trocarCodigoPorToken(code, origin)
    if (!tokens.refresh_token) return falhar('Google não devolveu refresh token — revogue o acesso em myaccount.google.com/permissions e tente conectar de novo')
    const perfil = await obterPerfil(tokens.access_token)

    await db().from('google_contas').upsert({
      empresa_id: validado.empresaId,
      email: perfil.emailAddress,
      refresh_token_cifrado: cifrar(tokens.refresh_token),
      escopos: 'gmail.modify gmail.compose',
      conectado_em: new Date().toISOString(),
      ativo: true,
    }, { onConflict: 'empresa_id' })

    return NextResponse.redirect(`${origin}/dashboard/agentes/donna?conectado=1`)
  } catch {
    return falhar('Falha ao conectar com o Google')
  }
}
