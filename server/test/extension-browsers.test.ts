import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { firefoxManifest } from "../../scripts/pack-firefox.mjs";

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, "../..");

type ExtApi = {
  hasRuntime: () => boolean;
  storageGet: (defaults: Record<string, unknown>) => Promise<Record<string, unknown>>;
  storageSet: (values: Record<string, unknown>) => Promise<void>;
  manifestGrants: (origin: string) => boolean;
  permissionsContains: (origin: string) => Promise<boolean>;
  permissionsRequest: (origin: string) => Promise<boolean>;
  sendMessage: (message: unknown) => Promise<unknown>;
  resolveSettings: (stored: Record<string, unknown>) => {
    mode: string;
    proxyUrl: string;
    proToken: string;
    byokProxyUrl: string;
    blurSlop: boolean;
  };
};

function loadApi(): ExtApi {
  delete (globalThis as { ExtApi?: unknown }).ExtApi;
  delete require.cache[require.resolve("../../extension/ext-api.js")];
  return require("../../extension/ext-api.js") as ExtApi;
}

describe("manifest hostów", () => {
  const manifest = JSON.parse(readFileSync(resolve(root, "extension/manifest.json"), "utf8")) as {
    host_permissions: string[];
    optional_host_permissions: string[];
    background: { service_worker: string };
    content_scripts: { js: string[] }[];
    browser_specific_settings?: unknown;
  };

  it("obejmuje LinkedIn, publiczne proxy i localhost", () => {
    for (const host of [
      "https://www.linkedin.com/*",
      "https://proxy-production-ebcc.up.railway.app/*",
      "http://127.0.0.1/*",
      "http://localhost/*",
    ]) {
      assert.ok(manifest.host_permissions.includes(host), host);
    }
    assert.equal(manifest.host_permissions.includes("https://*.linkedin.com/*"), false);
  });

  it("nie powtarza localhost w optional_host_permissions", () => {
    assert.deepEqual(manifest.optional_host_permissions, [
      "https://*.up.railway.app/*",
      "https://*/*",
      "http://*/*",
    ]);
    for (const host of ["http://127.0.0.1/*", "http://localhost/*"]) {
      assert.equal(manifest.optional_host_permissions.includes(host), false, host);
    }
  });

  it("nie ma klucza Safari w manifeście Chromium", () => {
    assert.equal(manifest.browser_specific_settings, undefined);
    assert.equal(manifest.background.service_worker, "background.js");
    assert.deepEqual(manifest.content_scripts[0].js, ["ext-api.js", "content.js"]);
  });
});

describe("ExtApi", () => {
  afterEach(() => {
    delete (globalThis as { chrome?: unknown }).chrome;
    delete (globalThis as { browser?: unknown }).browser;
    delete (globalThis as { ExtApi?: unknown }).ExtApi;
  });

  it("czyta storage.sync przez callback chrome", async () => {
    (globalThis as { chrome?: unknown }).chrome = {
      runtime: { id: "chromium" },
      storage: {
        sync: {
          get(defaults: Record<string, unknown>, cb: (v: unknown) => void) {
            cb({ ...defaults, enabled: false });
          },
        },
      },
    };
    const api = loadApi();
    const stored = await api.storageGet({ enabled: true, threshold: 0.65 });
    assert.equal(stored.enabled, false);
    assert.equal(api.hasRuntime(), true);
  });

  it("gdy browser.storage.sync rzuca, schodzi na local", async () => {
    (globalThis as { browser?: unknown }).browser = {
      runtime: {
        id: "safari",
        sendMessage: () => Promise.resolve({ ok: true }),
      },
      storage: {
        sync: {
          get() {
            return Promise.reject(new Error("sync unavailable"));
          },
        },
        local: {
          get(defaults: Record<string, unknown>) {
            return Promise.resolve({ ...defaults, proxyUrl: "http://127.0.0.1:8787" });
          },
        },
      },
    };
    const api = loadApi();
    const stored = await api.storageGet({ proxyUrl: "https://proxy-production-ebcc.up.railway.app" });
    assert.equal(stored.proxyUrl, "http://127.0.0.1:8787");
    const response = (await api.sendMessage({ type: "health" })) as { ok: boolean };
    assert.equal(response.ok, true);
  });

  it("uznaje hosty z manifestu i pyta o obcy origin", async () => {
    let requested: string[] = [];
    (globalThis as { chrome?: unknown }).chrome = {
      runtime: { id: "chromium" },
      permissions: {
        contains() {
          return Promise.resolve(false);
        },
        request(opts: { origins: string[] }) {
          requested = opts.origins;
          return Promise.resolve(true);
        },
      },
    };
    const api = loadApi();
    assert.equal(api.manifestGrants("https://proxy-production-ebcc.up.railway.app/"), true);
    assert.equal(api.manifestGrants("http://localhost:8787/"), true);
    assert.equal(api.manifestGrants("https://www.linkedin.com/"), true);
    assert.equal(api.manifestGrants("https://evil.example/"), false);
    assert.equal(await api.permissionsContains("https://proxy-production-ebcc.up.railway.app/"), true);
    assert.equal(await api.permissionsRequest("https://evil.example/"), true);
    assert.deepEqual(requested, ["https://evil.example/"]);
  });
});

