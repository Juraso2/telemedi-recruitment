import { z } from 'zod'
import { setTimeout as delay } from 'node:timers/promises'
import { createNoteRuntime } from '../mastra/index.js'
import { noteOutputSchema, type NoteModelConfig } from '../mastra/agents/note-agent.js'

const noteRequest = z
  .object({
    adultConfirmed: z.literal(true),
    recipient: z.enum(['lekarz', 'psychiatra', 'psycholog', 'psychoterapeuta']),
    account: z.string().trim().min(1).max(20_000),
  })
  .strict()

const errorMessages = {
  invalid_input: 'Sprawdź wypowiedź, adresata i potwierdzenie pełnoletności.',
  configuration:
    'Generowanie nie jest poprawnie skonfigurowane. Osoba uruchamiająca aplikację musi sprawdzić klucz OpenAI i model. Twoja wypowiedź została zachowana.',
  out_of_scope:
    'Opisz własne doświadczenia lub to, czego nie udało Ci się przekazać specjaliście. Twój tekst pozostaje do poprawienia.',
  provider_unavailable:
    'Nie udało się przygotować notatki. Twoja wypowiedź została zachowana. Spróbuj ponownie.',
  generation_failed:
    'Nie udało się przygotować poprawnej notatki. Twoja wypowiedź została zachowana. Spróbuj ponownie.',
}
export type NoteErrorCode = keyof typeof errorMessages
export type NoteResult =
  | { ok: true; note: string }
  | { ok: false; code: NoteErrorCode; message: string }

function failure(code: NoteErrorCode): NoteResult {
  return { ok: false, code, message: errorMessages[code] }
}

function noteFailure(error: unknown): { code: NoteErrorCode; retryable: boolean } {
  let cause = error
  for (let depth = 0; depth < 8 && cause && typeof cause === 'object'; depth++) {
    const detail = cause as {
      statusCode?: number
      name?: string
      cause?: unknown
      isRetryable?: boolean
    }
    if ([400, 401, 403, 404].includes(detail.statusCode ?? 0)) {
      return {
        code: 'configuration',
        retryable: false,
      }
    }
    if (
      detail.isRetryable ||
      [408, 409, 429].includes(detail.statusCode ?? 0) ||
      (detail.statusCode ?? 0) >= 500 ||
      ['AbortError', 'TimeoutError', 'MastraTimeoutError'].includes(detail.name ?? '')
    ) {
      return {
        code: 'provider_unavailable',
        retryable: true,
      }
    }
    cause = detail.cause
  }
  return {
    code: 'generation_failed',
    retryable: false,
  }
}

export function createNoteService(config: NoteModelConfig) {
  return {
    async createNote(body: unknown): Promise<NoteResult> {
      const input = noteRequest.safeParse(body)
      if (!input.success) return failure('invalid_input')

      // This runtime owns the source only for the duration of this request.
      const runtime = createNoteRuntime(config)
      if (!runtime) return failure('configuration')

      try {
        for (let attempt = 0; ; attempt++) {
          try {
            const result = await runtime
              .getAgentById('note-writer')
              .generate(
                JSON.stringify({ adresat: input.data.recipient, wypowiedz: input.data.account }),
                {
                  maxSteps: 1,
                  modelSettings: { maxRetries: 0 },
                  providerOptions: { openai: { store: false } },
                  structuredOutput: { schema: noteOutputSchema, errorStrategy: 'strict' },
                  abortSignal: AbortSignal.timeout(30_000),
                },
              )
            if (result.error) throw result.error

            const output = noteOutputSchema.parse(result.object)
            if (!output.inScope) return failure('out_of_scope')
            if (!output.note.trim()) return failure('generation_failed')

            return { ok: true, note: output.note.trim() }
          } catch (error) {
            const cause = noteFailure(error)
            if (attempt > 0 || !cause.retryable) return failure(cause.code)
            await delay(300)
          }
        }
      } finally {
        await runtime.shutdown()
      }
    },
  }
}
