import { MastraServer } from '@mastra/fastify'
import Fastify, { type FastifyServerOptions } from 'fastify'
import { mastra } from './mastra/index.js'

export async function buildApp(options: FastifyServerOptions = {}) {
  const app = Fastify(options)
  const server = new MastraServer({ app, mastra })
  await server.init()

  app.get('/api/health', async () => ({ status: 'ok' }))

  return app
}
