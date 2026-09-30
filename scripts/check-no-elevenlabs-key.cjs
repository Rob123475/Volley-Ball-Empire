#!/usr/bin/env node
// Overnight brief 30 Sep, item 21: Rob's ElevenLabs API key must never reach
// the repo, the game, a build, a log, the status file or GitHub. Run before
// every push (installed as .git/hooks/pre-push in the game and Unity repos):
// it reads the key from Rob's own file at run time and fails the push if the
// key appears in any file git tracks or would add, or in any commit about to
// be pushed. The key itself is never printed.
//
// Usage: node scripts/check-no-elevenlabs-key.cjs [repoDir]
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const KEY_FILE = path.join(os.homedir(), "Downloads", "11labs api.txt");
const repo = path.resolve(process.argv[2] || process.cwd());

if (!fs.existsSync(KEY_FILE)) {
  console.log("[key-check] no key file on this machine: nothing to look for");
  process.exit(0);
}
const key = fs.readFileSync(KEY_FILE, "utf8").split(/\r?\n/)[0].trim();
if (key.length < 16) { console.log("[key-check] key file has no key: nothing to look for"); process.exit(0); }

const git = (...a) => execFileSync("git", a, { cwd: repo, maxBuffer: 1 << 30 });
const found = [];

// 1. Every file git tracks or would add (not ignored), up to 60 MB each.
const files = git("ls-files", "-co", "--exclude-standard", "-z").toString("utf8").split("\0").filter(Boolean);
const needle = Buffer.from(key, "utf8");
for (const f of files) {
  const p = path.join(repo, f);
  let st; try { st = fs.statSync(p); } catch { continue; }
  if (!st.isFile() || st.size > 60 * 1024 * 1024) continue;
  if (fs.readFileSync(p).indexOf(needle) >= 0) found.push(f);
}

// 2. Every commit not yet on the remote.
let range = "";
try { range = git("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}").toString().trim(); } catch { /* no upstream */ }
if (range) {
  const log = git("log", "-p", "--no-ext-diff", `${range}..HEAD`);
  if (log.indexOf(needle) >= 0) found.push(`commits ${range}..HEAD`);
}

if (found.length) {
  console.error(`[key-check] THE ELEVENLABS KEY IS IN: ${found.join(", ")}. Push refused.`);
  process.exit(1);
}
console.log(`[key-check] ElevenLabs key not found in ${files.length} files${range ? ` or the unpushed commits` : ""} of ${path.basename(repo)}`);
