import { z } from 'zod'

const EnvBoolean = z.preprocess((value) => {
  if (typeof value !== 'string') return value
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}, z.boolean())

const EnvSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_BASE_URL: z.string().default('http://localhost:5173'),
  APP_BASE_URLS: z.string().optional(),
  JWT_SECRET: z.string().min(16),
  DEV_LOGIN_ENABLED: EnvBoolean.default(false),
  DEV_ADMIN_TELEGRAM_ID: z.coerce.number().int().optional(),

  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_INIT_DATA_MAX_AGE_SECONDS: z.coerce.number().int().positive().default(86400),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  KEEPALIVE_URLS: z.string().optional(),
  KEEPALIVE_INTERVAL_MS: z.coerce.number().int().positive().default(10 * 60 * 1000),
  KEEPALIVE_SECRET: z.string().optional(),
})

export type Env = z.infer<typeof EnvSchema>

export function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env)
  if (!parsed.success) {
    console.error(parsed.error.flatten().fieldErrors)
    throw new Error('Invalid environment variables')
  }
  return parsed.data
}
