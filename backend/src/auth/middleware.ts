import type { NextFunction, Request, Response } from 'express'
import type { Env } from '../env'
import { verifyUserJwt } from './jwt'

export type AuthedRequest = Request & { auth?: { userId: string; role: 'user' | 'admin' } }

export function authMiddleware(
  env: Env,
  resolveRole?: (userId: string) => Promise<'user' | 'admin' | null>,
) {
  return async (req: AuthedRequest, _res: Response, next: NextFunction) => {
    const bearer = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice('Bearer '.length)
      : undefined
    const token = bearer ?? (req.cookies?.cheessy_token as string | undefined)
    if (!token) return next()

    const payload = verifyUserJwt(env, token)
    if (!payload) return next()
    try {
      const role = resolveRole ? await resolveRole(payload.sub) : payload.role
      if (!role) return next()
      req.auth = { userId: payload.sub, role }
      next()
    } catch (e) {
      next(e)
    }
  }
}

export function requireAuth(req: AuthedRequest, res: Response): req is AuthedRequest & { auth: NonNullable<AuthedRequest['auth']> } {
  if (!req.auth) {
    res.status(401).json({ error: 'Unauthorized' })
    return false
  }
  return true
}

export function requireAdmin(req: AuthedRequest, res: Response): boolean {
  if (!requireAuth(req, res)) return false
  if (req.auth.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden' })
    return false
  }
  return true
}
