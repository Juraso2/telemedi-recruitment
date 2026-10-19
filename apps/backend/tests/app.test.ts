import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test'
import { buildApp } from '../src/app.js'

let app: Awaited<ReturnType<typeof buildApp>>

beforeAll(async () => {
  app = await buildApp()
})
afterAll(async () => {
  await app?.close()
})

describe('API', () => {
  it('serves the application health endpoint', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/health' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok' })
  })

  it('protects the general Mastra routes with the same access check', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/agents' })
    expect(response.statusCode).toBe(401)
    expect(response.json()).toMatchObject({ code: 'access_required' })
  })
})
