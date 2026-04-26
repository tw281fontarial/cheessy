import { env } from './env'

const baseUrl = env.apiBaseUrl ?? 'http://localhost:4000'

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${baseUrl}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        ...(init?.headers ?? {}),
      },
    })
  } catch (e) {
    console.error('fetch failed', { path, e })
    throw e
  }

  const contentType = res.headers.get('content-type') ?? ''
  const isJson = contentType.includes('application/json')

  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      if (isJson) {
        const body = (await res.json()) as any
        if (typeof body?.error === 'string') message = body.error
        else message = JSON.stringify(body)
      } else {
        const text = await res.text()
        if (text) message = text
      }
    } catch (e) {
      console.error('error parsing failed response', { path, e })
    }
    console.error('api error', { path, status: res.status, message })
    throw new Error(message)
  }

  if (!isJson) return (await res.text()) as any as T
  return (await res.json()) as T
}

