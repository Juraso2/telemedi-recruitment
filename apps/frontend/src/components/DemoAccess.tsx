import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'

function readExpiry(result: unknown): number | null {
  if (
    result &&
    typeof result === 'object' &&
    'expiresAt' in result &&
    typeof result.expiresAt === 'number' &&
    Number.isFinite(result.expiresAt) &&
    result.expiresAt > Date.now()
  )
    return result.expiresAt
  return null
}

export function useDemoAccess() {
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [checking, setChecking] = useState(true)
  const [expired, setExpired] = useState(false)
  const [checkError, setCheckError] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/demo-access', {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Access check failed')
        const result: unknown = await response.json()
        if (!controller.signal.aborted) setExpiresAt(readExpiry(result))
      })
      .catch(() => {
        if (!controller.signal.aborted) setCheckError(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setChecking(false)
      })
    return () => controller.abort()
  }, [])
  useEffect(() => {
    if (!expiresAt) return
    const check = () => {
      if (expiresAt <= Date.now()) {
        setExpiresAt(null)
        setExpired(true)
      }
    }
    const timeout = window.setTimeout(check, Math.max(0, expiresAt - Date.now()))
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', check)
    return () => {
      window.clearTimeout(timeout)
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', check)
    }
  }, [expiresAt])
  return {
    expiresAt,
    checking,
    expired,
    checkError,
    grant(expiry: number) {
      setExpiresAt(expiry)
      setExpired(false)
      setCheckError(false)
    },
    invalidate() {
      setExpiresAt(null)
      setExpired(true)
    },
  }
}

type Access = ReturnType<typeof useDemoAccess>
export function DemoAccess({ access }: { access: Access }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (access.expired) input.current?.focus()
  }, [access.expired])
  async function unlock(event: FormEvent) {
    event.preventDefault()
    if (busy || !code) return
    setBusy(true)
    setError('')
    const attempted = code
    setCode('')
    try {
      const response = await fetch('/api/demo-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: attempted }),
        signal: AbortSignal.timeout(15_000),
      })
      const result: unknown = await response.json()
      const expiry = readExpiry(result)
      if (response.ok && expiry) access.grant(expiry)
      else if (response.status === 401) setError('Niepoprawny kod dostępu. Spróbuj ponownie.')
      else if (response.status === 429)
        setError('Osiągnięto limit prób kodu. Odczekaj do 15 minut i spróbuj ponownie.')
      else if (response.status === 503)
        setError(
          'Dostęp do demo nie jest poprawnie skonfigurowany. Osoba uruchamiająca aplikację powinna ustawić kod o długości 12–256 znaków i ponownie uruchomić backend.',
        )
      else throw new Error('Access failed')
    } catch {
      setError(
        'Nie udało się uzyskać dostępu. Sprawdź połączenie i spróbuj ponownie. Twoja wypowiedź pozostaje w aplikacji.',
      )
    } finally {
      setBusy(false)
    }
  }
  if (access.checking)
    return (
      <p className="mt-2 mb-6 text-xs leading-relaxed text-muted-foreground">
        Sprawdzamy dostęp do demo…
      </p>
    )
  if (access.expiresAt)
    return (
      <p className="mt-2 mb-6 text-xs leading-relaxed text-muted-foreground">
        Dostęp do demo jest aktywny.
      </p>
    )
  return (
    <form
      className="my-6 min-w-0 rounded-xl border bg-muted/40 p-4"
      onSubmit={(event) => void unlock(event)}
      aria-label="Dostęp do demo"
      aria-busy={busy}
    >
      <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
        {access.expired
          ? 'Dostęp wygasł lub wymaga odnowienia. Wpisz kod ponownie, aby korzystać z AI. Twoja wypowiedź pozostaje w aplikacji.'
          : 'Wpisz wspólny kod, aby korzystać z AI w demo. Dostęp jest ważny do 24 godzin. Możesz wcześniej przygotować wypowiedź.'}
      </p>
      {access.checkError && (
        <p className="mt-2 mb-6 text-xs leading-relaxed text-muted-foreground">
          Nie udało się sprawdzić dostępu. Możesz ponowić próbę, wpisując kod.
        </p>
      )}
      <label className="mb-2 block text-sm leading-normal font-medium" htmlFor="demo-code">
        Kod dostępu do demo
      </label>
      <input
        id="demo-code"
        className="block min-h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
        ref={input}
        type="password"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        autoComplete="off"
        maxLength={256}
        required
        disabled={busy}
        aria-describedby="demo-code-hint"
      />
      <p id="demo-code-hint" className="mt-2 mb-6 text-xs leading-relaxed text-muted-foreground">
        Kod nie tworzy konta i nie szyfruje danych w tej przeglądarce.
      </p>
      {error && (
        <p
          className="my-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm leading-relaxed text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}
      <Button
        type="submit"
        className="min-h-11 w-full gap-3 rounded-lg px-4 py-3 text-sm whitespace-normal sm:w-auto"
        disabled={busy || !code}
      >
        {busy ? 'Sprawdzamy kod…' : 'Odblokuj dostęp'}
      </Button>
    </form>
  )
}
