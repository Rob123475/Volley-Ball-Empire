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

### 1a. Caption audit — DONE, 3 September 2026. See `docs/caption-audit.md`.
All 204 senior and spare cards were opened and read against their row.
**200 correct, 4 wrong, 3 of them new:**

- **`indonesia_02`** — Novi Anggraini's slot shows Sinta Wulandari's card.
  Novi has no card at all; Sinta appears twice. Two *different* renders with
  the same caption, so no hash scan would ever have caught it.
- **`laos_02`** — same shape: Bouavanh Sisouvanh's slot shows Keovilay
  Phommachanh. Bouavanh has no card.
- **`greece_03`** — row says *Elena* Papadopoulou, card says *Eleni*, which is
  `greece_01`'s name. Photo is right (23/190/Spiker all match); needs a
  decision, not a fix — see the audit doc.
- **`morocco_02`** — already known (§1d), confirmed by hash, still inert.

Both new failures are a country's **`_02` slot filled with a second render of
`_01`** — the same fault as Venezuela and Morocco, and now found four times.
Treat any regenerated `_02` as suspect until its card is read.

Also found: three cards (`portugal_03`, `spain_02`, `spain_03`) print no
age/height line, and `papua_new_guinea_03`'s position contradicts its row.

**Do not build a guard that compares card position to row position** — the
cards use FIVB names (Outside Hitter, Libero, Middle Blocker) that do not map
onto the four database values. It would fire on ~30 correct cards.

### 1b. Kiriwina Tau's portrait — cosmetic
Correctly captioned, but built from an `asia_01` render re-kitted as PNG.
`attached_assets/player_senior_png_09.webp` is byte-identical to
`player_senior_oceania_09` — her genuine original. Swap if you want PNG fully
authentic. No functional impact.

### 1c. Four `.png` files among 200 `.webp`
Camila Pérez, Sofía Mendoza, Amira El Mansouri, Mere Bainivalu — the corrected
sources you supplied were PNGs and there is no webp encoder on this machine
(no sharp, no ImageMagick). They work; they are ~15% larger. Re-export those
four as webp and I will swap them in.

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
- **15 unused senior images ship** — the 12 spares, plus `peru_04`, plus the two
  superseded Venezuela `.webp`s.
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
