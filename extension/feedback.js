const form = document.querySelector("#feedback");
const badge = document.querySelector("#badge");
const reason = document.querySelector("#reason");
const excerpt = document.querySelector("#excerpt");
const status = document.querySelector("#status");
const button = form.querySelector("button");
const initial = new URLSearchParams(location.search).get("badge");
if (["concrete", "low_information", "uncertain"].includes(initial)) badge.value = initial;
let submissionId = crypto.randomUUID();
let pending = false;
let saved = false;
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (pending || saved || !reason.value.trim()) return;
  pending = true;
  button.disabled = true;
  status.textContent = "Wysyłanie…";
  try {
    const payload = { submissionId, assessment: "content-v1", badge: badge.value, reason: reason.value.trim(), ...(excerpt.value ? { excerpt: excerpt.value } : {}) };
    const response = await ExtApi.sendMessage({ type: "feedback", payload });
    if (!response?.ok || response.body?.saved !== true) throw new Error(response?.status === 401 ? "Zgłoszenia wymagają tokenu Pro lub pilotażu. Sprawdź ustawienia rozszerzenia." : "Nie udało się zapisać. Spróbuj ponownie — wpisana treść pozostaje w formularzu.");
    saved = true;
    status.textContent = "Zapisano zgłoszenie. Dziękujemy.";
  } catch (error) { status.textContent = error.message || "Nie udało się zapisać. Spróbuj ponownie."; }
  finally { pending = false; button.disabled = saved; }
});
