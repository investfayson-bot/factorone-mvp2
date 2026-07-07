import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseUser } from '@/lib/supabase-route'
import { criarUrlAutorizacao } from '@/lib/google-oauth'

// Retorna a URL de autorização (não redireciona direto) porque a sessão do
// Supabase neste app vive no localStorage do client, não em cookie — uma
// navegação simples <a href> não carrega o Authorization header. O botão no
// dashboard chama essa rota via fetch (com o Bearer token) e só então faz
// window.location.href = url.
export async function GET(req: NextRequest) {
  const { user, supabase } = await getSupabaseUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { data: u } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
  const empresaId = (u?.empresa_id as string) || user.id
  const origin = req.nextUrl.origin
  return NextResponse.json({ url: criarUrlAutorizacao(empresaId, origin) })
}
