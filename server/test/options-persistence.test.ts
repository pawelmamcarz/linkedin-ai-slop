import { it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";

const root = resolve(import.meta.dirname, "../../extension");
type Settings = Record<string, unknown>;

async function openOptions(stored: Settings, backend: string) {
  const dom = new JSDOM(readFileSync(resolve(root, "options.html"), "utf8"), {
    url: "https://extension.example/options.html", runScripts: "outside-only",
  });
  const win = dom.window;
  const read = (keys: null | Settings) => keys === null ? { ...stored }
    : Object.fromEntries(Object.entries(keys).map(([key, fallback]) => [key, key in stored ? stored[key] : fallback]));
  const area = backend === "chrome-callback" ? {
    get(keys: null | Settings, callback: (value: Settings) => void) { callback(read(keys)); },
    set(values: Settings, callback: () => void) { Object.assign(stored, values); callback(); },
  } : {
    get: async (keys: null | Settings) => read(keys),
    set: async (values: Settings) => { Object.assign(stored, values); },
  };
  const api = {
    runtime: { id: "test", sendMessage: async () => ({}) },
    storage: backend === "safari-local" ? {
      sync: { get: async () => { throw new Error("sync unavailable"); }, set: async () => { throw new Error("sync unavailable"); } },
      local: area,
    } : { sync: area },
  };
  Object.assign(win, {
    [backend.startsWith("chrome") ? "chrome" : "browser"]: api,
    fetch: async () => ({ ok: true, json: async () => ({}) }),
  });
  win.eval(readFileSync(resolve(root, "ext-api.js"), "utf8"));
  win.eval(readFileSync(resolve(root, "options.js"), "utf8"));
  await new Promise<void>((resolve) => setImmediate(resolve));
  return dom;
}

for (const backend of ["chrome-promise", "chrome-callback", "firefox-promise", "safari-local"]) {
  for (const consent of [true, false]) {
    it(`${backend} reopens content assessment and preserves dimming consent ${consent} when saving unrelated settings`, async () => {
      const stored: Settings = {
        assessment: "content-v1", qualityDimEnabled: consent, mode: "pro", proToken: "trial_example",
        byokProxyUrl: "https://custom.example", minTextChars: 120,
      };
      let dom = await openOptions(stored, backend);
      try {
        const document = dom.window.document;
        assert.equal((document.querySelector("#assessment") as HTMLSelectElement).value, "content-v1");
        assert.equal((document.querySelector("#quality-dim") as HTMLInputElement).checked, consent);
        assert.equal((document.querySelector("#quality-dim") as HTMLInputElement).disabled, false);
        assert.equal((document.querySelector("#pro-token") as HTMLInputElement).value, "trial_example");
        (document.querySelector("#min-text") as HTMLInputElement).value = "180";
        document.querySelector("#settings")!.dispatchEvent(new dom.window.Event("submit", { cancelable: true }));
        await new Promise<void>((resolve) => setImmediate(resolve));
        assert.match(document.querySelector("#status")!.textContent!, /Zapisano/);
        assert.equal(stored.assessment, "content-v1");
        assert.equal(stored.qualityDimEnabled, consent);
        assert.equal(stored.minTextChars, 180);
        assert.equal(stored.proToken, "trial_example");
        assert.equal(stored.byokProxyUrl, "https://custom.example");
        dom.window.close();
        dom = await openOptions(stored, backend);
        assert.equal((dom.window.document.querySelector("#assessment") as HTMLSelectElement).value, "content-v1");
        assert.equal((dom.window.document.querySelector("#quality-dim") as HTMLInputElement).checked, consent);
        assert.equal((dom.window.document.querySelector("#min-text") as HTMLInputElement).value, "180");
      } finally {
        dom.window.close();
      }
    });
  }
}

it("reopens saved BYOK settings and defaults an existing installation to style assessment without consent", async () => {
  const stored: Settings = { mode: "byok", byokProxyUrl: "http://localhost:8787/" };
  const dom = await openOptions(stored, "chrome-promise");
  try {
    const document = dom.window.document;
    assert.equal((document.querySelector("#proxy") as HTMLInputElement).value, "http://localhost:8787");
    assert.equal((document.querySelector("#assessment") as HTMLSelectElement).value, "style-v2");
    assert.equal((document.querySelector("#quality-dim") as HTMLInputElement).checked, false);
    document.querySelector("#settings")!.dispatchEvent(new dom.window.Event("submit", { cancelable: true }));
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(stored.byokProxyUrl, "http://localhost:8787");
    assert.equal(stored.assessment, "style-v2");
    assert.equal(stored.qualityDimEnabled, false);
  } finally {
    dom.window.close();
  }
});
