# Niewypowiedziane

To, czego nie udało Ci się powiedzieć.

Ścieżka tekstowa z [ticketu #2](https://github.com/Juraso2/telemedi-recruitment/issues/2),
[ticketu #3](https://github.com/Juraso2/telemedi-recruitment/issues/3)
i [ticketu #4](https://github.com/Juraso2/telemedi-recruitment/issues/4):
wprowadzenie i potwierdzenie pełnoletności → wybór specjalisty → wpisanie wypowiedzi →
sprawdzenie i zatwierdzenie źródła → notatka przygotowana przez OpenAI i Mastrę →
edycja → zatwierdzenie treści → kopiowanie.

Wybór problemu wynika z trudności w przekazaniu pominiętych informacji po konsultacji.
AI porządkuje relację w pierwszej osobie, zachowuje niepewność i sprzeczności,
nie ma dopisywać faktów, diagnoz ani zaleceń. Jest to generowany tekst, który może
zawierać błędy, a nie narzędzie diagnostyczne. Jakość wymaga sprawdzenia na rzeczywistym modelu.

Obecna wersja dostarcza tekstową podstawę procesu. Nagrywanie przez ElevenLabs,
pytanie uzupełniające i historia są osobnymi ticketami. Aplikacja nie wysyła wiadomości specjaliście.

## Dostęp do demo

W `apps/backend/.env` ustaw własny, losowy `DEMO_ACCESS_CODE` o długości 12–256 znaków.
Nie używaj kodu testowego z repozytorium. Pusty lub zbyt krótki kod blokuje uzyskanie
dostępu, a backend nadal udostępnia healthcheck. Kod nie trafia do bundla frontendu.

Formularz kodu odblokowuje operacje AI. Wpisywanie, edycja i kopiowanie już gotowej
notatki pozostają lokalnie dostępne. Błędny kod nie daje dostępu. Wygaśnięcie pokazuje
formularz ponownie i nie resetuje bieżącej wypowiedzi, adresata ani notatki.
Po odnowieniu użytkownik sam ponawia generowanie. Odświeżenie zachowuje dostęp,
ale bieżący tekst nadal znika, ponieważ historia jest osobnym ticketem.
Widoczność przyszłej historii po wygaśnięciu wymaga uzgodnienia przed jej wdrożeniem.

`POST /api/demo-access` przyjmuje `{ "code": "…" }`. Po poprawnym kodzie ustawia
podpisane HMAC-SHA256 ciasteczko `demo_access`, HttpOnly, SameSite=Strict, Path=/api.
Zawiera tylko termin ważności, bez kodu i treści sesji. Backend sprawdza podpis
oraz termin na każdym chronionym żądaniu, niezależnie od stanu przycisków w UI.
Ważność wynosi 24 godziny od wpisania kodu, bez przedłużania przy odświeżeniu
lub wywołaniach API. `GET /api/demo-access` zwraca ten termin albo `null`, bez
wydawania nowego ciasteczka. Odpowiedzi API mają `Cache-Control: no-store`.

Ochrona jest wspólnym hookiem dla wszystkich tras backendu oprócz healthchecku
i wejścia przez kod, obejmuje też ogólne API Mastry. Kolejne operacje dostawców
podlegają tej samej kontroli. Klucz podpisu jest losowany na start procesu,
więc restart lub zmiana kodu z restartem unieważnia wcześniejszy dostęp.
Mechanizm jest przeznaczony dla jednej instancji demo, bez kont i bazy sesji.
Kod i ciasteczko nie są zapisywane w localStorage, sessionStorage ani logach.
Wspólny kod nie izoluje osób używających tej samej przeglądarki i nie szyfruje
lokalnych danych.

Dla publicznego demo używaj HTTPS i `DEMO_COOKIE_SECURE=true`. Bez jawnego ustawienia
Secure jest włączone przy `NODE_ENV=production`. Przykład `.env` ustawia `false`
wyłącznie do lokalnego HTTP, także Docker Compose na adresie NetBird.
Przy `Secure=true` na takim HTTP przeglądarka nie prześle ciasteczka.
Nie są wymagane CORS ani udostępnianie backendu na osobnej domenie: frontend
korzysta z tego samego originu przez proxy.

Limity `@fastify/rate-limit` działają w pamięci procesu według IP połączenia:
5 zgłoszeń kodu na 15 minut, łącznie z poprawnymi, oraz 20 chronionych żądań API
na godzinę, wspólnie dla tras i kolejnych sesji dostępu. Limit obejmuje także
nieudane operacje; automatyczna próba ponowienia u dostawcy należy do tego samego
żądania. `429` zawiera `Retry-After`; UI zachowuje tekst i informuje o oczekiwaniu.
Ponowne wpisanie kodu nie zeruje limitu operacji. Restart zeruje liczniki.
Backend domyślnie nie ufa `X-Forwarded-For`, więc nie da się nim zmienić limitowanego
IP. Za proxy Nginx użytkownicy dzielą limit adresu proxy. To celowo zachowawcze
ograniczenie kosztów małego demo; wdrożenie na wiele instancji wymaga wspólnego
magazynu limitów i konfiguracji zaufanych proxy. Warto też ustawić budżet po stronie
dostawcy, ponieważ limity procesu nie stanowią limitu wydatków konta.

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
`OPENAI_API_KEY` oraz `DEMO_ACCESS_CODE`. Domyślny model to `gpt-4.1-mini`; możesz zmienić `OPENAI_MODEL`
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
brak klucza i brak wrażliwej treści w logach. Dodatkowe testy obejmują
bezpośrednią odmowę dostępu do AI, niepoprawny kod, podpis i prywatność ciasteczka,
stałe 24 godziny, limity prób i operacji oraz odzyskanie dostępu bez utraty wypowiedzi.
Czas jest kontrolowaną granicą testów API i UI; produkcyjne API nie ma endpointu
do zmiany zegara. Wyłącznie serwer testowy ufa syntetycznym IP, aby każdy scenariusz
sprawdzać z rzeczywistymi limitami bez wpływu na pozostałe testy.

Przed pierwszym uruchomieniem testów zainstaluj Chromium: `vp exec playwright install chromium`.
W devbox testy wybierają adres NetBird z interfejsów sieciowych; w innym środowisku
możesz ustawić `E2E_BASE_URL` wskazujący frontend na porcie 5174. Backend testowy
zajmuje port 3100, więc nie zastępuje działającego backendu na porcie 3000.
Jeśli porty są zajęte, użyj np. `E2E_API_PORT=3101 E2E_PORT=5175 vp run test:e2e`.

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
