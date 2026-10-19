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
      <h2 className="note-heading" ref={heading} tabIndex={-1}>
        {approved ? 'Zatwierdzona notatka' : 'Sprawdź treść notatki'}
      </h2>
      <p className="body-copy">
        {approved
          ? 'To wersja zatwierdzona przez Ciebie. Możesz ją skopiować i samodzielnie przekazać specjaliście.'
          : 'Porównaj propozycję ze swoją wypowiedzią. Możesz zmienić treść, zanim ją zatwierdzisz.'}
      </p>
      <details className="note-source">
        <summary>Wypowiedź źródłowa</summary>
        <p className="source-text">{source}</p>
      </details>
      {approved ? (
        <>
          <label className="field-label" htmlFor="approved-note">
            Treść zatwierdzonej notatki
          </label>
          <textarea
            id="approved-note"
            ref={approvedText}
            className="note-paper"
            rows={10}
            value={text}
            readOnly
          />
          <div className="action-row">
            <Button
              variant="outline"
              className="secondary-action"
              onClick={() => {
                copyAttempt.current += 1
                setCopyStatus('idle')
                setApproved(false)
              }}
            >
              Wróć do edycji
            </Button>
            <Button
              className="primary-action"
              disabled={copyStatus === 'copying'}
              onClick={() => void copy()}
            >
              Kopiuj
            </Button>
          </div>
          <output className="copy-status">
            {copyStatus === 'copied'
              ? 'Skopiowano notatkę.'
              : copyStatus === 'copying'
                ? 'Kopiowanie…'
                : ''}
          </output>
          {copyStatus === 'failed' && (
            <div className="copy-fallback">
              <p role="alert" className="error-message">
                Nie udało się skopiować notatki. Możesz ponownie wybrać „Kopiuj” albo zaznaczyć
                tekst i skopiować go ręcznie. Na komputerze użyj Ctrl+C lub ⌘C, a na telefonie opcji
                „Kopiuj” po zaznaczeniu tekstu.
              </p>
              <Button
                variant="outline"
                className="secondary-action"
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
          <label className="field-label" htmlFor="note-text">
            Treść notatki
          </label>
          <textarea
            id="note-text"
            rows={10}
            value={text}
            onChange={(event) => setText(event.target.value)}
            aria-describedby="note-edit-hint"
          />
          <p id="note-edit-hint" className="input-hint">
            AI może popełniać błędy. Sprawdź, czy tekst oddaje to, co chcesz przekazać.
          </p>
          <Button type="submit" className="primary-action" disabled={!text.trim()}>
            Zatwierdź treść
          </Button>
        </form>
      )}
      <p className="note-footnote">
        Nikt nie otrzymał tej notatki automatycznie. Samodzielnie decydujesz, czy i komu ją
        przekazać.
      </p>
      <div className="new-session-action">
        <Button
          variant="outline"
          className="secondary-action"
          onClick={onNewSession}
          aria-describedby="new-session-hint"
        >
          Nowa sesja
        </Button>
        <p id="new-session-hint" className="input-hint">
          Nowa sesja usunie bieżącą wypowiedź i notatkę z tej karty.
        </p>
      </div>
    </>
  )
}
