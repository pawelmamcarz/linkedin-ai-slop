# Chrome Web Store Listing — LinkedIn AI Slop

Last updated: 2026-10-08. Published version: 0.2.5; update 0.2.6 is pending review. This document records the last verified submission. Update copy is in [the listing](store/chrome/listing.md), and validation is in [the release note](docs/audits/2026-10-07-release-0.2.6.md).

## Submission Status

- Publisher: `pawelmamcarz`, account `pawel@mamcarz.com`.
- Item ID: `blekdfdinogdmbpakkgaecdpilanobge`.
- [Developer dashboard](https://chrome.google.com/webstore/devconsole/680b68e2-c71f-45d5-aca9-a787c2420ba8/blekdfdinogdmbpakkgaecdpilanobge/edit/status).
- On 2026-10-08, a refreshed dashboard confirmed **0.2.5 Published — public**. The Package tab independently showed published version 0.2.5. [Public listing](https://chromewebstore.google.com/detail/blekdfdinogdmbpakkgaecdpilanobge).
- On 2026-10-08, the prepared ZIP was uploaded and submitted. After refreshing, the Status tab confirmed **Oczekuje na sprawdzenie** and **Wersja robocza oczekuje na sprawdzenie**. The Package tab confirmed **0.2.6 under review / published 0.2.5**, with the submitted CRX at revision `00002`.
- The updated Polish description and 447-character reviewer instructions were saved. Permissions and data use are unchanged; no private account credentials were supplied.
- With explicit action-time consent, the banner and options screenshots were replaced, reordered, and saved. The badges and hover screenshots were retained. Automatic publication after approval was selected. **0.2.6 is submitted, but approval and publication are not yet confirmed.**

## Store Listing

Name: **LinkedIn AI Slop**. Primary language: **Polish**. Category: **Productivity → Tools** (dashboard: „Narzędzia”).

Short description, from the package:

> Oznacza posty na LinkedIn: Ludzki, Mieszany albo AI slop. Ocena Jev. Klucz API zostaje na proxy.

Detailed description for the dashboard:

```text
LinkedIn AI Slop oznacza posty na feedzie LinkedIn jako Ludzki, Mieszany albo AI slop, aby pomóc Ci zauważyć szablonowe i ogólnikowe treści.

Posty są oceniane podczas przewijania. Po najechaniu na oznaczenie zobaczysz wynik oceny stylu tekstu. Post oznaczony jako AI slop otrzymuje mały baner i lekką zasłonę. „Pokaż” odsłania treść, „Ukryj” przywraca zasłonę. Przyciski posta pozostają dostępne. Zasłanianie możesz wyłączyć w ustawieniach.

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

Uploaded package: `store/chrome/dist/linkedin-ai-slop-chrome-0.2.6.zip`, 12 files, 37,428 bytes. SHA-256: `6be4786505935a8a492b8af595aab4cafd19cbeca5ff15d1a8dd4b191df18725`. All packaged files match `extension/`. No server, credentials, dependencies, or tests are included.

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
No extension account, API key or purchase required. Demo is default. Popup: Sprawdź proxy. With your LinkedIn test account, open https://www.linkedin.com/feed/ and scroll posts with 100+ characters (reshares need 200+ own characters). Hover badges. AI slop: light cover, Pokaż/Ukryj; reactions remain usable. Options: disable covering. Popup/settings/connection work without LinkedIn login. Source: https://github.com/pawelmamcarz/linkedin-ai-slop
```

The saved instruction uses 447 of the dashboard's 500-character limit. Login/password fields are empty. The extension's automatic demo injection is registered for localhost:8787, not the hosted fixture; the LinkedIn feed is the integration test path.

## Version History & Review Notes

| Version | Date | Changes | Verified status |
| --- | --- | --- | --- |
| 0.2.5 | 2026-10-07 | Existing package submitted with listing, graphics, privacy, distribution, and reviewer instructions. | Published publicly, verified 2026-10-08 |
| 0.2.6 | 2026-10-08 | Short standalone posts, asynchronous expansion, text-aware cache, automatic minute-limit retry, light cover and smaller banner. | Submitted; pending review verified 2026-10-08; automatic publication after approval |

0.2.6 package: `store/chrome/dist/linkedin-ai-slop-chrome-0.2.6.zip`, 12 files, 37,428 bytes. SHA-256: `6be4786505935a8a492b8af595aab4cafd19cbeca5ff15d1a8dd4b191df18725`. Every packaged file matches `extension/`. Screenshots were regenerated and checked for dimensions and RGB format. Permissions and data use remain as declared above.

Tests pass 62/62 and typecheck passes. Isolated Chrome checks the actual content script with a fixture classification response: short post, flow banner, light cover, reaction click, stable overlay, and Pokaż/Ukryj. Live Demo previously reported 60/min and 500/day; the listing does not claim a fixed daily limit. Detector accuracy on user-labelled LinkedIn posts has not been measured. Existing saved text-length settings are preserved.

Reviewer instructions saved for 0.2.6:

```text
No extension account, API key or purchase required. Demo is default. Popup: Sprawdź proxy. With your LinkedIn test account, open https://www.linkedin.com/feed/ and scroll posts with 100+ characters (reshares need 200+ own characters). Hover badges. AI slop: light cover, Pokaż/Ukryj; reactions remain usable. Options: disable covering. Popup/settings/connection work without LinkedIn login. Source: https://github.com/pawelmamcarz/linkedin-ai-slop
```

The dashboard confirms 0.2.6 is submitted and pending review. Upload, submission, approval, and publication remain distinct gates; do not report approval or publication until verified.

Proxy release is deployed: [PR #23](https://github.com/pawelmamcarz/linkedin-ai-slop/pull/23), commit `a320e4c33c6df157a6eebde1107f8fcf45a9f7d6`, Railway deployment `e7040e16-cf7b-48eb-8a52-61518c027bbf`, exact-commit status success. Production health and one synthetic short-post evaluation returned HTTP 200; the evaluation reported 0.93 / slop. CI passed on both the PR and main.

Store update: the earlier active-window issue was overcome on 2026-10-08 with a user-confirmed native file picker. The package, description, reviewer instructions, and two refreshed screenshots were saved. The final review dialog had automatic publication selected. A refreshed Status tab confirmed pending review, and Package confirmed submitted 0.2.6 at revision `00002`. The public 0.2.5 remains available.

No previous Chrome Web Store rejection was verified. Version 0.2.5 was approved and published; 0.2.6 is pending review. Google recommends contacting [developer support](https://developer.chrome.com/docs/webstore/review-process) after more than three weeks pending review. Avoid cancelling a pending review merely to accelerate it.

Submission note: native computer control follows the active Chrome window. The browser connector was unavailable; switching back through Chrome's window menu allowed completion. No unrelated project fields were changed. The user clarified that the reported rejection concerned another service, not this Chrome submission.
