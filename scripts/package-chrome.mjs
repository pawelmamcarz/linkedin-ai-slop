import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const extensionDir = resolve(root, "extension");
const manifestPath = resolve(extensionDir, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const version = String(manifest.version || "").trim();

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error(`Zła wersja w manifeście: ${version}`);
}

const description = String(manifest.description || "");
if (description.length === 0 || description.length > 132) {
  throw new Error(`Opis w manifeście ma ${description.length} znaków (limit 132).`);
}

const files = [
  "manifest.json",
  "background.js",
  "ext-api.js",
  "content.js",
  "badge.css",
  "options.html",
  "options.css",
  "options.js",
  "icons/icon16.png",
  "icons/icon32.png",
  "icons/icon48.png",
  "icons/icon128.png",
];

for (const size of ["16", "32", "48", "128"]) {
  const icon = `icons/icon${size}.png`;
  if (manifest.icons?.[size] !== icon) {
    throw new Error(`Brak ikony ${size} w manifest.icons`);
  }
}

const outDir = resolve(root, "store/chrome/dist");
const out = resolve(outDir, `linkedin-ai-slop-chrome-${version}.zip`);
execFileSync("mkdir", ["-p", outDir]);
rmSync(out, { force: true });

const stage = mkdtempSync(join(tmpdir(), "lais-chrome-"));
try {
  execFileSync("mkdir", ["-p", join(stage, "icons")]);
  for (const file of files) {
    execFileSync("cp", [resolve(extensionDir, file), resolve(stage, file)]);
  }
  execFileSync("zip", ["-r", "-X", out, ...files], { cwd: stage, stdio: "inherit" });
} finally {
  rmSync(stage, { recursive: true, force: true });
}

const listing = execFileSync("unzip", ["-Z1", out], { encoding: "utf8" })
  .trim()
  .split("\n")
  .filter(Boolean)
  .sort();
const expected = [...files].sort();
if (listing.join("\n") !== expected.join("\n")) {
  throw new Error(`Zip ma inne pliki niż lista paczki:\n${listing.join("\n")}`);
}
if (listing[0] === "manifest.json" || listing.includes("manifest.json")) {
  const packed = JSON.parse(execFileSync("unzip", ["-p", out, "manifest.json"], { encoding: "utf8" }));
  if (packed.version !== version) {
    throw new Error(`Wersja w zipie (${packed.version}) nie zgadza się z manifestem (${version}).`);
  }
}

console.log(`Paczka Chrome ${version}: ${out}`);
console.log("manifest.json jest w korzeniu zipa.");
