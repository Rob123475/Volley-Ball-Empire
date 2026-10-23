# 1.1.3, the final package: status

Brief: `Downloads\FINAL-1.1.3-BRIEF.md` (23 Oct 2026). Worktree `C:/vbe-tm`, branch **release-1.1.3**, made from `release-1.1.2` 39cebbbe (live on Steam as BuildID 26098080). Commit and push after every item. Nothing uploaded to Steam. Rob's live save was only copied, never opened.

*Written as the work goes. The summary goes at the top once Part C is done.*

## Summary

(Part C not run yet.)

## Decisions I made

- **A1, logos:** the brief says pictures carrying a logo, brand mark, printed name or flag are reported and **not installed**. 82 of the 143 fail: every head coach (10) and every scout (61) wears the gold swirl tour emblem (polo chest, suit lapel; the scouts also have the blurred swirl on the back wall), and every assistant coach (11) has "BEACH VOLLEYBALL WORLD TOUR" on the shirt and WORLD TOUR / VOLLEY TOUR on the net banners behind. I did not clean them as on 19 Oct, because the brief says don't install those, and the medics the AI clubs run short of (doctors and physios) all pass. The 82 can be cleaned the 19 Oct way, or regenerated without the emblem, in a later update if Rob wants them.
- **A1, printed role words:** "PHYSIOTHERAPIST" and "PHYSIO ASSISTANT" on the physios' polos are generic role words, which the 19 Oct check left as they are (docs/STAFF-LOGO-CLEANUP.md, "Left as is"). They pass.
- **A1, orthopaedic surgeons:** "the `orthapaedic surgeon` folder is out". The 17 Oct set has no surgeon folder, so none are installed. The 13 surgeons 1.1.1 already installed stay. Taking them out of saves would be a removal the brief doesn't ask for.
- **A1, nationality and age:** the doctor and physiotherapist file names give the nationality (cut short, e.g. "of a Sou" is the South Korean woman); the registrar and physio assistant names give none, so it is read off the picture, as for 1.1.1's junior medics. No file name gives an age, so ages are read off the pictures. Names follow each nation's athletes' surnames where the game has them, and none repeats an existing staff name (two clashes, Seo-yeon Choi and Rania Khoury, were changed to Han and Saab).

## Part A

### A1. Staff portraits Rob made on 17 Oct

**Done. Commit: see the A1 line in the item table.**

**1. Which are already in the game (by picture, not file name).**
- Every one of the 143 was compared with every portrait under `images/staff/**` (359) and the earlier source folder `Desktop\staff portraits\` (156). The method: the installer's own crop, then a 256-bit DCT hash plus a pixel-by-pixel difference at 64×64 colour (`scripts/portraits/staff-picture-match.py`; the result is `docs/proof-1.1.3/a1-picture-match.json`).
- A plain 64-bit pHash wasn't decisive on these look-alike studio headshots (different people came out 4 to 10 bits apart), so the pixel difference decides. The closest game picture to any new one is 6.2 levels apart (of 255), and by eye it is a different man (`a1-sheet_game.jpg`, the 16 closest pairs side by side).
- **Already in: 0. New: 143. Duplicates within the new set: 1 pair**, scouts `... croppe (15).png` and `(16).png`, identical to the pixel.

**2. The logo check (as on 19 Oct: by eye on contact sheets, `docs/proof-1.1.3/a1-sheet-*.jpg`).**

| Folder | Pictures | Pass | Fail | Why it fails |
|---|---|---|---|---|
| doctor | 13 | 13 | 0 | |
| registrar | 12 | 12 | 0 | |
| physiotherapist | 12 | 12 | 0 | ("PHYSIOTHERAPIST" on the polo: a role word, passes) |
| Physio Assistant | 12 | 12 | 0 | ("PHYSIO ASSISTANT": a role word, passes) |
| head coach | 10 | 0 | 10 | gold swirl tour emblem on the polo chest |
| assistant coach | 11 | 0 | 11 | "BEACH VOLLEYBALL WORLD TOUR" and the swirl on the shirt; WORLD TOUR / VOLLEY TOUR net banners; a cap logo on one |
| scouts | 61 | 0 | 61 | gold swirl lapel pin; a blurred swirl on the wall behind. (15) and (16) are also a duplicate |
| **Total** | **143** | **49** | **82** | |

**3. Installed: the 49 that pass**, the way 1.1.1 did it (`scripts/install-staff-portraits.cjs`: 500×500 WebP at q=88, the role folders under `images/staff/`, ids from 10001 up so the boot's Pass 3b brings them to old saves; the junior grades with `--juniors`). Names, ages and nationalities are in `docs/staff-portrait-names-1.1.3.json`.
- The installer used to number a role's pictures after its *seeded* staff and find a person again by picture. A second install into the same folder would have overwritten day 2's and 1.1.1's pictures (doctors from staff-11). It now finds a person by name and role, and a new picture takes the next number after every picture already in the folder, from the rows and the files alike. The installer suite still passes (15/15: first write, second write updates, never a duplicate).
- Doctors are `medical_doctor/staff-36` to `-48`, Registrars `-49` to `-60`, Physiotherapists `physiotherapist/staff-32` to `-43`, Physio Assistants `-44` to `-55`. Staff ids 10161 to 10209.

**Counts per role, starter DB and a copy of Rob's live save** (`%APPDATA%\Beach Volleyball Empire\volleyball-empire.sqlite`, last saved 16 Oct; copied, and the 1.1.3 server booted once on the copy):

| Role | Starter DB before | Starter DB after | Live-save copy before | Live-save copy after one boot |
|---|---|---|---|---|
| Doctor | 21 | **34** | 21 | **34** |
| Registrar (Doctor) | 14 | **26** | 0 (a 1.1.0 save) | **26** |
| Physiotherapist | 21 | **33** | 21 | **33** |
| Physio Assistant (Physiotherapist) | 10 | **22** | 0 | **22** |
| Orthopaedic Surgeon | 13 | 13 | 0 | 13 |
| every other role | unchanged | unchanged | unchanged | unchanged |
| all staff | 280 | **329** | | |

- Both careers in the live-save copy got their state rows for all 49 new people (career 16: 0 then 49; career 18: 0 then 49).

**Proof, the AI clubs (`harness/ai-staff.mjs`, 31/31 alone):**
- "(1.1.3) the Day 8 pool includes the 49 new faces, and AI clubs hired some of them": **49 in the career, 28 at AI clubs on Day 8** (doctors and physiotherapists).
- "(1.1.3) on Day 8 no AI club is short of a doctor or physio": **0 of 60** without one. Before, only 32 doctors and physios were spare for 60 clubs (docs/STATUS-UPDATE1-PRE-UPLOAD.md); now 105 are.
- `harness/junior-medics.mjs` 12/12 (now 26 Registrars and 22 Physio Assistants). `harness/wizard-career-economy.mjs`'s staff count moves from 160 to 209 from id 10001.
- **The soak line** (no AI club short of a doctor or physio, across the seasons) is in Part C.

## Item table

| Item | What | Commit | Proof |
|---|---|---|---|
| A1 | Staff portraits: 49 installed, 82 refused (logos) | (this commit) | ai-staff 31/31, junior-medics 12/12, installer 15/15, live-save copy |
