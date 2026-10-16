import { Button } from '@/components/ui/button'

export function App() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-start gap-6 px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Telemedi</h1>
      <p className="text-muted-foreground">Aplikacja jest gotowa do rozbudowy.</p>
      <Button asChild>
        <a href="/api/health">Sprawdź API</a>
      </Button>
    </main>
  )
}
