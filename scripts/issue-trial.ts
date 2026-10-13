import { openSync, writeFileSync, closeSync, unlinkSync } from "node:fs";
import { issueTrial } from "../server/src/trial-tokens.ts";
const [participantId, output] = process.argv.slice(2);
if (!participantId || !output) throw new Error("Usage: issue-trial.ts PARTICIPANT_ID PRIVATE_OUTPUT_FILE; set TRIAL_TOKEN_FILE");
// Reserve the output before minting; an existing file must never be overwritten.
const fd = openSync(output, "wx", 0o600);
try {
  const result = issueTrial(participantId);
  if (!result.created) {
    closeSync(fd); unlinkSync(output);
    console.log("Participant already has a trial. No token issued or extended.");
  } else {
    writeFileSync(fd, result.token + "\n"); closeSync(fd);
    console.log("Trial created; token saved to private output file.");
  }
} catch (error) { closeSync(fd); throw error; }
