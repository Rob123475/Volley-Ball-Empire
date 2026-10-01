// Small WAV helpers for the audio scripts (16-bit PCM in, mono float out).
import fs from "node:fs";

/** Read a 16-bit PCM WAV; returns { rate, mono: Float64Array } (channels averaged). */
export function readWav(file) {
  const b = fs.readFileSync(file);
  if (b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WAVE") throw new Error(`${file}: not a WAV`);
  let p = 12, fmt = null, data = null;
  while (p + 8 <= b.length) {
    const id = b.toString("ascii", p, p + 4), size = b.readUInt32LE(p + 4);
    if (id === "fmt ") fmt = { channels: b.readUInt16LE(p + 10), rate: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) };
    if (id === "data") data = b.subarray(p + 8, p + 8 + size);
    p += 8 + size + (size & 1);
  }
  if (!fmt || !data || fmt.bits !== 16) throw new Error(`${file}: need 16-bit PCM`);
  const n = Math.floor(data.length / 2 / fmt.channels), mono = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let c = 0; c < fmt.channels; c++) s += data.readInt16LE((i * fmt.channels + c) * 2) / 32768;
    mono[i] = s / fmt.channels;
  }
  return { rate: fmt.rate, mono };
}

/** Float samples (interleaved when channels > 1) -> 16-bit PCM WAV buffer. */
export function wavBuffer(x, rate, channels = 1) {
  const pcm = Buffer.alloc(x.length * 2);
  for (let i = 0; i < x.length; i++) pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(x[i] * 32767))), i * 2);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(channels, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2 * channels, 28); h.writeUInt16LE(2 * channels, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

/** Raw 16-bit little-endian PCM -> floats (kept interleaved). */
export function pcmToFloat(buf) {
  const x = new Float64Array(buf.length >> 1);
  for (let i = 0; i < x.length; i++) x[i] = buf.readInt16LE(i * 2) / 32768;
  return x;
}

const db = (v) => (v > 0 ? 20 * Math.log10(v) : -99);

/** Whole-clip RMS and peak in dBFS, and the RMS of each `win`-second window (interleaved samples). */
export function measure(x, rate, win = 0.5, channels = 1) {
  let e = 0, peak = 0;
  for (const v of x) { e += v * v; peak = Math.max(peak, Math.abs(v)); }
  const w = Math.max(1, Math.round(rate * win)) * channels, env = [];
  for (let i = 0; i + w <= x.length; i += w) {
    let s = 0; for (let k = 0; k < w; k++) s += x[i + k] ** 2;
    env.push(db(Math.sqrt(s / w)));
  }
  return { seconds: x.length / channels / rate, rmsDb: db(Math.sqrt(e / x.length)), peakDb: db(peak), env };
}
