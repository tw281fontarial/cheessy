import { env } from './env'

const TOKEN_KEY = 'cheessy_auth_token'

type ApiErrorBody = {
  error?: unknown
}

export function setAuthToken(token: string | null) {
  if (!token) localStorage.removeItem(TOKEN_KEY)
  else localStorage.setItem(TOKEN_KEY, token)
}

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  if (!env.apiBaseUrl) {
    const e = new Error('VITE_API_BASE_URL is missing')
    console.error(e.message)
    throw e
  }

  const url = `${env.apiBaseUrl}${path}`
  const token = getAuthToken()
  const hasBody = init?.body !== undefined
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  }
  if (hasBody && !headers['content-type']) headers['content-type'] = 'application/json'
  if (token && !headers.authorization) headers.authorization = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      credentials: 'include',
      headers,
    })
  } catch (e) {
    console.error('fetch failed', { url, path, error: e })
    throw e
  }

  const contentType = res.headers.get('content-type') ?? ''
  const isJson = contentType.includes('application/json')

  if (!res.ok) {
    let message = `HTTP ${res.status}`
    let responseText = ''
    try {
      if (isJson) {
        const body = (await res.json()) as ApiErrorBody
        responseText = JSON.stringify(body)
        if (typeof body?.error === 'string') message = body.error
        else message = JSON.stringify(body)
      } else {
        responseText = await res.text()
        if (responseText) message = responseText
      }
    } catch (e) {
      console.error('error parsing failed response', { url, path, error: e })
    }
    console.error('api error', { url, path, status: res.status, responseText, message })
    throw new Error(message)
  }

  if (!isJson) return (await res.text()) as T
  return (await res.json()) as T
}
