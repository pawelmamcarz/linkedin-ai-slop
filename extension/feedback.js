const form = document.querySelector("#feedback");
const badge = document.querySelector("#badge");
const reason = document.querySelector("#reason");
const excerpt = document.querySelector("#excerpt");
const status = document.querySelector("#status");
const button = form.querySelector("button");
const initial = new URLSearchParams(location.search).get("badge");
if (["concrete", "low_information", "uncertain"].includes(initial)) badge.value = initial;
const submissionId = crypto.randomUUID();
let draft = null;
let submission = null;
let pending = false;
let saved = false;
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (pending || saved || !reason.value.trim()) return;
  if (draft && (draft.badge !== badge.value || draft.reason !== reason.value || draft.excerpt !== excerpt.value)) {
    status.textContent = "Treść została zmieniona po pierwszej próbie. Nie wysłano zmian. Przywróć pierwotną treść, aby ponowić zgłoszenie, lub otwórz nowy formularz dla nowego zgłoszenia. Wpisany tekst pozostaje tutaj.";
    return;
  }
  if (!submission) {
    draft = Object.freeze({ badge: badge.value, reason: reason.value, excerpt: excerpt.value });
    submission = Object.freeze({ submissionId, assessment: "content-v1", badge: draft.badge, reason: draft.reason.trim(), ...(draft.excerpt ? { excerpt: draft.excerpt } : {}) });
    badge.disabled = true;
    reason.readOnly = true;
    excerpt.readOnly = true;
  }
  pending = true;
  button.disabled = true;
  status.textContent = "Wysyłanie…";
  try {
    const response = await ExtApi.sendMessage({ type: "feedback", payload: submission });
    if (response?.status === 409) throw new Error("Ten identyfikator zgłoszenia jest już przypisany do innej treści. Nie zapisano tego formularza. Zachowaj wpisany tekst i otwórz nowy formularz dla nowego zgłoszenia.");
    if (!response?.ok || response.body?.saved !== true) throw new Error(response?.status === 401 ? "Zgłoszenia wymagają tokenu Pro lub pilotażu. Sprawdź ustawienia rozszerzenia." : "Nie udało się zapisać. Spróbuj ponownie — wpisana treść pozostaje w formularzu.");
    saved = true;
    status.textContent = "Zapisano zgłoszenie. Dziękujemy.";
  } catch (error) {
    status.textContent = (error.message || "Nie udało się potwierdzić zapisu.") + " Formularz jest zablokowany po pierwszej próbie. Ponowienie wysyła tę samą treść; nowe zgłoszenie wymaga nowego formularza.";
  }
  finally { pending = false; button.disabled = saved; }
});
