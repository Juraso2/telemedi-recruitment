import { expect, test, type Page } from '@playwright/test'

async function startAccount(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Zaczynam' })).toBeDisabled()
  await page.getByLabel('Mam ukończone 18 lat').check()
  await page.getByRole('button', { name: 'Zaczynam' }).click()
  await page.getByLabel('Psychiatra', { exact: true }).check()
  await page.getByRole('button', { name: 'Wolę napisać' }).click()
}

async function receiveNote(page: Page) {
  await startAccount(page)
  await page.getByLabel('Twoja wypowiedź').fill('Od kilku dni gorzej śpię. Nie wiem, czy to stres.')
  await page.getByRole('button', { name: 'Zatwierdź wypowiedź' }).click()
  await page.getByRole('button', { name: 'Przygotuj notatkę' }).click()
  await expect(page.getByRole('heading', { name: 'Twoja notatka' })).toBeVisible()
}

test('copying uses the exact approved edits and editing requires another approval', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        async writeText(text: string) {
          ;(window as unknown as { copiedText: string }).copiedText = text
        },
      },
    })
  })
  await receiveNote(page)
  const firstVersion = '  Nie wiem, czy to stres.\n\nChcę powiedzieć więcej.  '
  await page.getByLabel('Treść notatki', { exact: true }).fill(firstVersion)
  await page.getByRole('button', { name: 'Zatwierdź treść' }).click()
  await page.getByRole('button', { name: 'Kopiuj', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Skopiowano notatkę.')
  expect(await page.evaluate(() => (window as unknown as { copiedText: string }).copiedText)).toBe(
    firstVersion,
  )

  await page.getByRole('button', { name: 'Wróć do edycji' }).click()
  await expect(page.getByRole('button', { name: 'Kopiuj', exact: true })).toHaveCount(0)
  await expect(page.getByText('Skopiowano notatkę.', { exact: true })).toHaveCount(0)
  const secondVersion = 'To moja poprawiona wiadomość.\nBez dodatkowych informacji.'
  await page.getByLabel('Treść notatki', { exact: true }).fill(secondVersion)
  await page.getByRole('button', { name: 'Zatwierdź treść' }).click()
  await page.getByRole('button', { name: 'Kopiuj', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Skopiowano notatkę.')
  expect(await page.evaluate(() => (window as unknown as { copiedText: string }).copiedText)).toBe(
    secondVersion,
  )
})

for (const clipboard of ['denied', 'unavailable'] as const) {
  test(`a ${clipboard} clipboard preserves the approved text and supports manual copy and retry`, async ({
    page,
  }) => {
    await page.addInitScript((mode) => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value:
          mode === 'unavailable'
            ? undefined
            : {
                async writeText() {
                  throw new DOMException('Denied', 'NotAllowedError')
                },
              },
      })
    }, clipboard)
    await receiveNote(page)
    const text = 'Nie udało mi się powiedzieć, że jest mi ciężko.'
    await page.getByLabel('Treść notatki', { exact: true }).fill(text)
    await page.getByRole('button', { name: 'Zatwierdź treść' }).click()
    await page.getByRole('button', { name: 'Kopiuj', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('Nie udało się skopiować')
    await expect(page.getByRole('alert')).toContainText('Ctrl+C')
    const approved = page.getByLabel('Treść zatwierdzonej notatki')
    await expect(approved).toHaveValue(text)
    await page.getByRole('button', { name: 'Zaznacz tekst' }).click()
    await expect(approved).toBeFocused()
    expect(
      await approved.evaluate((element: HTMLTextAreaElement) => ({
        start: element.selectionStart,
        end: element.selectionEnd,
      })),
    ).toEqual({ start: 0, end: text.length })

    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          async writeText(value: string) {
            ;(window as unknown as { copiedText: string }).copiedText = value
          },
        },
      })
    })
    await page.getByRole('button', { name: 'Kopiuj', exact: true }).click()
    await expect(page.getByRole('status')).toHaveText('Skopiowano notatkę.')
    await expect(page.getByRole('alert')).toHaveCount(0)
    expect(
      await page.evaluate(() => (window as unknown as { copiedText: string }).copiedText),
    ).toBe(text)
  })
}

