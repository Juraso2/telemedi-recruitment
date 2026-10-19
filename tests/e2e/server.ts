import { buildApp } from '../../apps/backend/src/app.js'
import { openAIStub } from '../../apps/backend/tests/openai-fixture.js'

const provider = await openAIStub((body) => {
  const input = JSON.stringify(body.messages)
  if (input.includes('TEST_NIEDOSTEPNY')) return { status: 503 }
  if (input.includes('Napisz kod')) return { inScope: false, note: '' }
  return {}
})
const app = await buildApp({}, { apiKey: 'test-key', baseURL: provider.baseURL })
await app.listen({ port: 3100, host: '0.0.0.0' })
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close().then(() => provider.close())
  })
}
