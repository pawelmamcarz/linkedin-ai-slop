# Teksty do publikacji

Produkt jest tylko na LinkedIn. Poniżej teksty gotowe do wklejenia na LinkedIn i do Chrome Web Store. Bez myślników pauz.

## Jedno zdanie

PL: Odznaka Ludzki, Mieszany albo AI slop na karcie posta, gdy scrollujesz feed LinkedIn. Klucz API zostaje na proxy.

EN: A Human, Mixed, or AI slop badge on the LinkedIn post card while you scroll. The API key stays on the proxy.

## Posty LinkedIn

### PL 1

Scrollujesz feed i od razu widzisz, czy post jest ludzki, mieszany, czy to AI slop.

Rozszerzenie LinkedIn AI Slop pyta model Jev (jev-latest). Klucz API nie siedzi w rozszerzeniu. Publiczne proxy to demo z limitem 60 ocen na minutę. Do codziennej pracy stawiasz własne.

Kod i instalacja z GitHuba: https://github.com/pawelmamcarz/linkedin-ai-slop
Strona: https://pawelmamcarz.github.io/linkedin-ai-slop/

### PL 2

Trzy odznaki na feedzie LinkedIn: Ludzki, Mieszany, AI slop.

Tekst widocznego posta idzie na proxy, proxy woła TypeSafe Jev, a kolor liczy kod w repozytorium. Próg domyślny to 0.65. Powtórzony tekst nie pali klucza drugi raz.

https://pawelmamcarz.github.io/linkedin-ai-slop/

### PL 3

Zbudowałem małe rozszerzenie, które oznacza posty na LinkedIn. Nie publikuje, nie czyta skrzynki, nie trzyma klucza API.

Demo jest publiczne i ma limit. Poważne użycie to własne proxy.

https://github.com/pawelmamcarz/linkedin-ai-slop

### EN 1

You scroll the LinkedIn feed and see whether a post is human, mixed, or AI slop.

LinkedIn AI Slop asks the Jev model (jev-latest). The API key is not inside the extension. The public proxy is a demo, 60 scores per minute per IP. For daily use, run your own.

Code: https://github.com/pawelmamcarz/linkedin-ai-slop
Page: https://pawelmamcarz.github.io/linkedin-ai-slop/en/

### EN 2

Three badges on the LinkedIn feed: Ludzki, Mieszany, AI slop (Human, Mixed, AI slop).

The visible post goes to a proxy. The proxy calls TypeSafe Jev. The repository decides the color. Default threshold is 0.65. Repeated text does not spend the key again.

https://pawelmamcarz.github.io/linkedin-ai-slop/en/

### EN 3

A small Chrome extension that badges LinkedIn posts. It does not publish, read your inbox, or store the API key.

The hosted proxy is a limited public demo. Serious use means your own proxy.

https://github.com/pawelmamcarz/linkedin-ai-slop

## Chrome Web Store

Krótki PL (do 132 znaków):

Oznacza posty na LinkedIn: Ludzki, Mieszany albo AI slop. Ocena Jev. Klucz API zostaje na proxy.

Krótki EN (do 132 znaków):

Marks LinkedIn posts Human, Mixed, or AI slop using Jev. The API key stays on the proxy, not in the extension.

Długi opis PL i EN jest w `store/CHECKLIST.md`. Pojedynczy cel: tylko feed LinkedIn.
