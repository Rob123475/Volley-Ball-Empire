#!/usr/bin/env node
/**
 * 1.2 section 5 (Rob, 28 Nov 2026): every commentary clip at the existing clips' loudness, run when clips
 * are added. Rob's samples differ by about 8 dB (his sample 1 is the quiet one).
 *
 * The existing 48 clips were made at one speech loudness (scripts/elevenlabs-commentary.mjs: speech RMS
 * -18 dBFS over the voiced part, peaks under -1 dBFS); this measures them and brings each clip given to
 * that same level. A quiet clip whose loudest moments would pass -1 dBFS on the way has just those moments
 * held down by a short look-ahead limiter (2 ms ahead, 60 ms back up), so it reaches the level unclipped. Read and written with Windows' own media transcoder (mp3-to-wav.ps1, wav-to-mp3.ps1),
 * nothing installed. A clip already within 0.5 dB is left alone (no re-encode).
 *
 * Usage: node scripts/level-commentary.mjs [--measure] [--out DIR] FILE.mp3 [FILE.mp3 ...]
 *   --measure  only measures and prints (the existing clips' level first)
 *   --out DIR  writes the levelled clips there, under the same names, instead of in place
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REPO = path.resolve(import.meta.dirname, "..");
const CLIPS = path.join(REPO, "artifacts", "beach-volleyball", "public", "unity-build", "StreamingAssets", "commentary");
const PEAK_DB = -1, SKIP_DB = 0.5;
const args = process.argv.slice(2);
const measureOnly = args.includes("--measure");
const outDir = args.includes("--out") ? path.resolve(args[args.indexOf("--out") + 1]) : null;
const files = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--out").map((f) => path.resolve(f));
const work = fs.mkdtempSync(path.join(os.tmpdir(), "bve-level-"));

/** A WAV file's samples, mono, -1..1, and its rate (PCM 16-bit or 32-bit float). */
function readWav(file) {
  const b = fs.readFileSync(file);
  let p = 12, fmt = null, data = null;
  while (p + 8 <= b.length) {
    const id = b.toString("ascii", p, p + 4), size = b.readUInt32LE(p + 4);
    if (id === "fmt ") fmt = { format: b.readUInt16LE(p + 8), channels: b.readUInt16LE(p + 10), rate: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) };
    if (id === "data") data = b.subarray(p + 8, p + 8 + size);
    p += 8 + size + (size % 2);
  }
  const bytes = fmt.bits / 8, frames = Math.floor(data.length / (bytes * fmt.channels)), x = new Float64Array(frames);
  for (let i = 0; i < frames; i++) {
    let s = 0;
    for (let c = 0; c < fmt.channels; c++) {
      const o = (i * fmt.channels + c) * bytes;
      s += fmt.format === 3 ? data.readFloatLE(o) : fmt.bits === 16 ? data.readInt16LE(o) / 32768 : data.readInt32LE(o) / 2147483648;
    }
    x[i] = s / fmt.channels;
  }
  return { x, rate: fmt.rate };
}

function writeWav(file, x, rate) {
  const pcm = Buffer.alloc(x.length * 2);
  for (let i = 0; i < x.length; i++) pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(x[i] * 32768))), i * 2);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, pcm]));
}

/** Holds every sample under the ceiling: the gain dips just before a peak (2 ms ahead) and comes back in 60 ms. */
function limit(x, rate, ceiling) {
  const ahead = Math.round(rate * 0.002), back = 1 / Math.round(rate * 0.06);
  const need = Float64Array.from(x, (v) => Math.min(1, ceiling / Math.max(Math.abs(v), 1e-9)));
  let g = 1, held = 0;
  const window = [];   // the smallest need over the next 2 ms, kept as a monotonic queue
  for (let i = 0; i < x.length + ahead; i++) {
    if (i < x.length) { while (window.length && need[window[window.length - 1]] >= need[i]) window.pop(); window.push(i); }
    const at = i - ahead;
    if (at < 0) continue;
    while (window.length && window[0] < at) window.shift();
    const want = window.length ? need[window[0]] : 1;
    g = want < g ? want : Math.min(want, g + back);
    if (g < 1) held++;
    x[at] *= g;
  }
  return held;
}

/** Speech loudness, as the clips were made: RMS over 20 ms frames louder than -45 dBFS (the voiced part). */
function loudness(x, rate) {
  const frame = Math.round(rate / 50); let sum = 0, n = 0, peak = 0;
  for (let i = 0; i + frame <= x.length; i += frame) {
    let e = 0; for (let k = 0; k < frame; k++) e += x[i + k] ** 2;
    if (Math.sqrt(e / frame) > 10 ** (-45 / 20)) { sum += e; n += frame; }
  }
  for (const v of x) peak = Math.max(peak, Math.abs(v));
  return { rmsDb: n ? 10 * Math.log10(sum / n) : -99, peakDb: 20 * Math.log10(peak || 1e-9) };
}

function decode(mp3) {
  const name = `${path.basename(mp3, ".mp3")}-${Math.random().toString(36).slice(2)}.wav`;
  execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(REPO, "scripts", "mp3-to-wav.ps1"), mp3, work, name], { stdio: "ignore" });
  return readWav(path.join(work, name));
}

// The existing clips' level: the A_ and B_ clips the game's LINES.txt lists that are on file.
const existing = fs.readFileSync(path.join(CLIPS, "LINES.txt"), "utf8").split(/\r?\n/).map((l) => l.split("\t")[0]).filter((f) => /^[AB]_.*\.mp3$/.test(f) && fs.existsSync(path.join(CLIPS, f)));
const levels = existing.map((f) => { const { x, rate } = decode(path.join(CLIPS, f)); return loudness(x, rate).rmsDb; });
const target = levels.reduce((a, b) => a + b, 0) / levels.length;
console.log(`the ${existing.length} existing clips: speech ${target.toFixed(1)} dBFS on average (${Math.min(...levels).toFixed(1)} to ${Math.max(...levels).toFixed(1)})`);

for (const f of files) {
  const { x, rate } = decode(f);
  const before = loudness(x, rate);
  const gainDb = target - before.rmsDb;
  let line = `  ${path.basename(f)}: speech ${before.rmsDb.toFixed(1)} dBFS, peak ${before.peakDb.toFixed(1)}`;
  if (measureOnly) { console.log(`${line}; ${gainDb >= 0 ? "+" : ""}${gainDb.toFixed(1)} dB to the clips' level`); continue; }
  const dest = outDir ? path.join(outDir, path.basename(f)) : f;
  if (Math.abs(gainDb) < SKIP_DB) { if (outDir) fs.copyFileSync(f, dest); console.log(`${line}; already at the clips' level`); continue; }
  const g = 10 ** (gainDb / 20);
  for (let i = 0; i < x.length; i++) x[i] *= g;
  const held = limit(x, rate, 10 ** (PEAK_DB / 20));
  const after = loudness(x, rate);
  const wav = path.join(work, path.basename(f, ".mp3") + "-levelled.wav");
  writeWav(wav, x, rate);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(REPO, "scripts", "wav-to-mp3.ps1"), wav, path.dirname(dest), path.basename(dest)], { stdio: "ignore" });
  console.log(`${line}; ${gainDb >= 0 ? "+" : ""}${gainDb.toFixed(1)} dB -> speech ${after.rmsDb.toFixed(1)} dBFS, peak ${after.peakDb.toFixed(1)}${held ? `, ${(held / rate * 1000).toFixed(0)} ms of peaks held down` : ""}${outDir ? ` (${dest})` : ""}`);
}
