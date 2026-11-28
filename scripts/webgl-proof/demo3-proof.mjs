/**
 * 1.2 demo 3 (Rob, section 8 of his 27 Nov additions): demo 3 on its built files, in headless Chrome on the
 * PC's GPU, 1920 x 1080 (built-game.mjs, packaged: the package's own server bundle serving its own pages,
 * as the installed game does, run by the repo's Electron as Node; a copy of the starter DB, never the
 * demo's save folder; a new Sydney Riptide career).
 *
 * A. One whole watched career match, as Rob opens it (CONTINUE, Watch Match), Auto, the defaults, the
 *    player's own banner set ("We love the Riptide"). Pictures, from the court's own log lines:
 *      the band (the director's "the band" shot), the commentary booth ("the commentary booth"), the
 *      drinks break (its cutaway), the crowd with its banners ("the crowd"), and the TV look in play;
 *    the frame rate for 30 s in the TV look; the match played to its end and reported.
 * B. One Exhibition match from the pick screen: a custom team in Rob's prints (tropical hibiscus as he
 *    painted it, and polka dots recoloured hot pink and white from the picker) with tinted sunglasses
 *    (blue mirror, amber), the AI playing all four (watched). A career ceremony is planted first in this
 *    copy of the DB (it opens on the dashboard, proving it waits). Then:
 *      - the court wears what was picked (its log and the game's view of the exhibition);
 *      - the song plays from the band's stage at the band's loudness, not full volume (the page's own
 *        <audio> element: volume under the player's level, and moving as the camera moves);
 *      - no career ceremony opens over the pick screen or the match;
 *      - pictures (the pick screen, the TV look, close-ups) and the frame rate for 30 s.
 * Pictures and summary.json in <outDir>.
 *
 * Usage: node scripts/webgl-proof/demo3-proof.mjs <outDir> [<package's win-unpacked folder>]
 */
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { builtGame, sleep } from "./built-game.mjs";

const outDir = path.resolve(process.argv[2] ?? "demo3");
const g = await builtGame({ outDir, ports: { api: 4241, cdp: 9371 }, width: 1920, height: 1080, packaged: process.argv[3] ?? "C:/build/vbe-1.2-demo-2026-11-28/win-unpacked", managerName: "Demo Three" });
const { js, shot, go, lines, check, send, waitFor } = g;
const audio = `(() => { const a = (window.__audios ?? []).at(-1); return a ? { volume: Math.round(a.volume * 1000) / 1000, muted: a.muted, playing: !a.paused, src: (a.src || "").split("/").pop() } : null; })()`;
const setSelect = (scope, label, value) => js(`(() => { const s = document.querySelector('${scope} select[aria-label="${label}"]'); if (!s) return false; const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set; set.call(s, "${value}"); s.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`);
const ceremonyOpen = () => js(`!!document.querySelector('[data-testid="ceremony-dialog"]')`);

/** The court's frame rate for `seconds`: every frame its page draws (Unity draws on requestAnimationFrame). */
async function fps(seconds) {
  await js(`(() => { const w = document.querySelector("iframe").contentWindow; w.__fps = []; let last = 0;
    const f = (t) => { if (last) w.__fps.push(t - last); last = t; if (w.__fpsOn) w.requestAnimationFrame(f); };
    w.__fpsOn = true; w.requestAnimationFrame(f); })()`);
  await sleep(seconds * 1000);
  const d = await js(`(() => { const w = document.querySelector("iframe").contentWindow; w.__fpsOn = false; return w.__fps; })()`);
  const sorted = [...d].sort((a, b) => a - b), total = d.reduce((a, b) => a + b, 0);
  const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  return { seconds: +(total / 1000).toFixed(1), frames: d.length, fps: +(d.length / (total / 1000)).toFixed(1), p50ms: +pct(0.5).toFixed(1), p95ms: +pct(0.95).toFixed(1), over50ms: d.filter((x) => x > 50).length };
}

/**
 * Pictures on the court's own lines while it plays, until `until` matches or ms pass. Only lines that come
 * after it starts looking count (a picture is taken on its moment, never late); `from` bounds `until`.
 */
async function watch(from, wanted, until, ms) {
  const taken = new Set();
  const t = Date.now();
  while (Date.now() - t < ms) {
    for (const [re, name, why, delays] of wanted) {
      if (taken.has(name)) continue;
      const l = lines.find((x) => x.at >= t && re.test(x.text));
      if (!l) continue;
      // The point's close-ups and replay play over a between-points shot: pictures through it, as it plays.
      const due = (Array.isArray(delays) ? delays : [delays]).map((d, i) => [d, i]).filter(([d, i]) => !taken.has(`${name}#${i}`) && Date.now() >= l.at + d);
      for (const [, i] of due) { await shot(Array.isArray(delays) ? name.replace(".png", `-${(delays[i] / 1000).toFixed(1)}s.png`) : name, why); taken.add(`${name}#${i}`); }
      if ((Array.isArray(delays) ? delays : [delays]).every((_, i) => taken.has(`${name}#${i}`))) taken.add(name);
    }
    if (until && lines.some((x) => x.at >= from && until.test(x.text))) break;
    await sleep(250);
  }
  return taken;
}

