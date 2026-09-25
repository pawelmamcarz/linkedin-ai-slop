import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(root, "store/chrome/shot-src");
const outDir = resolve(root, "store/chrome/assets");

const jobs = [
  ["01-badges.html", "01-badges-1280x800.png", 1280, 800],
  ["02-banner.html", "02-banner-1280x800.png", 1280, 800],
  ["03-hover.html", "03-hover-1280x800.png", 1280, 800],
  ["04-options.html", "04-options-1280x800.png", 1280, 800],
  ["tile.html", "tile-440x280.png", 440, 280],
  ["marquee.html", "marquee-1400x560.png", 1400, 560],
];

function pngInfo(path) {
  const buf = readFileSync(path);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), color: buf[25] };
}

mkdirSync(outDir, { recursive: true });

for (const [html, dest, width, height] of jobs) {
  const target = resolve(outDir, dest);
  const shot = `/tmp/lais-chrome-shot-${width}x${height}.png`;
  const profile = `/tmp/lais-chrome-profile-${width}-${height}`;
  try {
    execFileSync(
      "timeout",
      [
        "20",
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
