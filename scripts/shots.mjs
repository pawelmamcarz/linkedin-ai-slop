import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(root, "store/screenshots/src");
const outDir = resolve(root, "store/screenshots");

const jobs = [
  ["01-overview.html", "01-overview.png", 1280, 800],
  ["02-feed.html", "02-feed.png", 1280, 800],
  ["03-options.html", "03-options.png", 1280, 800],
  ["og.html", resolve(root, "docs/og.png"), 1200, 630],
  ["tile.html", "tile-440x280.png", 440, 280],
];

function pngInfo(path) {
  const buf = readFileSync(path);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), color: buf[25] };
}

mkdirSync(outDir, { recursive: true });

for (const [html, dest, width, height] of jobs) {
  const target = dest.startsWith("/") ? dest : resolve(outDir, dest);
  const shot = `/tmp/lais-shot-${width}x${height}.png`;
  const profile = `/tmp/lais-chrome-${width}-${height}`;
  try {
    execFileSync(
      "timeout",
      [
        "12",
        "google-chrome",
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--hide-scrollbars",
        "--no-first-run",
        "--disable-background-networking",
        "--force-device-scale-factor=1",
        `--user-data-dir=${profile}`,
        `--window-size=${width},${height}`,
        `--screenshot=${shot}`,
        `file://${resolve(src, html)}`,
      ],
      { stdio: "inherit" },
    );
  } catch (error) {
    if (error.status !== 124) throw error;
  }
  execFileSync(
    "ffmpeg",
    ["-y", "-i", shot, "-vf", `scale=${width}:${height},format=rgb24`, "-frames:v", "1", "-update", "1", target],
    { stdio: "inherit" },
  );
  const info = pngInfo(target);
  if (info.width !== width || info.height !== height || info.color !== 2) {
    throw new Error(`${target} is ${info.width}x${info.height} color ${info.color}`);
  }
  console.log("ok", target, info);
}
