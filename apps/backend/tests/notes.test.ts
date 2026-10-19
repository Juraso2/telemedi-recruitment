import { afterEach, expect, it } from 'vite-plus/test'
import { buildApp } from '../src/app.js'
import { faithfulNote, openAIStub } from './openai-fixture.js'

const cleanup: (() => Promise<unknown>)[] = []
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close()
})

it('retries a transient provider failure once and preserves a sanitized manual retry response', async () => {
  const provider = await openAIStub([{ status: 503 }, { status: 503 }])
  cleanup.push(provider.close)
  const app = await buildApp({}, { apiKey: 'test-key', baseURL: provider.baseURL })
  cleanup.push(() => app.close())
  const response = await app.inject({
    method: 'POST',
    url: '/api/notes',
    payload: {
      adultConfirmed: true,
      recipient: 'lekarz',
      account: 'Jest mi ciężko.',
    },
  })
  expect(response.statusCode).toBe(502)
  expect(provider.requests).toHaveLength(2)
  expect(response.body).not.toContain('sk-secret')
})

it('turns a confirmed personal account into a note through the OpenAI boundary', async () => {
  const provider = await openAIStub()
  cleanup.push(provider.close)
  const app = await buildApp({}, { apiKey: 'test-key', baseURL: provider.baseURL })
  cleanup.push(() => app.close())
  const response = await app.inject({
    method: 'POST',
    url: '/api/notes',
    payload: {
      adultConfirmed: true,
      recipient: 'psychiatra',
      account: 'Od kilku dni gorzej śpię. Nie wiem, czy to stres.',
    },
  })
  expect(response.statusCode).toBe(200)
  expect(response.json()).toEqual({ note: faithfulNote })
  expect(provider.requests[0]?.store).toBe(false)
})

it.each([
  { adultConfirmed: false, recipient: 'lekarz', account: 'Jest mi ciężko.' },
  { adultConfirmed: true, recipient: 'nieznany', account: 'Jest mi ciężko.' },
  { adultConfirmed: true, recipient: 'lekarz', account: '   ' },
  { adultConfirmed: true, recipient: 'lekarz', account: 'a'.repeat(20_001) },
])('rejects invalid input without sending it to OpenAI: %j', async (payload) => {
  const provider = await openAIStub()
  cleanup.push(provider.close)
  const app = await buildApp({}, { apiKey: 'test-key', baseURL: provider.baseURL })
  cleanup.push(() => app.close())
  const response = await app.inject({ method: 'POST', url: '/api/notes', payload })
  expect(response.statusCode).toBe(400)
  expect(provider.requests).toHaveLength(0)
})

it('returns an out-of-scope result without a generated note', async () => {
  const provider = await openAIStub([{ inScope: false, note: '' }])
  cleanup.push(provider.close)
  const app = await buildApp({}, { apiKey: 'test-key', baseURL: provider.baseURL })
  cleanup.push(() => app.close())
  const response = await app.inject({
    method: 'POST',
    url: '/api/notes',
    payload: { adultConfirmed: true, recipient: 'psycholog', account: 'Napisz kod aplikacji.' },
  })
  expect(response.statusCode).toBe(422)
  expect(response.json()).toMatchObject({ code: 'out_of_scope' })
  expect(response.json()).not.toHaveProperty('note')
})

it('never retries rejected credentials or exposes private content in responses and logs', async () => {
  const provider = await openAIStub([{ status: 401 }])
  cleanup.push(provider.close)
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
    { apiKey: 'PRIVATE-key', baseURL: provider.baseURL },
  )
  cleanup.push(() => app.close())
  const response = await app.inject({
    method: 'POST',
    url: '/api/notes?private_query=SECRET-query',
    headers: { authorization: 'Bearer SECRET-auth' },
    payload: {
      adultConfirmed: true,
      recipient: 'lekarz',
      account: 'SECRET-account: jest mi ciężko.',
    },
  })
  expect(response.statusCode).toBe(503)
  expect(response.json()).toMatchObject({ code: 'configuration' })
  expect(provider.requests).toHaveLength(1)
  for (const secret of ['PRIVATE', 'sk-secret', 'SECRET-query', 'SECRET-auth', 'SECRET-account']) {
    expect(logs + response.body).not.toContain(secret)
  }
  expect(logs).toContain('note_failed')
  expect(logs).toContain('statusCode')
})

it('recovers after one transient failure, without extra framework retries', async () => {
  const provider = await openAIStub([{ status: 503 }, {}])
  cleanup.push(provider.close)
  const app = await buildApp({}, { apiKey: 'test-key', baseURL: provider.baseURL })
  cleanup.push(() => app.close())
  const response = await app.inject({
    method: 'POST',
    url: '/api/notes',
    payload: { adultConfirmed: true, recipient: 'psychoterapeuta', account: 'Jest mi ciężko.' },
  })
  expect(response.json()).toEqual({ note: faithfulNote })
  expect(provider.requests).toHaveLength(2)
})

it('explains missing configuration without needing an API key at startup', async () => {
  const app = await buildApp({}, {})
  cleanup.push(() => app.close())
  const response = await app.inject({
    method: 'POST',
    url: '/api/notes',
    payload: { adultConfirmed: true, recipient: 'lekarz', account: 'Jest mi ciężko.' },
  })
  expect(response.statusCode).toBe(503)
  expect(response.json()).toMatchObject({ code: 'configuration' })
})
