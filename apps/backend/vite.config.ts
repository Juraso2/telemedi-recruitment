import { defineConfig } from 'vite-plus'

export default defineConfig({
  test: { name: 'backend', environment: 'node', include: ['tests/**/*.test.ts'] },
})
