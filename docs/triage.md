# Triage — open items

Refreshed 3 September 2026. Branch `fix/continent-keys-and-roster-cleanup`,
pushed, not yet merged to main. Working tree clean.

Since the last refresh: attached_assets deduplicated (1236 files -> 558,
2.38 GB -> 1.01 GB) and the §1a caption audit completed across all 204 cards.

## Where things stand

```
[check-continents]  OK — every continent value is a canonical key
[check-roster]      OK — the database matches the declared world
harness             5/5 suites, 39 smoke checks, 32 guard self-tests
```

| | |
|---|---|
| seniors | 192 — every core nation on exactly 3 |
| youth | 72 — 12 per region, all core nations, all aged 14–17 |
| spares | 12 parked, nothing deleted |
| staff | 120 — 12 roles × 10, every one its own face |
| squad rule | 2 starters + 1 interchange + 1 youth, enforced and tested |
| world roster | declared as data in `continents.ts`, guarded by `check-roster.cjs` |
| installer | 686 MB (was 1,780 MB) |

**Closed yesterday:** continent keys across 8 vocabularies · both club pickers ·
the Player Market continent filter · Europe's 9 missing players · Lucía
Martínez's misfiling · Amira El Mansouri's and Mere Bainivalu's portraits · all
10 fitness trainer portraits · Venezuela's shared card · 4 duplicate staff
names · 36 male-named youth · squad size · the 15 off-roster youth ·
double-packaged Unity build.

---

## 1. Artwork — the one class still open

**A filename is not evidence. Only the caption inside a card says who it is.**
Proven wrong four separate times: Morocco, Venezuela, Papua New Guinea, and all
ten fitness trainers (a perfect `_01`↔`_10` reversal).

### 1a. Caption audit — DONE and GUARDED. See `docs/caption-audit.md`.
All 204 senior and spare cards were opened and read against their row.
**200 were correct; 2 of the 4 faults are now fixed, 2 need new art.**

Fixed in the database and in the seed scripts, so a re-seed cannot undo them:

- **`greece_03`** — row renamed `Elena` → **`Eleni Papadopoulou`**, matching
  her card. Deliberately restores two Greek players of that name; they have
  different ages and heights, and nothing keys off name.
- **`papua_new_guinea_03`** — Mere Bainivalu's position `spiker` →
  **`all_rounder`**, matching her card.

Still open, and **not fixable from inside this repo**:

- **`indonesia_02`** — shows Sinta Wulandari; Dewi Lestari has no card.
- **`laos_02`** — shows Keovilay Phommachanh; Bouavanh Sisouvanh has no card.

The unshipped originals in `attached_assets` carry the same wrong captions and
the seed scripts assign exactly those files, so the art was generated wrong at
source. Renaming the rows to match would put two identically-named players in
one nation with conflicting stats, which is worse. **These need two new
renders.** `morocco_02` (Zineb Ouadi, spare) stays parked and inert.

**A build guard now holds all of this: `scripts/check-captions.cjs`**, in
`pnpm typecheck`. It pins each card's sha1 to the identity read off it, so
regenerating or swapping a portrait fails the build until the new card is read.
The three known-wrong cards are recorded as such and asserted to still be
exactly that problem. Four self-test cases in `harness/guard-selftest.mjs`
(now 36/36).

**Do not add a card-vs-row position comparison** — the cards use FIVB names
(Outside Hitter, Libero, Middle Blocker) that do not map onto the database
values. It would fire on ~30 correct cards.

### 1b. Kiriwina Tau's portrait — cosmetic
Correctly captioned, but built from an `asia_01` render re-kitted as PNG.
`attached_assets/player_senior_png_09.webp` is byte-identical to
`player_senior_oceania_09` — her genuine original. Swap if you want PNG fully
authentic. No functional impact.

### 1c. PNG content in the images tree — DONE, 3 September 2026
The note said "four `.png` files among 200 `.webp`" and that there was no webp
encoder on this machine. Both turned out to be wrong.

