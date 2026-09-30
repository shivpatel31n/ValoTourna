// One-time fix: replace every hardcoded "http://localhost:5000/api/..." string
// literal with a template literal that falls back to localhost in dev but
// reads VITE_API_URL in production.
//
// Usage: node fix-api-base.mjs   (run from inside my-app/)

import fs from "fs";
import path from "path";

const ROOT = path.join(process.cwd(), "src");

// Matches: "http://localhost:5000/api/something"  (double-quoted, no interpolation)
const PATTERN = /"http:\/\/localhost:5000(\/api\/[a-zA-Z]*)"/g;
const REPLACEMENT = '`${import.meta.env.VITE_API_URL || "http://localhost:5000"}$1`';

let filesChanged = 0;
let replacementsMade = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.isFile() && (entry.name.endsWith(".jsx") || entry.name.endsWith(".js"))) {
      const original = fs.readFileSync(full, "utf8");
      const matches = original.match(PATTERN);
      if (matches) {
        const updated = original.replace(PATTERN, REPLACEMENT);
        fs.writeFileSync(full, updated, "utf8");
        filesChanged++;
        replacementsMade += matches.length;
        console.log(`Fixed ${matches.length} line(s) in ${path.relative(process.cwd(), full)}`);
      }
    }
  }
}

walk(ROOT);
console.log(`\nDone. ${replacementsMade} replacement(s) across ${filesChanged} file(s).`);
