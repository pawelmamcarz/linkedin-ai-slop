# Safari Web Extension

Ta sama paczka co Chrome i Brave (`extension/`). Katalog `safari/` to cienki wrapper: aplikacja macOS plus cel Safari Web Extension. Skrypty, popup i ikony nie są kopiowane do gita. Faza buildu `safari/sync-resources.sh` kopiuje `extension/` do bundla i dopisuje `browser_specific_settings.safari` (skrypt `scripts/patch-safari-manifest.py`). Źródłowy `extension/manifest.json` zostaje bez klucza Safari, żeby paczka Chrome Web Store nie miała nieznanego pola.

Dostęp do stron jest w `host_permissions` manifestu:

- `https://www.linkedin.com/*`
- `https://*.linkedin.com/*`
- `https://proxy-production-ebcc.up.railway.app/*`
- `http://127.0.0.1/*`
- `http://localhost/*`

Entitlement `com.apple.security.network.client` jest w `LinkedInAISlop Extension/LinkedInAISlopExtension.entitlements`. Safari i tak czyta listę hostów z manifestu Web Extension, nie z osobnego entitlementu URL.

To nie jest paczka App Store ani TestFlight. Podpis w projekcie jest ad-hoc (`CODE_SIGN_IDENTITY = -`), żeby dało się załadować rozszerzenie bez konta dewelopera Apple. Notaryzacja i App Store to osobny krok na koncie Apple, którego to repo nie wykonuje.

Wymagane: macOS 13+, Safari 16.4+, Xcode. Ta maszyna CI jest Linuxem i nie buduje `.app`.

## Jedna komenda na Macu

```bash
bash scripts/build-safari.sh
```

To woła:

```bash
xcodebuild -project safari/LinkedInAISlop.xcodeproj -scheme LinkedInAISlop -configuration Debug -destination 'platform=macOS' build
```

Można też otworzyć `safari/LinkedInAISlop.xcodeproj` w Xcode i nacisnąć Run.

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
  --bundle-identifier com.pawelmamcarz.linkedin-ai-slop \
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
