#!/usr/bin/env node
/**
 * 1.2 9b (Rob, 28 Nov 2026): Rob's swimwear swatches made ready for the game.
 *
 * For every print in artifacts/api-server/src/data/prints.json (and each colourway), from its
 * 'source' in Rob's swatch folder:
 *   - cropped to 'crop' (x, y, width, height in the swatch's pixels): a regular pattern (stripes,
 *     polka dots, gingham, houndstooth) cut to a whole number of its repeats, so it tiles with no join;
 *   - capped at 1024 pixels wide (the swatches are 1774 wide; together 42 MB);
 *   - written to artifacts/beach-volleyball/public/prints as 'file': PNG for a print of 3 colours or
 *     fewer (the colour change needs its edges clean), JPEG at quality 90 for a full-colour one.
 * Rob's art is not repainted: only cropped and scaled.
 *
 * Usage: node scripts/prepare-prints.mjs [swatch folder]
 *   (default C:/Users/rbonn/Game_Dev/VolleyBall Empire/1.2 props/swimwear-prints)
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const REPO = path.resolve(import.meta.dirname, "..");
const SOURCE = process.argv[2] ?? "C:/Users/rbonn/Game_Dev/VolleyBall Empire/1.2 props/swimwear-prints";
const OUT = path.join(REPO, "artifacts", "beach-volleyball", "public", "prints");
const MAX_WIDTH = 1024;
const { prints } = JSON.parse(fs.readFileSync(path.join(REPO, "artifacts", "api-server", "src", "data", "prints.json"), "utf8"));

fs.mkdirSync(OUT, { recursive: true });
let total = 0;
for (const p of prints) {
  for (const w of p.colourways ?? [p]) {
    let img = sharp(path.join(SOURCE, w.source));
    const meta = await img.metadata();
    if (p.crop) img = img.extract({ left: p.crop[0], top: p.crop[1], width: p.crop[2], height: p.crop[3] });
    const width = p.crop ? p.crop[2] : meta.width;
    if (width > MAX_WIDTH) img = img.resize({ width: MAX_WIDTH });
    img = w.file.endsWith(".png") ? img.png({ compressionLevel: 9, palette: true, quality: 100, colours: 64 }) : img.jpeg({ quality: 90, mozjpeg: true });
    const out = path.join(OUT, w.file);
    await img.toFile(out);
    const size = fs.statSync(out).size;
    total += size;
    const m = await sharp(out).metadata();
    console.log(`  ${w.file.padEnd(34)} ${m.width} x ${m.height}  ${(size / 1024).toFixed(0)} KB${p.crop ? `  (cropped to ${p.crop[2]} x ${p.crop[3]})` : ""}`);
  }
}
console.log(`[prepare-prints] ${prints.length} prints, ${(total / 1024 / 1024).toFixed(1)} MB in ${path.relative(REPO, OUT)}`);
