/**
 * 1.2 section 10 (29 Nov 2026): every venue's frame rate at every time of day, in the WebGL build in
 * headless Chrome on the PC's GPU (as section 2 measured the island), with each venue's bundle size and
 * load time from the court's own log.
 *
 * The built game (production, as the packaged game serves it, or a package's own files with --packaged DIR)
 * on a copy of the starter DB. For each venue and time of day, an exhibition is made through the game's own
 * API (Sydney Riptide's pool teams, the AI playing all four, sunny) and opened on the court
 * (/exhibition/court?exhibitionId=...). Once the match has started and the walk-on is over, every frame the
 * court draws is counted for N seconds in the TV look, and a picture taken.
 *
 * Usage: node scripts/webgl-proof/venues-fps-10.mjs <outDir> [--seconds 30] [--venues a,b] [--times morning,night] [--packaged DIR]
 * Writes summary.json (and fps-VENUE-TIME.png); prints the table.
 */
import fs from "node:fs";
import path from "node:path";
import { builtGame, sleep } from "./built-game.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const outDir = path.resolve(args[0] ?? "venues-fps");
const SECONDS = Number(opt("--seconds", "30"));
const VENUES = opt("--venues", "oceania,north_america,south_america,europe,asia,africa_middle_east").split(",");
const TIMES = opt("--times", "morning,midday,sunset,night").split(",");

const g = await builtGame({ outDir, ports: { api: 4251, cdp: 9381 }, width: 1920, height: 1080, production: true, packaged: opt("--packaged", null), managerName: "Venue FPS" });
const { call, js, go, lines, waitFor, shot } = g;
g.summary.runs = [];

async function fps(seconds) {
  await js(`(() => { const w = document.querySelector("iframe").contentWindow; w.__fps = []; let last = 0;
    const f = (t) => { if (last) w.__fps.push(t - last); last = t; if (w.__fpsOn) w.requestAnimationFrame(f); };
    w.__fpsOn = true; w.requestAnimationFrame(f); })()`);
  await sleep(seconds * 1000);
  const d = (await js(`(() => { const w = document.querySelector("iframe").contentWindow; w.__fpsOn = false; return w.__fps; })()`)) ?? [];
  const sorted = [...d].sort((a, b) => a - b), total = d.reduce((a, b) => a + b, 0);
  const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
  return { seconds: +(total / 1000).toFixed(1), frames: d.length, fps: total ? +(d.length / (total / 1000)).toFixed(1) : 0, p50ms: +pct(0.5).toFixed(1), p95ms: +pct(0.95).toFixed(1), over50ms: d.filter((x) => x > 50).length };
}

try {
  await go("/", 2500);
  await js(`localStorage.setItem("vbe-court-control-mode", "auto"); localStorage.removeItem("vbe-court-camera"); localStorage.removeItem("vbe-court-skips")`);
  await g.continueTitle();
  const o = (await call("GET", "/exhibition/options")).data;
  const t = o.teams[0], u = o.teams[1];
  const team = (x) => ({ poolTeamId: x.id, name: x.name, primary: x.primary, secondary: x.secondary, players: x.players.map((id) => ({ poolPlayerId: id, name: o.players.find((p) => p.id === id).name, wear: [] })) });
  for (const venue of VENUES) {
    for (const time of TIMES) {
      const made = await call("POST", "/exhibition", { home: team(t), away: team(u), venue, timeOfDay: time, weather: "sunny", difficulty: "medium", seats: [-1, -1, -1, -1] });
      if (made.status !== 200 && made.status !== 201) { g.summary.runs.push({ venue, time, error: `exhibition refused: ${made.status} ${JSON.stringify(made.data)}` }); continue; }
      const from = Date.now();
      await go(`/exhibition/court?exhibitionId=${made.data.id}`, 500);
      const started = await waitFor(/match starts/, 300000, from);
      const loaded = lines.find((l) => l.at >= from && /\[Venue\] .* in after/.test(l.text))?.text ?? "";
      const asked = lines.find((l) => l.at >= from && /\[Venue\] '.*' is /.test(l.text))?.text ?? "";
      const m = loaded.match(/\[Venue\] (\S+) \(([^)]*)\) in after ([\d.]+)s, ([\d.]+) MB/);
      if (!started) { g.summary.runs.push({ venue, time, error: "the match never started", loaded, asked }); continue; }
      await sleep(14000);   // the walk-on and the first serve
      const r = await fps(SECONDS);
      await shot(`fps-${venue}-${time}.png`, `${venue} at ${time}, the TV look`);
      const run = { venue, time, loadedVenue: m?.[1] ?? null, name: m?.[2] ?? null, loadSeconds: m ? +m[3] : null, bundleMB: m ? +m[4] : null, ...r, fallback: asked || null };
      g.summary.runs.push(run);
      console.error(`${venue} ${time}: ${r.fps} fps (median ${r.p50ms} ms, 95th ${r.p95ms} ms, ${r.over50ms} over 50 ms); loaded ${run.loadedVenue} ${run.bundleMB} MB in ${run.loadSeconds} s`);
    }
  }
} catch (e) { g.fail(e); }
await g.close();
const rows = g.summary.runs.map((r) => `| ${r.venue} | ${r.time} | ${r.error ? "ERROR " + r.error : `${r.fps} | ${r.p50ms} | ${r.p95ms} | ${r.over50ms} | ${r.bundleMB} MB, ${r.loadSeconds} s${r.loadedVenue !== r.venue ? ` (played at ${r.loadedVenue})` : ""}`} |`);
console.log(["| Venue | Time | fps | median ms | 95th ms | frames over 50 ms | bundle, load |", "|---|---|---|---|---|---|---|", ...rows].join("\n"));
