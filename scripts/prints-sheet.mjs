#!/usr/bin/env node
/**
 * 1.2 9b (Rob, 28 Nov 2026): the proof sheet of Rob's prints, from Unity's renders (PrintsProof) and
 * the prints' own pictures. One row per print:
 *   on a swimsuit, close | on a bikini top, close | at match distance (16 m, enlarged 2x) |
 *   a second colourway (a print the player recolours) or each colourway (paisley) |
 *   the join: the picture repeated 2 x 2 the way the swimwear repeats it (tiled or mirrored), the
 *   middle of it at full size, so a seam would show where the four meet (the tie-dye: once, not repeated).
 * At the top, the colour picker's palette (read from components/colour-picker.tsx).
 *
 * Usage: node scripts/prints-sheet.mjs <renders dir> <out.png>
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const REPO = path.resolve(import.meta.dirname, "..");
const [renders, out] = process.argv.slice(2);
const { prints } = JSON.parse(fs.readFileSync(path.join(REPO, "artifacts/api-server/src/data/prints.json"), "utf8"));
const PICS = path.join(REPO, "artifacts/beach-volleyball/public/prints");
const picker = fs.readFileSync(path.join(REPO, "artifacts/beach-volleyball/src/components/colour-picker.tsx"), "utf8");
const swatches = (name) => [...picker.slice(picker.indexOf(`export const ${name}`)).split(";")[0].matchAll(/\["([^"]+)", "(#[0-9a-f]{6})"\]/g)].map((m) => [m[1], m[2]]);

const CELL = 300, LABEL = 46, BG = { r: 36, g: 36, b: 40 };
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const text = (w, h, lines, size = 15) => Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${lines.map((l, i) => `<text x="6" y="${18 + i * (size + 4)}" font-family="Segoe UI, Arial" font-size="${size}" fill="${l.colour ?? "#f0f0f0"}">${esc(l.t)}</text>`).join("")}</svg>`);

async function cell(file) { return sharp(file).resize(CELL, CELL, { fit: "cover" }).png().toBuffer(); }
async function matchCell(file) {
  const m = await sharp(file).metadata();
  const c = Math.round(m.width / 2);   // her, in the middle: the middle half, enlarged 2x
  return sharp(file).extract({ left: Math.round(c - m.width / 4), top: Math.round(m.height / 4), width: Math.round(m.width / 2), height: Math.round(m.height / 2) }).resize(CELL, CELL, { kernel: "nearest" }).png().toBuffer();
}
/** The picture repeated 2 x 2 as the swimwear repeats it; the middle, where the four meet, at full size. */
async function joinCell(p, file) {
  const src = sharp(path.join(PICS, file));
  const m = await src.metadata();
  if (p.wrap === "single") return sharp(path.join(PICS, file)).resize(CELL, CELL, { fit: "contain", background: BG }).png().toBuffer();
  const [u, v] = p.wrap;
  const a = await src.clone().png().toBuffer();
  const right = u === "mirror" ? await sharp(a).flop().png().toBuffer() : a;
  const row = await sharp({ create: { width: m.width * 2, height: m.height, channels: 3, background: BG } }).composite([{ input: a, left: 0, top: 0 }, { input: right, left: m.width, top: 0 }]).png().toBuffer();
  const below = v === "mirror" ? await sharp(row).flip().png().toBuffer() : row;
  const grid = await sharp({ create: { width: m.width * 2, height: m.height * 2, channels: 3, background: BG } }).composite([{ input: row, left: 0, top: 0 }, { input: below, left: 0, top: m.height }]).png().toBuffer();
  const size = Math.min(m.width, m.height, 420);
  const piece = await sharp(grid).extract({ left: m.width - size / 2, top: m.height - size / 2, width: size, height: size }).resize(CELL, CELL).png().toBuffer();
  // marks just outside where the joins run (the middle across and down), not over the pattern
  const marks = Buffer.from(`<svg width="${CELL}" height="${CELL}" xmlns="http://www.w3.org/2000/svg"><polygon points="${CELL / 2 - 7},0 ${CELL / 2 + 7},0 ${CELL / 2},9" fill="#ff3b30"/><polygon points="0,${CELL / 2 - 7} 0,${CELL / 2 + 7} 9,${CELL / 2}" fill="#ff3b30"/></svg>`);
  return sharp(piece).composite([{ input: marks, left: 0, top: 0 }]).png().toBuffer();
}

