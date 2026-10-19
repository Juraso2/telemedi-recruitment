# Niewypowiedziane

To, czego nie udało Ci się powiedzieć.

Ścieżka tekstowa z [ticketu #2](https://github.com/Juraso2/telemedi-recruitment/issues/2)
i [ticketu #3](https://github.com/Juraso2/telemedi-recruitment/issues/3):
wprowadzenie i potwierdzenie pełnoletności → wybór specjalisty → wpisanie wypowiedzi →
sprawdzenie i zatwierdzenie źródła → notatka przygotowana przez OpenAI i Mastrę →
edycja → zatwierdzenie treści → kopiowanie.

Wybór problemu wynika z trudności w przekazaniu pominiętych informacji po konsultacji.
AI porządkuje relację w pierwszej osobie, zachowuje niepewność i sprzeczności,
nie ma dopisywać faktów, diagnoz ani zaleceń. Jest to generowany tekst, który może
zawierać błędy, a nie narzędzie diagnostyczne. Jakość wymaga sprawdzenia na rzeczywistym modelu.

Obecna wersja dostarcza tekstową podstawę procesu. Nagrywanie przez ElevenLabs,
pytanie uzupełniające, historia oraz kod dostępu
są osobnymi ticketami. Aplikacja nie wysyła wiadomości specjaliście.
Obecnej wersji nie należy udostępniać jako publicznego demo przed wdrożeniem kontroli dostępu.

## Weryfikacja i kopiowanie notatki

Po wygenerowaniu można poprawić notatkę i rozwinąć podgląd zatwierdzonej wypowiedzi
źródłowej. Edycja notatki nie zmienia źródła i nie uruchamia kolejnego wywołania AI.
„Zatwierdź treść” otwiera podgląd, a dopiero w nim jest dostępny przycisk „Kopiuj”.
Powrót do edycji cofa zatwierdzenie i potwierdzenie wcześniejszego kopiowania.
Kopiowany tekst odpowiada dokładnie zatwierdzonej wersji, także podziałom na akapity.

Kopiowanie przez Clipboard API wymaga bezpiecznego kontekstu i uprawnienia przeglądarki.
Pod adresem NetBird z HTTP może być niedostępne. Wtedy notatka pozostaje widoczna,
a aplikacja oferuje ponowienie oraz „Zaznacz tekst” do ręcznego kopiowania przez
Ctrl+C, ⌘C lub opcję kopiowania na telefonie. Nie stosuje przestarzałego execCommand.

Po wygenerowaniu można edytować wyłącznie notatkę, bez zmiany źródła i regenerowania.
„Nowa sesja” czyści bieżącą wypowiedź, notatkę i zatwierdzenie, wracając do wprowadzenia.
W tej wersji nie ma historii ani automatycznego wysyłania wiadomości specjaliście.

## Klucze i dane

Skopiuj `apps/backend/.env.example` do `apps/backend/.env` i ustaw własny
`OPENAI_API_KEY`. Domyślny model to `gpt-4.1-mini`; możesz zmienić `OPENAI_MODEL`
na dostępny na Twoim koncie model obsługujący Chat Completions i Structured Outputs.
Opcjonalne `OPENAI_BASE_URL` służy do konfiguracji adresu dostawcy; nie wpisuj go we frontendzie.

Klucz nie trafia do przeglądarki ani repozytorium. Bez klucza aplikacja się uruchamia,
a próba generowania wyświetla informację o brakującej konfiguracji i zachowuje tekst.
Po zmianie `.env` uruchom backend ponownie; w Dockerze odtwórz usługę.

Wypowiedź jest wysyłana dopiero po wybraniu „Przygotuj notatkę”. Backend wywołuje
prywatnego agenta Mastry bez pamięci konwersacji, eksportowania śladów i bazy sesji.
Klient OpenAI używa `store: false`. To nie oznacza wyłączenia wszystkich zasad retencji
u dostawcy: szczegóły opisują [kontrole danych OpenAI](https://developers.openai.com/api/docs/guides/your-data).
W przeglądarce tekst jest wyłącznie w pamięci karty; odświeżenie go usuwa.

API `POST /api/notes` przyjmuje `adultConfirmed: true`, jednego z czterech adresatów
oraz niepustą wypowiedź do 20 000 znaków. Zwraca notatkę lub bezpieczny komunikat
błędu. Przejściowy błąd dostawcy ma jedną automatyczną próbę ponowienia;
błąd klucza, modelu lub niepoprawne dane nie są automatycznie ponawiane.

Logowanie Pino w Fastify zapisuje identyfikator żądania, stałą nazwę operacji, status,
czas i bezpieczny kod błędu. Nie zapisuje treści, nagłówków, URL-i z zapytaniem,
kluczy ani surowych błędów dostawcy. Logowanie Mastry jest wyłączone.

Integracja wykorzystuje [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
do rozróżnienia osobistej wypowiedzi od zadania spoza zakresu. Sama poprawność schematu
nie dowodzi wierności wygenerowanej notatki.

## Środowisko

Monorepo Vite+ z dwiema aplikacjami:

- `apps/frontend`: React + TypeScript, serwer Vite+ na porcie 5173.
- `apps/backend`: Fastify + TypeScript oraz Mastra z adapterem `@mastra/fastify`, port 3000.

## Uruchomienie

Wystarczy Docker z Compose 2.24 lub nowszym. Generowanie wymaga konfiguracji
`apps/backend/.env` opisanej wyżej:

```sh
docker compose up -d
```

Compose buduje obrazy obu aplikacji, instaluje zależności wewnątrz obrazu
i uruchamia backend oraz Nginx serwujący frontend. Nie wymaga lokalnego Node.js,
Vite+ ani lokalnego instalowania pakietów. Opcjonalny plik środowiska backendu
jest wczytywany przy tworzeniu kontenera, bez kopiowania sekretów do obrazu.

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
Jeśli zmienisz port backendu, ustaw `API_PROXY_TARGET` dla serwera frontendu.

Aplikacje można uruchamiać osobno:

```sh
vp run --filter @telemedi/frontend dev
vp run --filter @telemedi/backend dev
```

Backend opcjonalnie wczytuje `apps/backend/.env`. Przykład znajduje się w `.env.example`.
`GET /api/health` zwraca `{ "status": "ok" }`.
Adapter udostępnia API Mastry pod `/api`, np. `GET /api/agents`.
Publiczna instancja Mastry pozostaje pusta i nie udostępnia agenta notatki przez
ogólne trasy. Notatki są obsługiwane wyłącznie przez walidowaną trasę `/api/notes`.

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

## Testowanie ścieżki tekstowej

```sh
vp run test:e2e
```

Testy przeglądarkowe uruchamiają prawdziwy frontend i backend na osobnych portach
oraz lokalną imitację zewnętrznego OpenAI. Nie mockują trasy `/api/notes` ani Mastry.
Obejmują komputer i telefon, potwierdzenie pełnoletności, wynik, treść poza zakresem
i zachowanie wypowiedzi po błędzie. Sprawdzają również podgląd źródła, edycję,
zatwierdzenie, dokładną treść przekazaną do schowka, ręczne zaznaczenie po błędzie,
ponowienie kopiowania, ignorowanie opóźnionego wyniku i rozpoczęcie nowej sesji.
Schowek jest kontrolowaną granicą przeglądarki: testy nie odczytują schowka użytkownika.
Testy API sprawdzają walidację, liczbę prób,
brak klucza i brak wrażliwej treści w logach.

Przed pierwszym uruchomieniem testów zainstaluj Chromium: `vp exec playwright install chromium`.
W devbox testy wybierają adres NetBird z interfejsów sieciowych; w innym środowisku
możesz ustawić `E2E_BASE_URL` wskazujący frontend na porcie 5174. Backend testowy
zajmuje port 3100, więc nie zastępuje działającego backendu na porcie 3000.

Imitacja dostawcy potwierdza połączenie warstw i obsługę odpowiedzi, a nie jakość
modelu. Osobne sprawdzenie z rzeczywistym kluczem wykonaj w aplikacji na syntetycznych
wypowiedziach: krótkiej relacji, niepewności, negacji, sprzeczności i prośbie o kod.
Sprawdź, czy wynik zachował odrębne informacje i nie dodał nowych faktów.
Nie utrwalaj prawdziwych danych zdrowotnych w raportach testów.

Build frontendu trafia do `apps/frontend/dist`, a backendu do `apps/backend/dist`.
Po zbudowaniu backend uruchomisz poleceniem:

```sh
vp run --filter @telemedi/backend start
```

W Docker Compose serwowanie plików frontendu i proxy API zapewnia Nginx.
Proxy Vite działa tylko podczas developmentu bez Dockera.
