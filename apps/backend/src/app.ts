import { MastraServer } from '@mastra/fastify'
import Fastify, { LogController, type FastifyServerOptions } from 'fastify'
import { mastra } from './mastra/index.js'
import { randomUUID } from 'node:crypto'
import { createNoteWriter, noteFailure, noteRequest, type NoteModelConfig } from './notes.js'

export async function buildApp(
  options: FastifyServerOptions = {},
  config: NoteModelConfig = {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL,
    baseURL: process.env.OPENAI_BASE_URL,
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
  const server = new MastraServer({ app, mastra })
  await server.init()

  app.get('/api/health', async () => ({ status: 'ok' }))

  const writeNote = createNoteWriter(config)
  app.post('/api/notes', async (request, reply) => {
    reply.header('Cache-Control', 'no-store')
    const input = noteRequest.safeParse(request.body)
    if (!input.success)
      return reply.code(400).send({
        code: 'invalid_input',
        message: 'Sprawdź wypowiedź, adresata i potwierdzenie pełnoletności.',
      })
    if (!writeNote)
      return reply.code(503).send({
        code: 'configuration',
        message:
          'Generowanie nie jest skonfigurowane. Osoba uruchamiająca aplikację musi ustawić klucz OpenAI w backendzie.',
      })
    try {
      const result = await writeNote(input.data)
      if (!result.inScope)
        return reply.code(422).send({
          code: 'out_of_scope',
          message:
            'Opisz własne doświadczenia lub to, czego nie udało Ci się przekazać specjaliście. Twój tekst pozostaje do poprawienia.',
        })
      if (!result.note.trim()) throw new Error('Empty note')
      return { note: result.note.trim() }
    } catch (error) {
      const failure = noteFailure(error)
      request.log.warn({ operation: 'create_note', code: failure.code }, 'note_failed')
      return reply.code(failure.status).send({ code: failure.code, message: failure.message })
    }
  })

  return app
}