describe("manifest Firefox", () => {
  const base = JSON.parse(readFileSync(resolve(root, "extension/manifest.json"), "utf8"));
  const firefox = firefoxManifest(base);

  it("zostawia Chromium przy service workerze i daje Firefoxowi background.scripts", () => {
    assert.equal(base.background.service_worker, "background.js");
    assert.equal(base.browser_specific_settings, undefined);
    assert.deepEqual(firefox.background.scripts, ["ext-api.js", "background.js"]);
    assert.equal(firefox.background.service_worker, undefined);
    assert.equal(firefox.browser_specific_settings.gecko.id, "linkedin-ai-slop@pawelmamcarz.github.io");
    assert.equal(firefox.browser_specific_settings.gecko.strict_min_version, "142.0");
    assert.deepEqual(firefox.browser_specific_settings.gecko.data_collection_permissions.required, [
      "websiteContent",
      "personallyIdentifyingInfo",
    ]);
  });

  it("obejmuje LinkedIn, proxy i localhost", () => {
    for (const host of [
      "*://*.linkedin.com/*",
      "https://proxy-production-ebcc.up.railway.app/*",
      "http://127.0.0.1/*",
      "http://localhost/*",
    ]) {
      assert.ok(firefox.host_permissions.includes(host), host);
    }
    const linkedIn = firefox.content_scripts.find((entry: { matches: string[] }) =>
      entry.matches.some((match) => match.includes("linkedin.com")),
    );
    assert.ok(linkedIn.matches.includes("*://*.linkedin.com/*"));
  });
});

describe("tryby proxy", () => {
  it("rozróżnia demo, BYOK i Pro bez wysyłania klucza TypeSafe", () => {
    const api = loadApi();
    const demo = api.resolveSettings({ proxyUrl: "https://proxy-production-ebcc.up.railway.app" });
    assert.equal(demo.mode, "demo");
    assert.equal(demo.proToken, "");
    const byok = api.resolveSettings({ proxyUrl: "http://127.0.0.1:8787" });
    assert.equal(byok.mode, "byok");
    assert.equal(byok.proxyUrl, "http://127.0.0.1:8787");
    const pro = api.resolveSettings({
      mode: "pro",
      proToken: " pro_secret ",
      byokProxyUrl: "http://127.0.0.1:8787",
    });
    assert.equal(pro.mode, "pro");
    assert.equal(pro.proxyUrl, "https://proxy-production-ebcc.up.railway.app");
    assert.equal(pro.proToken, "pro_secret");
    assert.equal(JSON.stringify(pro).includes("TYPESAFE"), false);
    assert.equal(api.resolveSettings({}).blurSlop, true);
    assert.equal(api.resolveSettings({ blurSlop: false }).blurSlop, false);
    assert.equal(api.resolveSettings({}).minTextChars, 200);
    assert.equal(api.resolveSettings({ minTextChars: 80 }).minTextChars, 80);
    assert.equal(api.resolveSettings({ minTextChars: 1 }).minTextChars, 40);
  });
});

describe("patch manifestu Safari", () => {
  it("dopisuje browser_specific_settings i nie kasuje hostów", () => {
    const dir = mkdtempSync(join(tmpdir(), "safari-manifest-"));
    const path = join(dir, "manifest.json");
    writeFileSync(path, readFileSync(resolve(root, "extension/manifest.json")));
    execFileSync("python3", [resolve(root, "scripts/patch-safari-manifest.py"), path], { stdio: "pipe" });
    const patched = JSON.parse(readFileSync(path, "utf8")) as {
      browser_specific_settings: { safari: { strict_min_version: string } };
      host_permissions: string[];
    };
    assert.equal(patched.browser_specific_settings.safari.strict_min_version, "16.4");
    assert.ok(patched.host_permissions.includes("https://proxy-production-ebcc.up.railway.app/*"));
    const source = JSON.parse(readFileSync(resolve(root, "extension/manifest.json"), "utf8")) as {
      browser_specific_settings?: unknown;
    };
    assert.equal(source.browser_specific_settings, undefined);
    rmSync(dir, { recursive: true, force: true });
  });
});