`pnpm install` provides **sharp** (a devDependency of `@workspace/scripts`), so
there is an encoder. And a format audit found **25** files carrying PNG bytes,
not four: the four honest `.png`, a stray unreferenced `hero-women-volleyball.png`,
and **twenty wearing a `.webp` extension over a PNG header** — nine senior
cards, all ten fitness trainers and a youth card. Together 52.2 MB of a 71 MB
tree, each about 2 MB where the same picture as real WebP is under 200 KB.

Nothing looked broken, which is why it survived: browsers and Electron sniff
content rather than trusting the extension, so every picture rendered. The only
symptom was an installer far heavier than it needed to be.

All 25 re-encoded at q=82 — chosen by measurement, not taste: the 402 cards
already shipping as real WebP sit at 0.92–0.94 bits per pixel and q=82
reproduces 0.93 bpp on these sources. Dimensions untouched; downscaling is a
visual decision and was not made. **`public/images`: 71 MB → 21 MB.**

The four `.png` seniors were renamed to `.webp` with `image_url`, the seed
scripts and `captions.json` updated together, and **all 13 changed senior cards
were re-opened and their captions re-read** before the guard was re-pinned —
a changed sha1 means the recorded reading no longer describes the file, and
re-pinning without looking would defeat the guard entirely. Two of those writes
also replaced the superseded, unreferenced `venezuela_02/03.webp`.

**Guarded by `scripts/check-image-formats.cjs`**, wired into `pnpm typecheck`.
It reads magic numbers directly — no image library, so the guard cannot rot
behind a dependency — and fails if any extension disagrees with its content.
Three self-test cases in `harness/guard-selftest.mjs` (now 39/39).
`scripts/normalise-image-formats.cjs --write` is the fixer.

### 1d. Zineb Ouadi shares Salma El Idrissi's picture — parked, inert
She is `player_type='spare'` and never displayed. Only matters if unparked.

---

## 2. Data-shape leftovers

- **`/players/validation` — DONE, 3 September 2026.** It asserted 60 seniors and
  60 youth at ten per continent against a world of 192 and 72, so it reported a
  phantom failure. Nothing in the frontend calls it, which is why nobody noticed.

  The numbers were not just stale, they were the wrong *kind* of assertion: the
  endpoint runs against a career in progress, where seniors retire, youth are
  promoted and everyone ages at each boundary. Totals are supposed to move, so a
  fixed expected count could only ever be right on day one of a new save.

  Rewritten to assert only what holds at every point in a career, all of it
  derived from what `continents.ts` declares rather than restated — nothing
  hardcodes "ten" or "three": canonical continent keys, nationalities inside the
  declared world, a youth's nationality being a core nation *of her own region*
  (the promotion trap), and ages within band. Counts are **reported**, not
  asserted, alongside the `declared` shape they were checked against.

  Six assertions in `harness/fresh-install.mjs` now run it on a real career
  every build. The rules themselves already have negative fixtures via
  `check-roster.cjs`; what was missing was anything exercising them live.

  **It immediately found something.** Martha Kera (Solomon Islands) ships at 37
  with `RETIREMENT_AGE = 34` — six years older than any other senior, the next
  oldest being 31. Her card says 37, so the age matches the artwork rather than
  being a typo. Reported as `activePastRetirementAge`, not failed, because the
  season boundary retires her by design. Open question in §3.
- **Staff nationalities — DONE, 3 September 2026.** 19 demonyms among 56 values,
  and the same disease was in `continental_pool_players` (14 more), which this
  note did not know about. The harm was not cosmetic: Norway *and* Norwegian,
  Poland *and* Polish, Singapore *and* Singaporean all existed at once, so
  anything grouping or counting by nationality saw two nations where there is
  one. 91 rows normalised across the two tables; staff went from 56 distinct
  values to 39. Fixed in the database and in 19 seed scripts, several of which
  would have reintroduced demonyms — and off-roster nations — on a re-seed.
  `DEMONYM_TO_COUNTRY` in `continents.ts` records what each one was taken to
  mean, and **`check-continents.cjs` now fails the build on any of them**,
  discovering nationality columns from the schema so a new table is covered
  without anyone remembering. Negative fixture added (40/40).
- **13 unused senior images ship** — the 12 spares, plus `peru_04`. The two
  superseded Venezuela `.webp`s are gone: the §1c conversion wrote the correct
  `.png` sources over them.
