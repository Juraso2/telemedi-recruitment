import { defineConfig } from 'vite-plus'

export default defineConfig({
  staged: { '*': 'vp check --fix' },
  fmt: {
    semi: false,
    singleQuote: true,
  },
  lint: {
    plugins: ['typescript'],
    jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
    rules: { 'vite-plus/prefer-vite-plus-imports': 'error' },
    options: { typeAware: true, typeCheck: true },
    overrides: [
      {
        files: ['apps/frontend/src/**'],
        plugins: ['react', 'jsx-a11y'],
        env: { browser: true },
        rules: { 'react/self-closing-comp': 'error' },
      },
      { files: ['apps/backend/**', '**/vite.config.ts'], env: { node: true } },
    ],
  },
  test: { projects: ['apps/backend'] },
})
