import { expect, test } from './fixtures.js'

test('a code unlocks AI, wrong codes do not, and access survives a refresh', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Kod dostępu do demo').fill('wrong-code')
  await page.getByRole('button', { name: 'Odblokuj dostęp' }).click()
  await expect(page.getByRole('alert')).toContainText('Niepoprawny kod')
  const denied = await page.request.post('/api/notes', {
    data: { adultConfirmed: true, recipient: 'lekarz', account: 'Jest mi ciężko.' },
  })
  expect(denied.status()).toBe(401)
  await page.getByLabel('Kod dostępu do demo').fill('demo-test-code')
  await page.getByRole('button', { name: 'Odblokuj dostęp' }).click()
  await expect(page.getByText('Dostęp do demo jest aktywny.', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('Dostęp do demo jest aktywny.', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Kod dostępu do demo')).toHaveCount(0)
})

for (const trigger of ['server', 'browser'] as const) {
  test(`expired access is renewed without losing the confirmed account: ${trigger}`, async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByLabel('Kod dostępu do demo').fill('demo-test-code')
    await page.getByRole('button', { name: 'Odblokuj dostęp' }).click()
    await expect(page.getByText('Dostęp do demo jest aktywny.', { exact: true })).toBeVisible()
    const loginStatus = await page.request.get('/api/demo-access')
    const { expiresAt } = (await loginStatus.json()) as { expiresAt: number }
    await page.reload()
    const refreshed = await page.request.get('/api/demo-access')
    expect(await refreshed.json()).toEqual({ expiresAt })
    await page.getByLabel('Mam ukończone 18 lat').check()
    await page.getByRole('button', { name: 'Zaczynam' }).click()
    await page.getByLabel('Psychiatra', { exact: true }).check()
    await page.getByRole('button', { name: 'Wolę napisać' }).click()
    const account = 'Nie wiem, jak powiedzieć, że jest mi ciężko.'
    await page.getByLabel('Twoja wypowiedź').fill(account)
    await page.getByRole('button', { name: 'Zatwierdź wypowiedź' }).click()
    try {
      const advanced = await page.request.post('/api/test-clock', {
        data: { offset: 24 * 60 * 60 * 1000 },
      })
      expect(advanced.ok()).toBe(true)
      const { now } = (await advanced.json()) as { now: number }
      if (trigger === 'server') {
        await page.getByRole('button', { name: 'Przygotuj notatkę' }).click()
        await expect(page.getByLabel('Kod dostępu do demo')).toBeVisible()
        await page.clock.setFixedTime(new Date(now))
      } else {
        await page.clock.setFixedTime(new Date(now))
        await page.evaluate(() => window.dispatchEvent(new Event('focus')))
      }
      await expect(
        page.getByText('Dostęp wygasł lub wymaga odnowienia.', { exact: false }),
      ).toBeVisible()
      await expect(page.getByLabel('Kod dostępu do demo')).toBeFocused()
      await expect(page.getByText(account, { exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Przygotuj notatkę' })).toBeDisabled()
      await page.getByLabel('Kod dostępu do demo').fill('wrong-code')
      await page.getByRole('button', { name: 'Odblokuj dostęp' }).click()
      await expect(page.getByRole('alert')).toContainText('Niepoprawny kod')
      await expect(page.getByText(account, { exact: true })).toBeVisible()
      await page.getByLabel('Kod dostępu do demo').fill('demo-test-code')
      await page.getByRole('button', { name: 'Odblokuj dostęp' }).click()
      await expect(page.getByText('Dostęp do demo jest aktywny.', { exact: true })).toBeVisible()
      expect(
        await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })),
      ).toEqual({ local: 0, session: 0 })
      await page.getByRole('button', { name: 'Przygotuj notatkę' }).click()
      await expect(page.getByRole('heading', { name: 'Twoja notatka' })).toBeVisible()
      await page.getByText('Wypowiedź źródłowa', { exact: true }).click()
      await expect(page.getByText(account, { exact: true })).toBeVisible()
    } finally {
      await page.request.post('/api/demo-access', { data: { code: 'demo-test-code' } })
      await page.request.post('/api/test-clock', { data: { offset: 0 } })
    }
  })
}
