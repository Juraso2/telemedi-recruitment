# Issue tracker: GitHub

Specyfikacje i tickety są zgłoszeniami GitHub Issues w repozytorium
Juraso2/telemedi-recruitment. Operacje wykonuj przez gh CLI.

## Zasady

- Publikacja specyfikacji oznacza utworzenie zgłoszenia.
- Odczyt ticketu obejmuje tytuł, opis, etykiety i komentarze.
- Przed utworzeniem zgłoszenia sprawdź, czy już nie istnieje.
- Treści wielowierszowe przekazuj przez plik i --body-file.
- Stosuj etykiety z docs/agents/triage-labels.md.
- Tickety implementacyjne łącz ze specyfikacją jako podzgłoszenia.
  Jeśli ta funkcja jest niedostępna, używaj listy zadań w zgłoszeniu
  nadrzędnym i odnośnika „Part of #numer” w tickecie.
- Po publikacji zwracaj użytkownikowi adres zgłoszenia.

## Pull requests as a triage surface

PRs as a request surface: no.

## Wayfinding

- Mapa prac jest jednym zgłoszeniem z etykietą wayfinder:map.
- Zawiera notatki, podjęte decyzje i otwarte pytania.
- Tickety są podzgłoszeniami mapy z etykietą wayfinder:<type>,
  gdzie type to research, prototype, grilling albo task.
- Zależności zapisuj jako natywne zależności GitHub Issues.
  Jeśli są niedostępne, używaj „Blocked by: #numer”.
- Wybieraj otwarty, nieprzypisany ticket bez otwartych blokad,
  zgodnie z kolejnością mapy.
- Przed pracą przypisz ticket do wykonawcy.
- Po rozwiązaniu dodaj wynik w komentarzu, zamknij ticket
  i uzupełnij decyzje mapy o krótkie podsumowanie oraz odnośnik.
