import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from './env'

let _client: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  const url = env.supabaseUrl
  const key = env.supabaseAnonKey
  if (!url || !key) {
    throw new Error('Supabase Storage не настроен')
  }
  if (_client) return _client
  _client = createClient(url, key)
  return _client
}

