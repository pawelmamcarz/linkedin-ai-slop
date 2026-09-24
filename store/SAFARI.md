# Safari

Safari nie ładuje zipa Chrome. W repo jest projekt Xcode: `safari/LinkedInAISlop.xcodeproj`. Opis budowy: [`safari/README.md`](../safari/README.md).

## Status

- Działa jako niepodpisane rozszerzenie deweloperskie na Macu (Safari 16.4+, macOS 13+), po buildzie w Xcode.
- Nie ma paczki App Store, TestFlight ani notaryzacji. Tego ten repozytorium nie wysyła.
- Linux i to CI nie produkują `.app`. Na Macu: `bash scripts/build-safari.sh`.

## Instalacja (PL)

1. Na Macu z Xcode: `bash scripts/build-safari.sh` albo otwórz `safari/LinkedInAISlop.xcodeproj` i Run.
2. Safari → Settings → Advanced → Show features for web developers.
3. Menu Develop → **Allow Unsigned Extensions**.
4. Safari → Settings → Extensions → włącz LinkedIn AI Slop i zezwól na `www.linkedin.com`.
5. Otwórz feed LinkedIn.

## Install (EN)

1. On a Mac with Xcode: `bash scripts/build-safari.sh`, or open `safari/LinkedInAISlop.xcodeproj` and Run.
2. Safari → Settings → Advanced → Show features for web developers.
3. Develop → **Allow Unsigned Extensions**.
4. Safari → Settings → Extensions → enable LinkedIn AI Slop and allow `www.linkedin.com`.
5. Open the LinkedIn feed.

Hosty w manifeście: LinkedIn, `https://proxy-production-ebcc.up.railway.app`, `http://127.0.0.1` i `http://localhost`. Własny inny host włączasz w ustawieniach rozszerzenia Safari.