test('a new session clears the note, source and approval without sending it anywhere', async ({
  page,
}) => {
  await receiveNote(page)
  await page.getByRole('button', { name: 'Zatwierdź treść' }).click()
  await expect(
    page.getByText('Nikt nie otrzymał tej notatki automatycznie.', { exact: false }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Nowa sesja', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Zaczynam' })).toBeDisabled()
  await expect(page.getByLabel('Mam ukończone 18 lat')).not.toBeChecked()
  await page.getByLabel('Mam ukończone 18 lat').check()
  await page.getByRole('button', { name: 'Zaczynam' }).click()
  await expect(page.getByLabel('Psychiatra', { exact: true })).not.toBeChecked()
  await page.getByLabel('Psycholog', { exact: true }).check()
  await page.getByRole('button', { name: 'Wolę napisać' }).click()
  await expect(page.getByLabel('Twoja wypowiedź')).toBeEmpty()
  await expect(page.getByRole('button', { name: 'Kopiuj', exact: true })).toHaveCount(0)
})

test('a late clipboard result does not mark a newly edited note as copied', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText() {
          return new Promise<void>((resolve) => {
            ;(window as unknown as { finishCopy: () => void }).finishCopy = resolve
          })
        },
      },
    })
  })
  await receiveNote(page)
  await page.getByRole('button', { name: 'Zatwierdź treść' }).click()
  await page.getByRole('button', { name: 'Kopiuj', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Kopiowanie…')
  await page.getByRole('button', { name: 'Wróć do edycji' }).click()
  await page
    .getByLabel('Treść notatki', { exact: true })
    .fill('To jest nowa wersja, której jeszcze nie skopiowano.')
  await page.getByRole('button', { name: 'Zatwierdź treść' }).click()
  await page.evaluate(async () => {
    ;(window as unknown as { finishCopy: () => void }).finishCopy()
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )
  })
  await expect(page.getByRole('status')).toBeEmpty()
  await expect(page.getByLabel('Treść zatwierdzonej notatki')).toHaveValue(
    'To jest nowa wersja, której jeszcze nie skopiowano.',
  )
})

test('a user can compare sources, edit and approve a note before copying', async ({ page }) => {
  const source = 'Od kilku dni gorzej śpię. Nie wiem, czy to stres.'
  const edited =
    'Od kilku dni gorzej śpię.\n\nNie wiem, czy ma to związek ze stresem. Chcę o tym porozmawiać.'
  await startAccount(page)
  await page.getByLabel('Twoja wypowiedź').fill(source)
  await page.getByRole('button', { name: 'Zatwierdź wypowiedź' }).click()
  await page.getByRole('button', { name: 'Przygotuj notatkę' }).click()

  const editor = page.getByLabel('Treść notatki', { exact: true })
  await expect(editor).toBeEditable()
  await expect(page.getByRole('button', { name: 'Kopiuj', exact: true })).toHaveCount(0)
  const sourceText = page.getByText(source, { exact: true })
  await expect(sourceText).not.toBeVisible()
  await page.getByText('Wypowiedź źródłowa', { exact: true }).press('Enter')
  await expect(sourceText).toBeVisible()
  await editor.fill(edited)
  await expect(sourceText).toHaveText(source)
  await page.getByRole('button', { name: 'Zatwierdź treść' }).click()
  await expect(page.getByRole('heading', { name: 'Zatwierdzona notatka' })).toBeFocused()
  await expect(page.getByLabel('Treść zatwierdzonej notatki')).toHaveValue(edited)
  await expect(page.getByLabel('Treść zatwierdzonej notatki')).not.toBeEditable()
  await expect(page.getByRole('button', { name: 'Kopiuj', exact: true })).toBeEnabled()
})

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
  await expect(page.getByLabel('Treść notatki', { exact: true })).toHaveValue(
    /Nie wiem, czy ma to związek ze stresem/,
  )
  await expect(page.getByRole('button', { name: 'Kopiuj', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Zatwierdź treść' })).toBeVisible()
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
