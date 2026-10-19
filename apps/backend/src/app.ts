import type { FastifyInstance } from 'fastify'
import type { createNoteService, NoteErrorCode } from './services/note-service.js'

const noteStatus: Record<NoteErrorCode, number> = {
  invalid_input: 400,
  configuration: 503,
  out_of_scope: 422,
  provider_unavailable: 502,
  generation_failed: 502,
}

export function registerApi(app: FastifyInstance, notes: ReturnType<typeof createNoteService>) {
  app.get('/api/health', async () => ({ status: 'ok' }))

  app.post('/api/notes', async (request, reply) => {
    const result = await notes.createNote(request.body)
    if (result.ok) return { note: result.note }
    if (
      result.code === 'provider_unavailable' ||
      result.code === 'generation_failed' ||
      result.code === 'configuration'
    )
      request.log.warn({ operation: 'create_note', code: result.code }, 'note_failed')
    return reply.code(noteStatus[result.code]).send({ code: result.code, message: result.message })
  })
}
