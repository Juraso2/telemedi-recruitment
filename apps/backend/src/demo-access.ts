import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'

export type DemoAccessConfig = { code?: string; secureCookies?: boolean; now?: () => number }
const cookieName = 'demo_access'
const lifetime = 24 * 60 * 60 * 1000
const codeInput = z.object({ code: z.string().min(1).max(256) }).strict()
const hash = (text: string) => createHash('sha256').update(text).digest()

export async function registerDemoAccess(app: FastifyInstance, config: DemoAccessConfig) {
  const now = config.now ?? Date.now
  await app.register(cookie, { secret: randomBytes(32).toString('hex') })
  await app.register(rateLimit, { global: false })
  const codeLimit = app.createRateLimit({ max: 5, timeWindow: 15 * 60 * 1000 })
  const operationLimit = app.createRateLimit({ max: 20, timeWindow: 60 * 60 * 1000 })
  async function checkLimit(
    limit: ReturnType<typeof app.createRateLimit>,
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const result = await limit(request)
    if (result.isAllowed || !result.isExceeded) return false
    reply.header('Retry-After', result.ttlInSeconds).code(429).send({
      code: 'rate_limited',
      message: 'Osiągnięto limit prób w demo. Spróbuj później. Twoja praca pozostaje w aplikacji.',
    })
    return true
  }
  function expiresAt(request: FastifyRequest): number | null {
    const signed = request.cookies[cookieName]
    if (!signed) return null
    const result = app.unsignCookie(signed)
    if (!result.valid) return null
    const expiry = Number(result.value)
    return Number.isSafeInteger(expiry) && expiry > now() && expiry <= now() + lifetime
      ? expiry
      : null
  }
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store')
    if (['/api/health', '/api/demo-access'].includes(request.routeOptions.url ?? '')) return
    if (expiresAt(request)) {
      await checkLimit(operationLimit, request, reply)
      return
    }
    return reply.code(401).send({
      code: 'access_required',
      message: 'Podaj kod dostępu do demo. Twoja praca pozostaje w aplikacji.',
    })
  })
  app.get('/api/demo-access', async (request) => ({ expiresAt: expiresAt(request) }))
  app.post('/api/demo-access', async (request, reply) => {
    if (await checkLimit(codeLimit, request, reply)) return
    if (!config.code || config.code.length < 12 || config.code.length > 256)
      return reply.code(503).send({
        code: 'access_configuration',
        message: 'Dostęp do demo wymaga konfiguracji kodu na serwerze.',
      })
    const input = codeInput.safeParse(request.body)
    if (!input.success || !timingSafeEqual(hash(input.data.code), hash(config.code)))
      return reply
        .code(401)
        .send({ code: 'invalid_code', message: 'Niepoprawny kod dostępu. Spróbuj ponownie.' })
    const expiry = now() + lifetime
    reply.setCookie(cookieName, String(expiry), {
      signed: true,
      httpOnly: true,
      sameSite: 'strict',
      secure: config.secureCookies ?? process.env.NODE_ENV === 'production',
      path: '/api',
      maxAge: lifetime / 1000,
      expires: new Date(expiry),
    })
    return { expiresAt: expiry }
  })
}