const rows = [];
for (const p of prints) {
  const ways = p.colourways ?? [];
  const cells = [];
  const add = async (file, caption) => { if (fs.existsSync(file)) cells.push({ img: await cell(file), caption }); };
  if (ways.length) for (const w of ways) await add(path.join(renders, `${p.id}-${w.id}-swimsuit.png`), `swimsuit, ${w.name}`);
  else await add(path.join(renders, `${p.id}-swimsuit.png`), "swimsuit, close");
  await add(path.join(renders, `${p.id}-bikini.png`), "bikini top, close");
  if (fs.existsSync(path.join(renders, `${p.id}-match.png`))) cells.push({ img: await matchCell(path.join(renders, `${p.id}-match.png`)), caption: "match distance (16 m), 2x" });
  await add(path.join(renders, `${p.id}-colourway2.png`), "a second colourway");
  cells.push({ img: await joinCell(p, p.file ?? ways[0].file), caption: p.wrap === "single" ? "once, not repeated" : `the join: ${p.wrap[0]} x ${p.wrap[1]}` });
  const what = ways.length ? `${ways.length} colourways (${ways.map((w) => w.name).join(", ")}), as Rob painted them`
    : p.colours.length ? `${p.colours.length} colours the player changes; Rob's: ${p.colours.join(" ")}` : "as Rob painted it (more than 3 colours)";
  rows.push({ title: `${p.name}: ${what}; scale ${p.scale}`, cells });
}

const cols = Math.max(...rows.map((r) => r.cells.length));
const W = cols * CELL, ROW = LABEL + CELL + 22;
const brights = swatches("BRIGHTS"), pastels = swatches("PASTELS"), neutrals = swatches("NEUTRALS");
const PAL = 150;
const layers = [];
const sw = 40;
const palSvg = Buffer.from(`<svg width="${W}" height="${PAL}" xmlns="http://www.w3.org/2000/svg">
  <text x="6" y="20" font-family="Segoe UI, Arial" font-size="17" fill="#fff">The colour picker (plain swimwear, and every colour of a print the player changes): 12 brights, 12 pastels, white, grey, black, and any colour by hand</text>
  ${brights.map(([n, h], i) => `<rect x="${6 + i * (sw + 6)}" y="34" width="${sw}" height="${sw}" fill="${h}" stroke="#000"/>`).join("")}
  ${pastels.map(([n, h], i) => `<rect x="${6 + i * (sw + 6)}" y="${34 + sw + 6}" width="${sw}" height="${sw}" fill="${h}" stroke="#000"/>`).join("")}
  ${neutrals.map(([n, h], i) => `<rect x="${6 + (13 + i) * (sw + 6)}" y="34" width="${sw}" height="${sw}" fill="${h}" stroke="#000"/>`).join("")}
  <text x="6" y="${34 + 2 * sw + 26}" font-family="Segoe UI, Arial" font-size="13" fill="#ccc">${esc(brights.map(([n]) => n).join(", "))} / pastels: ${esc(pastels.map(([n]) => n).join(", "))}</text>
</svg>`);
layers.push({ input: palSvg, left: 0, top: 0 });
rows.forEach((r, i) => {
  const top = PAL + i * ROW;
  layers.push({ input: text(W, LABEL, [{ t: r.title }], 16), left: 0, top });
  r.cells.forEach((c, j) => {
    layers.push({ input: c.img, left: j * CELL, top: top + LABEL });
    layers.push({ input: text(CELL, 22, [{ t: c.caption, colour: "#c8c8a0" }], 12), left: j * CELL, top: top + LABEL + CELL - 2 });
  });
});
await sharp({ create: { width: W, height: PAL + rows.length * ROW, channels: 3, background: BG } }).composite(layers).png({ compressionLevel: 9 }).toFile(out);
console.log(`[prints-sheet] ${rows.length} prints, ${cols} columns -> ${out}`);
