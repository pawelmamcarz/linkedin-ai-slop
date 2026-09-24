import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const extensionDir = resolve(root, "extension");
const out = resolve(root, "store/linkedin-ai-slop-firefox.xpi");

const FIREFOX_HOSTS = [
  "*://*.linkedin.com/*",
  "https://www.linkedin.com/*",
  "https://*.linkedin.com/*",
  "https://proxy-production-ebcc.up.railway.app/*",
  "http://127.0.0.1/*",
  "http://localhost/*",
];

export function firefoxManifest(base) {
  const manifest = structuredClone(base);
  const hosts = new Set([...(manifest.host_permissions || []), ...FIREFOX_HOSTS]);
  manifest.host_permissions = [...hosts];
  manifest.background = {
    scripts: ["ext-api.js", "background.js"],
  };
  for (const entry of manifest.content_scripts || []) {
    const matches = new Set(entry.matches || []);
    if ([...matches].some((match) => match.includes("linkedin.com"))) {
      matches.add("*://*.linkedin.com/*");
      matches.add("https://www.linkedin.com/*");
    }
    entry.matches = [...matches];
  }
  manifest.browser_specific_settings = {
    gecko: {
      id: "linkedin-ai-slop@pawelmamcarz.github.io",
      strict_min_version: "142.0",
      data_collection_permissions: {
        required: ["websiteContent", "personallyIdentifyingInfo"],
      },
    },
  };
  return manifest;
}

function main() {
  const base = JSON.parse(readFileSync(join(extensionDir, "manifest.json"), "utf8"));
  const manifest = firefoxManifest(base);
  const stage = mkdtempSync(join(tmpdir(), "linkedin-ai-slop-firefox-"));
  try {
    cpSync(extensionDir, stage, { recursive: true });
    writeFileSync(join(stage, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    rmSync(out, { force: true });
    execFileSync(
      "zip",
      ["-r", "-X", out, ".", "-x", "*.DS_Store", "-x", "*.map", "-x", ".git/*"],
      { cwd: stage, stdio: "inherit" },
    );
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
  console.log(`Paczka Firefox: ${out}`);
  console.log("XPI to zip. W korzeniu jest manifest z background.scripts i gecko.id.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
