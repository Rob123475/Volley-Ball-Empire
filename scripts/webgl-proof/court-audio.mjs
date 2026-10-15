/**
 * Rob, 16 Oct: what the 3D court sends to the speakers, for the sound proofs
 * (sound-volume-proof.mjs in Chrome, package-sound-proof.mjs in the packaged game).
 *
 * AUDIO_TAP is injected into every frame before its own scripts
 * (Page.addScriptToEvaluateOnNewDocument): every Web Audio node connected to the
 * speakers goes through one analyser per audio context, and
 * window.__vbeLevel() reads them all. Unity's WebGL audio is Web Audio, so in
 * the court's frame this is everything the court plays.
 */
export const AUDIO_TAP = `(() => {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  const taps = new WeakMap();
  const tapFor = (ctx) => {
    if (!taps.has(ctx)) {
      const a = ctx.createAnalyser(); a.fftSize = 2048;
      AudioNode.prototype.__vbeConnect.call(a, ctx.destination);
      taps.set(ctx, a);
      (window.__vbeTaps = window.__vbeTaps || []).push(a);
    }
    return taps.get(ctx);
  };
  AudioNode.prototype.__vbeConnect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    if (dest instanceof AudioDestinationNode) return this.__vbeConnect(tapFor(dest.context), ...rest);
    return this.__vbeConnect(dest, ...rest);
  };
  window.__vbeLevel = () => {
    let peak = 0, sum = 0, n = 0;
    for (const a of window.__vbeTaps || []) {
      const buf = new Float32Array(a.fftSize); a.getFloatTimeDomainData(buf);
      for (const s of buf) { peak = Math.max(peak, Math.abs(s)); sum += s * s; n++; }
    }
    return { peak, rms: n ? Math.sqrt(sum / n) : -1, taps: (window.__vbeTaps || []).length,
      state: (window.__vbeTaps || []).map((a) => a.context.state).join(",") };
  };
})();`;
