# Caption audit — all 204 senior cards

Done 3 September 2026. **Every senior and spare card was opened and read**, and
its printed caption compared against the `players` row that points at it. This
is the audit `docs/triage.md` §1a called the biggest remaining unknown.

Method: 204 rows from `players` where `player_type` is `senior` or `spare`,
joined to the file each `image_url` names, and each image read. Compared name,
nationality, age and height on the card against the row. A filename was never
treated as evidence — only the caption inside the card.

**Result: 200 of 204 correct. Four wrong, three of them new.**

**Status after the 3 Sep follow-up: 202 of 204 clean.** `greece_03` and
`papua_new_guinea_03` are fixed in the database *and* in the seed scripts.
The two remaining (`indonesia_02`, `laos_02`) cannot be fixed without new
renders — proved below — and are now pinned by a build guard rather than
left to be rediscovered. `morocco_02` stays parked and inert.

A guard enforces all of this: **`scripts/check-captions.cjs`**, wired into
`pnpm typecheck`. It holds every row to the caption recorded here and pins each
reading to that file's sha1, so regenerating or swapping a portrait fails the
build until the new card is read. It has four self-test cases in
`harness/guard-selftest.mjs`.

Coverage is 204, not 207. Three files ship but no row points at them:
`peru_04.webp`, `venezuela_02.webp`, `venezuela_03.webp` — the superseded
originals, already recorded in triage §2. They were not audited because
nothing displays them.

---

## The four wrong cards

### 1. `indonesia_02` — Dewi Lestari has no card *(new)*

| | |
|---|---|
| database row | Dewi Lestari · Indonesia · 23 · 168cm · setter |
| card actually reads | **1. SINTA WULANDARI** · Indonesia · 21 yrs · 165cm · Defender |

That is `indonesia_01`'s identity — Sinta Wulandari's own row is correct and
sits on `indonesia_01`. So Sinta appears twice in the Player Market and Dewi
Lestari never appears at all.

The two files are **not** byte-identical (`94e43fb7…` vs `42cd5d88…`) — they
are two different renders of the same woman carrying the same caption, which
is why a duplicate-hash scan never caught it. Fixing it needs a new render for
Dewi, not a file swap.

### 2. `laos_02` — Bouavanh Sisouvanh has no card *(new)*

| | |
|---|---|
| database row | Bouavanh Sisouvanh · Laos · 24 · 172cm · defender |
| card actually reads | **1. KEOVILAY PHOMMACHANH** · Laos · 19 yrs · 158cm · Setter |

Identical shape to the Indonesia case: `laos_01` is the real Keovilay
Phommachanh (20/165), and `laos_02` is a second, different render of her that
also got her name. Two separate renders, so again not a hash duplicate.
Bouavanh Sisouvanh needs a card of her own.

**These two are the same failure mode as Venezuela and Morocco: a country's
`_02` slot filled with a second render of `_01`.** It is worth assuming it can
recur on any country whose `_02` was regenerated, and re-reading those cards
before trusting them.

### 3. `greece_03` — name collision *(FIXED 3 Sep 2026)*

| | |
|---|---|
| row said | **Elena** Papadopoulou · Greece · 23 · 190cm · spiker |
| card reads | **ELENI** PAPADOPOULOU · Greece · 23 yrs · 190cm · Spiker |

Age, height and position all matched, so the photo was the right person and only
the given name disagreed, by one letter. Someone had renamed the row
`Eleni → Elena` to break a duplicate without regenerating the card.

**Resolved by renaming the row back to `Eleni Papadopoulou`** — the card is the
evidence, so the database follows it. Changed in the starter database and in
`scripts/src/seed-new-draft-players.ts:197`, so a re-seed cannot undo it.

This deliberately restores two Greek players called Eleni Papadopoulou
(26/178 and 23/190). They are different people with different stats, no guard
requires unique names, and nothing in the game keys off name. A duplicate name
is a smaller problem than a card that names the wrong woman.