- **Two dead asset folders — DONE, 3 September 2026.** Confirmed dead and
  deleted: nothing in the database, frontend, api-server or electron referenced
  `images/staff/medical_physiotherapist` or `images/staff/medical_science`, and
  every file in them was byte-identical to one in the live `physiotherapist` /
  `sports_scientist` folders (9/9 and 8/8). Nothing regenerates them —
  `local-image.ts` only ever writes under `images/players/`.

- **79 loose staff images at the root of `images/staff/` — NOT deleted, needs a
  decision.** Found while confirming the above. They sit outside the role
  subfolders the database points at, so nothing references them, but unlike the
  dead folders they are **unique content**: 600x400 landscape crops where the
  referenced files are 600x800 portrait, and no copy exists in
  `attached_assets` by hash. 2.3 MB. Deleting is reversible through git
  history, but it is the only copy in the tree, so it is a call rather than
  a cleanup — they may be intended for a landscape staff card that does not
  exist yet. `player_senior_peru_04.webp` is the one unreferenced senior image
  in the same position.

---

## 3. Design questions you raised, still open

### 3w. The academy never refills — checked 3 September 2026, NOT fixed
Asked for directly: "check that there are new players spawned in youth each
year as we need to replace retiring players." **There is no youth intake.**

`rolloverSeason` does exactly three things to the roster at a boundary:
**age → retire → promote**. Nothing creates a youth player. The only code in
the server that inserts `player_type: 'youth'` is in `routes/dev.ts`, a test
route.

So the academy is a fixed pool that drains and never refills:

| | start | end of a 5-season arc |
|---|---|---|
| academy (youth) | 72 | **0** |
| seniors | 192 | ~263 (192 + 72 promoted − 1 retired) |

The starter youth are 14–17 and `PROMOTION_AGE` is 19, so every one of the 72
crosses it inside the arc — the rollover harness already reports "72 promoted
seniors". After that the pipeline the design leans on is empty.

**The draft is not the answer as it stands.** `POST /draft/generate-class`
does generate 30 players, but:

- it is **manual** — nothing in the season boundary calls it, and no frontend
  caller for `generate-class` was found
- every generated player has **`imageUrl: null`**, so they are faceless in a
  game whose whole player identity is the portrait card
- ages are 17–20, straddling the youth/senior line rather than feeding the
  academy
- nationalities come from a hardcoded `YOUTH_NATIONALITIES` list **duplicated
  verbatim in `routes/dev.ts`** — a ninth vocabulary — and it contains
  off-roster nations (South Korea, Ghana, Denmark, Norway, Sweden). That is
  the stranded-nation trap `check-roster.cjs` guards against in the starter
  data, reintroduced at runtime.

Decisions needed before this can be built: does intake feed the **academy**
(youth, ageing in) or the **draft pool**? How many per season? Where do their
portraits come from — the 12 parked spares are the only unused real cards, and
they run out immediately. Until portraits are solved, any intake ships faceless
players.

### 3x. Seniors cannot retire before the age cap — NOT implemented
Stated as intent: "senior players can also retire before 40, they just can't
play on after 40." Today 40 is the *only* automatic retirement. There are
exactly three paths that set `isRetired`:

1. `retireAgedPlayers` at the boundary — the hard age cap, nothing else
2. a manual retire endpoint in `routes/players.ts` — manager-initiated
3. `routes/draft.ts` using `isRetired: true` as a **tombstone** for stale
   unclaimed draft players, which is a misuse of the flag rather than a
   retirement

Nothing retires a senior early for form, injury, morale or choice. Combined
with the cap at 40 (§3z), the shipped world retires **one** player across a
five-season career. If early retirement is wanted, it needs a trigger — and
the `isDraftPlayer` tombstone in (3) should stop borrowing the same flag, or
early-retirement logic will pick up stale draft rows as retirees.

### 3y. Do skin tone and kit colour follow the team in Unity? — TO CHECK
Rob's note, no hurry, flagged for a later pass. The 2D card art is fixed per
player, but the Unity live-match view renders athletes separately. Worth
confirming that a player keeps her own skin tone when she changes club, and
that the bikini/kit colour follows the **team** she is playing for rather than
being baked into the model. A player who changes skin tone on transfer, or a
whole court in one nation's kit, is the kind of thing that only shows up in a
real match and never in a guard. Unity-side, so it needs the WebGL build
running, not a database query.