try {
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => { const make = Document.prototype.createElement; Document.prototype.createElement = function (t, o) { const e = make.call(this, t, o); if (String(t).toLowerCase() === "audio") (window.__audios ||= []).push(e); return e; }; })();` });
  await go("/");
  await js(`localStorage.setItem("vbe-court-control-mode", "auto"); localStorage.removeItem("vbe-court-camera"); localStorage.removeItem("vbe-court-skips"); localStorage.setItem("vbe-court-banner", "We love the Riptide")`);
  await send("Page.reload"); await sleep(2500);
  check("CONTINUE on the title screen", await g.continueTitle());
  const matchId = await g.firstMatchDay();

  // ── A. a whole watched career match ──────────────────────────────────────────
  await go("/", 2500);
  let watched = false;
  for (let i = 0; i < 60 && !watched; i++) {
    watched = await js(`(() => { const b = [...document.querySelectorAll('[data-testid="match-day-box"] button')].find(x => /Watch/i.test(x.textContent)); if (b && !b.disabled) { b.click(); return true; } return false; })()`);
    if (!watched) await sleep(500);
  }
  check("Watch Match on the match day box", watched, `match ${matchId}`);
  const fromA = Date.now();
  const startedA = await waitFor(/match starts/, 300000, fromA);
  check("the career match started on the court", !!startedA, startedA?.text.split("\n")[0] ?? "");
  const banners = await waitFor(/\[CrowdBanners\] \d+ banners up/, 60000, fromA);
  check("the crowd's banners are up, the player's own among them", /We love the Riptide|WE LOVE THE RIPTIDE/i.test(banners?.text ?? ""), banners?.text.split("\n")[0] ?? "");
  await waitFor(/\[Point\] decided/, 120000, fromA);
  await sleep(1500);
  await shot("a-tv-in-play.png", "the TV look in play");
  g.summary.fpsCareer = await fps(30);
  check("the career match's frame rate (30 s, the TV look)", g.summary.fpsCareer.fps > 30, JSON.stringify(g.summary.fpsCareer));
  const taken = await watch(fromA, [
    [/\[Director\] Between: the band/, "a-band.png", "the band, from the director's shot", [1500, 3500, 5500]],
    [/\[Director\] Between: the commentary booth/, "a-booth.png", "the commentary booth, from the director's shot", [1500, 3500, 5500]],
    [/\[Director\] cutaway: the drinks break/, "a-drinks-break.png", "the drinks break", 1500],
    [/\[Director\] Between: the crowd/, "a-crowd-banners.png", "the crowd and its banners", [1500, 3500, 5500]],
  ], /\[Match moments\] celebration (took|skipped)/, 40 * 60000);   // the last point's shots come after the result is sent
  for (const [name, what] of [["a-band.png", "the band shot"], ["a-booth.png", "the commentary booth shot"], ["a-drinks-break.png", "the drinks break"], ["a-crowd-banners.png", "the crowd shot (banners)"]])
    check(`the career match showed ${what}`, taken.has(name));
  const ended = await waitFor(/\[Match moments\] celebration|match-result ok/, 20 * 60000, fromA);
  check("the career match played to its end", !!ended, ended?.text.split("\n")[0] ?? "");
  const reported = await waitFor(/\[MatchReporter\] POST \/api\/unity\/match-result ok/, 120000, fromA);
  check("and the court reported the result to the career", !!reported, reported?.text.split("\n")[0].slice(0, 160) ?? "");
  await sleep(6000);
  await shot("a-result.png", "the end of the match");

  // ── B. an Exhibition match from the pick screen ─────────────────────────────
  // A career ceremony waiting (planted in this copy of the DB): it must open on the dashboard, never over an exhibition.
  const careerSaveId = (await g.call("GET", "/careers")).data?.activeCareerSaveId;
  const today = (await g.call("GET", "/calendar")).data?.currentDate ?? "2026-01-02";
  const dbw = new DatabaseSync(g.db);
  dbw.prepare("INSERT OR IGNORE INTO career_ceremonies (career_save_id, event, season_year, ready_on) VALUES (?, 'world_finals', 2026, ?)").run(careerSaveId, today);
  dbw.close();
  await go("/", 4000);
  check("(set-up) a career ceremony is waiting: it opens on the dashboard", await ceremonyOpen());
  await go("/exhibition", 5000);
  check("no career ceremony over the exhibition's pick screen", !(await ceremonyOpen()));
  // Home: a custom team; player 1 in tropical hibiscus (as Rob painted it) and blue mirror sunglasses,
  // player 2 in polka dots recoloured hot pink and white, amber sunglasses; the AI plays all four.
  await setSelect("", "Home team", "custom"); await sleep(500);
  for (const i of [0, 1]) await setSelect(`[data-testid="ex-player-${i}"]`, "Who plays her", "-1");
  await setSelect('[data-testid="ex-player-0"]', "Print", "tropical-hibiscus"); await sleep(300);
  await setSelect('[data-testid="ex-player-0"]', "sunglasses", "sunglasses"); await sleep(300);
  await setSelect('[data-testid="ex-player-0"]', "sunglasses lenses", "blue-mirror");
  await setSelect('[data-testid="ex-player-1"]', "Print", "polka-dots"); await sleep(300);
  await js(`document.querySelector('[data-testid="ex-player-1"] button[aria-label="Swimwear colour 1"]').click()`); await sleep(400);
  await js(`document.querySelector('[data-testid="colour-palette"] button[aria-label="Hot pink"]').click()`); await sleep(300);
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }); await sleep(300);
  await setSelect('[data-testid="ex-player-1"]', "sunglasses", "sunglasses"); await sleep(300);
  await setSelect('[data-testid="ex-player-1"]', "sunglasses lenses", "amber");
  await setSelect("", "Time of day", "midday");
  await js(`document.querySelector('[data-testid="ex-player-0"]').scrollIntoView({ block: "center" })`);
  await shot("b-pick-screen.png", "the pick screen: a custom team in Rob's prints, tinted sunglasses");
  const fromB = Date.now();
  await js(`document.querySelector('[data-testid="exhibition-play"]').click()`);
  const startedB = await waitFor(/match starts/, 240000, fromB);
  const at = await js("location.pathname + location.search");
  check("Play: the exhibition starts on the court, the AI playing all four", !!startedB && /\/exhibition\/court\?exhibitionId=/.test(at) && !/played=1/.test(at), at);
  const exId = new URLSearchParams(at.split("?")[1]).get("exhibitionId");
  const st = (await g.call("GET", `/unity/exhibition-state?id=${exId}`)).data;
  const p0 = st.players?.[0], p1 = st.players?.[1];
  check("the game's view: Rob's prints and the tinted sunglasses",
    p0?.swimwear?.printFile === "hibiscus-tropical-on-black.jpg" && p1?.swimwear?.printFile === "polka-dots-red-white.png" && p1.swimwear.colours[0] === "#ff2d8a"
    && p0.wear.find((w) => w.part === "SK_BG_SUNGLASSES")?.lens === "blue-mirror" && p1.wear.find((w) => w.part === "SK_BG_SUNGLASSES")?.lens === "amber",
    `${p0?.swimwear?.printFile} ${JSON.stringify(p0?.wear)}; ${p1?.swimwear?.printFile} ${p1?.swimwear?.colours} ${JSON.stringify(p1?.wear)}`);
  const dressed = await waitFor(/exhibition: Player_A2 swimwear .*polka-dots-red-white #FF2D8A/, 30000, fromB);
  const dressedA1 = lines.find((l) => l.at >= fromB && /exhibition: Player_A1 swimwear .*hibiscus-tropical-on-black as painted/.test(l.text));
  check("the court wears them (Rob's prints loaded from the game)", !!dressed && !!dressedA1, `${dressedA1?.text.split("\n")[0] ?? ""} | ${dressed?.text.split("\n")[0] ?? ""}`);
  const lens = lines.filter((l) => l.at >= fromB && /SK_BG_SUNGLASSES \((blue-mirror|amber) lenses\)/.test(l.text)).map((l) => l.text.split("\n")[0]);
  check("and the sunglasses in their tints", lens.some((t) => /blue-mirror/.test(t)) && lens.some((t) => /amber/.test(t)), lens.join(" | "));
  check("no career ceremony over the exhibition match", !(await ceremonyOpen()));
  await waitFor(/\[Point\] decided/, 120000, fromB);
  await sleep(1500);
  await shot("b-tv-in-play.png", "the exhibition in the TV look");
  // The song: from the band's stage, at its loudness where the camera is, under the player's own level.
  const level = await js(`(() => { try { const m = JSON.parse(localStorage.getItem("bve.music") || "{}"); const v = JSON.parse(localStorage.getItem("vbe-court-volume") || "{}"); return (m.volume ?? 0.4) * (v.master ?? 1); } catch { return 0.4; } })()`);
  const samples = [];
  for (let i = 0; i < 12; i++) { samples.push((await js(audio))?.volume); await sleep(2500); }
  const a = await js(audio);
  check("the song plays from the band's stage at its loudness, not full volume", a?.playing === true && samples.every((v) => v > 0 && v < level), `player's level ${level}; the song over 30 s: ${samples.join(", ")}`);
  g.summary.fpsExhibition = await fps(30);
  check("the exhibition's frame rate (30 s, the TV look)", g.summary.fpsExhibition.fps > 30, JSON.stringify(g.summary.fpsExhibition));
  await watch(fromB, [[/\[Director\] cutaway: the scorer|cutaway: the other side/, "b-close-up.png", "a close-up between points", 800]], null, 120000);
  check("still no career ceremony over the match", !(await ceremonyOpen()));
} catch (e) {
  g.fail(e);
} finally {
  await g.close();
}
console.log(JSON.stringify({ ok: g.ok, fpsCareer: g.summary.fpsCareer, fpsExhibition: g.summary.fpsExhibition, checks: g.summary.checks.map((c) => `${c.pass ? "PASS" : "FAIL"} ${c.label}`) }));
process.exit(g.ok ? 0 : 1);
