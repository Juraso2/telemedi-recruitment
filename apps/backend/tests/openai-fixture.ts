import { createServer } from 'node:http'

export const faithfulNote =
  'Po konsultacji zostało mi coś ważnego do powiedzenia. Od kilku dni gorzej śpię. Nie wiem, czy ma to związek ze stresem.'

type Outcome = { status?: number; inScope?: boolean; note?: string; raw?: string }

// A controlled external OpenAI HTTP boundary, not a replacement for the app or Mastra.
export async function openAIStub(
  outcomes: Outcome[] | ((body: Record<string, unknown>) => Outcome) = [{}],
) {
  const requests: Record<string, unknown>[] = []
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = []
    for await (const chunk of request) chunks.push(Buffer.from(chunk))
    const body = JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown>
    requests.push(body)
    const outcome = typeof outcomes === 'function' ? outcomes(body) : (outcomes.shift() ?? {})
    if (outcome.status) {
      response.writeHead(outcome.status, { 'content-type': 'application/json' })
      response.end(
        JSON.stringify({
          error: { message: 'PRIVATE provider detail sk-secret', type: 'api_error' },
        }),
      )
      return
    }
    const content =
      outcome.raw ??
      JSON.stringify({ inScope: outcome.inScope ?? true, note: outcome.note ?? faithfulNote })
    const base = { id: 'chatcmpl-test', created: 1, model: 'gpt-4.1-mini' }
    if (body.stream) {
      response.writeHead(200, { 'content-type': 'text/event-stream' })
      response.write(
        `data: ${JSON.stringify({ ...base, object: 'chat.completion.chunk', choices: [{ index: 0, delta: { role: 'assistant', content }, finish_reason: null }] })}\n\n`,
      )
      response.write(
        `data: ${JSON.stringify({ ...base, object: 'chat.completion.chunk', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 30, total_tokens: 40 } })}\n\n`,
      )
      response.end('data: [DONE]\n\n')
    } else {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(
        JSON.stringify({
          ...base,
          object: 'chat.completion',
          choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 30, total_tokens: 40 },
        }),
      )
    }
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('No stub address')
  return {
    baseURL: `http://127.0.0.1:${address.port}/v1`,
    requests,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  }
}
