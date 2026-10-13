import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { evaluateContentWithMeta } from "../server/src/evaluate.ts";
type Row = { id: string; expected: string; badge: string; policyVersion: string; rubricVersion: string };
const badges = ["concrete", "low_information", "uncertain"];
export function scorePilot(rows: Row[]) {
  if (!Array.isArray(rows) || rows.length !== 50 || new Set(rows.map((r) => r.id)).size !== 50 || rows.some((r) => !r.id || !badges.includes(r.expected) || !badges.includes(r.badge) || r.policyVersion !== "content-v1" || r.rubricVersion !== "content-v1")) throw new Error("Require 50 unique, complete content-v1 results");
  const valuable = rows.filter((r) => r.expected === "concrete");
  const low = rows.filter((r) => r.expected === "low_information");
  if (valuable.length < 20 || low.length < 20) throw new Error("Require at least 20 valuable and 20 low-information examples");
  const valuableFalsePositives = valuable.filter((r) => r.badge === "low_information").length;
  const lowInformationRecall = low.filter((r) => r.badge === "low_information").length / low.length;
  const matrix = Object.fromEntries(badges.map((expected) => [expected, Object.fromEntries(badges.map((badge) => [badge, rows.filter((r) => r.expected === expected && r.badge === badge).length]))]));
  return { passed: valuableFalsePositives <= 1 && lowInformationRecall >= 0.5, valuableFalsePositives, lowInformationRecall, matrix, count: rows.length, policyVersion: "content-v1", rubricVersion: "content-v1" };
}
async function main() {
  const [mode, input, output] = process.argv.slice(2);
  if (!["--offline", "--live"].includes(mode) || !input || !output) throw new Error("Usage: check-content-pilot.ts --offline|--live INPUT.json OUTPUT.json");
  const raw = readFileSync(input, "utf8");
  const source = JSON.parse(raw);
  let rows: Row[] = source;
  if (mode === "--live") {
    scorePilot(source.map((r: Row) => ({ ...r, badge: "uncertain", policyVersion: "content-v1", rubricVersion: "content-v1" })));
    if (source.some((r: { text?: unknown }) => typeof r.text !== "string" || !r.text.trim())) throw new Error("Every example needs text");
    rows = [];
    for (const r of source) {
      const { result } = await evaluateContentWithMeta({ postId: r.id, text: r.text });
      rows.push({ id: r.id, expected: r.expected, badge: result.badge, policyVersion: result.policyVersion, rubricVersion: "content-v1" });
    }
  }
  const report = { ...scorePilot(rows), inputHash: createHash("sha256").update(raw).digest("hex"), results: rows.map(({ id, expected, badge, policyVersion, rubricVersion }) => ({ id, expected, badge, policyVersion, rubricVersion })) };
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { mode: 0o600, flag: "wx" });
  console.log(JSON.stringify({ passed: report.passed, count: report.count }));
  if (!report.passed) process.exitCode = 1;
}
if (process.argv[1] && basename(process.argv[1]) === "check-content-pilot.ts") main().catch(() => { console.error("Pilot check failed; validate input, output path and API configuration."); process.exitCode = 1; });
