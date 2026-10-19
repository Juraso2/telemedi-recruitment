import { buildApp } from './server.js'

const app = await buildApp({ logger: true })
const port = Number(process.env.PORT ?? 3000)

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close().catch(() => {
      app.log.error({ operation: 'shutdown', code: 'shutdown_failed' }, 'server_failed')
      process.exitCode = 1
    })
  })
}

try {
  await app.listen({ port, host: process.env.HOST ?? '0.0.0.0' })
} catch {
  app.log.error({ operation: 'startup', code: 'startup_failed' }, 'server_failed')
  await app.close()
  process.exitCode = 1
}
