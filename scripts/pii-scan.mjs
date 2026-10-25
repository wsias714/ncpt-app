// Fails on obvious patient/personal identifier patterns in src/ and public/.
// Not a substitute for python3 -m ncpt_books.pii_guard (see README), just a cheap tripwire.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["src", "public", "index.html"];
const SKIP_EXT = /\.(png|jpg|ico|woff2?)$/i;
const RULES = [
  ["email address", /[A-Za-z0-9._%+-]+@(?!example\.(com|org)\b)[A-Za-z0-9-]+\.[A-Za-z]{2,}/],
  ["SSN-like", /\b\d{3}-\d{2}-\d{4}\b/],
  ["phone number", /(?<![\d.])\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}(?![\d.])/],
  ["street address", /\b\d{1,5} [A-Z][a-z]+ (Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln)\b/],
  ["date of birth", /\b(DOB|date of birth)\b/i],
  ["named customer (code must be 1-3 caps)", /\bCustomer [A-Z][a-z]{2,}\b/],
  ["Google secret/key", /GOCSPX-[\w-]+|AIza[\w-]{30,}/],
];

function* files(p) {
  const st = statSync(p, { throwIfNoEntry: false });
  if (!st) return;
  if (st.isDirectory()) { for (const f of readdirSync(p)) yield* files(join(p, f)); }
  else if (!SKIP_EXT.test(p)) yield p;
}

const hits = [];
for (const root of ROOTS) {
  for (const f of files(root)) {
    readFileSync(f, "utf8").split("\n").forEach((line, i) => {
      for (const [name, re] of RULES) if (re.test(line)) hits.push(`${f}:${i + 1}: ${name}`);
    });
  }
}
if (hits.length) {
  console.error("pii-scan FAILED (locations only, content withheld):\n" + hits.join("\n"));
  process.exit(1);
}
console.log("pii-scan: clean");
