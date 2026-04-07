import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | undefined

function getClient(): SupabaseClient {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return client
}

/** Singleton; só instancia no browser na primeira chamada (evita erro no `next build` sem env). */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const value = Reflect.get(getClient(), prop as string | symbol)
    return typeof value === 'function' ? value.bind(getClient()) : value
  },
})
