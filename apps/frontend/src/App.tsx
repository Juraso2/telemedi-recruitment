import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { NoteReview } from '@/components/NoteReview'

const recipients = [
  {
    value: 'lekarz',
    label: 'Lekarz',
    description: 'Wiadomość do lekarza prowadzącego konsultację.',
  },
  {
    value: 'psychiatra',
    label: 'Psychiatra',
    description: 'To, co zostało po rozmowie z psychiatrą.',
  },
  {
    value: 'psycholog',
    label: 'Psycholog',
    description: 'Myśli, którymi chcesz podzielić się z psychologiem.',
  },
  {
    value: 'psychoterapeuta',
    label: 'Psychoterapeuta',
    description: 'Słowa, do których chcesz wrócić po sesji.',
  },
] as const
type Recipient = (typeof recipients)[number]['value']
type Step = 'intro' | 'recipient' | 'account' | 'review' | 'loading' | 'note'
const titles: Record<Step, string> = {
  intro: 'Nie wszystko udaje się powiedzieć od razu.',
  recipient: 'Do kogo chcesz napisać?',
  account: 'Zacznij od tego, co przychodzi Ci do głowy.',
  review: 'Sprawdź swoją wypowiedź',
  loading: 'Układamy Twoje słowa.',
  note: 'Twoja notatka',
}
const errors: Record<string, string> = {
  out_of_scope:
    'Opisz własne doświadczenia lub to, czego nie udało Ci się przekazać specjaliście. Twój tekst pozostaje do poprawienia.',
  invalid_input: 'Sprawdź wypowiedź, adresata i potwierdzenie pełnoletności.',
  configuration:
    'Generowanie wymaga poprawnej konfiguracji OpenAI w backendzie. Poproś osobę uruchamiającą aplikację o sprawdzenie klucza i modelu. Twoja wypowiedź została zachowana.',
}
const generationError =
  'Nie udało się przygotować notatki. Twoja wypowiedź została zachowana. Możesz spróbować ponownie.'

