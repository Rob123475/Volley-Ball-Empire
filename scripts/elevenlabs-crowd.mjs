/**
 * Overnight brief 1 Oct, N-28: real crowd audio for the 3D match, made with
 * ElevenLabs Sound Effects on Rob's account, in the style of Rob's own two
 * point-reaction clips (Downloads\bve-commentary\crowd\crowd-A-sports-crowd-
 * cheer.mp3, 2 s, and crowd-B-sporting-event.mp3, 1 s: a real stadium crowd,
 * close and loud, RMS about -15 and -11 dBFS).
 *
 * Made here (stereo, 44.1 kHz): two seamless 30 s crowd beds (a calm murmur and an excited one
 * the match crossfades to as a rally runs long), 4 cheers, 3 applause,
 * 2 whistles, 2 groans and 1 big roar. Each is fetched as 44.1 kHz PCM, its
 * loudness set (point reactions to Rob's clips' level, RMS -14 dBFS; beds
 * RMS -20 dBFS, which the game then mixes down; the crowd's whistles -16), peaks held
 * under -1 dBFS.
 * The beds' loop point is checked (the level either side of the wrap, and the
 * jump in the waveform there); a bed whose wrap is not seamless gets a 0.75 s
 * equal-power crossfade folded over its ends.
 *
 * WAVs go to the Unity project's Assets/Resources/Audio/Crowd (the game's crowd
 * folder: every build carries Resources); MP3 copies to
 * Downloads\bve-commentary\crowd\generated.
 *
 * The API key is read from Downloads\11labs api.txt (first line) at run time
 * only; it is never written anywhere or printed.
 *
 * Usage: node scripts/elevenlabs-crowd.mjs [--only bed_calm,cheer_1] [--reprocess]
 *   --reprocess  re-measure and re-normalise the raw downloads kept in the
 *                scratch folder (no API call)
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { measure, pcmToFloat, wavBuffer } from "./lib/wav.mjs";

const REPO = path.resolve(import.meta.dirname, "..");
const UNITY = "C:/Users/rbonn/Game_Dev/VolleyBall Empire/volleyball/Assets/Resources/Audio/Crowd";
const COPY = path.join(os.homedir(), "Downloads", "bve-commentary", "crowd", "generated");
const RAW = path.join(os.tmpdir(), "bve-crowd-raw");
const KEY_FILE = path.join(os.homedir(), "Downloads", "11labs api.txt");
const RATE = 44100, CH = 2;   // the API's pcm_44100 is 16-bit stereo, interleaved
const REACTION_DB = -14, BED_DB = -20, PEAK_DB = -1;

export const SOUNDS = [
  { name: "bed_calm", seconds: 30, loop: true, bed: true,
    text: "Large outdoor beach volleyball stadium crowd ambience between points, thousands of spectators murmuring and chatting, scattered claps and distant shouts, warm and lively, continuous, no music, no announcer" },
  { name: "bed_excited", seconds: 30, loop: true, bed: true,
    text: "Excited outdoor stadium crowd during a long tense rally at a beach volleyball match, rising buzz of thousands of fans, shouts of encouragement, rhythmic clapping, continuous, no music, no announcer" },
  { name: "cheer_1", seconds: 2.5, text: "Sports crowd cheering loudly after a great point at a beach volleyball match, short burst of cheers and whoops" },
  { name: "cheer_2", seconds: 3, text: "Stadium crowd bursts into cheers and claps after a spectacular spike, excited fans yelling" },
  { name: "cheer_3", seconds: 2.5, text: "Crowd of fans cheering and whistling with excitement at an outdoor sporting event, short reaction" },
  { name: "cheer_4", seconds: 3, text: "Big happy cheer from a sports crowd after a winning shot, whoops and shouts, outdoor stadium" },
  { name: "applause_1", seconds: 3, text: "Stadium crowd applause, warm clapping after a point at a beach volleyball match, outdoor" },
  { name: "applause_2", seconds: 3.5, text: "Sporting event crowd clapping and applauding politely, a few cheers, outdoor stands" },
  { name: "applause_3", seconds: 3, text: "Enthusiastic applause from thousands of spectators at an outdoor sports match" },
  { name: "whistle_1", seconds: 2, db: -16, text: "Fans in a stadium crowd whistling loudly with two fingers in celebration after a great point, short, outdoor" },
  { name: "whistle_2", seconds: 2.5, db: -16, text: "Several spectators whistling and cheering at an outdoor beach volleyball match, sharp happy whistles from the stands" },
  { name: "groan_1", seconds: 2.5, text: "Sports crowd groaning in disappointment, a loud collective ohhh after a missed shot, outdoor stadium" },
  { name: "groan_2", seconds: 2.5, text: "Stadium crowd sighs and groans together after an error, aww of disappointment" },
  { name: "roar_big", seconds: 7, text: "Huge stadium crowd roar erupting as the match-winning point is scored, thousands of fans screaming and cheering, sustained celebration, outdoor beach volleyball final" },
];

const args = process.argv.slice(2);
const only = args.includes("--only") ? new Set(args[args.indexOf("--only") + 1].split(",")) : null;
const reprocess = args.includes("--reprocess");
const list = SOUNDS.filter((s) => !only || only.has(s.name));

async function generate(s, key) {
  for (let attempt = 1; ; attempt++) {
    const r = await fetch(`https://api.elevenlabs.io/v1/sound-generation?output_format=pcm_${RATE}`, {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({ text: s.text, duration_seconds: s.seconds, prompt_influence: 0.5, loop: !!s.loop, model_id: "eleven_text_to_sound_v2" }),
    });
    if (r.ok) {
      const cost = r.headers.get("character-cost") ?? r.headers.get("x-character-cost");
      return { pcm: Buffer.from(await r.arrayBuffer()), cost: cost == null ? null : Number(cost) };
    }
    const body = (await r.text()).slice(0, 300);
    if (attempt >= 3 || (r.status !== 429 && r.status < 500)) throw new Error(`${s.name}: HTTP ${r.status}: ${body}`);
    await new Promise((res) => setTimeout(res, 3000 * attempt));
  }
}

/** Level either side of the wrap, and the waveform jump there (as a share of the bed's typical step). */
function wrapCheck(x) {
  const w = Math.round(RATE * 0.5) * CH;
  const rms = (a, b) => { let e = 0; for (let i = a; i < b; i++) e += x[i] ** 2; return 10 * Math.log10(e / (b - a) + 1e-12); };
  let step = 0; for (let i = CH; i < x.length; i++) step += Math.abs(x[i] - x[i - CH]);
  step /= x.length - CH;
  let jump = 0; for (let c = 0; c < CH; c++) jump = Math.max(jump, Math.abs(x[c] - x[x.length - CH + c]));
  return { endDb: rms(x.length - w, x.length), startDb: rms(0, w), jump: jump / (step || 1e-9) };
}

