# Weekend status — unattended batch (12–13 Sep 2026)

Written as the run goes. Rules: `docs/REPAIR-REGISTER.md` rules of engagement; never
write to the live save; commit per item; decisions that change **game design** go in
**Open questions for Rob** below — everything else, act on the recommendation and
record why.

Order of work: **R-40** (WebGL renders an empty court) → **R-29** (honest AI
competitors) → **R-10** (design-screens audit, read-only) → **Unity items**
(MatchManager ratings ingestion, scene archive, conditional rebuild).

---

## Correction carried in from Friday

On Friday I said the Forward-vs-Forward+ question had been written into this file. It
had not — no such file existed until this run created it. The question was answered
in chat regardless (option 1 first, then force Forward if the court is still empty),
so nothing was lost, but the claim was wrong.

---

## R-40 — WebGL build renders an empty court (HIGH)

**DONE — the court renders.** Full write-up in `docs/REPAIR-REGISTER.md` R-40.

- **Reproduced before fixing.** The eebb029 build, pulled back out of LFS and served
  the same way, shows exactly Rob's screen — sky, court lines, net pole, labels, no
  sand/venue/crowd/players — on SwiftShader **and** on the real GPU
  (`ANGLE (NVIDIA GeForce RTX 5080 … Direct3D11)`): bottom half 51.5% sky-blue, 0.1% sand.
- **New build:** bottom half 0.6% sky-blue / 43.6% sand, mean RGB (207,188,164) on the
  real GPU; same on SwiftShader. Loader logged `careerSaveId 9 (from page URL)`, four
  per-player lines, `applied 4 of 4 player(s)`. **0 console errors** in all four runs.
- **Which change fixed it: the rebuild itself — not the revert, not Forward.** The
  766ebc1 revert was undone by URP before any shader compiled (its pre-build prefilter
  pass rewrote the three assets back to the 1075031 values at 07:30:56; the build
  compiled Lit at log line 13956). Forward (mode 0) was never needed, so the renderer
  stays Forward+. The measurable difference is the shipped URP/Lit ForwardLit variant
  set: **160 in the broken build, 240 in the new one**. Why the 11 Sep build's keyword
  prefilter came out differently is not proven — recorded as inference, not fact.
- **Hypothesis correction:** the suspected migration commit `1075031` is not the cause;
  the working build was built with exactly those settings.
- Commits: game repo `195e769` (build + `scripts/webgl-proof/` + register), Unity `ea6eb5e`
  (the settings the build derived; the three URP assets are unchanged from `1075031`) and
  `9c823c9` (UNITY-STATUS). All pushed.
- Proof screenshots: `proof/webgl_court.png` (+ `_gpu`, and the
  `webgl_court_eebb029_control*.png` pair) in the Unity checkout. `proof/` is gitignored
  there by design, so they are **on this machine only**. `ea6eb5e`'s commit message wrongly
  says it carries them. Proof tooling now lives in the game repo at
  `scripts/webgl-proof/` (Playwright is not installed; it drives the installed Chrome
  over the DevTools Protocol with Node 24's native WebSocket).
- The proof server always boots against a **copy** of the live save — the api-server's
  boot passes write, so the live file is never opened.
- Harness: unity-match-state-payload 9/9, unity-career-scoping 15/15, fresh-install 40/40.

---

## R-29 — honest AI competitors

*In progress.* Design written first: `docs/r29-design.md` (what exists today, the design, every
screen and query that changes, and the harness).

## R-10 — design-screens audit

**DONE — read-only report: `docs/r10-audit.md`.** No code changed for this item.

- Every page file: what it shows, what feeds it (hooks and endpoints), and what is dead,
  duplicated, mislabelled or fake. There is also a navigation map and a design-doc screen table.
- **Design-doc screens:** Finals, Season end and Start are built. Ranking screen, per-event
  Qualification, Tier status and Career Result are **not**. Fail state is partial and not
  verified stage by stage.
- **Worst findings** (registered as repairs, not fixed this weekend):
  1. **Nothing ever writes a trophy.** The Trophy Cabinet, "Titles Won" and the trophy news
     read a table no code inserts into.
  2. **World Tour News is mostly invented** (seeded RNG over hardcoded names), mixed
     indistinguishably with real items.
  3. **Manager Movements are random.** The **youth league** has the same one-club, random-result
     problem R-29 just fixed for seniors, including a fake form strip.
  4. **Job Market listings are hardcoded**, under a coming-soon notice.
  5. **The All-Star page can never show a match.**
  6. **`/dev/generation-test` ships in the desktop build** with its API unmounted.
  7. **Club tabs are mislabelled:** "Hall of Fame" shows the leaderboard.
  8. **Unlinked duplicate routes:** `/world-tour`, `/continental` and `/youth-results`.
- The 76-vs-62 season length is in §5 of the report, with the questions in Q2 below.

## Unity items

*Not started.*

---

## Open questions for Rob

*(game-design decisions only)*

**Q1 — R-29: is the World Tour field 18 or 19?** Not blocking: built one way, and changing it
is a single function (`worldTourField`).

The rules page says the World Tour is "18 teams total — 3 qualifying teams from each of the 6
continental regions", and your club plays every World Tour round on top of that. So the field
is **19**, and with an odd field one club has to sit out each round.

**Built as:** the 18 qualifiers + your club. One AI club rests per round, rotating, so each
rests 3 or 4 times across the 60 rounds; your club never rests, because the 62-match fixture is
already the contract. This means your harness line "after N rounds every AI club has played N
matches" cannot be literally true. The harness asserts instead that every AI club has played
exactly N minus its scheduled rests, and that exactly one club rests per round.

If you want an even field, two options:
- **(a)** your club takes one of the 18 places: 17 qualifiers + you;
- **(b)** a 19th qualifier, e.g. the best 4th-placed regional club: 19 + you = 20.

**Q2 — R-10: is a season 62 matches, and is there an All-Star match?** Not blocking; nothing
was changed either way.

`data/worldTour.ts` schedules 62 events: 60 World Tour rounds plus the semi final and final.
Older code and comments described 76. Remnants of an All-Star match are still in place:
- a tier in `FINALS_TIERS`
- a special case in the finals insert
- a whole page that can only ever say "Not Yet Scheduled"

but no All-Star event exists. Is 62 the intended season, with the All-Star remnants to be removed?
Or were the extra events, the All-Star match among them, meant to exist?

**Q3 — R-10: how should Olympic qualification work?** Not blocking.

The rules page says "Top 12 World Tour teams qualify". The code ranks **countries** by their top
two players' ratings, with a fixed number of spots per continent. Olympic results are rolled on
every page load, so the same tournament's scores can differ between two visits. Which rule is
intended? The fix follows from the answer.
