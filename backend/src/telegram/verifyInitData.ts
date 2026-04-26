import crypto from 'node:crypto'

export function parseInitData(initData: string): Record<string, string> {
  const params = new URLSearchParams(initData)
  const out: Record<string, string> = {}
  for (const [k, v] of params.entries()) out[k] = v
  return out
}

export function verifyTelegramInitData(initData: string, botToken: string): boolean {
  const data = parseInitData(initData)
  const receivedHash = data.hash
  if (!receivedHash) return false
  delete data.hash

  const checkString = Object.keys(data)
    .sort()
    .map((k) => `${k}=${data[k]}`)
    .join('\n')

  const secretKey = crypto.createHash('sha256').update(botToken).digest()
  const hmac = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex')
  return hmac === receivedHash
}

export function getTelegramUserFromInitData(initData: string):
  | {
      id: number
      username?: string
      first_name?: string
      last_name?: string
      photo_url?: string
    }
  | null {
  const data = parseInitData(initData)
  if (!data.user) return null
  try {
    return JSON.parse(data.user) as any
  } catch {
    return null
  }
}

