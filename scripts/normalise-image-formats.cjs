#!/usr/bin/env node
/**
 * Re-encode PNG-content images under public/images as real WebP.
 *
 * ── The problem this fixes ──────────────────────────────────────────────────
 * A `.webp` extension is not evidence that a file is WebP. On 3 September 2026
 * a format audit found 25 files carrying PNG bytes: four honestly named `.png`,
 * and twenty-one wearing a `.webp` extension over a PNG `IHDR` header. Together
 * they were 52.2 MB of the 71 MB images tree - nine senior cards, all ten
 * fitness trainers, a youth card and a stray hero image, every one of them
 * roughly 2 MB where a real WebP of the same picture is under 200 KB.
 *
 * Nothing looked broken, which is why it survived. Browsers and Electron sniff
 * content rather than trusting the extension, so the pictures rendered; they
 * just shipped at eleven times the necessary size, inside an installer the
 * project had spent real effort shrinking.
 *
 * This is the same lesson as the caption audit, one level down: the filename is
 * not evidence. There it was who is in the picture; here it is what the file
 * even is.
 *
 * ── What it does, and deliberately does not do ──────────────────────────────
 * Converts IN PLACE, keeping the path exactly as it was, for any file whose
 * real format is PNG. Dimensions are preserved - downscaling is a visual
 * decision, not a format one, and is not made here.
 *
 * It will NOT rename `.png` to `.webp`. A rename changes `image_url` in the
 * database, the `imageFile` in the seed scripts, and the key in
 * scripts/captions.json; doing that silently from an image tool is how those
 * three drift apart. Such files are listed for a human to move deliberately.
 *
 * ── Quality ─────────────────────────────────────────────────────────────────
 * q=82 was chosen by measurement, not taste. The 402 cards already shipping as
 * real WebP sit at 0.92-0.94 bits per pixel; q=82 reproduces 0.93 bpp on these
 * sources, so converted files encode like the ones already there. The captions
 * - small text, the first thing lossy WebP degrades - were read back at that
 * setting and are crisp.
 *
 * Run: node scripts/normalise-image-formats.cjs           # report only
 *      node scripts/normalise-image-formats.cjs --write   # convert in place
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const IMAGES = path.join(ROOT, "artifacts/beach-volleyball/public/images");
const QUALITY = 82;
const TAG = "[normalise-image-formats]";

let sharp;
try {
  sharp = require(path.join(ROOT, "scripts/node_modules/sharp"));
} catch {
  console.error(`${TAG} sharp is not installed. Run \`pnpm install\` first.`);
  process.exit(1);
}

const write = process.argv.includes("--write");

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

(async () => {
  const convertible = [];
  const needsRename = [];

  for (const p of walk(IMAGES)) {
    const ext = path.extname(p).slice(1).toLowerCase();
    if (!["webp", "png", "jpg", "jpeg"].includes(ext)) continue;

    let meta;
    try {
      meta = await sharp(p).metadata();
    } catch (err) {
      console.error(`${TAG} unreadable: ${path.relative(ROOT, p)} (${err.message})`);
      process.exitCode = 1;
      continue;
    }
    if (meta.format !== "png") continue;

    (ext === "png" ? needsRename : convertible).push({ p, size: fs.statSync(p).size });
  }

  const mb = (b) => (b / 2 ** 20).toFixed(1);

  if (!convertible.length && !needsRename.length) {
    console.log(`${TAG} nothing to do - no PNG-content images under public/images.`);
    return;
  }

  console.log(
    `${TAG} ${convertible.length} file(s) carry PNG content under a .webp name ` +
      `(${mb(convertible.reduce((a, f) => a + f.size, 0))} MB)`,
  );

  let before = 0;
  let after = 0;
  for (const f of convertible) {
    const rel = path.relative(IMAGES, f.p);
    if (!write) {
      console.log(`  would convert  ${(f.size / 1024).toFixed(0).padStart(5)}KB  ${rel}`);
      continue;
    }
    // Encode to a buffer first: writing straight back to the path sharp is
    // reading would truncate the source out from under the decoder.
    const buf = await sharp(f.p).webp({ quality: QUALITY, effort: 6 }).toBuffer();
    fs.writeFileSync(f.p, buf);
    before += f.size;
    after += buf.length;
    console.log(
      `  converted  ${(f.size / 1024).toFixed(0).padStart(5)}KB -> ` +
        `${(buf.length / 1024).toFixed(0).padStart(4)}KB  ${rel}`,
    );
  }

  if (write && convertible.length) {
    console.log(
      `\n${TAG} ${mb(before)} MB -> ${mb(after)} MB ` +
        `(${(100 - (after / before) * 100).toFixed(1)}% smaller)`,
    );
  }

  if (needsRename.length) {
    console.log(
      `\n${TAG} ${needsRename.length} honestly-named .png file(s) - NOT touched. ` +
        `Renaming these changes image_url, the seed scripts and captions.json, ` +
        `so move them deliberately:`,
    );
    for (const f of needsRename) {
      console.log(`  ${(f.size / 1024).toFixed(0).padStart(5)}KB  ${path.relative(IMAGES, f.p)}`);
    }
  }

  if (!write) console.log(`\n${TAG} report only. Re-run with --write to convert.`);
})();
