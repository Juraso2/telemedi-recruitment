import { Mastra } from '@mastra/core/mastra'
import { createNoteAgent, type NoteModelConfig } from './agents/note-agent.js'

// The HTTP adapter must not expose the private note agent through generic routes.
export const mastra = new Mastra({ logger: false })

export function createNoteRuntime(config: NoteModelConfig) {
  if (!config.apiKey?.trim()) return undefined
  return new Mastra({ agents: { writer: createNoteAgent(config) }, logger: false })
}