### 4. `morocco_02` — Zineb Ouadi *(already known, triage §1d)*

Byte-identical to `morocco_01`, so her card reads "Salma El Idrissi". Confirmed
by hash rather than re-read. Still inert: she is `player_type='spare'` and never
displayed. Only matters if she is ever unparked.

---

## There is no correct art for Dewi or Bouavanh — checked three ways

Before renaming any row to match wrong art, the repo was searched for a card
that *does* show them. There is none:

1. **The unshipped originals in `attached_assets` are wrong too.**
   `player_senior_indonesian_02_…webp` and `player_senior_laos_02_…webp` were
   opened: both print the `_01` player's name. The art was generated wrong at
   source, not broken during packaging.
2. **The seed scripts assigned exactly those files.**
   `seed-new-batch-players.ts:220` gives Dewi Lestari
   `player_senior_indonesian_02_1784380742425.webp`, and `:275` gives Bouavanh
   Sisouvanh `player_senior_laos_02_1784380742430.webp`. Both point at the
   miscaptioned renders, so re-seeding reproduces the fault exactly.
3. **No other unshipped image shows them.** All 329 distinct unshipped contents
   in `attached_assets` were enumerated; the only Indonesia and Laos candidates
   are the three per country already accounted for.

So these two cannot be fixed from inside the repo. The options are:

- **regenerate two cards** (the only clean fix — needs the image pipeline)
- **rename the rows to match the art** — rejected: it would put two identical
  *Sinta Wulandari* and two identical *Keovilay Phommachanh* in the same
  nation with conflicting ages and heights, which is worse than the current
  state, where the row is at least a coherent person
- leave them, guarded and visible — **this is what was done**

`scripts/check-captions.cjs` now records all three as known-wrong art and
asserts each is still exactly that problem, so they cannot quietly become a
different one.

---

## Cosmetic defects found along the way

Not wrong, but not right either.

### Three cards omit the age/height line

`portugal_03` (Inês Moreira), `spain_02` (Lucía Martínez) and `spain_03`
(Marta Hernández) print only `Country` where every other card prints
`Country • N yrs • Ncm`. Names are correct. All three are among the
larger-format regenerated cards, though the other regenerated cards
(`england_02/03`, `germany_02/03`, `netherlands_02/03`) do carry the line.

### `papua_new_guinea_03` — position disagreed *(FIXED 3 Sep 2026)*

Mere Bainivalu's card says **All-Rounder** while her row said `spiker`. Not a
vocabulary difference — `all_rounder` is itself a database value — so one side
was simply wrong. **Resolved by setting the row to `all_rounder`**, matching
the card. Changed in the starter database and in
`scripts/src/seed-all-senior-players.ts:156`.

### `england_01` — a youth render in a senior slot

Ava Patel's card is correct in every field, but its provenance line reads
`player_youth_europe_01_eng.webp`. She is 19, the youngest senior in the world,
so it is plausible rather than alarming — same class as Kiriwina Tau (§1b).
Cosmetic.

---

## Two things this audit settled

**Caption position names are decorative, not data.** The cards use FIVB
vocabulary that does not map onto the four database positions:

| card says | row says |
|---|---|
| Outside Hitter, Opposite Hitter | spiker |
| Middle Blocker | blocker |
| Libero, Defensive Specialist | defender |
| All-Rounder | all_rounder |

Do not build a guard that compares these two strings — it would fire on ~30
correct cards. `papua_new_guinea_03` above is the one real position conflict,
and it is only real because both sides say a value the other vocabulary has.

**The `_NN` index in a filename means nothing.** `germany_01` carries the
source `player_senior_europe_02_ger.webp` and `germany_02` carries
`…europe_01_ger.webp` — the indices are swapped, and both captions are still
correct. Several countries do this. The provenance line is useful for tracing
where art came from; it is not evidence of who is in the picture. Which is the
same lesson §1 already recorded, now confirmed across all 204.
