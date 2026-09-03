#!/usr/bin/env node
/**
 * Build gate: every shipped image's extension must match its actual content.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * On 3 September 2026 an audit of public/images found 25 files carrying PNG
 * bytes: four honestly named `.png`, one stray hero `.png` nothing referenced,
 * and twenty wearing a `.webp` extension over a PNG `IHDR` header. Together
 * they were 52.2 MB of a 71 MB tree - nine senior cards, all ten fitness
 * trainers and a youth card, each about 2 MB where the same picture as real
 * WebP is under 200 KB.
 *
 * Nothing looked broken, which is exactly why it survived so long. Browsers
 * and Electron sniff content rather than trusting the extension, so every
 * picture rendered correctly. The only symptom was an installer roughly 48 MB
 * heavier than it needed to be, in a project that had spent real effort taking
 * it from 1,780 MB to 686 MB.
 *
 * This is the caption audit's lesson one level down. There, a filename did not
 * prove who was in the picture. Here, it does not prove what the file even is.
 *
 * ── What it checks ──────────────────────────────────────────────────────────
 * Decodes the header of every image under public/images and fails if the real
 * format disagrees with the extension, or if a file cannot be decoded at all.
 * It does NOT check dimensions or quality - those are visual decisions, not
 * correctness ones.
 *
 * To fix a failure: `node scripts/normalise-image-formats.cjs --write`
 * re-encodes PNG content in place. Renaming a `.png` is left to a human,
 * because it also changes image_url in the database, the seed scripts and
 * scripts/captions.json.
 *
 * Run: node scripts/check-image-formats.cjs [images-dir]
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const IMAGES = process.argv[2] || path.join(ROOT, "artifacts/beach-volleyball/public/images");
const TAG = "[check-image-formats]";

// Magic numbers, so this guard needs no image library and cannot itself rot
// behind a dependency. Each entry: the format, and a test on the first bytes.
const SIGNATURES = [
  { format: "png", test: (b) => b.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")) },
  {
    format: "webp",
    test: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" &&
                 b.subarray(8, 12).toString("latin1") === "WEBP",
  },
  { format: "jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { format: "gif", test: (b) => b.subarray(0, 3).toString("latin1") === "GIF" },
  { format: "avif", test: (b) => b.subarray(4, 8).toString("latin1") === "ftyp" },
];

const EXT_TO_FORMAT = { png: "png", webp: "webp", jpg: "jpeg", jpeg: "jpeg", gif: "gif", avif: "avif" };

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

const fail = [];
let checked = 0;
let bytes = 0;

for (const p of walk(IMAGES)) {
  const ext = path.extname(p).slice(1).toLowerCase();
  const expected = EXT_TO_FORMAT[ext];
  if (!expected) continue;

  checked++;
  const stat = fs.statSync(p);
  bytes += stat.size;
  const rel = path.relative(IMAGES, p);

  const fd = fs.openSync(p, "r");
  const head = Buffer.alloc(16);
  const read = fs.readSync(fd, head, 0, 16, 0);
  fs.closeSync(fd);

  if (read < 12) {
    fail.push(`${rel}: too small to be an image (${read} bytes)`);
    continue;
  }

  const actual = SIGNATURES.find((s) => s.test(head))?.format;
  if (!actual) {
    fail.push(`${rel}: unrecognised image format - not PNG, WebP, JPEG, GIF or AVIF`);
    continue;
  }
  if (actual !== expected) {
    fail.push(
      `${rel}: is ${actual.toUpperCase()} but named .${ext} ` +
        `(${(stat.size / 1024).toFixed(0)}KB). ` +
        `Run \`node scripts/normalise-image-formats.cjs --write\`.`,
    );
  }
}

console.log(`${TAG} ${checked} images under ${path.relative(ROOT, IMAGES) || IMAGES}, ${(bytes / 2 ** 20).toFixed(1)} MB`);

if (fail.length) {
  console.error(`\n${TAG} FAILED - ${fail.length} file(s) whose extension lies about their content:`);
  for (const f of fail) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(`${TAG} OK - every image's extension matches its actual format.`);
