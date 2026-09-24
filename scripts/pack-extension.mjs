import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const extensionDir = resolve(root, "extension");
const out = resolve(root, "store/linkedin-ai-slop-extension.zip");

mkdirSync(dirname(out), { recursive: true });
rmSync(out, { force: true });

execFileSync(
  "zip",
  ["-r", "-X", out, ".", "-x", "*.DS_Store", "-x", "*.map", "-x", ".git/*"],
  { cwd: extensionDir, stdio: "inherit" },
);

console.log(`Paczka: ${out}`);
console.log("W zipie manifest.json jest w korzeniu (tak chce Chrome Web Store).");
