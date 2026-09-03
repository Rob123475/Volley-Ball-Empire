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

- **`/players/validation` is stale.** Asserts 60 seniors and 60 youth at ten per
  continent; reality is 192 and 72. It has been reporting against a world a
  third of the size. Rewritten against the real rule it becomes a live guard
  instead of noise — and it now has `check-roster.cjs` to borrow its shape from.
- **Staff nationalities are mixed format** — 56 distinct values, 19 of them
  demonyms (`Australian`, `Italian`) against country names elsewhere. Players
  are fully on country names. Only the three fitness trainers were normalised.
- **13 unused senior images ship** — the 12 spares, plus `peru_04`. The two
  superseded Venezuela `.webp`s are gone: the §1c conversion wrote the correct
  `.png` sources over them.
- **Two possibly-dead asset folders**: `images/staff/medical_physiotherapist`
  (9 files) and `images/staff/medical_science` (8 files). The database uses
  `physiotherapist` and `sports_scientist`. Confirm before deleting.

---

## 3. Design questions you raised, still open

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
