# Brave

Brave jest Chromium i ładuje ten sam Manifest V3 co Chrome. Nie ma osobnej paczki Brave. Zip: `store/linkedin-ai-slop-extension.zip` (`npm run pack:extension`), katalog źródłowy: `extension/`.

Pozycji w Chrome Web Store jeszcze nie ma. Gdy się pojawi, Brave umie zainstalować rozszerzenie ze sklepu Chrome. Dziś ścieżka to load unpacked.

## Instalacja (PL)

1. Pobierz repozytorium albo rozpakuj zip.
2. Otwórz `brave://extensions`.
3. Włącz tryb dewelopera.
4. **Załaduj rozpakowane** i wskaż katalog `extension/` (albo katalog z rozpakowanego zipa, ten z `manifest.json` w korzeniu).
5. Wejdź na `https://www.linkedin.com/feed/` i przewiń.

## Install (EN)

1. Clone the repo or unzip `store/linkedin-ai-slop-extension.zip`.
2. Open `brave://extensions`.
3. Turn on developer mode.
4. **Load unpacked** and select `extension/` (or the unzipped folder whose root is `manifest.json`).
5. Open `https://www.linkedin.com/feed/` and scroll.

## Shields

Odznaka woła proxy z service workera rozszerzenia (`background.js`), nie ze strony LinkedIn. Shields na linkedin.com nie przechwytują tego `fetch`. Gdy własny adres proxy nie odpowiada, sprawdź, czy host jest zapisany w opcjach i czy przeglądarka dostała zgodę na ten origin.

Rozszerzenie nie używa API tylko z Chrome (identity, offscreen, side panel). Zestaw to `storage`, `runtime`, `permissions` i `host_permissions`.
