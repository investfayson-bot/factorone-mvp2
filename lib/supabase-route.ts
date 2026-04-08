import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'

export async function getSupabaseUser(
  req: NextRequest
): Promise<{ user: User | null; supabase: SupabaseClient }> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')?.trim()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(url, anon, {
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  })
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { user, supabase }
}
