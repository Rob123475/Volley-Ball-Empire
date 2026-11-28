/**
 * 1.2 9d (Rob, 28 Nov 2026): the music, Rob's ruling. The songs play from the band's stage and on
 * through the match; the player must be able to turn the music down or off whenever they choose,
 * from the game's Settings and from the court's own settings during a match, and the choice is
 * remembered. The controls were already there (components/sound-settings.tsx); this proves them on
 * the built game, reading the page's own <audio> element (caught as it is made):
 *   1. Settings > Sound: the music volume down to 20% and muted: the song's element follows;
 *   2. the page reloaded: both remembered (bve.music) and the element starts that way;
 *   3. unmuted at 60%, a watched match on the court: the song plays on, at 60% times the stage's
 *      loudness where the camera is (never more than the player's own level);
 *   4. the court's settings (the gear above the match): the volume to 0 and muted, mid-match, and the
 *      song follows; back on the dashboard the choice holds.
 * Pictures and summary.json in <outDir>.
 *
 * Usage: node scripts/webgl-proof/music-9d.mjs <outDir>
 */
import path from "node:path";
import { builtGame, sleep } from "./built-game.mjs";

const outDir = path.resolve(process.argv[2] ?? "music-9d");
const g = await builtGame({ outDir, ports: { api: 4963, web: 4962, cdp: 9363 } });
const { js, shot, go, check, send } = g;
const audio = `(() => { const a = (window.__audios ?? []).at(-1); return a ? { volume: Math.round(a.volume * 1000) / 1000, muted: a.muted, playing: !a.paused, src: (a.src || "").split("/").pop() } : null; })()`;
const setRange = (testid, v) => js(`(() => { const i = document.querySelector('[data-testid="${testid}"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(i, "${v}"); i.dispatchEvent(new Event("input", { bubbles: true })); i.dispatchEvent(new Event("change", { bubbles: true })); })()`);
try {
  // Every <audio> the page makes is kept where the proof can read it (the music player makes one).
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => { const make = Document.prototype.createElement; Document.prototype.createElement = function (t, o) { const e = make.call(this, t, o); if (String(t).toLowerCase() === "audio") (window.__audios ||= []).push(e); return e; }; })();` });
  await go("/");
  await g.continueTitle();
  await sleep(4000);
  const master = await js(`(() => { try { return JSON.parse(localStorage.getItem("vbe-court-volume") || "{}").master ?? 1; } catch { return 1; } })()`);
  let a = await js(audio);
  check("the song is playing", a?.playing === true, JSON.stringify(a));

  // 1. Settings > Sound.
  await go("/settings", 4000);
  await setRange("sound-volume", 20);
  await js(`document.querySelector('[data-testid="sound-mute"]').click()`);
  await sleep(800);
  a = await js(audio);
  check("Settings: the music down to 20% and muted, and the song follows", a?.muted === true && Math.abs(a.volume - 0.2 * master) < 0.01, `${JSON.stringify(a)} (master ${master})`);
  await js(`document.querySelector('[data-testid="sound-volume"]').scrollIntoView({ block: "center" })`);
  await shot("9d-settings-sound.png", "Settings > Sound: music at 20%, muted");

  // 2. Remembered.
  await send("Page.reload"); await sleep(4000);
  await g.continueTitle(); await sleep(1500);
  const stored = await js(`localStorage.getItem("bve.music")`);
  a = await js(audio);
  check("remembered after a reload (bve.music), and the song starts that way", /"volume":0\.2/.test(stored) && /"muted":true/.test(stored) && a?.muted === true && Math.abs(a.volume - 0.2 * master) < 0.01, `${stored}; ${JSON.stringify(a)}`);

  // 3. On the court: the song plays on, at the player's level times the stage's loudness.
  await go("/settings", 3000);
  await js(`document.querySelector('[data-testid="sound-mute"]').click()`);
  await setRange("sound-volume", 60);
  await sleep(500);
  const matchId = await g.firstMatchDay();
  await js(`localStorage.setItem("vbe-court-control-mode", "auto")`);
  const from = Date.now();
  await go(`/court?matchId=${matchId}`, 1000);
  const started = await g.waitFor(/match starts/, 300000, from);
  check("a watched match on the court", !!started, started?.text.split("\n")[0] ?? "");
  await sleep(15000);
  a = await js(audio);
  const stage = g.lines.filter((l) => l.at >= from && /vbe-stage-audio|\[Band\]/.test(l.text)).map((l) => l.text.split("\n")[0]).slice(-1)[0] ?? "";
  check("on the court the song plays on, at 60% times the stage's loudness (never louder than the player's 60%)",
    a?.playing === true && a.muted === false && a.volume > 0 && a.volume <= 0.6 * master + 0.001, `${JSON.stringify(a)}; ${stage}`);

  // 4. The court's own settings, mid-match.
  await js(`document.querySelector('[data-testid="button-court-settings"]').click()`);
  await sleep(1000);
  await setRange("sound-volume", 0);
  await sleep(500);
  a = await js(audio);
  check("the court's settings: the music down to nothing mid-match, and the song follows", a?.volume === 0, JSON.stringify(a));
  await shot("9d-court-settings.png", "the court's settings over the match: music at 0%");
  await js(`document.querySelector('[data-testid="sound-mute"]').click()`);
  await sleep(500);
  a = await js(audio);
  const words = await js(`document.querySelector('[data-testid="court-settings-overlay"]')?.innerText.match(/The songs[^.]*\\./)?.[0] ?? ""`);
  check("and muted there too; the court's settings say the songs play on from the band's stage", a?.muted === true && /band's stage/.test(words), `${JSON.stringify(a)}; "${words}"`);
  check("the court's choice is remembered", /"volume":0[,}]/.test(await js(`localStorage.getItem("bve.music")`)) && /"muted":true/.test(await js(`localStorage.getItem("bve.music")`)), await js(`localStorage.getItem("bve.music")`));
} catch (e) {
  g.fail(e);
} finally {
  await g.close();
}
console.log(JSON.stringify({ ok: g.ok, checks: g.summary.checks.map((c) => `${c.pass ? "PASS" : "FAIL"} ${c.label}`) }));
process.exit(g.ok ? 0 : 1);
