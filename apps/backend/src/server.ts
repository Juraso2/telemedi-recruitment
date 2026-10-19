import { registerDemoAccess, type DemoAccessConfig } from './demo-access.js'
import { MastraServer } from '@mastra/fastify'
import Fastify, { LogController, type FastifyServerOptions } from 'fastify'
import { mastra } from './mastra/index.js'
import { randomUUID } from 'node:crypto'
import { createNoteService } from './services/note-service.js'
import type { NoteModelConfig } from './mastra/agents/note-agent.js'
import { registerApi } from './app.js'

export async function buildApp(
  options: FastifyServerOptions = {},
  config: NoteModelConfig = {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL,
    baseURL: process.env.OPENAI_BASE_URL,
  },
  access: DemoAccessConfig = {
    code: process.env.DEMO_ACCESS_CODE,
    secureCookies:
      process.env.DEMO_COOKIE_SECURE === 'false'
        ? false
        : process.env.DEMO_COOKIE_SECURE === 'true'
          ? true
          : undefined,
  },
) {
  const app = Fastify({
    ...options,
    logController: new LogController({ disableRequestLogging: true }),
    requestIdHeader: false,
    genReqId: () => randomUUID(),
  })
  app.setErrorHandler((error, _request, reply) => {
    const statusCode =
      error &&
      typeof error === 'object' &&
      'statusCode' in error &&
      typeof error.statusCode === 'number'
        ? error.statusCode
        : 500
    const status = statusCode >= 400 && statusCode < 500 ? statusCode : 500
    return reply.code(status).send({
      code: 'request_failed',
      message:
        status < 500
          ? 'Nieprawidłowe żądanie. Sprawdź dane i spróbuj ponownie.'
          : 'Nie udało się obsłużyć żądania. Spróbuj ponownie.',
    })
  })
  app.addHook('onResponse', async (request, reply) => {
    request.log.info(
      {
        operation: request.routeOptions.url === '/api/notes' ? 'create_note' : 'http_request',
        statusCode: reply.statusCode,
        durationMs: Math.round(reply.elapsedTime),
      },
      'request_completed',
    )
  })
  await registerDemoAccess(app, access)
  const server = new MastraServer({ app, mastra })
  await server.init()

  registerApi(app, createNoteService(config))
  return app
}
