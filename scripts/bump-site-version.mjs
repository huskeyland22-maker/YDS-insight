import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const target = path.join(root, "site-version.js");

function pad(value) {
  return String(value).padStart(2, "0");
}

function makeVersionStamp(now) {
  return (
    String(now.getFullYear()) +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    "-" +
    pad(now.getHours()) +
    pad(now.getMinutes())
  );
}

const now = new Date();
const version = makeVersionStamp(now);

if (!fs.existsSync(target)) {
  console.error("site-version.js not found:", target);
  process.exit(1);
}

const original = fs.readFileSync(target, "utf8");
const updated = original.replace(
  /window\.SITE_VERSION\s*=\s*"[^"]*";/,
  `window.SITE_VERSION = "${version}";`
);

if (updated === original) {
  console.error("SITE_VERSION line was not found in site-version.js");
  process.exit(1);
}

fs.writeFileSync(target, updated, "utf8");
console.log("Updated SITE_VERSION to", version);
