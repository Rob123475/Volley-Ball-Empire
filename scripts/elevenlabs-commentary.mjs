/**
 * Overnight brief 30 Sep, item 21: the 48 commentary clips, voiced through
 * Rob's ElevenLabs account.
 *
 * Voices (read from Rob's history, 30 Sep 2026 02:18 and 02:21 UTC):
 *   A  Kailey                                   h1nUqvAFfvrCaHydX12x
 *   B  Hukum – Sports Commentary: High energy   CSyG9YhQsyznH6ETWS8Q
 * with the model those generations used, eleven_v4.
 *
 * Overnight brief 1 Oct, N-32 ("more animated"): settings for more energy and
 * variation: stability 0.0 (the model's "Creative" end; was 0.5), style 0.8
 * (exaggeration; was the default), similarity 0.75, speaker boost on. Build-up
 * plays are spoken [excited]; the key moments (block, point, rally) [shouting].
 * The tag is not shown in the subtitle. A take outside 0.6-3.9 s (a low
 * stability can wander) is made again, up to 4 times. The 30 Sep clips are
 * kept in Downloads\bve-commentary\clips-01oct as a fallback.
 *
 * The lines and file names come from the game's clip list
 * (public/unity-build/StreamingAssets/commentary/LINES.txt, written with
 * Downloads\bve-commentary\COMMENTARY-SCRIPT.md from one list). Each clip is
 * fetched as 24 kHz PCM, its loudness set to the same level (speech RMS
 * -18 dBFS, measured over the voiced part, peaks held under -1 dBFS) so both
 * voices sit alike under the crowd, then encoded to MP3 by Windows' own media
 * transcoder (scripts/wav-to-mp3.ps1). The MP3s go to the game's commentary
 * folder and a copy to Downloads\bve-commentary\clips.
 *
 * The API key is read from Downloads\11labs api.txt (first line) at run time
 * only; it is never written anywhere or printed.
 *
 * Usage: node scripts/elevenlabs-commentary.mjs [--only A_spike_1,B_rally_3] [--test]
 *   --test  speaks one short line to a scratch folder and exits
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REPO = path.resolve(import.meta.dirname, "..");
const CLIPS = path.join(REPO, "artifacts", "beach-volleyball", "public", "unity-build", "StreamingAssets", "commentary");
const COPY = path.join(os.homedir(), "Downloads", "bve-commentary", "clips");
const KEY_FILE = path.join(os.homedir(), "Downloads", "11labs api.txt");
export const VOICES = {
  A: { name: "Kailey", id: "h1nUqvAFfvrCaHydX12x" },
  B: { name: "Hukum", id: "CSyG9YhQsyznH6ETWS8Q" },
};
const MODEL = "eleven_v4";
const SETTINGS = { stability: 0.0, style: 0.8, similarity_boost: 0.75, use_speaker_boost: true };
const TAG = (file) => (/_(block|point|rally)_/.test(file) ? "[shouting]" : "[excited]");
const MIN_S = 0.6, MAX_S = 3.9;
const RATE = 24000;
const TARGET_DB = -18, PEAK_DB = -1;

const args = process.argv.slice(2);
const only = args.includes("--only") ? new Set(args[args.indexOf("--only") + 1].split(",")) : null;
const test = args.includes("--test");
const key = fs.readFileSync(KEY_FILE, "utf8").split(/\r?\n/)[0].trim();

async function speak(voiceId, text) {
  for (let attempt = 1; ; attempt++) {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=pcm_${RATE}`, {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/pcm" },
      body: JSON.stringify({ text, model_id: MODEL, voice_settings: SETTINGS }),
    });
    if (r.ok) return { pcm: Buffer.from(await r.arrayBuffer()), cost: Number(r.headers.get("character-cost") ?? text.length) };
    const body = (await r.text()).slice(0, 300);
    if (attempt >= 3 || (r.status !== 429 && r.status < 500)) throw new Error(`HTTP ${r.status}: ${body}`);
    await new Promise((res) => setTimeout(res, 3000 * attempt));
  }
}

/** Speech loudness: RMS over 20 ms frames louder than -45 dBFS (the voiced part). */
function loudness(samples) {
  const frame = RATE / 50; let sum = 0, n = 0, peak = 0;
  for (let i = 0; i + frame <= samples.length; i += frame) {
    let e = 0; for (let k = 0; k < frame; k++) e += samples[i + k] ** 2;
    const rms = Math.sqrt(e / frame);
    if (rms > 10 ** (-45 / 20)) { sum += e; n += frame; }
  }
  for (const v of samples) peak = Math.max(peak, Math.abs(v));
  return { rmsDb: n ? 10 * Math.log10(sum / n) : -99, peakDb: 20 * Math.log10(peak || 1e-9) };
}

function normalise(pcm) {
  const x = new Float64Array(pcm.length / 2);
  for (let i = 0; i < x.length; i++) x[i] = pcm.readInt16LE(i * 2) / 32768;
  const before = loudness(x);
  const gainDb = Math.min(TARGET_DB - before.rmsDb, PEAK_DB - before.peakDb);
  const g = 10 ** (gainDb / 20);
  const out = Buffer.alloc(pcm.length);
  for (let i = 0; i < x.length; i++) out.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(x[i] * g * 32768))), i * 2);
  for (let i = 0; i < x.length; i++) x[i] *= g;
  return { out, before, after: loudness(x), gainDb, seconds: x.length / RATE };
}

function wav(pcm) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

const lines = fs.readFileSync(path.join(CLIPS, "LINES.txt"), "utf8").split(/\r?\n/)
  .filter((l) => /\.mp3\t/.test(l)).map((l) => { const [file, text] = l.split("\t"); return { file, text, speaker: file[0] }; })
  .filter((l) => (test ? l.file === "A_point_1.mp3" : !only || only.has(l.file.replace(/\.mp3$/, ""))));
const work = fs.mkdtempSync(path.join(os.tmpdir(), "bve-11labs-"));
const outDir = test ? work : CLIPS;
fs.mkdirSync(COPY, { recursive: true });
let chars = 0, sent = 0;
const report = [];
for (const l of lines) {
  const v = VOICES[l.speaker];
  let n, takes = 0;
  for (;;) {
    const text = `${TAG(l.file)} ${l.text}`;
    const { pcm, cost } = await speak(v.id, text);
    chars += cost; sent += text.length; takes++;
    n = normalise(pcm);
    if ((n.seconds >= MIN_S && n.seconds <= MAX_S) || takes >= 4) break;
    console.log(`  ${l.file}: take ${takes} was ${n.seconds.toFixed(2)} s, again`);
  }
  const w = path.join(work, l.file.replace(/\.mp3$/, ".wav"));
  fs.writeFileSync(w, wav(n.out));
  execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(REPO, "scripts", "wav-to-mp3.ps1"), w, outDir, l.file], { stdio: "ignore" });
  if (!test) fs.copyFileSync(path.join(outDir, l.file), path.join(COPY, l.file));
  report.push(`${l.file}\t${v.name}\t${n.seconds.toFixed(2)} s (${takes} take${takes > 1 ? "s" : ""})\t${n.before.rmsDb.toFixed(1)} -> ${n.after.rmsDb.toFixed(1)} dBFS (peak ${n.after.peakDb.toFixed(1)})\t${l.text}`);
  console.log(report[report.length - 1]);
}
console.log(`characters used: ${chars} (billed, character-cost header); ${sent} characters of text sent; clips: ${lines.length}; to ${outDir}${test ? "" : ` and ${COPY}`}`);
