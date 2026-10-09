# Chrome Web Store Listing — LinkedIn AI Slop

Last updated: 2026-10-09. Last dashboard verification: 2026-10-08, published **0.2.6**, **0.2.7** pending review with automatic publication selected. This checkpoint may have changed; the current native browser connection is unavailable. **0.2.8** is prepared with the requested Lifetime price of **19.99 PLN**, but has not been uploaded or submitted. Update copy is in [the listing](store/chrome/listing.md); price validation is in [the release note](docs/audits/2026-10-09-lifetime-price.md).

## Submission Status

- Publisher: `pawelmamcarz`, account `pawel@mamcarz.com`.
- Item ID: `blekdfdinogdmbpakkgaecdpilanobge`.
- [Developer dashboard](https://chrome.google.com/webstore/devconsole/680b68e2-c71f-45d5-aca9-a787c2420ba8/blekdfdinogdmbpakkgaecdpilanobge/edit/status).
- On 2026-10-08, the refreshed Package tab confirmed **Published — public**, published version **0.2.6**, draft version **0.2.6**, with the upload control enabled. Earlier cached dashboard output still showed the previous review; the refreshed state resolves that discrepancy.
- On 2026-10-08, ZIP **0.2.7** was uploaded. The Package tab confirmed draft **0.2.7** and published **0.2.6**. The new Polish description and 479-character test instructions were saved. The final submission dialog confirmed receipt. After reload, Package showed **Oczekuje na sprawdzenie**, draft **0.2.7** at revision `00003`, and published **0.2.6**.
- [Public listing](https://chromewebstore.google.com/detail/blekdfdinogdmbpakkgaecdpilanobge).
- Permissions and data use are unchanged in 0.2.7. No private account credentials are required for review.

## Store Listing

Name: **LinkedIn AI Slop**. Primary language: **Polish**. Category: **Productivity → Tools** (dashboard: „Narzędzia”).

Short description, from the package:

> Oznacza posty na LinkedIn: Ludzki, Mieszany albo AI slop. Ocena Jev. Klucz API zostaje na proxy.

Detailed description for the dashboard:

```text
LinkedIn AI Slop oznacza posty na feedzie LinkedIn jako Ludzki, Mieszany albo AI slop, aby pomóc Ci zauważyć szablonowe i ogólnikowe treści.

Posty są oceniane podczas przewijania. Po najechaniu na oznaczenie zobaczysz wynik oceny stylu tekstu. Podgląd pokazuje konkretność treści i niepewność oceny. Mocna, zgodna ocena AI slop dodaje mały baner i lekką zasłonę; słabszy lub sprzeczny wynik pozostawia post odsłonięty. Zmiana czułości przelicza dostępne wyniki bez ponownego wysyłania tekstów. „Pokaż” odsłania treść, „Ukryj” przywraca zasłonę. Przyciski posta pozostają dostępne. Zasłanianie możesz wyłączyć w ustawieniach.

W ustawieniach możesz włączyć lub wyłączyć ocenianie, zmienić próg i minimalną długość tekstu oraz wybrać tryb Demo, własne proxy (BYOK) albo Pro. Demo jest bezpłatne i ma limity ocen. Płatny Pro jest opcjonalny. Po limicie minutowym ocenianie wznawia się automatycznie.

Domyślnie samodzielny tekst krótszy niż 100 znaków po usunięciu hashtagów, wzmianek, linków i emoji jest pomijany. Komentarze pod postami nie są oceniane. Przy udostępnieniu oceniany jest własny komentarz autora o długości co najmniej 200 znaków, bez tekstu cytowanego posta. Posty zalogowanej osoby są pomijane, jeśli uda się rozpoznać jej profil. Zapisany wcześniej własny próg długości pozostaje bez zmian.

Ocena dotyczy stylu tekstu, może być błędna i nie stanowi dowodu, że post został napisany przez AI.

Do oceny tekst widocznego posta (do 6000 znaków), identyfikator posta i opcjonalnie imię autora są wysyłane na skonfigurowany serwer, a tekst i imię dalej do TypeSafe. Ustawienia i opcjonalny token Pro są zapisywane w pamięci rozszerzenia. Klucz TypeSafe pozostaje na serwerze.

Rozszerzenie nie czyta skrzynki, nie publikuje postów i nie sprzedaje danych.

Rozszerzenie jest niezależnym projektem, niepowiązanym z LinkedIn.

Kod: https://github.com/pawelmamcarz/linkedin-ai-slop
Polityka: https://pawelmamcarz.github.io/linkedin-ai-slop/privacy.html
```

Single purpose:

> Oznaczanie postów na feedzie LinkedIn według oceny stylu ich tekstu jako Ludzki, Mieszany albo AI slop oraz opcjonalne zasłanianie postów oznaczonych jako AI slop.

## Graphics & Package

| Asset | Dimensions | Local file | Status |
| --- | --- | --- | --- |
| Store icon | 128×128 | `extension/icons/icon128.png` | Available |
| Badges screenshot | 1280×800 | `store/chrome/assets/01-badges-1280x800.png` | Available |
| Cover screenshot | 1280×800 | `store/chrome/assets/02-banner-1280x800.png` | Replaced in submitted 0.2.6 listing |
| Hover screenshot | 1280×800 | `store/chrome/assets/03-hover-1280x800.png` | Available |
| Options screenshot | 1280×800 | `store/chrome/assets/04-options-1280x800.png` | Replaced in submitted 0.2.6 listing |
| Small promo tile | 440×280 | `store/chrome/assets/tile-440x280.png` | Available |
| Marquee | 1400×560 | `store/chrome/assets/marquee-1400x560.png` | Available |

Submitted package: `store/chrome/dist/linkedin-ai-slop-chrome-0.2.7.zip`, 13 files, 39,064 bytes. SHA-256: `fd30dcf2597c29449cbd81cba87debbb4eaeb6bd570cad502c04c132ba03ec90`. Every packaged file matches `extension/`. No server, credentials, dependencies or tests are included.

## Permissions Justification

| Permission | Type | Dashboard justification |
| --- | --- | --- |
| `storage` | permissions | Zapamiętywanie włącznika, progu oceny, minimalnej długości tekstu, opcji zasłaniania, trybu Demo/BYOK/Pro, adresu własnego proxy i opcjonalnego tokenu Pro. Ustawienia używają storage.sync, a przy jego niedostępności storage.local. Klucz TypeSafe nie jest zapisany w rozszerzeniu. |
| `https://www.linkedin.com/*` | host_permissions | Odczyt tekstu widocznych kart postów na LinkedIn i wyświetlanie oznaczeń oraz banera Pokaż/Ukryj. Rozszerzenie nie czyta skrzynki i nie publikuje postów. |
| `https://proxy-production-ebcc.up.railway.app/*` | host_permissions | Przesyłanie tekstu posta do domyślnego serwera oceny w trybie Demo/Pro, sprawdzanie połączenia i dostępności ofert Pro. Klucz TypeSafe pozostaje na serwerze. |
| `http://127.0.0.1/*`, `http://localhost/*` | host_permissions | Połączenie z własnym lokalnym serwerem oceny oraz działanie lokalnego podglądu feedu /demo na porcie 8787. |
| `https://*.up.railway.app/*`, `https://*/*`, `http://*/*` | optional_host_permissions | Opcjonalny tryb BYOK pozwala użyć własnego serwera oceny. Te uprawnienia nie są przyznawane podczas instalacji: przy zapisie własnego adresu rozszerzenie prosi wyłącznie o dostęp do wskazanego przez użytkownika originu. |

Remote code: **No**. JavaScript is bundled in the ZIP; the remote server returns classification data, which is not executed as code.

## Privacy & Data Use

The extension transmits data; do not declare “no data collected.”

| Dashboard data category | Declaration | Actual handling |
| --- | --- | --- |
| Personally identifiable information | Yes | Optional author name; purchase/customer information is handled by the proxy and Stripe as described in the policy. |
| Location | Yes | The proxy reads IP addresses for minute/day rate limits. No GPS or precise geolocation is requested. |
| Financial information | Yes | Optional Pro purchase and subscription information is processed by the proxy and Stripe; payment card details stay in Stripe Checkout. |
| Authentication information | Yes | Optional Pro token stored in extension storage and sent to the proxy for Pro requests. No LinkedIn credentials are read. |
| Website content | Yes | Visible post text and post ID are sent to the selected proxy; text and optional name go to TypeSafe for classification. |
| Health, personal communications, web history, user activity | No dedicated collection | No inbox, browsing history, or activity telemetry is collected. Post content may incidentally contain sensitive information; it is processed as website content. |

Settings and optional Pro token use `storage.sync` when available; synchronized data may leave the device through browser sync. The proxy caches text hashes and judgments for 12 hours by default, without raw post text. No ads, data sales, or unrelated data uses are present in the inspected code.

Data-use certifications: not sold; not used outside the extension's single purpose; not used for creditworthiness or lending.

Privacy policy: https://pawelmamcarz.github.io/linkedin-ai-slop/privacy.html
English: https://pawelmamcarz.github.io/linkedin-ai-slop/en/privacy.html

Both URLs returned HTTP 200 on 2026-10-07 and include Stripe, storage, and contact sections.

## Distribution & Developer Info

Verified visibility: Public. Regions: all regions. Payment declaration: contains in-app purchases (optional Pro); Demo remains free. Automatic publication after approval was selected.

Publisher display name: `pawelmamcarz` (verified in dashboard).
Contact: `pawel@mamcarz.com`.
Homepage: https://sciema.app/linkedin-ai-slop/
Support: https://github.com/pawelmamcarz/linkedin-ai-slop/issues

## Test Instructions

```text
No extension account, API key or purchase required. Demo is default. Popup: Sprawdź proxy. With your LinkedIn test account, open linkedin.com/feed and scroll posts with 100+ characters (reshares: 200+ own characters). Hover/focus badges for substance and uncertainty. Strong consistent slop: light cover, Pokaż/Ukryj; reactions work. Uncertain results stay uncovered. Options: change sensitivity without new requests; disable covering. Popup/settings work without LinkedIn login.
```

Saved instructions use 479 of the dashboard's 500-character limit. Login/password fields are empty. The extension's automatic demo injection is registered for localhost:8787, not the hosted fixture; the LinkedIn feed is the integration test path.

## Version History & Review Notes

| Version | Date | Changes | Verified status |
| --- | --- | --- | --- |
| 0.2.8 | 2026-10-09 | Lifetime Pro price in options: 19.99 PLN. | Prepared; not uploaded or submitted; native pipe unavailable |
| 0.2.7 | 2026-10-08 | Shared sensitivity rules, uncertainty and substance hints, conservative cover, preserved paragraphs, observer and queue fixes. | Submitted; pending review verified 2026-10-08; automatic publication after approval |
| 0.2.5 | 2026-10-07 | Existing package submitted with listing, graphics, privacy, distribution, and reviewer instructions. | Published publicly, verified 2026-10-08 |
| 0.2.6 | 2026-10-08 | Short standalone posts, asynchronous expansion, text-aware cache, automatic minute-limit retry, light cover and smaller banner. | Published publicly, confirmed in refreshed Package tab 2026-10-08 |

0.2.6 package: `store/chrome/dist/linkedin-ai-slop-chrome-0.2.6.zip`, 12 files, 37,428 bytes. SHA-256: `6be4786505935a8a492b8af595aab4cafd19cbeca5ff15d1a8dd4b191df18725`. Every packaged file matches `extension/`. Screenshots were regenerated and checked for dimensions and RGB format. Permissions and data use remain as declared above.

Historical 0.2.6 validation: tests passed 62/62 and typecheck passed. Isolated Chrome checks the actual content script with a fixture classification response: short post, flow banner, light cover, reaction click, stable overlay, and Pokaż/Ukryj. Live Demo previously reported 60/min and 500/day; the listing does not claim a fixed daily limit. Detector accuracy on user-labelled LinkedIn posts has not been measured. Existing saved text-length settings are preserved.

Reviewer instructions saved for 0.2.6:

```text
No extension account, API key or purchase required. Demo is default. Popup: Sprawdź proxy. With your LinkedIn test account, open https://www.linkedin.com/feed/ and scroll posts with 100+ characters (reshares need 200+ own characters). Hover badges. Strong consistent AI slop: light cover, Pokaż/Ukryj. Uncertain results stay uncovered. Options: adjust sensitivity; cached results update without requests. Popup/settings/connection work without LinkedIn login. Source: https://github.com/pawelmamcarz/linkedin-ai-slop
```

Historical submission evidence for 0.2.6: revision `00002` was submitted with automatic publication selected. The refreshed Package tab now confirms publication. See [the 0.2.6 release note](docs/audits/2026-10-07-release-0.2.6.md) for its validation and proxy deployment.

No previous Chrome Web Store rejection was verified. Upload, submission, approval, and publication remain distinct gates; the 0.2.7 state is recorded above after each completed step.

Proxy 0.2.7 is deployed: [PR #27](https://github.com/pawelmamcarz/linkedin-ai-slop/pull/27), commit `02a2a8e73cbd80ca934fd2fca0ffcbab5b0099af`, Railway `78914001-c8c6-42a3-99d5-eeb660e35fd1` SUCCESS. 73/73 tests and typecheck pass; main CI and Pages pass. Live synthetic acceptance confirmed style-v2, selected-choice probability, cover/uncertainty fields and a cache HIT when changing threshold. See the release note for the UI and accuracy limits. Existing store graphics were retained.

Prepared price-update package: `store/chrome/dist/linkedin-ai-slop-chrome-0.2.8.zip`, 13 files, 39,068 bytes, SHA-256 `4ba50d86526874df1e81fefc10d19c7b81a49dfa0108f026e0fe0d22bb1679d3`. All files match extension/. Permissions and data use are unchanged. Native computer-use startup failed before access to the Store dashboard; no review was cancelled and no upload was attempted.

Lifetime price update deployed on 2026-10-09: [PR #29](https://github.com/pawelmamcarz/linkedin-ai-slop/pull/29), commit `3720de8c16edac948aff3abe5d66aa6e9c3d8702`, Railway `e8f2635e-db1b-4c07-a1c3-087a25ef2301` SUCCESS. Production offers reports 19.99 PLN, public PL/EN pages show the new price, and anonymous Checkout returns HTTP 302 to Stripe. 75/75 tests and typecheck pass; main CI/Pages pass. Native access still fails after the user offered to enable it; 0.2.8 remains prepared, not uploaded or submitted.
