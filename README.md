# Telemedi recruitment

Monorepo Vite+ z dwiema aplikacjami:

- `apps/frontend`: React + TypeScript, serwer Vite+ na porcie 5173.
- `apps/backend`: Fastify + TypeScript oraz Mastra z adapterem `@mastra/fastify`, port 3000.

## Uruchomienie

Wystarczy Docker z wtyczką Compose v2 lub nowszą:

```sh
docker compose up -d
```

Compose buduje obrazy obu aplikacji, instaluje zależności wewnątrz obrazu
i uruchamia backend oraz Nginx serwujący frontend. Nie wymaga lokalnego Node.js,
Vite+, instalowania pakietów ani tworzenia `.env`.

Aplikacja jest dostępna na porcie `8080`, w devbox pod `http://100.68.78.7:8080`.
Nginx przekazuje `/api/*` do backendu w sieci Compose. Backend nie publikuje
osobnego portu na hoście. Frontend uruchamia się po poprawnym healthchecku backendu.
Obie usługi mają healthchecki i politykę restartu `unless-stopped`.

`docker compose up -d` uwzględnia też zmiany w kodzie dzięki `pull_policy: build`.
Inny port można ustawić przez `APP_PORT=8081 docker compose up -d`.

```sh
docker compose ps
docker compose logs -f
docker compose down
```

Obrazy budowane są przez Vite+. Backend zawiera Node.js, skompilowany kod
i zależności produkcyjne, a frontend wyłącznie Nginx i wynik buildu Reacta.

## Development bez Dockera

Wymagany Vite+ (`vp`) i Node.js zgodny z `engines` w `package.json`.
`vp` zarządza pnpm oraz wersją Node.js.

```sh
vp install
vp run dev
```

W devbox otwórz adres NetBird wypisany przez frontendowy serwer.
Frontend przekazuje żądania `/api/*` do backendu przez proxy Vite.
Jeśli zmienisz port backendu, dostosuj też proxy w `apps/frontend/vite.config.ts`.

Aplikacje można uruchamiać osobno:

```sh
vp run --filter @telemedi/frontend dev
vp run --filter @telemedi/backend dev
```

Backend opcjonalnie wczytuje `apps/backend/.env`. Przykład znajduje się w `.env.example`.
`GET /api/health` zwraca `{ "status": "ok" }`.
Adapter udostępnia API Mastry pod `/api`, np. `GET /api/agents`.
Instancja w `apps/backend/src/mastra/index.ts` jest pusta i nie wymaga kluczy API.
Agentów, modele i ich klucze należy skonfigurować przy dodawaniu funkcji AI.
Mastra korzysta domyślnie z pamięci procesu. Jeśli dodasz funkcje wymagające
trwałych danych, skonfiguruj adapter storage.

## Komponenty UI

Frontend korzysta z shadcn/ui z komponentami Radix, Tailwind CSS v4 i motywem
Nova. Konfiguracja znajduje się w `apps/frontend/components.json`, komponenty
w `apps/frontend/src/components/ui`, a motyw w `apps/frontend/src/styles.css`.
Alias `@/` wskazuje na `apps/frontend/src`. Strona startowa używa komponentu `Button`.

Kolejne komponenty dodasz przez lokalne CLI:

```sh
vp -C apps/frontend exec shadcn add dialog
```

## Kontrola jakości i build

```sh
vp run check
vp run test
vp run build
# Wszystkie powyższe kroki:
vp run ready
```

Obie aplikacje korzystają ze wspólnej konfiguracji Oxlint i Oxfmt w głównym
`vite.config.ts`, zgodnie z [przewodnikiem Vite+](https://viteplus.dev/guide/monorepo).
Reguły React i środowisko Node są ustawione przez `lint.overrides`.
`vp run fmt` formatuje repozytorium, a `vp run lint` uruchamia sam lint.
Testy integracyjne backendu sprawdzają API Fastify i rejestrację tras Mastry.

Build frontendu trafia do `apps/frontend/dist`, a backendu do `apps/backend/dist`.
Po zbudowaniu backend uruchomisz poleceniem:

```sh
vp run --filter @telemedi/backend start
```

W Docker Compose serwowanie plików frontendu i proxy API zapewnia Nginx.
Proxy Vite działa tylko podczas developmentu bez Dockera.
