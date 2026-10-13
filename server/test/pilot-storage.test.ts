import { it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";

const root = resolve(import.meta.dirname, "../../extension");
const hostedProxy = "https://proxy-production-ebcc.up.railway.app";
type Settings = Record<string, unknown>;
type Message = { type: string; payload?: Settings; proxyUrl?: string; proToken?: string };
type Reply = { ok: boolean; status: number };

function loadBackground(stored: Settings) {
  let listener!: (message: Message, sender: { url?: string }) => Promise<Reply>;
  const requests: { url: string; init: RequestInit }[] = [];
  const context = {
    console, URL, Promise, AbortSignal,
    fetch: async (url: string, init: RequestInit) => {
      requests.push({ url, init });
      return new Response(JSON.stringify({ saved: true }), { status: 200 });
    },
    chrome: {
      runtime: {
        id: "test", getURL: (path: string) => "chrome-extension://test/" + path,
        sendMessage() {},
        onMessage: { addListener: (fn: typeof listener) => { listener = fn; } },
      },
      storage: { sync: {
        // Chrome get({}) selects no keys; get(null) reads all saved keys.
        get: async (keys: null | Settings) => keys === null ? { ...stored }
          : Object.fromEntries(Object.entries(keys).map(([key, fallback]) => [key, key in stored ? stored[key] : fallback])),
      } },
    },
    ExtApi: undefined as unknown as { storageGet: (defaults: Settings) => Promise<Settings> },
  };
  runInNewContext(readFileSync(resolve(root, "ext-api.js"), "utf8"), context);
  runInNewContext(readFileSync(resolve(root, "background.js"), "utf8"), context);
  return { api: context.ExtApi, requests, message: (message: Message) => listener(message, { url: "chrome-extension://test/feedback.html" }) };
}

it("loads saved assessment and token using Chrome storage key semantics", async () => {
  const { api } = loadBackground({ mode: "pro", proToken: "trial_example", assessment: "content-v1", qualityDimEnabled: true });
  const read = await api.storageGet({ enabled: true });
  assert.equal(read.assessment, "content-v1");
  assert.equal(read.qualityDimEnabled, true);
  assert.equal(read.enabled, true);
});

for (const token of ["trial_example", "pro_example"]) {
  it(`sends the saved ${token.split("_")[0]} token in evaluation and feedback HTTP headers`, async () => {
    const { message, requests } = loadBackground({ mode: "pro", proToken: ` ${token} ` });
    assert.equal((await message({ type: "evaluate", payload: { postId: "p", text: "Specific information", assessment: "content-v1" } })).ok, true);
    assert.equal((await message({ type: "feedback", payload: { badge: "concrete" } })).ok, true);
    assert.deepEqual(requests.map(({ url }) => url), [`${hostedProxy}/evaluate`, `${hostedProxy}/feedback`]);
    for (const request of requests) {
      assert.equal(new Headers(request.init.headers).get("X-Pro-Token"), token);
      assert.equal(new Headers(request.init.headers).get("Content-Type"), "application/json");
    }
    assert.equal(JSON.parse(String(requests[0].init.body)).assessment, "content-v1");
  });
}

it("uses the saved custom proxy for evaluation and health without leaking an inactive Pro token", async () => {
  const { message, requests } = loadBackground({ mode: "byok", byokProxyUrl: "https://custom.example/", proToken: "pro_inactive" });
  await message({ type: "evaluate", payload: { postId: "p", text: "Specific information" } });
  await message({ type: "health" });
  assert.deepEqual(requests.map(({ url }) => url), ["https://custom.example/evaluate", "https://custom.example/health"]);
  for (const request of requests) assert.equal(new Headers(request.init.headers).has("X-Pro-Token"), false);
  assert.equal((await message({ type: "feedback", payload: {} })).status, 403);
  assert.equal(requests.length, 2);
});

it("retains the legacy custom proxy and explicit health overrides", async () => {
  const { message, requests } = loadBackground({ proxyUrl: "http://127.0.0.1:8787/" });
  await message({ type: "feedback", payload: {} });
  await message({ type: "health", proxyUrl: "http://localhost:9999/", proToken: " trial_override " });
  assert.equal(requests[0].url, "http://127.0.0.1:8787/feedback");
  assert.equal(requests[1].url, "http://localhost:9999/health");
  assert.equal(new Headers(requests[1].init.headers).get("X-Pro-Token"), "trial_override");
});
