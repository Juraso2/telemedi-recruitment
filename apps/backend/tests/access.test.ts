import { afterEach, expect, it, vi } from 'vite-plus/test'
import { buildApp } from '../src/app.js'
import { openAIStub } from './openai-fixture.js'

const cleanup: (() => Promise<unknown>)[] = []
afterEach(async () => {
  vi.useRealTimers()
  for (const close of cleanup.splice(0).reverse()) await close()
})
const account = { adultConfirmed: true, recipient: 'lekarz', account: 'Jest mi ciężko.' }

it('rejects direct AI requests without access before contacting the provider', async () => {
  const provider = await openAIStub()
  cleanup.push(provider.close)
  const app = await buildApp({}, { apiKey: 'test-key', baseURL: provider.baseURL })
  cleanup.push(() => app.close())
  const response = await app.inject({ method: 'POST', url: '/api/notes', payload: account })
  expect(response.statusCode).toBe(401)
  expect(response.json()).toMatchObject({ code: 'access_required' })
  expect(provider.requests).toHaveLength(0)
})

it('only a correct code grants access using a private signed cookie', async () => {
  const provider = await openAIStub()
  cleanup.push(provider.close)
  const app = await buildApp(
    {},
    { apiKey: 'test-key', baseURL: provider.baseURL },
    { code: 'demo-test-code', secureCookies: true },
  )
  cleanup.push(() => app.close())
  const denied = await app.inject({
    method: 'POST',
    url: '/api/demo-access',
    payload: { code: 'wrong-code' },
  })
  expect(denied.statusCode).toBe(401)
  expect(denied.headers['set-cookie']).toBeUndefined()
  const login = await app.inject({
    method: 'POST',
    url: '/api/demo-access',
    payload: { code: 'demo-test-code' },
  })
  expect(login.statusCode).toBe(200)
  const cookie = login.cookies[0]!
  expect(login.headers['set-cookie']).toContain('HttpOnly')
  expect(login.headers['set-cookie']).toContain('SameSite=Strict')
  expect(login.headers['set-cookie']).toContain('Secure')
  expect(login.body + login.headers['set-cookie']).not.toContain('demo-test-code')
  const headers = { cookie: `${cookie.name}=${encodeURIComponent(cookie.value)}` }
  const status = await app.inject({ method: 'GET', url: '/api/demo-access', headers })
  expect(status.json()).toEqual(login.json())
  expect(status.headers['set-cookie']).toBeUndefined()
  const result = await app.inject({ method: 'POST', url: '/api/notes', payload: account, headers })
  expect(result.statusCode).toBe(200)
  expect(provider.requests).toHaveLength(1)
})

it('expires at 24 hours without sliding on status reads and rejects altered credentials', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-19T12:00:00Z'))
  const provider = await openAIStub()
  cleanup.push(provider.close)
  const app = await buildApp(
    {},
    { apiKey: 'test-key', baseURL: provider.baseURL },
    { code: 'demo-test-code' },
  )
  cleanup.push(() => app.close())
  const login = await app.inject({
    method: 'POST',
    url: '/api/demo-access',
    payload: { code: 'demo-test-code' },
  })
  expect(login.json()).toEqual({ expiresAt: Date.parse('2026-10-20T12:00:00Z') })
  const cookie = login.cookies[0]!
  const headers = { cookie: `${cookie.name}=${encodeURIComponent(cookie.value)}` }
  vi.setSystemTime(new Date('2026-10-20T11:59:59Z'))
  const status = await app.inject({ method: 'GET', url: '/api/demo-access', headers })
  expect(status.json()).toEqual(login.json())
  expect(status.headers['set-cookie']).toBeUndefined()
  const tampered = await app.inject({
    method: 'GET',
    url: '/api/demo-access',
    headers: { cookie: `${headers.cookie}changed` },
  })
  expect(tampered.json()).toEqual({ expiresAt: null })
  vi.setSystemTime(new Date('2026-10-20T12:00:00Z'))
  const denied = await app.inject({ method: 'POST', url: '/api/notes', headers, payload: account })
  expect(denied.statusCode).toBe(401)
  expect(provider.requests).toHaveLength(0)
  const renewed = await app.inject({
    method: 'POST',
    url: '/api/demo-access',
    payload: { code: 'demo-test-code' },
  })
  const renewedCookie = renewed.cookies[0]!
  const result = await app.inject({
    method: 'POST',
    url: '/api/notes',
    headers: { cookie: `${renewedCookie.name}=${encodeURIComponent(renewedCookie.value)}` },
    payload: account,
  })
  expect(result.statusCode).toBe(200)
})

it('limits code attempts per IP even when a caller supplies a forwarded address', async () => {
  const app = await buildApp({}, {}, { code: 'demo-test-code' })
  cleanup.push(() => app.close())
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await app.inject({
      method: 'POST',
      url: '/api/demo-access',
      payload: { code: 'wrong' },
      headers: { 'x-forwarded-for': `192.0.2.${attempt}` },
    })
    expect(response.statusCode).toBe(401)
  }
  const blocked = await app.inject({
    method: 'POST',
    url: '/api/demo-access',
    payload: { code: 'demo-test-code' },
  })
  expect(blocked.statusCode).toBe(429)
  expect(blocked.json()).toMatchObject({ code: 'rate_limited' })
  expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0)
})

it('limits protected operations across routes and renewed access sessions', async () => {
  const app = await buildApp({}, {}, { code: 'demo-test-code' })
  cleanup.push(() => app.close())
  async function loginCookie() {
    const login = await app.inject({
      method: 'POST',
      url: '/api/demo-access',
      payload: { code: 'demo-test-code' },
    })
    const cookie = login.cookies[0]!
    return `${cookie.name}=${encodeURIComponent(cookie.value)}`
  }
  let cookie = await loginCookie()
  for (let call = 0; call < 20; call++) {
    const result = await app.inject({ method: 'GET', url: '/api/agents', headers: { cookie } })
    expect(result.statusCode).toBe(200)
  }
  cookie = await loginCookie()
  const denied = await app.inject({
    method: 'POST',
    url: '/api/notes',
    headers: { cookie },
    payload: account,
  })
  expect(denied.statusCode).toBe(429)
  expect(denied.json()).toMatchObject({ code: 'rate_limited' })
})

it('fails closed without configured demo access and never logs codes or credentials', async () => {
  let logs = ''
  const app = await buildApp(
    {
      logger: {
        stream: {
          write(chunk: string) {
            logs += chunk
          },
        },
      },
    },
    {},
    { code: 'PRIVATE-demo-code' },
  )
  cleanup.push(() => app.close())
  const login = await app.inject({
    method: 'POST',
    url: '/api/demo-access?secret=PRIVATE-query',
    payload: { code: 'PRIVATE-demo-code' },
  })
  const cookie = login.cookies[0]!
  await app.inject({
    method: 'GET',
    url: '/api/agents',
    headers: { cookie: `${cookie.name}=${encodeURIComponent(cookie.value)}` },
  })
  expect(logs).not.toContain('PRIVATE')
  expect(logs).not.toContain(cookie.value)
  expect(logs).not.toContain(encodeURIComponent(cookie.value))
  expect(logs).toContain('request_completed')
  const unconfigured = await buildApp({}, {}, {})
  cleanup.push(() => unconfigured.close())
  const denied = await unconfigured.inject({
    method: 'POST',
    url: '/api/demo-access',
    payload: { code: 'anything' },
  })
  expect(denied.statusCode).toBe(503)
  expect(denied.cookies).toHaveLength(0)
})
