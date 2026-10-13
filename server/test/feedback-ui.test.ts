import { it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { JSDOM } from "jsdom";
import { tmpdir } from "node:os";
import { saveFeedback } from "../src/feedback.ts";
it("sends only user-entered feedback, preserves input and ID after failure", async () => {
  const root = resolve(import.meta.dirname, "../../extension");
  const dom = new JSDOM(readFileSync(resolve(root, "feedback.html"), "utf8"), { url: "https://example.test/feedback.html?badge=uncertain&text=secret", runScripts: "outside-only" });
  const sent: any[] = [];
  (dom.window as any).ExtApi = { sendMessage: async (msg: unknown) => { sent.push(msg); return sent.length === 1 ? { ok: false, status: 503 } : { ok: true, body: { saved: true } }; } };
  dom.window.eval(readFileSync(resolve(root, "feedback.js"), "utf8"));
  const reason = dom.window.document.querySelector("#reason") as HTMLTextAreaElement;
  const excerpt = dom.window.document.querySelector("#excerpt") as HTMLTextAreaElement;
  const form = dom.window.document.querySelector("form")!;
  assert.equal(sent.length, 0);
  assert.equal(excerpt.value, "");
  reason.value = "<script>my reason</script>";
  form.dispatchEvent(new dom.window.Event("submit", { cancelable: true }));
  form.dispatchEvent(new dom.window.Event("submit", { cancelable: true }));
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(sent.length, 1);
  assert.equal(reason.value, "<script>my reason</script>");
  assert.equal(sent[0].payload.excerpt, undefined);
  form.dispatchEvent(new dom.window.Event("submit", { cancelable: true }));
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(sent[0].payload.submissionId, sent[1].payload.submissionId);
  assert.match(dom.window.document.querySelector("#status")!.textContent!, /Zapisano/);
  dom.window.close();
});

it("locks an uncertain submission, preserves attempted edits, and retries only the original saved payload", async () => {
  const dir = mkdtempSync(join(tmpdir(), "feedback-ui-"));
  const env = { FEEDBACK_FILE: join(dir, "feedback.jsonl"), PRO_TOKENS: "test-secret" };
  const root = resolve(import.meta.dirname, "../../extension");
  const dom = new JSDOM(readFileSync(resolve(root, "feedback.html"), "utf8"), { url: "https://example.test/feedback.html", runScripts: "outside-only" });
  let attempts = 0;
  (dom.window as any).ExtApi = { sendMessage: async (msg: any) => {
    const result = saveFeedback(msg.payload, "test-secret", env);
    if (++attempts === 1) throw new Error("Response timed out");
    return { ok: result.status < 300, status: result.status, body: result.body };
  } };
  dom.window.eval(readFileSync(resolve(root, "feedback.js"), "utf8"));
  const reason = dom.window.document.querySelector("#reason") as HTMLTextAreaElement;
  const excerpt = dom.window.document.querySelector("#excerpt") as HTMLTextAreaElement;
  const badge = dom.window.document.querySelector("#badge") as HTMLSelectElement;
  const form = dom.window.document.querySelector("form")!;
  const status = dom.window.document.querySelector("#status")!;
  const submit = () => form.dispatchEvent(new dom.window.Event("submit", { cancelable: true }));
  try {
    reason.value = "Original reason";
    excerpt.value = "Original excerpt";
    submit(); submit();
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(attempts, 1);
    assert.equal(reason.readOnly, true);
    assert.equal(excerpt.readOnly, true);
    assert.equal(badge.disabled, true);
    assert.match(status.textContent!, /ponow|Ponow/);
    const stored = readFileSync(env.FEEDBACK_FILE, "utf8");
    reason.value = "Edited reason";
    submit();
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(attempts, 1);
    assert.equal(reason.value, "Edited reason");
    assert.doesNotMatch(status.textContent!, /Zapisano/);
    assert.match(status.textContent!, /zmien|Zmien/);
    reason.value = "Original reason";
    submit(); submit();
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(attempts, 2);
    assert.equal(readFileSync(env.FEEDBACK_FILE, "utf8"), stored);
    assert.match(status.textContent!, /Zapisano/);
    assert.equal((form.querySelector("button") as HTMLButtonElement).disabled, true);
    submit();
    assert.equal(attempts, 2);
  } finally { dom.window.close(); rmSync(dir, { recursive: true }); }
});

it("does not show success when the server detects conflicting content", async () => {
  const dir = mkdtempSync(join(tmpdir(), "feedback-ui-conflict-"));
  const env = { FEEDBACK_FILE: join(dir, "feedback.jsonl"), PRO_TOKENS: "test-secret" };
  const id = "00000000-0000-4000-8000-000000000001";
  saveFeedback({ submissionId: id, assessment: "content-v1", badge: "concrete", reason: "Stored reason" }, "test-secret", env);
  const original = readFileSync(env.FEEDBACK_FILE, "utf8");
  const root = resolve(import.meta.dirname, "../../extension");
  const dom = new JSDOM(readFileSync(resolve(root, "feedback.html"), "utf8"), { url: "https://example.test/feedback.html", runScripts: "outside-only" });
  dom.window.crypto.randomUUID = () => id;
  (dom.window as any).ExtApi = { sendMessage: async (msg: any) => {
    const result = saveFeedback(msg.payload, "test-secret", env);
    return { ok: result.status < 300, status: result.status, body: result.body };
  } };
  dom.window.eval(readFileSync(resolve(root, "feedback.js"), "utf8"));
  try {
    const reason = dom.window.document.querySelector("#reason") as HTMLTextAreaElement;
    reason.value = "Different reason";
    dom.window.document.querySelector("form")!.dispatchEvent(new dom.window.Event("submit", { cancelable: true }));
    await new Promise((r) => setTimeout(r, 5));
    const status = dom.window.document.querySelector("#status")!.textContent!;
    assert.doesNotMatch(status, /Zapisano/);
    assert.match(status, /innej treści/);
    assert.equal(reason.value, "Different reason");
    assert.equal(readFileSync(env.FEEDBACK_FILE, "utf8"), original);
  } finally { dom.window.close(); rmSync(dir, { recursive: true }); }
});
