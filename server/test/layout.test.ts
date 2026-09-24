import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("układ repo dla Railway", () => {
  it("server/src widzi jev/ obok server/, nie wewnątrz samego server/", () => {
    const fromServerSrc = resolve(import.meta.dirname, "../src");
    const thresholds = resolve(fromServerSrc, "../../jev/thresholds.ts");
    const questions = resolve(fromServerSrc, "../../jev/questions.ts");
    assert.equal(existsSync(thresholds), true);
    assert.equal(existsSync(questions), true);
    assert.equal(existsSync(resolve(fromServerSrc, "../jev/thresholds.ts")), false);
  });
});
