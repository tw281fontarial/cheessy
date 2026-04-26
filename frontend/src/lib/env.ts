function parseCsv(value: string | undefined) {
  if (!value) return []
  return value
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

export const env = {
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim(),
  devAllowedUsernames: parseCsv(import.meta.env.VITE_DEV_ALLOWED_USERNAMES as string | undefined),
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim(),
  supabaseAnonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim(),
}

export function isLocalhostHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1'
}