/** Fold the last `fade` seconds over the first with an equal-power crossfade; the result loops seamlessly. */
function crossfadeLoop(x, fade = 0.75) {
  const n = Math.round(RATE * fade) * CH, out = x.slice(0, x.length - n);
  for (let i = 0; i < n; i++) {
    const t = (Math.floor(i / CH) + 0.5) / (n / CH);
    out[i] = x[i] * Math.sin((t * Math.PI) / 2) + x[x.length - n + i] * Math.cos((t * Math.PI) / 2);
  }
  return out;
}

function setLevel(x, targetDb) {
  const m = measure(x, RATE, 0.5, CH);
  const gainDb = Math.min(targetDb - m.rmsDb, PEAK_DB - m.peakDb);
  const g = 10 ** (gainDb / 20);
  return { y: x.map((v) => v * g), gainDb };
}

const key = reprocess ? null : fs.readFileSync(KEY_FILE, "utf8").split(/\r?\n/)[0].trim();
fs.mkdirSync(UNITY, { recursive: true });
fs.mkdirSync(COPY, { recursive: true });
fs.mkdirSync(RAW, { recursive: true });
const work = fs.mkdtempSync(path.join(os.tmpdir(), "bve-crowd-"));
let seconds = 0, costed = 0, costSum = 0;
for (const s of list) {
  const rawFile = path.join(RAW, `${s.name}.pcm`);
  if (!reprocess) {
    const { pcm, cost } = await generate(s, key);
    fs.writeFileSync(rawFile, pcm);
    seconds += s.seconds;
    if (cost != null) { costed++; costSum += cost; }
  }
  let x = pcmToFloat(fs.readFileSync(rawFile));
  let note = "";
  if (s.loop) {
    const before = wrapCheck(x);
    note = `wrap ${before.endDb.toFixed(1)}/${before.startDb.toFixed(1)} dB, jump ${before.jump.toFixed(1)} steps`;
    if (Math.abs(before.endDb - before.startDb) > 3 || before.jump > 8) {
      x = crossfadeLoop(x);
      const after = wrapCheck(x);
      note += ` -> crossfaded: ${after.endDb.toFixed(1)}/${after.startDb.toFixed(1)} dB, jump ${after.jump.toFixed(1)}`;
    } else note += " (seamless as made)";
  }
  const { y, gainDb } = setLevel(x, s.db ?? (s.bed ? BED_DB : REACTION_DB));
  const m = measure(y, RATE, 0.5, CH);
  const wav = path.join(work, `${s.name}.wav`);
  fs.writeFileSync(wav, wavBuffer(y, RATE, CH));
  fs.copyFileSync(wav, path.join(UNITY, `${s.name}.wav`));
  execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(REPO, "scripts", "wav-to-mp3.ps1"), wav, COPY, `${s.name}.mp3`], { stdio: "ignore" });
  console.log(`${s.name}\t${m.seconds.toFixed(2)} s\tRMS ${m.rmsDb.toFixed(1)} dBFS, peak ${m.peakDb.toFixed(1)} (gain ${gainDb.toFixed(1)} dB)\t${note}`);
}
if (!reprocess) console.log(`sound effects: ${list.length} clips, ${seconds} s requested; cost header on ${costed} of them, totalling ${costSum}`);
console.log(`to ${UNITY} and ${COPY}`);
