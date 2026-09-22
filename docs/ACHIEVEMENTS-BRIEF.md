# Steam Achievements — brief for Claude Code (22 Sep 2026)

Goal: the 22 in-game achievements unlock on Steam too. In-game side already exists
and is not to be redesigned: `artifacts/api-server/src/utils/achievement-definitions.ts`
(22 defs, keys below) and `check-achievements.ts` (`checkAchievements()` returns the
keys newly unlocked this call). Steam side: **zero code exists** — nothing in
`electron/main.js` or `package.json` references Steamworks.

Rules of engagement: one item at a time, show verification for each, harness green
before commit, live save never opened. The build Steam already has in review
(BuildID 25335748, v0.9.1) is NOT to be replaced — any new build goes to a separate
SteamPipe branch (see item 6). Rob decides whether it ships at launch or as the first
update.

## The 22 keys (Steam API names must be EXACTLY these)

first_steps, battle_hardened, century_wins, perfect_season,
tournament_winner, champion, world_champion, dynasty_begins, olympic_gold,
making_money, millionaires_club, debt_free, financially_secure,
talent_spotter, youth_pipeline, youth_graduate, youth_factory, future_superstar, star_factory,
local_legend, world_traveller, globe_trotter

Display names and descriptions come from `ACHIEVEMENT_DEFS` — generate a table
(key · name · description) as `docs/achievements-table.md` so Rob can copy each one into
Steamworks without retyping (item 0).

## Design

- Electron main process owns the Steam connection (it is the process Steam attaches to).
  Library: `steamworks.js` (napi-rs, prebuilt N-API binary — verify it loads under
  Electron 32 without an electron-rebuild step; if it needs one, that is the same ABI
  trap as better-sqlite3 — read docs/toolchain-gotchas.md first and prove the load with
  a one-line script before writing anything else).
- Init once at app start: `steamworks.init(5233750)`. If Steam is not running or init
  throws, the game must run exactly as today — no Steam is a normal condition
  (Rob's dev launches via `pnpm run electron:dev`). Log one line either way.
- Unlock path: api-server → Electron over the EXISTING fork IPC channel (the one
  `{ type: "shutdown" }` already uses in main.js ~line 439). Server sends
  `{ type: "achievement", key }` for each key `checkAchievements()` returns; main.js
  calls `client.achievement.activate(key)`. Never call Steam from the server process.
- Catch-up on boot: after Steam init, ask the server for every key already unlocked on
  the active profile's careers and activate any Steam doesn't have
  (`isActivated`). This is what gives Rob's existing saves their achievements and what
  the first-update path relies on. Achievements are per Steam account, not per career:
  unlocking in any career counts — say so in a comment.
- Dev testing needs `steam_appid.txt` containing `5233750` beside the exe / project
  root; it must NOT ship in the package (add to the after-pack guard like the sidecars).
- Packaging: steamworks.js must be unpacked from asar (`asarUnpack`) so
  `steam_api64.dll` loads; electron-builder `files` currently only lists
  `electron/**/*` — confirm the module ends up in the package (Gate 7 style file
  check, list the exact path).

## Items, in order

0. `docs/achievements-table.md` from ACHIEVEMENT_DEFS (no code change). Report the
   count: must be 22 — Rob has icon pairs (coloured + grey) and their count must match.
1. Prove `steamworks.js` loads in Electron 32 on the beast (script, output shown).
   If it can't be made to load cleanly, STOP and report — do not patch around it.
2. main.js: init + no-Steam fallback + IPC `achievement` handler + boot catch-up.
3. api-server: emit `achievement` messages at every `checkAchievements()` call site
   (grep for the callers; there is more than one) and a route/IPC reply for the
   catch-up list. Harness suite: `harness/achievement-ipc.mjs` proving the messages
   are emitted with the right keys (sabotage-proven, fixed check count).
4. Full harness ×3 identical fingerprints, typecheck, guards — same gates as R-80.
5. On-screen proof (Rob's): Steam client running, launch through Steam (dev branch)
   or with steam_appid.txt, win a first match → Steam overlay pops "First Steps".
   Then open Steam → game → Achievements: it's listed as unlocked.
6. New build → SteamPipe branch `achievements` (NOT default). Version 0.9.2.
   Default branch stays 25335748 until Rob says otherwise.

## Rob's clicks (Steamworks website, not code)

Edit Steamworks Settings → Stats & Achievements → Achievements → New Achievement,
one per row of the table: API Name = key, Display Name, Description, icons
(achieved = coloured, unachieved = grey; Steam wants 64×64 JPG/PNG), then
"Save" and "Publish" on the Steamworks Settings page. Store page tick "Steam
Achievements" under Supported Features is done LAST, and only after Valve has
approved the store page — don't touch the store page while it is in review.

## Decision gate

If item 5 is proven on screen by Tue 6 Oct, Rob can choose to promote the
`achievements` branch to default for the 13 Oct release. If not, launch on the
reviewed build and ship achievements as the first update the week after.
