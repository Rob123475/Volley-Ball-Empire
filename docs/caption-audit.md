# Caption audit — all 204 senior cards

Done 3 September 2026. **Every senior and spare card was opened and read**, and
its printed caption compared against the `players` row that points at it. This
is the audit `docs/triage.md` §1a called the biggest remaining unknown.

Method: 204 rows from `players` where `player_type` is `senior` or `spare`,
joined to the file each `image_url` names, and each image read. Compared name,
nationality, age and height on the card against the row. A filename was never
treated as evidence — only the caption inside the card.

**Result: 200 of 204 correct. Four wrong, three of them new.**

Coverage is 204, not 207. Three files ship but no row points at them:
`peru_04.webp`, `venezuela_02.webp`, `venezuela_03.webp` — the superseded
originals, already recorded in triage §2. They were not audited because
nothing displays them.

---

## The four wrong cards

### 1. `indonesia_02` — Novi Anggraini has no card *(new)*

| | |
|---|---|
| database row | Novi Anggraini · Indonesia · 23 · 168cm · setter |
| card actually reads | **1. SINTA WULANDARI** · Indonesia · 21 yrs · 165cm · Defender |

That is `indonesia_01`'s identity — Sinta Wulandari's own row is correct and
sits on `indonesia_01`. So Sinta appears twice in the Player Market and Novi
Anggraini never appears at all.

The two files are **not** byte-identical (`94e43fb7…` vs `42cd5d88…`) — they
are two different renders of the same woman carrying the same caption, which
is why a duplicate-hash scan never caught it. Fixing it needs a new render for
Novi, not a file swap.

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

### 3. `greece_03` — name collision *(new)*

| | |
|---|---|
| database row | **Elena** Papadopoulou · Greece · 23 · 190cm · spiker |
| card actually reads | **ELENI** PAPADOPOULOU · Greece · 23 yrs · 190cm · Spiker |

Age, height and position all match, so the *photo* is the right person — only
the given name disagrees, by one letter. `greece_01` is Eleni Papadopoulou
(26/178), a genuinely different player. So the card makes two different Greek
players share a name.

Someone appears to have renamed the row `Eleni → Elena` to break the
duplicate, without regenerating the card. Two ways out, and it is a call to
make rather than an obvious fix:

- rename the row back to `Eleni Papadopoulou` — matches the art, but restores
  two identically-named Greeks
- regenerate the card as `Elena` — keeps them distinct, costs one render

### 4. `morocco_02` — Zineb Ouadi *(already known, triage §1d)*

Byte-identical to `morocco_01`, so her card reads "Salma El Idrissi". Confirmed
by hash rather than re-read. Still inert: she is `player_type='spare'` and never
displayed. Only matters if she is ever unparked.

---

## Cosmetic defects found along the way

Not wrong, but not right either.

### Three cards omit the age/height line

`portugal_03` (Inês Moreira), `spain_02` (Lucía Martínez) and `spain_03`
(Marta Hernández) print only `Country` where every other card prints
`Country • N yrs • Ncm`. Names are correct. All three are among the
larger-format regenerated cards, though the other regenerated cards
(`england_02/03`, `germany_02/03`, `netherlands_02/03`) do carry the line.

### `papua_new_guinea_03` — position disagrees

Mere Bainivalu's card says **All-Rounder**; her row says `spiker`. This is not
a vocabulary difference — `all_rounder` is itself a database value — so one of
the two is simply wrong.

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
