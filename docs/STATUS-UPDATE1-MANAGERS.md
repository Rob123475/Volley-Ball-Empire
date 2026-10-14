# Update 1, item 2: manager faces and specialities: status

Brief: `docs/UPDATE1-MANAGERS-BRIEF.md` (with its Addendum), Rob's decisions of 13 and 14 Oct 2026. Branch `update-1`, on top of `95810b8` (item 1, the youth renewal). **Not pushed** (the brief: push only after Rob's on-screen check). Nothing merged into `main` or `launch-final`.

## Summary

All of item 2 is done and committed on `update-1`, and the full build passed on the final commit `a01d6a1`: **ALL HARNESSES PASSED, 105 of 105 suites, 1,774 of 1,774 checks**, the new `manager-faces` suite (56 checks) among them.

- **69 manager faces** (Rob's 61 and his 8 spares) are installed, each with its fixed name and one of eight specialities.
- **A new career** shows all 69 faces; the player picks one and keeps the name they type. The other faces are dealt at random to the 60 AI clubs, whose managers take the face's name.
- **Each speciality** moves its one number for the player's club only. An AI manager's speciality is shown, not used, until item 3.
- **Faces show** in both wizards, on Profile, on the save slot cards, on Qualified Teams and on the Job Market.
- **A sacked manager** is never re-appointed by the club that sacked them; the replacement is the free face out of work longest.
- **Rob's B:** a senior now refuses an offer below her asking wage, in every career.
- **Changes Rob should know about:** a career now needs a face; one existing guard ("no he/his/him") now allows the male manager pronouns in exactly one place. Both are in the "did not match" list below.

Not pushed: Rob checks on screen first (list below).

## Commits (oldest first)

| Step | Commit | What |
|---|---|---|
| 1 | `ead9b4e` | The 61 faces installed (600x800 WebP, q=82, through sharp like the player cards) by `scripts/install-manager-faces.cjs`; manifest `artifacts/api-server/src/data/manager-faces.json` (id, file, name, gender, age, nationality, speciality); the brief and `docs/manager-face-names.json` committed |
| 2 | `09a1742` | Faces dealt: `career_saves.manager_face_id`, `career_pool_team_state.manager_face_id`; a new career deals the other faces at random to the 60 AI clubs; AI managers are named by their face; the FIRST/LAST lists and `aiManagerName` deleted; "behind him/her" from the face; older saves dealt once at boot |
| 3 | `1a22c31` | The eight specialities, one multiplier each on the number the game already works out, for the player's club only; Rob's B: a senior refuses an offer below her asking wage; a career needs a face |
| 4 | `24a1c81` | The faces on screen: both new-career wizards, Profile, save slot cards, Qualified Teams, Job Market (offers and vacancies), the Medical page's injury risk |
| 1b | `f44354e` | Rob's 8 spare faces (69 in all), specialities dealt round-robin over all 69 |
| 2b | `5bbad03` | Rob's 14 Oct rule: a club appoints the free face out of work longest, never one it sacked (`career_manager_faces`) |
| 5 | `e3ae3f4` | `harness/manager-faces.mjs` (56 checks), in run-all |
| 5b | `a01d6a1` | The male manager pronouns are the one allowed exception to the "no he/his/him" guard (commentary-she) |

## What was done, by part of the brief

**The pictures.** 62 files in Rob's folder on 13 Oct; the Jamaican `(1)` copy was proved byte-identical (sha1) and skipped: 61 faces, 31 women and 30 men. Every file name matched a key in the names file (the "40 Maori woman" key matches "Maori woman from New Zealand"). Centre-cropped to 3:4, resized to 600x800, WebP q=82, about 44 KB each, in `public/images/managers/`. On 14 Oct Rob added 8 more (portrait 1920x2560, already 3:4, taken whole) and 8 names: 69 faces, 35 women and 34 men. Faces 1-61 kept their files, ids and specialities.

**Specialities.** Dealt round-robin in the brief's order over the names file's order: 9 each for Talent Recruiter, Negotiator, Contracts Expert, Sponsor Magnet and Leader, 8 each for Coach, Youth Developer and Fitness Guru, men and women in every one. Each effect is one multiplier, read from the player's manager's face (`utils/managerFaces.ts specialityFactor`, which reads only `career_saves`, so an AI manager's speciality is shown, not used: M-6):

| Speciality | Where it acts | What the player sees |
|---|---|---|
| Talent Recruiter | `continental-scouting` missionCostsFor: x0.75 | the scouting page now shows the server's costs ($15,000 / $33,750 / $56,250), not its own typed-in figures |
| Negotiator | `marketPrice` / `youthPrice` / `youthTierPrice`: x0.9 | market cards, the confirm step and the charge agree; a youth a mission or youth scouting finds is priced 10% lower when found |
| Contracts Expert | `wageCurve askingWage`: x0.9 | the market's asking wage, where the signing slider starts, and the floor below which she refuses |
| Sponsor Magnet | `generateOffer`: the sponsor's offer x1.1 | offers stored at the higher figure, shown and paid as stored |
| Leader | `board-confidence startingBoardConfidence`: 70 not 60 | set on the club's row when a career starts and when the manager takes over a club |
| Coach | training XP for seniors: x1.1 | the session record carries `managerXpMultiplier` |
| Youth Developer | `academyWeek` on `academyXpFor`: x1.15 | the player's academy only; AI academies (youthLoans) unchanged |
| Fitness Guru | `injuryRisk`'s one call in `applyPostMatchEffects`: x0.8 | the Medical page's injury risk takes the same factor |

**Who gets which face.** Both wizards show all 69; each card has the face, the speciality and its one-line effect; a face must be picked to go on. The player still types a name and picks a nationality. The other faces are dealt at random to the 60 AI clubs (8 are left over, out of work from the first day). AI managers are named by their face (the names file); the old mixed name lists are gone. A job offer says "behind him" or "behind her" from the face. A sacked manager is out of work from the sacking and that club never appoints them again; a club appointing takes the free face out of work longest (ties in random order). A club the player takes over puts its manager out of work from that season's start. Older saves: a career with no face is dealt once at boot (the player's face at random); never again.

**Where faces show.** New-career picker (both wizards); Profile hero (the purple UserCog is gone) with the speciality and effect; save slot cards; Qualified Teams (each club's manager's face, name and speciality; "You" at a club the player took over); Job Market (offers and vacancies show the manager being replaced).

## What was tested

- **New suite `harness/manager-faces.mjs`, 56 checks**, every item in the brief's harness list (with 69 faces instead of 61) and Rob's 14 Oct rule. Each speciality is measured against the same club without it. For the sacking rule the suite plants a sacking as the board writes it, a season earlier; at the window the club passes over the sacked manager (out of work longest of all) and takes the next-longest face. Passed 56/56 on its own three times.
- **Full build (`pnpm run build`: typecheck, build, sync:public, then the whole harness) at `a01d6a1`: ALL HARNESSES PASSED, 105 of 105 suites, 1,774 of 1,774 checks, 0 failed.** This is the final code; the status file is the only commit after it.
- **The first full run, at `e3ae3f4`,** passed 104 of 105 suites (1,772 of 1,773 checks). The separate `run-all` after it gave the same result. The one failure was commentary she (item 8 below), fixed in `a01d6a1`.
- **A second `run-all` after the passing build was stopped at suite 37**, on Rob's instruction: it would only have repeated the build's own run on the same code.
- **Earlier, step by step:**
  - The 19 suites that sign players passed after step 3. Three of them (player-market, contract-terms, transfer-fee) were updated to offer her asking wage.
  - The 13 suites touching the changed screens passed after step 4.
  - ai-job-market 30/30 and job-market 54/54 passed after steps 2, 4 and 2b.
- **staff-bonuses failed 3 sponsor checks once, run on its own after step 4:** its Promotions Manager was off at random. Run on its own, a suite has random staff absences switched on; run-all switches them off. It passed 22/22 on two re-runs and in both full runs.

## What did not match the brief, and what was decided

1. **No men's first names in the game** (the brief's stop condition). Stopped 13 Oct; Rob's Addendum replaced the name rule with one fixed name per face (`docs/manager-face-names.json`).
2. **19 of the 61 faces came from nations with no players in the game** (no names of any kind). Covered by the fixed names.
3. **JPEG vs WebP.** All 624 portraits are WebP; Rob chose WebP.
4. **Contracts Expert: the game had no wage floor.** A senior signed on whatever the slider sent ($1,000 up). Rob chose B (14 Oct): she refuses an offer below her asking wage, for every career; the Contracts Expert lowers that ask by 10%. Contracts already signed keep their wages; renewals are unchanged. Three suites that signed seniors at $4,000-$8,000 now offer her asking wage (contract-terms, transfer-fee, player-market).
5. **Leader:** the player's board starts from the database default of 60 on the club's row, not from `CONFIDENCE_START`; the board-review guard forbids writing board confidence outside the review, so the Leader's 70 is set when the club's row is created (new career, take-over).
6. **The sacking rule could not hold with 61 faces** (one player and 60 AI clubs leave no spare face, so a lone sacking could only bring the same manager back; the brief's test 5 said "a new face"). Rob added 8 spare faces and the 14 Oct rule (out of work longest, never re-appointed by the club that sacked them). Note: I did not find an earlier "D:" message in the conversation; the rule was implemented as stated on 14 Oct.
7. **A career now needs a face** (POST /careers refuses one without; the brief is silent). Both wizards always send one. Every harness career uses face 8 (a Fitness Guru, whose only effect is a lower random injury chance), so no other suite's numbers move by chance.
8. **"No he/his/him" (Rob, 30 Sep, the commentary-she guard) vs "he/she from the face" (this brief).** The first full run failed that one suite. The male words are now written once (`managerFaces.ts MALE_PRONOUNS`) and used only for a man's face; the guard allows exactly that line and checks it stays that narrow.
9. **Specialities per face:** the brief said 7-8 each for 61 faces; with 69 it is 8-9.
10. **The 8 new faces** are aged 30, 33, 36, 40, 46, 49, 52 and 57 (the brief said 35-50 for the first 61), and are portraits, not landscape.
11. **Fitness Guru** cannot be measured by counting injuries (they are random); the suite checks the 0.8 factor on `injuryRisk`'s one call, and the Medical page's.
12. Generated API client regenerated for the new fields; the zod types also picked up the `staff` news type the spec already had.
13. Line endings: several working files on this machine had CRLF while the committed files are LF (an old checkout); they were made LF before editing, so the diffs show only real changes.

## What Rob must check on screen

1. **New career** (title screen and Career Management): the 69 faces, each with its speciality and effect; pick one; the career starts.
2. **Profile:** your face and speciality in the hero.
3. **Qualified Teams:** every club's manager face, name and speciality.
4. **One speciality effect**, e.g. a Talent Recruiter's mission costs on Scouting ($15,000 for a month), or a Negotiator's prices on the Player Market.
5. **Job Market** in an off-season window: the manager being replaced on offers and vacancies.
6. **The faces themselves:** the 8 new ones sit a little smaller in the frame than the originals; a few original backgrounds show part of a club sign (e.g. "...KERS", "OC... BEACH", "AZAR... CLUB").
7. **Signing a senior:** the slider starts at her asking wage and will not go below it.

## Questions for Rob

1. Was there more to your "D:" rule than "never re-appointed by the club that sacked them; the free face out of work longest"?
2. The asking-wage floor (B) also applies to a player bought in the transfer window from another club (her current wage is her ask). Is that right?
3. An older save dealt a Leader face at boot does not get +10 board confidence now (the bonus is where a board starts). Should it?
4. A vacancy keeps showing the sacked manager's face; if that face is appointed elsewhere before the vacancy is filled, both screens show it for a while. Acceptable?
5. The background signs in a few pictures: keep, or replace those pictures?
