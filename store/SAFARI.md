# Safari

Safari nie ładuje zipa Chrome. W repo jest projekt Xcode: `safari/LinkedInAISlop.xcodeproj`. Opis budowy: [`safari/README.md`](../safari/README.md).

## Status

- Debug działa jako niepodpisane rozszerzenie deweloperskie na Macu (Safari 16.4+, macOS 13+): `bash scripts/build-safari.sh`. Team ID nie jest potrzebny.
- Release to osobna konfiguracja pod Mac App Store. Checklist jest poniżej. Wysyłki do App Store Connect nie ma.
- Linux i to CI nie produkują `.app`.

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

## App Store Connect

To nie jest upload. Debug (`npm run safari:build`) zostaje ad-hoc: `CODE_SIGN_IDENTITY = -`, `CODE_SIGNING_REQUIRED = NO`, puste `DEVELOPMENT_TEAM`. Do sklepu idzie archiwum Release, nie ten build.

Bundle id aplikacji: `com.mamcarz.linkedinaislop`. Rozszerzenie: `com.mamcarz.linkedinaislop.extension`. Wersja: `0.2.3` (`extension/manifest.json` i `safari/Config/Shared.xcconfig`).

`com.pawelmamcarz.linkedin-ai-slop` nie wchodzi na listę Bundle ID w App Store Connect (New App). Register tego App ID na developer.apple.com zwraca "not available". Używaj pary powyżej.

### Register, potem New App

1. Otwórz https://developer.apple.com/account/resources/identifiers/list (Identifiers).
2. Register App ID aplikacji macOS: `com.mamcarz.linkedinaislop`. Platforma: macOS.
3. Register App ID rozszerzenia Safari: `com.mamcarz.linkedinaislop.extension`. Platforma: macOS.
4. Dopiero potem App Store Connect → Apps → New App. Platforma: macOS. Bundle ID: `com.mamcarz.linkedinaislop`. Rekord jest jeden. Rozszerzenie jest osadzone w tej aplikacji. To nie jest osobna appka iOS ani drugi rekord w Connect.

### Register, then New App

1. Open https://developer.apple.com/account/resources/identifiers/list (Identifiers).
2. Register the macOS app App ID: `com.mamcarz.linkedinaislop`. Platform: macOS.
3. Register the Safari Web Extension App ID: `com.mamcarz.linkedinaislop.extension`. Platform: macOS.
4. Then App Store Connect → Apps → New App. Platform: macOS. Bundle ID: `com.mamcarz.linkedinaislop`. One record. The extension is embedded in that app. It is not a separate iOS app and not a second Connect record.

### Checklist (PL)

- [ ] Konto Apple Developer Program i Team ID (10 znaków). Nie commituj Team ID.
- [ ] Na developer.apple.com zrób Register obu App ID: `com.mamcarz.linkedinaislop` i `com.mamcarz.linkedinaislop.extension`.
- [ ] App Store Connect → New App, platforma macOS, Bundle ID `com.mamcarz.linkedinaislop`.
- [ ] W Xcode ustaw Team na targetach LinkedInAISlop i LinkedInAISlop Extension (Signing & Capabilities). Albo lokalny plik `safari/Config/Local.xcconfig` (jest w `.gitignore`) z linią `DEVELOPMENT_TEAM = TWOJE_TEAM_ID`. W repo to pole zostaje puste.
- [ ] Archiwum Release, nie Debug: Xcode → Product → Archive, albo `DEVELOPMENT_TEAM=TWOJE_TEAM_ID npm run safari:archive`.
- [ ] Ikona aplikacji: `safari/LinkedInAISlop/Assets.xcassets` (`AppIcon`, w tym 512pt @2x = 1024×1024). Archiwum Release kompiluje z tego ICNS. Brak tego slotu daje błąd App Store Connect „Missing required icon … 512pt x 512pt @2x”.
- [ ] Zrzuty: `store/screenshots/` (1280×800). Connect może poprosić o inny rozmiar macOS.
- [ ] Privacy Policy URL: https://pawelmamcarz.github.io/linkedin-ai-slop/privacy.html
- [ ] Hardened Runtime jest włączony w Release (`ENABLE_HARDENED_RUNTIME` w `safari/Config/Release.xcconfig`). App Sandbox jest już w entitlements.
- [ ] Notaryzacja: Mac App Store notaryzuje build w trakcie recenzji. Osobne `notarytool` jest dla dystrybucji Developer ID poza sklepem, nie dla tej wysyłki.
- [ ] `ITSAppUsesNonExemptEncryption` w `safari/LinkedInAISlop/Info.plist` jest `false` (sam HTTPS).
- [ ] Przy kolejnej wysyłce podbij `CURRENT_PROJECT_VERSION` w `safari/Config/Shared.xcconfig`.

### Checklist (EN)

- [ ] Apple Developer Program account and a Team ID (10 characters). Do not commit the Team ID.
- [ ] On developer.apple.com, Register both App IDs: `com.mamcarz.linkedinaislop` and `com.mamcarz.linkedinaislop.extension`.
- [ ] App Store Connect → New App, macOS platform, Bundle ID `com.mamcarz.linkedinaislop`.
- [ ] In Xcode, set Team on LinkedInAISlop and LinkedInAISlop Extension (Signing & Capabilities). Or a local `safari/Config/Local.xcconfig` (gitignored) with `DEVELOPMENT_TEAM = YOUR_TEAM_ID`. The committed value stays empty.
- [ ] Release archive, not the Debug ad-hoc build: Xcode → Product → Archive, or `DEVELOPMENT_TEAM=YOUR_TEAM_ID npm run safari:archive`.
- [ ] App icon: `safari/LinkedInAISlop/Assets.xcassets` (`AppIcon`, including 512pt @2x = 1024×1024). A Release archive compiles the ICNS from that set. Without the 1024 slot, App Store Connect reports “Missing required icon … 512pt x 512pt @2x”.
- [ ] Screenshots: `store/screenshots/` (1280×800). Connect may ask for another macOS size.
- [ ] Privacy Policy URL: https://pawelmamcarz.github.io/linkedin-ai-slop/privacy.html
- [ ] Hardened Runtime is on for Release (`ENABLE_HARDENED_RUNTIME` in `safari/Config/Release.xcconfig`). App Sandbox is already in the entitlements.
- [ ] Notarization: the Mac App Store notarizes the build during review. A separate `notarytool` run is for Developer ID distribution outside the store, not for this upload.
- [ ] `ITSAppUsesNonExemptEncryption` in `safari/LinkedInAISlop/Info.plist` is `false` (HTTPS only).
- [ ] On the next upload, bump `CURRENT_PROJECT_VERSION` in `safari/Config/Shared.xcconfig`.

Potem: Xcode → Window → Organizer → Distribute App → App Store Connect. Szczegóły buildu: [`safari/README.md`](../safari/README.md).
