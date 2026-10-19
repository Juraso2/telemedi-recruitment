import { createHash } from 'node:crypto'
import { test as base } from '@playwright/test'

export { expect } from '@playwright/test'
export const test = base.extend({
  context: async ({ context }, use, testInfo) => {
    const ip = createHash('sha256').update(testInfo.testId).digest()
    await context.setExtraHTTPHeaders({ 'x-forwarded-for': `192.${ip[0]}.${ip[1]}.${ip[2]}` })
    await use(context)
  },
})

export async function unlockDemo(page: import('@playwright/test').Page) {
  await page.getByLabel('Kod dostępu do demo').fill('demo-test-code')
  await page.getByRole('button', { name: 'Odblokuj dostęp' }).click()
  await base.expect(page.getByText('Dostęp do demo jest aktywny.', { exact: true })).toBeVisible()
}
