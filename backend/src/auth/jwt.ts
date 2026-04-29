import jwt from 'jsonwebtoken'
import type { Env } from '../env'

export type JwtPayload = {
  sub: string
  role?: 'user' | 'admin'
}

export function signUserJwt(env: Env, payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '30d' })
}

export function verifyUserJwt(env: Env, token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload
    if (!decoded?.sub) return null
    return decoded
  } catch {
    return null
  }
}
