import { expect, test, type Page } from '@playwright/test'

async function startAccount(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Zaczynam' })).toBeDisabled()
  await page.getByLabel('Mam ukończone 18 lat').check()
  await page.getByRole('button', { name: 'Zaczynam' }).click()
  await page.getByLabel('Psychiatra', { exact: true }).check()
  await page.getByRole('button', { name: 'Wolę napisać' }).click()
}

test('a user can confirm an account and receive a note', async ({ page }, testInfo) => {
  await startAccount(page)
  await expect(page.getByRole('button', { name: 'Zatwierdź wypowiedź' })).toBeDisabled()
  await page.getByLabel('Twoja wypowiedź').fill('Od kilku dni gorzej śpię. Nie wiem, czy to stres.')
  await page.getByRole('button', { name: 'Zatwierdź wypowiedź' }).click()
  await expect(page.getByRole('heading', { name: 'Sprawdź swoją wypowiedź' })).toBeFocused()
  await expect(
    page.getByText('Od kilku dni gorzej śpię. Nie wiem, czy to stres.', { exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Przygotuj notatkę' }).click()
  await expect(page.getByRole('heading', { name: 'Twoja notatka' })).toBeVisible()
  await expect(page.getByText(/Nie wiem, czy ma to związek ze stresem/)).toBeVisible()
  await expect(page.getByRole('button', { name: /Kopiuj|Zatwierdź treść/ })).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('note.png'), fullPage: true })
})

test('out-of-scope input stays editable and can be replaced by a short account', async ({
  page,
}) => {
  await startAccount(page)
  await page.getByLabel('Twoja wypowiedź').fill('Napisz kod aplikacji.')
  await page.getByRole('button', { name: 'Zatwierdź wypowiedź' }).click()
  await page.getByRole('button', { name: 'Przygotuj notatkę' }).click()
  await expect(page.getByRole('alert')).toContainText('Opisz własne doświadczenia')
  await expect(page.getByLabel('Twoja wypowiedź')).toHaveValue('Napisz kod aplikacji.')
  await page.getByLabel('Twoja wypowiedź').fill('Jest mi ciężko.')
  await page.getByRole('button', { name: 'Zatwierdź wypowiedź' }).click()
  await page.getByRole('button', { name: 'Przygotuj notatkę' }).click()
  await expect(page.getByRole('heading', { name: 'Twoja notatka' })).toBeVisible()
})

test('a provider failure keeps the account and offers manual retry', async ({ page }) => {
  await startAccount(page)
  await page
    .getByLabel('Twoja wypowiedź')
    .fill('TEST_NIEDOSTEPNY: nie umiem powiedzieć, że jest mi ciężko.')
  await page.getByRole('button', { name: 'Zatwierdź wypowiedź' }).click()
  await page.getByRole('button', { name: 'Przygotuj notatkę' }).click()
  await expect(page.getByRole('alert')).toContainText('Twoja wypowiedź została zachowana')
  await expect(page.getByRole('button', { name: 'Spróbuj ponownie' })).toBeVisible()
  await page.getByRole('button', { name: 'Popraw wypowiedź' }).click()
  await expect(page.getByLabel('Twoja wypowiedź')).toHaveValue(
    'TEST_NIEDOSTEPNY: nie umiem powiedzieć, że jest mi ciężko.',
  )
})
