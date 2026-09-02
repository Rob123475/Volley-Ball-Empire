# Triage — open items

Compiled 2 September 2026, at the end of the continent-key / roster-cleanup
work. Branch `fix/continent-keys-and-roster-cleanup` (4 commits) is pushed and
**not yet merged to main**.

The database is clean as of now: 192 seniors at exactly three per nationality,
72 youth at twelve per region across ten nations each and all aged 14–17, 12
parked spares, 120 staff over twelve roles of ten. No duplicate names, no
picture shared between two active rows, every nationality matching its region.
All five harness suites pass.

---

## 1. Artwork — captions that name the wrong person

**The single most important thing learned this week: a filename is not
evidence. Only the caption printed inside a card says who it is.** Four
independent cases were found, and there is no reason to believe they are the
last.

### 1a. Mere Bainivalu's card — BLOCKED ON YOU
`attached_assets/player_senior_png_01.png` is captioned **"10. AMIRA EL
MANSOURI · Papua New Guinea · 21 yrs · 190cm"**. Everything but the name is
Mere Bainivalu: PNG kit, PNG flag, her age and height, footer
`player_senior_oceania_10_png.webp`. Amira is Moroccan, 26, 171cm — she cannot
be a 190cm Papua New Guinean. **Needs re-captioning as "Mere Bainivalu"**, then
importing. Not imported: it would put a Moroccan's name on a Papua New Guinean.

### 1b. Kiriwina Tau's card — optional tidy
Her portrait (`png_02`) is captioned correctly but is derived from an
`asia_01` render re-kitted as PNG. `attached_assets/player_senior_png_09.webp`
is byte-identical to `player_senior_oceania_09` — the *genuine* Kiriwina Tau
render. Swapping it in would make PNG fully authentic.

### 1c. Full caption audit of all 205 senior images — RECOMMENDED NEXT
Mislabelling has been confirmed in Morocco, Venezuela, Papua New Guinea and
**all ten fitness trainers**. The trainers were a perfect reversal
(`_01`↔`_10`, `_02`↔`_09`, …), which no amount of filename inspection would
have caught. The work is mechanical: read each caption, compare with the
assigned row, report mismatches. It is the only way to know the true state.

### 1d. Zineb Ouadi — parked, no action needed
Shares Salma El Idrissi's picture. She is `player_type='spare'` and is never
displayed, so this is inert. It becomes real only if she is ever unparked.

---

## 2. Youth flags on Windows

Youth cards render the flag of the player's country (no photographs of minors —
deliberate). **Windows ships no country-flag emoji**, so Chromium falls back to
drawing the two letters: Fiji shows as `FJ`, Vanuatu as `VU`. Since the game is
Electron on Windows, that is what every player sees.

It reads acceptably — country code, country name, ACADEMY, on the continent
colour — but it is not flags. Decision needed:

- **keep it** (zero work), or
- **bundle SVG flags** — ~60 small files under `public/images/flags/`, keyed on
  the ISO code `countryCode()` already returns. One-line change in
  `player-portrait.tsx`; works offline and on every platform.

---

## 3. Youth nations vs the senior ten

Asia, North America and South America now draw their youth from your canonical
ten. **Europe and Africa do not** — Europe's youth are Croatian, Danish,
Icelandic, Polish, Russian, Ukrainian, Bulgarian; Africa's include Senegal,
Guinea, Burkina Faso, Jordan, Oman.

The spread is even (max two per nation), so this is not a balance problem. It
matters because **a promoted youth becomes a senior of that nationality** —
promote the Croatian and Europe gains an eleventh nation, breaking the 10 × 3
rule. Either align them or accept that promotion widens the nation list.

---

## 4. Data-shape leftovers

- **`/players/validation` is stale.** It asserts 60 seniors and 60 youth at ten
  per continent. Reality is 192 and 72. It has been reporting against a world a
  third of the size, which is part of why none of this surfaced. Rewrite it
  against the real rule (10 nations × 3 per region, youth 12 per region, ages
  14–17) and it becomes a live guard rather than noise.
- **Staff nationality format is mixed.** ~55 distinct values, some country
  names (`Brazil`, `Canada`), some demonyms (`Australian`, `Italian`). Only the
  three fitness trainers were normalised. Players are fully on country names.
- **Unused image files.** `player_senior_venezuela_02.webp` / `_03.webp` are
  superseded by the `.png` imports, and 13 senior images are unreferenced (the
  12 spares plus `peru_04`). Harmless, but they ship.
- **Possibly dead asset folders.** `images/staff/medical_physiotherapist`
  (9 files) and `images/staff/medical_science` (8 files) are not referenced —
  the database uses `physiotherapist` and `sports_scientist`. Confirm before
  deleting.

---

## 5. Phase 8 — exercise the screens

Recorded in full in `economy-design.md`. The short version: **no guard renders
a screen**, and every bug this week lived between a correct API response and
what the player saw. The club picker returned all ten clubs on every build and
drew seven.

1. **Component tests** (Vitest + Testing Library) over `NewCareerModal` — the
   cheapest, catches this exact class. ~1 day, no new infrastructure.
2. **One Playwright pass over career creation** — the only thing that tests a
   rendered screen. `run-all.mjs` already does the server/DB fixture work.
   2–3 days.
3. **Route-mounting smoke pass** — nearly free once (2) exists.

The picker existed **twice** (`career-management.tsx` and `new-career.tsx`,
the latter being the one the title screen actually reaches). Fixing one changed
nothing a player could see. That was found by opening the app, not by any check.

---

## 6. Housekeeping

- **Merge `fix/continent-keys-and-roster-cleanup` to main** (4 commits, pushed).
- **Desktop installer rebuilt**: `C:\build\vbe\Volleyball Empire Setup 1.0.0.exe`,
  **686 MB**, down from 1,780 MB. Not yet installed or launched — worth doing
  once to confirm the packaged app still boots.
- **Unity `.data` is 636 MB raw / 526 MB brotli.** `before-pack.cjs` strips the
  raw copies and `precompressedUnityAssets.ts` serves the `.br` with
  `Content-Encoding: br`, so this is already handled. Any further size work
  means a smaller Unity build, not packaging changes.
