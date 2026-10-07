import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(root, "store/chrome/shot-src");
const outDir = resolve(root, "store/chrome/assets");
const chromeBinary = process.env.LAIS_CHROME_BINARY || (process.platform === "darwin"
  ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : "google-chrome");

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
  const profile = mkdtempSync(resolve(tmpdir(), "lais-chrome-shots-"));
  const shot = resolve(profile, "screenshot.png");
  try {
    try {
      execFileSync(
        chromeBinary,
        [
          "--headless=new",
          "--disable-gpu",
          "--hide-scrollbars",
          "--no-first-run",
          "--disable-background-networking",
          "--force-device-scale-factor=1",
          `--user-data-dir=${profile}`,
          `--window-size=${width},${height}`,
          `--screenshot=${shot}`,
          `file://${resolve(src, html)}`,
        ],
        { stdio: "ignore", timeout: 20_000 },
      );
    } catch (error) {
      if (error.code !== "ETIMEDOUT" || !existsSync(shot)) throw error;
    }
    execFileSync(
      "ffmpeg",
      ["-y", "-i", shot, "-vf", `scale=${width}:${height},format=rgb24`, "-frames:v", "1", "-update", "1", target],
      { stdio: "ignore" },
    );
  } finally {
    rmSync(profile, { recursive: true, force: true });
  }
  const info = pngInfo(target);
  if (info.width !== width || info.height !== height || info.color !== 2) {
    throw new Error(`${target} is ${info.width}x${info.height} color ${info.color}`);
  }
  console.log("ok", target, info);
}
