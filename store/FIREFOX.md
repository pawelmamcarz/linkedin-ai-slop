# Firefox

Osobny manifest, te same pliki co Chrome (`extension/`). Firefox ignoruje samo `background.service_worker`, więc paczka Firefox ma `background.scripts`: najpierw `ext-api.js`, potem `background.js`. Chromium zostaje przy service workerze. Jednego manifestu nie da się wgrać do obu sklepów bez tej różnicy.

Paczka: `store/linkedin-ai-slop-firefox.xpi` (`npm run pack:firefox`). XPI to zip z `manifest.json` w korzeniu.

Firefox 142 lub nowszy. `strict_min_version` jest 142, bo od tej wersji działa wbudowana zgoda na transmisję danych (`data_collection_permissions`) także w lintach AMO dla pulpitu i Androida. Rozszerzenie wysyła treść posta (`websiteContent`) i opcjonalnie imię z karty (`personallyIdentifyingInfo`) na proxy. To nie jest `none`.

Id: `linkedin-ai-slop@pawelmamcarz.github.io`.

Hosty: `*://*.linkedin.com/*`, `https://www.linkedin.com/*`, `https://proxy-production-ebcc.up.railway.app/*`, `http://127.0.0.1/*`, `http://localhost/*`.

## Instalacja tymczasowa (PL)

1. `npm run pack:firefox`
2. Otwórz `about:debugging#/runtime/this-firefox`
3. **Załaduj dodatek tymczasowy** i wskaż `store/linkedin-ai-slop-firefox.xpi`
4. Wejdź na `https://www.linkedin.com/feed/`

Dodatek tymczasowy znika po restarcie Firefoksa. Trzeba go załadować ponownie.

## Temporary install (EN)

1. `npm run pack:firefox`
2. Open `about:debugging#/runtime/this-firefox`
3. **Load Temporary Add-on** and select `store/linkedin-ai-slop-firefox.xpi`
4. Open `https://www.linkedin.com/feed/`

A temporary add-on is removed when Firefox restarts.

## AMO

Pozycji na addons.mozilla.org nie ma. Recenzja AMO nie została wysłana. Tekst do wklejenia, gdy ktoś założy konto, jest w `store/LISTING.md` (te same opisy co do Chrome). Przed wysłaniem uruchom `npx web-ext lint` na rozpakowanym XPI. Opcjonalne `https://*/*` i `http://*/*` służą własnemu adresowi proxy. Recenzent może o nie zapytać.
