/**
 * 1.2 D4, D5, D6 (28 Nov 2026): the new pages in pictures, in headless Chrome, on the built game
 * (built-game.mjs: the api-server on a copy of the starter DB, the built pages, a career).
 *   1. the title screen, with the EXHIBITION GAME pill beside CONTINUE;
 *   2. the store as shipped, closed: no Store pill in the side menu, and /store goes back to the dashboard;
 *   3. opened (the harness switch, as flipping the settings file would): the pill, the store page, a
 *      hat bought in red (1.2 9b: the colour picker's Red) and worn (the wallet down by its price);
 *   4. the exhibition's pick screen, the worn hat already on the home team's first player;
 *   5. Settings > Match presentation, the player's banner typed in;
 *   6. Play on the pick screen: the WebGL court opens the exhibition (exhibitionId on its URL), dresses
 *      the players and starts the match.
 * Pictures and summary.json in <outDir>.
 *
 * Usage: node scripts/webgl-proof/pages-d4-d6.mjs <outDir>
 */
import path from "node:path";
import { builtGame, sleep } from "./built-game.mjs";

const outDir = path.resolve(process.argv[2] ?? "pages-d4-d6");
const g = await builtGame({ outDir, ports: { api: 4953, web: 4952, cdp: 9361 } });
const { call, js, shot, go, lines, check } = g;
try {
  await go("/");
  const pill = await js(`!![...document.querySelectorAll("button")].find(b => /exhibition game/i.test(b.textContent))`);
  check("the title screen has the EXHIBITION GAME pill", pill);
  await shot("d6-title-pill.png", "the title screen");
  await g.continueTitle();
  await sleep(2000);
  const closedPill = await js(`[...document.querySelectorAll("nav a")].some(a => a.getAttribute("href") === "/store")`);
  check("closed as shipped: no Store pill in the side menu", closedPill === false);
  await shot("d4-closed-menu.png", "the side menu with the store closed");
  await go("/store");
  check("closed: /store goes back to the dashboard", (await js("location.pathname")) === "/", await js("location.pathname"));

  await call("POST", "/dev/store/open", { open: true });
  await go("/");
  const openPill = await js(`[...document.querySelectorAll("nav a")].some(a => a.getAttribute("href") === "/store")`);
  check("opened: the Store pill is in the side menu", openPill === true);
  await go("/store");
  await sleep(1500);
  const before = await js(`document.querySelector('[data-testid="store-balance"]')?.textContent`);
  await shot("d4-store-page.png", "the store page");
  // The hat in red (the colour picker's Red), bought and worn.
  await js(`document.querySelector('button[aria-label="Sun hat colour 1"]').click()`);
  await sleep(500);
  await js(`document.querySelector('[data-testid="colour-palette"] button[aria-label="Red"]').click()`);
  await sleep(300);
  await js(`document.querySelector('[data-testid="buy-sun-hat"]').click()`);
  await sleep(1500);
  await js(`document.querySelector('[data-testid^="wear-"]')?.click()`);
  await sleep(1500);
  const after = await js(`document.querySelector('[data-testid="store-balance"]')?.textContent`);
  const owned = await js(`fetch("/api/store").then((r) => r.json()).then((d) => JSON.stringify(d.owned))`);
  check("bought in the picker's Red: the wallet down by the hat's price", /1000/.test(before) && /850/.test(after) && /#e11d2a/.test(owned), `${before} -> ${after}; ${owned}`);
  await shot("d4-store-bought.png", "the hat bought in red and worn");

  await go("/exhibition", 5000);
  const hatOn = await js(`[...document.querySelectorAll('[data-testid="ex-player-0"] select')].some(s => s.value === "sun-hat")`);
  check("the exhibition's pick screen: the worn hat on the home team's first player", hatOn === true);
  await shot("d6-pick-screen.png", "the exhibition pick screen");
  await call("POST", "/dev/store/open", { open: false });

  await go("/settings");
  await js(`(() => { const i = document.querySelector('[data-testid="crowd-banner"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(i, "We love the Riptide"); i.dispatchEvent(new Event("input", { bubbles: true })); })()`);
  await sleep(500);
  check("Settings: the player's banner is remembered", (await js(`localStorage.getItem("vbe-court-banner")`)) === "We love the Riptide");
  await js(`document.querySelector('[data-testid="crowd-banner"]').scrollIntoView({ block: "center" })`);
  await shot("d5-banner-setting.png", "Settings > Match presentation, the banner");

  // 6. Play an exhibition in the WebGL court.
  // The store is closed again, so nothing bought is worn; the hat is picked here, free, as in any exhibition.
  await go("/exhibition", 5000);
  await js(`(() => { const s = document.querySelector('[data-testid="ex-player-0"] select[aria-label="hat"]'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set; set.call(s, "sun-hat"); s.dispatchEvent(new Event("change", { bubbles: true })); })()`);
  await sleep(500);
  const from = Date.now();
  await js(`document.querySelector('[data-testid="exhibition-play"]').click()`);
  const started = await g.waitFor(/match starts/, 240000, from);
  const at = await js("location.pathname + location.search");
  check("Play: the court opens the exhibition", /\/exhibition\/court\?exhibitionId=/.test(at), at);
  const exId = new URLSearchParams(at.split("?")[1]).get("exhibitionId");
  const wear = await js(`fetch("/api/unity/exhibition-state?id=${exId}").then((r) => r.json()).then((d) => JSON.stringify(d.players[0].wear))`);
  check("the court's view of the game: the first player's worn hat", /"part":"[^"]*hat/i.test(wear), wear);
  const dressed = lines.filter((l) => l.at >= from && /\[UnityMatchDataLoader\] exhibition: Player_A1/.test(l.text)).map((l) => l.text.split("\n")[0]);
  check("the WebGL court put the hat on the first player", /wears .*hat/i.test(dressed[0] ?? ""), dressed[0] ?? "");
  check("and started the match", !!started, started?.text.split("\n")[0] ?? "");
  await sleep(12000);
  await shot("d6-webgl-court.png", "the exhibition in the WebGL court");
} catch (e) {
  g.fail(e);
} finally {
  await g.close();
}
console.log(JSON.stringify({ ok: g.ok, checks: g.summary.checks.map((c) => `${c.pass ? "PASS" : "FAIL"} ${c.label}`) }));
process.exit(g.ok ? 0 : 1);
