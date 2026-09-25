# Safari Web Extension

Ta sama paczka co Chrome i Brave (`extension/`). Katalog `safari/` to cienki wrapper: aplikacja macOS plus cel Safari Web Extension. Skrypty, popup i ikony nie są kopiowane do gita. Faza buildu `safari/sync-resources.sh` kopiuje `extension/` do bundla i dopisuje `browser_specific_settings.safari` (skrypt `scripts/patch-safari-manifest.py`). Źródłowy `extension/manifest.json` zostaje bez klucza Safari, żeby paczka Chrome Web Store nie miała nieznanego pola.

Dostęp do stron jest w `host_permissions` manifestu:

- `https://www.linkedin.com/*`
- `https://*.linkedin.com/*`
- `https://proxy-production-ebcc.up.railway.app/*`
- `http://127.0.0.1/*`
- `http://localhost/*`

Entitlement `com.apple.security.network.client` jest w `LinkedInAISlop Extension/LinkedInAISlopExtension.entitlements`. Safari i tak czyta listę hostów z manifestu Web Extension, nie z osobnego entitlementu URL.

Debug jest ad-hoc (`CODE_SIGN_IDENTITY = -`, `CODE_SIGNING_REQUIRED = NO`, puste `DEVELOPMENT_TEAM` na targetach Debug), żeby dało się załadować rozszerzenie bez konta Apple. Release (`safari/Config/Release.xcconfig`) jest pod Mac App Store: Automatic signing, Hardened Runtime, Team ID uzupełniasz sam. Checklist: [`store/SAFARI.md`](../store/SAFARI.md). Wysyłki nie ma.

`MARKETING_VERSION` jest w `safari/Config/Shared.xcconfig` i ma być równy `extension/manifest.json` (teraz 0.2.5). Skrypty build i archive i tak podają wersję z manifestu do `xcodebuild`.

Bundle id aplikacji: `com.mamcarz.linkedinaislop`. Safari Web Extension: `com.mamcarz.linkedinaislop.extension`.

Zanim utworzysz aplikację w App Store Connect:

1. Na https://developer.apple.com/account/resources/identifiers/list zrób Register App ID `com.mamcarz.linkedinaislop` (macOS).
2. Register App ID `com.mamcarz.linkedinaislop.extension` (macOS).
3. Dopiero potem App Store Connect → Apps → New App, platforma macOS, Bundle ID `com.mamcarz.linkedinaislop`.

Pełna checklista: [`store/SAFARI.md`](../store/SAFARI.md).

Wymagane: macOS 13+, Safari 16.4+, Xcode. Ta maszyna CI jest Linuxem i nie buduje `.app`.

## Jedna komenda na Macu

```bash
bash scripts/build-safari.sh
```

To woła:

```bash
xcodebuild -project safari/LinkedInAISlop.xcodeproj -scheme LinkedInAISlop -configuration Debug -destination 'platform=macOS' build
```

Można też otworzyć `safari/LinkedInAISlop.xcodeproj` w Xcode i nacisnąć Run (schemat startuje w Debug).

## Archiwum Release (App Store)

Na Macu, z własnym Team ID (nie commituj go):

```bash
DEVELOPMENT_TEAM=TWOJE_TEAM_ID npm run safari:archive
```

To woła `xcodebuild -configuration Release -destination 'generic/platform=macOS' -archivePath build/LinkedInAISlop.xcarchive archive`. Katalog `build/` jest w `.gitignore`.

W Xcode to samo robi Product → Archive (akcja Archive schematu używa konfiguracji Release). Potem Organizer → Distribute App → App Store Connect.

Team ID możesz też wpisać w Xcode (Signing & Capabilities) albo w `safari/Config/Local.xcconfig` (`DEVELOPMENT_TEAM = TWOJE_TEAM_ID`). `Release.xcconfig` dołącza ten plik tylko gdy istnieje (`#include?`). Nie wpisuj tam cudzego ani fałszywego identyfikatora.

## Ładowanie niepodpisane

1. W Safari: **Develop → Allow Unsigned Extensions** (menu Develop włączasz w Safari → Settings → Advanced).
2. Uruchom aplikację **LinkedIn AI Slop** z Xcode.
3. Safari → Settings → Extensions → włącz **LinkedIn AI Slop**.
4. Zezwól na `www.linkedin.com`.
5. Otwórz [https://www.linkedin.com/feed/](https://www.linkedin.com/feed/).

Własny host proxy spoza manifestu w Safari włączasz na karcie rozszerzenia (per witryna). Localhost i publiczne proxy są już na liście hostów.

## Konwerter Apple (alternatywa)

Gdy wolisz projekt wygenerowany przez Xcode:

```bash
xcrun safari-web-extension-converter extension \
  --project-location safari/converted \
  --app-name "LinkedIn AI Slop" \
  --bundle-identifier com.mamcarz.linkedinaislop \
  --swift \
  --macos-only \
  --copy-resources \
  --no-open \
  --no-prompt \
  --force
```

Katalog `safari/converted` jest lokalny i nie wchodzi do repo. Gotowy projekt w `safari/LinkedInAISlop.xcodeproj` jest tym, który otwierasz na co dzień.

## Co działa bez Maca

Wspólny kod (`extension/ext-api.js`) używa `browser.*`, gdy jest, a w Chromium `chrome.*`. Storage próbuje `sync`, a gdy Safari go odrzuci, schodzi na `local`. Żądanie do proxy idzie z service workera.