### 3z. Martha Kera vs the retirement age — RESOLVED 3 September 2026
Found by the rewritten `/players/validation`: she shipped at 37 against
`RETIREMENT_AGE = 34`, the only senior at or past it, with the next oldest at
31. Her card reads 37, so the database matched the artwork.

**Resolved by raising `RETIREMENT_AGE` to 40** (Rob's call). Recorded here
because it is a mechanic change, not a tuning tweak, and the cost is real:

| threshold | seniors retiring per season, 5-season arc | total |
|---|---|---|
| 34 (was) | 1, 0, 2, 1, 5 | 9 |
| 38 | 1, 0, 0, 0, 0 | 1 |
| **40 (now)** | **0, 0, 1, 0, 0** | **1** |

The one retirement at 40 *is* Martha Kera, in season three. Nobody else in the
world ever reaches the threshold, so retirement is effectively off for a
five-season career. `retireAgedPlayers` still runs at every boundary and is
still tested — it just has almost nothing to act on.

If retirement should bite again without moving the number back, the lever is
the roster's age spread rather than the threshold: the world would need seniors
in their mid-to-late thirties instead of one outlier at 37.

`harness/rollover.mjs` no longer hardcodes the threshold — it reads
`declared.retirementAge` from `/players/validation`, so moving the constant can
no longer leave the harness asserting the old rule and still passing.

### 3a. Do the AI clubs need a reserve?
The squad rule is 2 + 1 + 1 for **your** club. The 60 AI pool teams still carry
**2 athletes each** in a separate table. That is fine for match simulation —
beach volleyball is played two-a-side — but if AI clubs should mirror the
player's squad, that is **+60 athletes** (one reserve each). They are never
rendered as cards, so it is generation, not art.

### 3b. A qualifying competition into the continental game
You already have a ladder: 24 promotion-pool teams (4 per region) sit under the
36 league teams, and `resolveRegionalSeason` promotes the top pool team while
relegating the bottom league team each season. The open question is whether you
want a qualifying tournament **in front of** that, or whether
promotion/relegation is enough.

### 3c. The cheapest expansion is already built
**Maldives, Malta, Russia and Ireland** each hold a full trio and are declared
in `RESERVE_NATIONS`. Moving them into `CORE_NATIONS` makes them playable with
no new players and no new art — Asia to 11 nations, Europe to 13. Monaco has 1
player and would need 2 more.

Adding thirty players for a DLC is ten nations appended to `CORE_NATIONS` plus
their players. `check-roster.cjs` follows the declaration, so nothing else
changes — and a half-landed expansion fails the build naming the shortfall.

---

## 4. Phase 8 — exercise the screens

Recorded in full in `economy-design.md`. **No guard renders a screen**, and
every bug this week lived between a correct API response and what the player
saw. The club picker returned all ten clubs on every build and drew seven. The
picker existed **twice**; fixing one changed nothing visible. That was found by
opening the app, not by any check.

1. **Component tests** (Vitest + Testing Library) over `NewCareerModal` — the
   cheapest, catches this exact class. ~1 day, no new infrastructure.
2. **One Playwright pass over career creation** — the only thing that tests a
   rendered screen. `run-all.mjs` already does the server/DB fixture work.
   2–3 days.
3. **Route-mounting smoke pass** — nearly free once (2) exists.

---

## 5. Housekeeping

- **Merge the branch to main** — 8 commits, pushed, green.
- **Install and launch the new 686 MB installer once.** It has been built and
  its contents verified, but never run. A packaged app that boots is not proven
  until someone boots it.
- **Youth flags: settled — keep the letters.** Windows ships no country-flag
  emoji, so `🇫🇯` renders as `FJ`. The Olympics and job-market screens have the
  same fallback, so letters are at least consistent. Real flags means bundling
  ~60 SVGs across every screen, as its own job.
- **Unity sizing is done.** `before-pack.cjs` strips the raw payloads,
  `precompressedUnityAssets.ts` serves the `.br`. Further savings mean a smaller
  Unity export, not packaging changes.
