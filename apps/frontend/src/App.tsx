import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { DemoAccess, useDemoAccess } from '@/components/DemoAccess'
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
  rate_limited:
    'Osiągnięto limit operacji AI w demo. Spróbuj ponownie za godzinę. Twoja wypowiedź została zachowana.',
  invalid_input: 'Sprawdź wypowiedź, adresata i potwierdzenie pełnoletności.',
  configuration:
    'Generowanie wymaga poprawnej konfiguracji OpenAI w backendzie. Poproś osobę uruchamiającą aplikację o sprawdzenie klucza i modelu. Twoja wypowiedź została zachowana.',
}
const generationError =
  'Nie udało się przygotować notatki. Twoja wypowiedź została zachowana. Możesz spróbować ponownie.'

export function App() {
  const access = useDemoAccess()
  const [step, setStep] = useState<Step>('intro')
  const [adultConfirmed, setAdultConfirmed] = useState(false)
  const [recipient, setRecipient] = useState<Recipient | null>(null)
  const [account, setAccount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)
  const submitting = useRef(false)
  useEffect(() => {
    if (!access.expired) heading.current?.focus()
  }, [step, access.expired, access.expiresAt])

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
    if (!access.expiresAt || submitting.current || !adultConfirmed || !recipient || !account.trim())
      return
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
        if (response.status === 401) access.invalidate()
        else setError(errors[code] ?? generationError)
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
    <div className="min-h-svh bg-background">
      <a
        className="sr-only z-10 rounded-lg bg-background p-3 focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
        href="#main"
      >
        Przejdź do treści
      </a>
      <main
        id="main"
        className="mx-auto grid w-full max-w-6xl grid-cols-1 items-start gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8 lg:grid-cols-3 lg:gap-12 lg:px-8 lg:py-12"
      >
        <aside className="min-w-0 px-1 sm:px-0 lg:pt-8" aria-label="O tej przestrzeni">
          <p className="text-xs leading-relaxed font-semibold tracking-widest text-muted-foreground">
            PO ROZMOWIE ZOSTAJĄ SŁOWA
          </p>
          <p className="my-3 max-w-md font-serif text-3xl leading-tight tracking-tight sm:text-4xl lg:my-6 lg:text-5xl">
            To, czego nie udało Ci się <em className="font-normal text-primary">powiedzieć.</em>
          </p>
          <p className="hidden max-w-sm text-sm leading-relaxed text-muted-foreground lg:block">
            Czasem ważne myśli pojawiają się dopiero po konsultacji. Tutaj możesz dać im miejsce.
          </p>
          <div className="my-8 hidden h-px w-12 bg-border lg:block" />
          <p className="hidden text-sm leading-relaxed text-muted-foreground lg:block">
            Nie musisz zaczynać od początku.
            <br />
            Nie musisz mieć gotowych zdań.
          </p>
          <p className="mt-10 hidden rounded-full border px-3 py-1 text-xs tracking-widest text-muted-foreground lg:inline-block">
            WERSJA TEKSTOWA
          </p>
        </aside>

        <section
          className="min-w-0 overflow-hidden rounded-2xl border bg-card shadow-sm lg:col-span-2"
          aria-labelledby="step-heading"
          aria-busy={step === 'loading'}
        >
          <ol
            className="grid list-none grid-cols-2 gap-3 border-b bg-muted/40 p-4 sm:grid-cols-4 sm:gap-4 sm:px-6 sm:py-5"
            aria-label="Etapy przygotowania notatki"
          >
            {['Początek', 'Adresat', 'Wypowiedź', 'Notatka'].map((label, index) => (
              <li
                key={label}
                aria-current={current === index ? 'step' : undefined}
                className={`flex min-w-0 items-center gap-2 text-xs ${index <= current ? 'text-primary' : 'text-muted-foreground'} ${index === current ? 'font-semibold' : ''}`}
              >
                <span
                  className={`grid size-6 shrink-0 place-items-center rounded-full border text-xs ${index <= current ? 'border-primary/40 bg-primary/10' : 'border-border'}`}
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <span>{label}</span>
              </li>
            ))}
          </ol>

          <div className="min-w-0 p-4 sm:p-6 lg:p-8">
            <p className="text-xs leading-relaxed font-semibold tracking-widest text-muted-foreground">
              {step === 'note' ? 'Z TWOJEJ WYPOWIEDZI' : 'MIEJSCE NA TWOJĄ PERSPEKTYWĘ'}
            </p>
            <h1
              className="mt-3 mb-5 font-serif text-2xl leading-tight tracking-tight text-foreground sm:text-3xl"
              id="step-heading"
              ref={heading}
            >
              {titles[step]}
            </h1>

            <DemoAccess access={access} />

            {error && (
              <div
                role="alert"
                className="my-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm leading-relaxed text-destructive"
              >
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
                <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                  Zapisz to, co zostało po konsultacji. AI pomoże uporządkować Twoją wypowiedź w
                  osobistą notatkę dla specjalisty.
                </p>
                <div className="my-6 space-y-4 border-y py-4 text-sm text-muted-foreground">
                  <p className="flex items-baseline gap-3">
                    <span className="shrink-0 text-xs text-primary" aria-hidden="true">
                      01
                    </span>
                    Wybierz, do kogo kierujesz swoje słowa.
                  </p>
                  <p className="flex items-baseline gap-3">
                    <span className="shrink-0 text-xs text-primary" aria-hidden="true">
                      02
                    </span>
                    Napisz i sprawdź swoją wypowiedź.
                  </p>
                  <p className="flex items-baseline gap-3">
                    <span className="shrink-0 text-xs text-primary" aria-hidden="true">
                      03
                    </span>
                    Otrzymaj uporządkowaną notatkę.
                  </p>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  AI porządkuje tekst, nie diagnozuje i nie udziela pomocy w nagłych sytuacjach. Ta
                  aplikacja nie zastępuje kontaktu ze specjalistą.
                </p>
                <label className="mt-6 mb-5 flex cursor-pointer items-center gap-3 text-sm leading-normal">
                  <input
                    type="checkbox"
                    className="size-5 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
                    checked={adultConfirmed}
                    onChange={(event) => setAdultConfirmed(event.target.checked)}
                    required
                  />
                  Mam ukończone 18 lat
                </label>
                <Button
                  className="min-h-11 w-full gap-3 rounded-lg px-4 py-3 text-sm whitespace-normal sm:w-auto"
                  type="submit"
                  disabled={!adultConfirmed}
                >
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
                <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                  Wybierz specjalistę, z którym chcesz podzielić się tym, co zostało
                  niewypowiedziane.
                </p>
                <fieldset className="mb-6 grid min-w-0 gap-3">
                  <legend className="sr-only">Adresat notatki</legend>
                  {recipients.map((option) => (
                    <label
                      className={`flex min-w-0 cursor-pointer items-center gap-3 rounded-lg border p-4 ${recipient === option.value ? 'border-primary/50 bg-primary/5' : 'border-input'}`}
                      key={option.value}
                    >
                      <input
                        type="radio"
                        className="size-5 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
                        name="recipient"
                        value={option.value}
                        checked={recipient === option.value}
                        onChange={() => setRecipient(option.value)}
                        required
                        aria-label={option.label}
                      />
                      <span>
                        <strong className="block text-sm font-medium">{option.label}</strong>
                        <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                          {option.description}
                        </span>
                      </span>
                    </label>
                  ))}
                </fieldset>
                <Button
                  className="min-h-11 w-full gap-3 rounded-lg px-4 py-3 text-sm whitespace-normal sm:w-auto"
                  type="submit"
                  disabled={!recipient}
                >
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
                <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                  Co chcesz dopowiedzieć po konsultacji? Nie musisz porządkować myśli. Wystarczy też
                  kilka słów.
                </p>
                <label className="mb-2 block text-sm leading-normal font-medium" htmlFor="account">
                  Twoja wypowiedź
                </label>
                <textarea
                  className="min-h-48 w-full min-w-0 resize-y rounded-lg border border-input bg-background p-3 text-base leading-relaxed placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 sm:p-4 sm:text-sm"
                  id="account"
                  value={account}
                  onChange={(event) => setAccount(event.target.value)}
                  maxLength={20_000}
                  rows={9}
                  placeholder="Po naszej rozmowie zostało mi coś ważnego do powiedzenia…"
                  aria-describedby="account-hint"
                />
                <p
                  id="account-hint"
                  className="mt-2 mb-6 text-xs leading-relaxed text-muted-foreground"
                >
                  {account.length.toLocaleString('pl-PL')} / 20 000 znaków. Możesz poprawić tekst
                  przed wysłaniem.
                </p>
                <Button
                  className="min-h-11 w-full gap-3 rounded-lg px-4 py-3 text-sm whitespace-normal sm:w-auto"
                  type="submit"
                  disabled={!account.trim()}
                >
                  Zatwierdź wypowiedź <span aria-hidden="true">→</span>
                </Button>
              </form>
            )}

            {step === 'review' && (
              <>
                <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                  To jest materiał dla AI. Po wybraniu „Przygotuj notatkę” wyślemy go do OpenAI, aby
                  uporządkować Twoje słowa.
                </p>
                <p className="mb-3 text-sm text-muted-foreground">
                  Adresat:{' '}
                  <strong>{recipients.find((option) => option.value === recipient)?.label}</strong>
                </p>
                <p className="rounded-lg bg-muted p-4 text-sm leading-relaxed whitespace-pre-wrap wrap-anywhere">
                  {account}
                </p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Button
                    variant="outline"
                    className="min-h-11 w-full gap-3 rounded-lg px-4 py-3 text-sm whitespace-normal sm:w-auto"
                    onClick={() => {
                      setError('')
                      setStep('account')
                    }}
                  >
                    Popraw wypowiedź
                  </Button>
                  <Button
                    className="min-h-11 w-full gap-3 rounded-lg px-4 py-3 text-sm whitespace-normal sm:w-auto"
                    disabled={access.checking || !access.expiresAt}
                    onClick={() => void generate()}
                  >
                    {error ? 'Spróbuj ponownie' : 'Przygotuj notatkę'}{' '}
                    <span aria-hidden="true">→</span>
                  </Button>
                </div>
              </>
            )}

            {step === 'loading' && (
              <output className="block py-6 text-sm leading-relaxed text-muted-foreground">
                <span
                  className="mb-5 block size-6 animate-spin rounded-full border-2 border-border border-t-primary motion-reduce:animate-none"
                  aria-hidden="true"
                />
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

          <footer className="flex items-start gap-2 border-t p-4 text-xs leading-relaxed text-muted-foreground sm:px-6 lg:px-8">
            <span aria-hidden="true">◇</span> Twoja wypowiedź nie jest zapisywana w historii tej
            wersji. Odświeżenie usuwa bieżącą pracę.
          </footer>
        </section>
      </main>
    </div>
  )
}
