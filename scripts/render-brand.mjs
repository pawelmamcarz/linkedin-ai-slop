import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const svg = resolve(root, "docs/brand/mark.svg");

function png(input, out, scale) {
  const vf = scale ? `scale=${scale}:${scale}:flags=lanczos,format=rgb24` : "format=rgb24";
  execFileSync("ffmpeg", ["-y", "-i", input, "-vf", vf, "-frames:v", "1", "-update", "1", out], {
    stdio: "inherit",
  });
}

const master = resolve(root, "docs/brand/mark-512.png");
png(svg, master, null);
png(master, resolve(root, "extension/icons/icon128.png"), "128");
png(master, resolve(root, "extension/icons/icon48.png"), "48");
png(master, resolve(root, "extension/icons/icon16.png"), "16");
png(master, resolve(root, "docs/favicon.png"), "32");
png(master, resolve(root, "docs/brand/mark.png"), "88");
console.log("Ikony zapisane.");
