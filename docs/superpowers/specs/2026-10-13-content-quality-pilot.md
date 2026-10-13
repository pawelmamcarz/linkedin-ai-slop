# Ocena treści — zatwierdzona specyfikacja pilotażu

Status: zakres produktowy zatwierdzony przez właściciela w rozmowie 2026-10-13. Nie jest to opis wdrożonego produktu. Plan techniczny został następnie zatwierdzony do lokalnej implementacji.

## Odbiorca i wartość

Regularny czytelnik LinkedIna chce szybciej znajdować wartościowe posty. Obietnica: „Pomaga odsiać powtarzalne i mało treściwe posty”. Nazwa LinkedIn AI Slop pozostaje na czas testu.

Oceniana jest treść, nie autorstwo. Brak konkretów w połączeniu z powtarzalnym przekazem, pustymi deklaracjami lub wymuszaniem reakcji uzasadnia ocenę negatywną. Same oznaki AI, długość, emoji, poprawny język lub popularny temat nie obniżają oceny. Krótka użyteczna informacja może być wartościowa.

## Zachowanie

- Odznaki: „Konkretny”, „Mało treściwy”, „Niepewna ocena”.
- Krótkie uzasadnienie i możliwość zgłoszenia pomyłki.
- Domyślnie tylko dyskretne oznaczenie. Przyciemnianie opcjonalne, wyłączone domyślnie.
- Przy niepewności post pozostaje widoczny. Priorytetem jest ochrona wartościowych postów przed błędną oceną negatywną.
- Personalizacja i automatyczne ukrywanie poza zakresem pierwszego testu.

## Bramka jakości przed testem

Właściciel ocenia 50 zróżnicowanych przykładów: minimum 20 wartościowych i 20 mało treściwych. Zestaw obejmuje krótkie informacje, reklamy, historie osobiste i treści techniczne.

Warunki dopuszczenia:

1. Najwyżej jeden wartościowy post oznaczony jako „Mało treściwy”.
2. Rozpoznana przynajmniej połowa postów mało treściwych.

Ocena użytkownika jest punktem odniesienia, nie obiektywnym dowodem jakości ani autorstwa.

## Test użyteczności i zakupu

- Właściciel zaprasza osobiście 10–15 osób.
- Uczestnik otrzymuje pełny dostęp na 14 dni.
- Po teście dobrowolny zakup Lifetime Pro za 19,99 zł; bez automatycznego obciążenia.
- Cel: minimum 10 rozpoczynających, minimum 6 deklarujących korzystanie przez co najmniej 3 dni w drugim tygodniu i minimum 3 rzeczywiste zakupy po teście.
- Pomiar: ankieta po każdym tygodniu, dobrowolne przykłady pomyłek, potwierdzone zakupy. Brak nowej automatycznej telemetrii.
- Formularz pomyłki: wybrana ocena, powód niezgody, opcjonalnie świadomie wklejony fragment posta. Bez automatycznego dołączania tekstu.

## Granice wykonania

Po zatwierdzeniu specyfikacji właściciel zatwierdził plan i lokalną implementację, następnie przekazał pozostałe poprawki na farmę tmux. Publikacja pakietów, produkcja, zaproszenia i wysyłanie wiadomości wymagają osobnego zlecenia. Zatwierdzone decyzje techniczne są opisane w planie.
