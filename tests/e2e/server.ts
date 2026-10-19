import { buildApp } from '../../apps/backend/src/server.js'
import { openAIStub } from '../../apps/backend/tests/openai-fixture.js'

const provider = await openAIStub((body) => {
  const input = JSON.stringify(body.messages)
  if (input.includes('TEST_NIEDOSTEPNY')) return { status: 503 }
  if (input.includes('Napisz kod')) return { inScope: false, note: '' }
  return {}
})
let clockOffset = 0
// Only this test fixture trusts synthetic client IPs to isolate production rate limits.
const app = await buildApp(
  { trustProxy: true },
  { apiKey: 'test-key', baseURL: provider.baseURL },
  {
    code: 'demo-test-code',
    secureCookies: false,
    now: () => Date.now() + clockOffset,
  },
)
// Controlled time boundary, available only in the test server and behind access control.
app.post('/api/test-clock', async (request) => {
  const { offset } = request.body as { offset: number }
  if (!Number.isFinite(offset)) throw new Error('Invalid test time')
  clockOffset = offset
  return { now: Date.now() + clockOffset }
})
await app.listen({ port: Number(process.env.E2E_API_PORT ?? 3100), host: '0.0.0.0' })
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close().then(() => provider.close())
  })
}
