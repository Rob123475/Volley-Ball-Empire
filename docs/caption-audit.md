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
`papua_new_guinea_03` were fixed in the database *and* in the seed scripts.
The two remaining (`indonesia_02`, `laos_02`) could not be fixed without new
renders — proved below — and were pinned by a build guard rather than left
to be rediscovered. `morocco_02` stayed parked and inert.

**Status after the 9 Sep replacement cards: 204 of 204 clean.** Four real
photographs (`playercards.zip`, installed via `scripts/install-player-cards.cjs
--write`) replaced `indonesia_02`, `laos_02`, `morocco_02` and — going one
step further than the 3 Sep stopgap — `greece_03` with a genuinely different
woman, **Thalia Vasilakis**, rather than continuing to duplicate Eleni's own
photo. `player_type='spare'` is unrelated to this fix and was left alone —
see the per-card sections below. **Nothing in this file is known-wrong any
more; `scripts/check-captions.cjs` reports 204/204.**

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

## The four wrong cards — all fixed 9 Sep 2026 with real replacement photos

### 1. `indonesia_02` — Dewi Lestari — *(FIXED 9 Sep 2026)*

| | |
|---|---|
| database row | Dewi Lestari · Indonesia · 23 · 168cm · setter |
| card previously read | **1. SINTA WULANDARI** · Indonesia · 21 yrs · 165cm · Defender — `indonesia_01`'s own identity, duplicated |
| card now reads | **2. DEWI LESTARI** · Indonesia · 23 yrs · 168cm · Setter |

A genuine new photograph of Dewi Lestari (`playercards.zip`, installed via
`scripts/install-player-cards.cjs --write`), re-encoded to the standard
600×901 WebP senior-card format. Row and card now agree in every field. The
old file this replaced was never byte-identical to `indonesia_01` — two
different renders of the wrong woman carrying the same caption, which is why
a duplicate-hash scan never caught it (kept as historical context, see "What
this proved" below).

### 2. `laos_02` — Bouavanh Sisouvanh — *(FIXED 9 Sep 2026)*

| | |
|---|---|
| database row | Bouavanh Sisouvanh · Laos · 24 · 172cm · defender |
| card previously read | **1. KEOVILAY PHOMMACHANH** · Laos · 19 yrs · 158cm · Setter — `laos_01`'s own identity, duplicated |
| card now reads | **3. BOUAVANH SISOUVANH** · Laos · 24 yrs · 172cm · Defender |

Same fix, same source zip. **These two were the same failure mode as
Venezuela and Morocco: a country's `_02` slot filled with a second render of
`_01`.** Still worth assuming it can recur on any country whose `_02` was
regenerated, and re-reading those cards before trusting them.

### 3. `greece_03` — name collision, then a real second fix *(FIXED 3 Sep 2026, then properly resolved 9 Sep 2026)*

The 3 Sep fix was a stopgap: the row had been renamed `Eleni → Elena` to
break a duplicate-name collision without regenerating the card, so it was
renamed back to `Eleni Papadopoulou` to match the photo that was already
there — correct, but it left two Greek players named Eleni Papadopoulou
sharing one look between them in spirit even though the art itself wasn't
shared.

**9 Sep: replaced properly.** A genuine new photograph — a different woman
entirely, **Thalia Vasilakis** — now occupies `greece_03`, installed the same
way as the other three. Card reads **7. THALIA VASILAKIS · Greece · 23 yrs ·
190cm · Spiker**, matching the row exactly (age/height/position happened to
already be correct from the Eleni-era row — only the name and photo changed).
There are no longer two identical-name Greek players — the 3 Sep fix's own
"this deliberately restores two Eleni Papadopoulous" tradeoff no longer
applies; `greece_03` is Thalia Vasilakis now, a distinct person.

### 4. `morocco_02` — Zineb Ouadi — *(FIXED 9 Sep 2026)*

| | |
|---|---|
| database row | Zineb Ouadi · Morocco · 22 · 170cm · setter |
| card previously read | byte-identical to `morocco_01` → "Salma El Idrissi" |
| card now reads | **5. ZINEB OUADI** · Morocco · 22 yrs · 170cm · Setter |

Same fix, same source zip. **Note: `player_type` is still `spare` in the repo
starter DB** (it reads `senior` in the live save — the two had already
diverged before this fix, unrelated to it). A spare player is never
displayed, so having her own correct card now doesn't yet make her visible in
game — that is a separate, unaddressed question (flagged, not decided here;
see `docs/triage.md` §1d).

---

## What the "no correct art existed" search proved, and why it's now moot

Before the 9 Sep replacement cards existed, the repo was searched three ways
for art that already showed Dewi or Bouavanh correctly, and found none — the
unshipped originals in `attached_assets` were wrong too, the seed scripts
pointed at exactly the miscaptioned renders, and no other unshipped image in
the whole 329-file set showed either woman. That search is why the 3 Sep
audit's only options were "regenerate" or "leave it guarded" — there was
nothing to swap to. `playercards.zip` is that regeneration: four fresh
photographs, sourced outside the repo, is what "no correct art exists in the
repo" always meant it would take.

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
