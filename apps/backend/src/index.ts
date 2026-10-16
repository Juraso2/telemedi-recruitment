import { buildApp } from './app.js'

const app = await buildApp({ logger: true })
const port = Number(process.env.PORT ?? 3000)

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close().catch((error: unknown) => {
      app.log.error(error)
      process.exitCode = 1
    })
  })
}

try {
  await app.listen({ port, host: process.env.HOST ?? '0.0.0.0' })
} catch (error) {
  app.log.error(error)
  await app.close()
  process.exitCode = 1
}
