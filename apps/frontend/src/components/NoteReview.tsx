import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

type NoteReviewProps = { note: string; source: string; onNewSession: () => void }

export function NoteReview({ note, source, onNewSession }: NoteReviewProps) {
  const [text, setText] = useState(note)
  const [approved, setApproved] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied' | 'failed'>('idle')
  const heading = useRef<HTMLHeadingElement>(null)
  const approvedText = useRef<HTMLTextAreaElement>(null)
  const copyAttempt = useRef(0)

  useEffect(() => {
    heading.current?.focus()
  }, [approved])
  useEffect(
    () => () => {
      copyAttempt.current += 1
    },
    [],
  )

  async function copy() {
    if (!approved || copyStatus === 'copying') return
    const attempt = ++copyAttempt.current
    setCopyStatus('copying')
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(text)
      if (attempt === copyAttempt.current) setCopyStatus('copied')
    } catch {
      if (attempt === copyAttempt.current) setCopyStatus('failed')
    }
  }

  return (
    <>
      <h2
        className="mb-3 text-lg font-semibold focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4"
        ref={heading}
        tabIndex={-1}
      >
        {approved ? 'Zatwierdzona notatka' : 'Sprawdź treść notatki'}
      </h2>
      <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
        {approved
          ? 'To wersja zatwierdzona przez Ciebie. Możesz ją skopiować i samodzielnie przekazać specjaliście.'
          : 'Porównaj propozycję ze swoją wypowiedzią. Możesz zmienić treść, zanim ją zatwierdzisz.'}
      </p>
      <details className="mb-6">
        <summary className="cursor-pointer py-3 text-sm text-primary focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2">
          Wypowiedź źródłowa
        </summary>
        <p className="rounded-lg bg-muted p-4 text-sm leading-relaxed whitespace-pre-wrap wrap-anywhere">
          {source}
        </p>
      </details>
      {approved ? (
        <>
          <label className="mb-2 block text-sm leading-normal font-medium" htmlFor="approved-note">
            Treść zatwierdzonej notatki
          </label>
          <textarea
            id="approved-note"
            ref={approvedText}
            className="min-h-48 w-full min-w-0 resize-y rounded-lg border border-input border-l-4 border-l-primary/50 bg-muted/40 p-3 text-base leading-relaxed whitespace-pre-wrap wrap-anywhere focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 sm:p-4 sm:text-sm"
            rows={10}
            value={text}
            readOnly
          />
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button
              variant="outline"
              className="min-h-11 w-full gap-3 rounded-lg px-4 py-3 text-sm whitespace-normal sm:w-auto"
              onClick={() => {
                copyAttempt.current += 1
                setCopyStatus('idle')
                setApproved(false)
              }}
            >
              Wróć do edycji
            </Button>
            <Button
              className="min-h-11 w-full gap-3 rounded-lg px-4 py-3 text-sm whitespace-normal sm:w-auto"
              disabled={copyStatus === 'copying'}
              onClick={() => void copy()}
            >
              Kopiuj
            </Button>
          </div>
          <output className="mt-4 block text-sm leading-relaxed text-muted-foreground">
            {copyStatus === 'copied'
              ? 'Skopiowano notatkę.'
              : copyStatus === 'copying'
                ? 'Kopiowanie…'
                : ''}
          </output>
          {copyStatus === 'failed' && (
            <div>
              <p
                role="alert"
                className="my-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm leading-relaxed text-destructive"
              >
                Nie udało się skopiować notatki. Możesz ponownie wybrać „Kopiuj” albo zaznaczyć
                tekst i skopiować go ręcznie. Na komputerze użyj Ctrl+C lub ⌘C, a na telefonie opcji
                „Kopiuj” po zaznaczeniu tekstu.
              </p>
              <Button
                variant="outline"
                className="min-h-11 w-full gap-3 rounded-lg px-4 py-3 text-sm whitespace-normal sm:w-auto"
                onClick={() => {
                  approvedText.current?.focus()
                  approvedText.current?.select()
                }}
              >
                Zaznacz tekst
              </Button>
            </div>
          )}
        </>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (text.trim()) setApproved(true)
          }}
        >
          <label className="mb-2 block text-sm leading-normal font-medium" htmlFor="note-text">
            Treść notatki
          </label>
          <textarea
            id="note-text"
            className="min-h-48 w-full min-w-0 resize-y rounded-lg border border-input bg-background p-3 text-base leading-relaxed placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 sm:p-4 sm:text-sm"
            rows={10}
            value={text}
            onChange={(event) => setText(event.target.value)}
            aria-describedby="note-edit-hint"
          />
          <p
            id="note-edit-hint"
            className="mt-2 mb-6 text-xs leading-relaxed text-muted-foreground"
          >
            AI może popełniać błędy. Sprawdź, czy tekst oddaje to, co chcesz przekazać.
          </p>
          <Button
            type="submit"
            className="min-h-11 w-full gap-3 rounded-lg px-4 py-3 text-sm whitespace-normal sm:w-auto"
            disabled={!text.trim()}
          >
            Zatwierdź treść
          </Button>
        </form>
      )}
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Nikt nie otrzymał tej notatki automatycznie. Samodzielnie decydujesz, czy i komu ją
        przekazać.
      </p>
      <div className="mt-6 border-t pt-5">
        <Button
          variant="outline"
          className="min-h-11 w-full gap-3 rounded-lg px-4 py-3 text-sm whitespace-normal sm:w-auto"
          onClick={onNewSession}
          aria-describedby="new-session-hint"
        >
          Nowa sesja
        </Button>
        <p id="new-session-hint" className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Nowa sesja usunie bieżącą wypowiedź i notatkę z tej karty.
        </p>
      </div>
    </>
  )
}