export function App() {
  const [step, setStep] = useState<Step>('intro')
  const [adultConfirmed, setAdultConfirmed] = useState(false)
  const [recipient, setRecipient] = useState<Recipient | null>(null)
  const [account, setAccount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)
  const submitting = useRef(false)
  useEffect(() => {
    heading.current?.focus()
  }, [step])

  function advance(event: FormEvent, next: Step) {
    event.preventDefault()
    setError('')
    setStep(next)
  }
  function newSession() {
    setAdultConfirmed(false)
    setRecipient(null)
    setAccount('')
    setNote('')
    setError('')
    setStep('intro')
  }
  async function generate() {
    if (submitting.current || !adultConfirmed || !recipient || !account.trim()) return
    submitting.current = true
    setError('')
    setStep('loading')
    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adultConfirmed, recipient, account }),
        signal: AbortSignal.timeout(65_000),
      })
      const result: unknown = await response.json()
      if (!response.ok) {
        const code =
          result &&
          typeof result === 'object' &&
          'code' in result &&
          typeof result.code === 'string'
            ? result.code
            : 'generation_failed'
        setError(errors[code] ?? generationError)
        setStep(code === 'out_of_scope' ? 'account' : 'review')
      } else if (
        result &&
        typeof result === 'object' &&
        'note' in result &&
        typeof result.note === 'string' &&
        result.note.trim()
      ) {
        setNote(result.note)
        setStep('note')
      } else {
        throw new Error('Invalid response')
      }
    } catch {
      setError(generationError)
      setStep('review')
    } finally {
      submitting.current = false
    }
  }
  const current =
    step === 'intro'
      ? 0
      : step === 'recipient'
        ? 1
        : step === 'account' || step === 'review'
          ? 2
          : 3

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Przejdź do treści
      </a>
      <header className="site-header">
        <span className="brand">
          <span className="brand-mark" aria-hidden="true">
            n.
          </span>
          Niewypowiedziane
          <span className="brand-dot" aria-hidden="true">
            .
          </span>
        </span>
        <span className="header-caption">Twoje słowa. W swoim tempie.</span>
      </header>
      <main id="main" className="workspace">
        <aside className="intro-column" aria-label="O tej przestrzeni">
          <p className="eyebrow">PO ROZMOWIE ZOSTAJĄ SŁOWA</p>
          <p className="intro-quote">
            To, czego nie udało Ci się <em>powiedzieć.</em>
          </p>
          <p className="intro-description">
            Czasem ważne myśli pojawiają się dopiero po konsultacji. Tutaj możesz dać im miejsce.
          </p>
          <div className="gentle-rule" />
          <p className="small-note">
            Nie musisz zaczynać od początku.
            <br />
            Nie musisz mieć gotowych zdań.
          </p>
          <p className="edition-label">WERSJA TEKSTOWA</p>
        </aside>
        <section
          className="session-card"
          aria-labelledby="step-heading"
          aria-busy={step === 'loading'}
        >
          <ol className="progress-list" aria-label="Etapy przygotowania notatki">
            {['Początek', 'Adresat', 'Wypowiedź', 'Notatka'].map((label, index) => (
              <li
                key={label}
                aria-current={current === index ? 'step' : undefined}
                className={index <= current ? 'reached' : ''}
              >
                <span className="step-number" aria-hidden="true">
                  {index + 1}
                </span>
                <span>{label}</span>
              </li>
            ))}
          </ol>
          <div className="card-content">
            <p className="eyebrow">
              {step === 'note' ? 'Z TWOJEJ WYPOWIEDZI' : 'MIEJSCE NA TWOJĄ PERSPEKTYWĘ'}
            </p>
            <h1 id="step-heading" ref={heading} tabIndex={-1}>
              {titles[step]}
            </h1>
            {error && (
              <div role="alert" className="error-message">
                {error}
              </div>
            )}
            {step === 'intro' && (
              <form
                onSubmit={(event) => {
                  if (adultConfirmed) advance(event, 'recipient')
                  else event.preventDefault()
                }}
              >
                <p className="body-copy">
                  Zapisz to, co zostało po konsultacji. AI pomoże uporządkować Twoją wypowiedź w
                  osobistą notatkę dla specjalisty.
                </p>
                <div className="expectations">
                  <p>
                    <span aria-hidden="true">01</span>Wybierz, do kogo kierujesz swoje słowa.
                  </p>
                  <p>
                    <span aria-hidden="true">02</span>Napisz i sprawdź swoją wypowiedź.
                  </p>
                  <p>
                    <span aria-hidden="true">03</span>Otrzymaj uporządkowaną notatkę.
                  </p>
                </div>
                <p className="disclaimer">
                  AI porządkuje tekst, nie diagnozuje i nie udziela pomocy w nagłych sytuacjach. Ta
                  aplikacja nie zastępuje kontaktu ze specjalistą.
                </p>
                <label className="adult-check">
                  <input
                    type="checkbox"
                    checked={adultConfirmed}
                    onChange={(event) => setAdultConfirmed(event.target.checked)}
                    required
                  />
                  Mam ukończone 18 lat
                </label>
                <Button className="primary-action" type="submit" disabled={!adultConfirmed}>
                  Zaczynam <span aria-hidden="true">→</span>
                </Button>
              </form>
            )}
            {step === 'recipient' && (
              <form
                onSubmit={(event) => {
                  if (recipient) advance(event, 'account')
                  else event.preventDefault()
                }}
              >
                <p className="body-copy">
                  Wybierz specjalistę, z którym chcesz podzielić się tym, co zostało
                  niewypowiedziane.
                </p>
                <fieldset className="recipient-options">
                  <legend className="sr-only">Adresat notatki</legend>
                  {recipients.map((option) => (
                    <label
                      className={`recipient-option ${recipient === option.value ? 'selected' : ''}`}
                      key={option.value}
                    >
                      <input
                        type="radio"
                        name="recipient"
                        value={option.value}
                        checked={recipient === option.value}
                        onChange={() => setRecipient(option.value)}
                        required
                        aria-label={option.label}
                      />
                      <span>
                        <strong>{option.label}</strong>
                        <span className="option-description">{option.description}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>
                <Button className="primary-action" type="submit" disabled={!recipient}>
                  Wolę napisać <span aria-hidden="true">→</span>
                </Button>
              </form>
            )}
            {step === 'account' && (
              <form
                onSubmit={(event) => {
                  if (account.trim()) advance(event, 'review')
                  else event.preventDefault()
                }}
              >
                <p className="body-copy">
                  Co chcesz dopowiedzieć po konsultacji? Nie musisz porządkować myśli. Wystarczy też
                  kilka słów.
                </p>
                <label className="field-label" htmlFor="account">
                  Twoja wypowiedź
                </label>
                <textarea
                  id="account"
                  value={account}
                  onChange={(event) => setAccount(event.target.value)}
                  maxLength={20_000}
                  rows={9}
                  placeholder="Po naszej rozmowie zostało mi coś ważnego do powiedzenia…"
                  aria-describedby="account-hint"
                />
                <p id="account-hint" className="input-hint">
                  {account.length.toLocaleString('pl-PL')} / 20 000 znaków. Możesz poprawić tekst
                  przed wysłaniem.
                </p>
                <Button className="primary-action" type="submit" disabled={!account.trim()}>
                  Zatwierdź wypowiedź <span aria-hidden="true">→</span>
                </Button>
              </form>
            )}
            {step === 'review' && (
              <>
                <p className="body-copy">
                  To jest materiał dla AI. Po wybraniu „Przygotuj notatkę” wyślemy go do OpenAI, aby
                  uporządkować Twoje słowa.
                </p>
                <p className="recipient-summary">
                  Adresat:{' '}
                  <strong>{recipients.find((option) => option.value === recipient)?.label}</strong>
                </p>
                <p className="source-text">{account}</p>
                <div className="action-row">
                  <Button
                    variant="outline"
                    className="secondary-action"
                    onClick={() => {
                      setError('')
                      setStep('account')
                    }}
                  >
                    Popraw wypowiedź
                  </Button>
                  <Button className="primary-action" onClick={() => void generate()}>
                    {error ? 'Spróbuj ponownie' : 'Przygotuj notatkę'}{' '}
                    <span aria-hidden="true">→</span>
                  </Button>
                </div>
              </>
            )}
            {step === 'loading' && (
              <output className="loading-state">
                <span className="loading-dot" aria-hidden="true" />
                <p>
                  Przygotowujemy osobistą notatkę na podstawie Twojej wypowiedzi. To może potrwać
                  chwilę.
                </p>
              </output>
            )}
            {step === 'note' && (
              <NoteReview note={note} source={account} onNewSession={newSession} />
            )}
          </div>
          <footer className="card-footer">
            <span aria-hidden="true">◇</span> Twoja wypowiedź nie jest zapisywana w historii tej
            wersji. Odświeżenie usuwa bieżącą pracę.
          </footer>
        </section>
      </main>
      <footer className="site-footer">
        <span>Niewypowiedziane</span>
        <span>Mały krok do dalszej rozmowy.</span>
      </footer>
    </div>
  )
}
