# Update 1 — item 2: Manager faces and specialities

Branch: **update-1** (on top of 95810b8). Rob's decisions, 13 Oct 2026 (M-1 to M-6, "Manager Pictures Decisions" page).

## Rules of engagement
- Work on update-1 only. Commit after each step below, with a clear message. Do NOT push until Rob has done his on-screen check.
- No guessing: read the code before changing it. If something in this brief doesn't match the code, stop and report. Don't invent a workaround.
- Delete dead code you replace. Don't layer new code over old.
- Line endings: keep each file's existing line endings (the repo is LF).
- The api-server build wipes dist/. Always use the full `pnpm run build` (which runs sync:public) before testing.
- Finish with: `node harness/run-all.mjs` all green (it was 104/104 suites, 1,717 checks), plus a new suite for this item. Report the counts.
- Write the report to docs/STATUS-UPDATE1-MANAGERS.md.

## The pictures
- Source: `C:\Users\rbonn\OneDrive\Desktop\Downloads  cards\downloads-manager-cards` (note the TWO spaces in "Downloads  cards").
- 62 files, 61 people. **Skip** `...39-year-old Jamaican woman_ club director of a (1).png`: it's a byte-identical duplicate.
- 61 = 31 women + 30 men, aged 35–50. Each file is 2560×1440 landscape, with the face roughly centred.
- Each file name gives the age, nationality and gender ("…portrait of a 42-year-old Nigerian woman_ …"). "Filipina" = Philippines, "Maori woman from New Zealand" = New Zealand.
- Install: crop the centre to a 3:4 portrait, resize to 600×800, and save as JPEG at about 85 quality (~100 KB each, not 5 MB). Put them in the same place the game keeps its other portraits, using the same install pattern as the existing player and staff picture scripts.
- Write a manifest (JSON, in the repo) with one row per face: id, file, gender, age, nationality, speciality.

## Specialities (M-1 approved; M-2: the speciality stays with the face)
Eight specialities, dealt round-robin across the 61 faces in a fixed order recorded in the manifest. That gives 7–8 per speciality, with men and women mixed in each.

| Speciality | Effect for the club it manages | Size |
|---|---|---|
| Talent Recruiter | Scouting missions cost less | −25% |
| Negotiator | Signing fees (a player's price) lower | −10% |
| Contracts Expert | New senior wages lower | −10% |
| Sponsor Magnet | Sponsor offers worth more | +10% |
| Leader | Board confidence starts at 70, not 60 (CONFIDENCE_START) | +10 |
| Coach | Senior training XP | +10% |
| Youth Developer | Academy XP (academyXpFor) | +15% |
| Fitness Guru | Match injury risk (injuryRisk) | −20% |

- Each effect must go through the existing code path for that number, with one multiplier read from the manager's speciality. No second, parallel system.
- **M-6:** for now, effects apply ONLY to the player's club. AI managers' specialities are shown, not used, until item 3 (AI clubs train) lands.
- Every screen that shows a price, fee, wage or offer must show the number after the speciality is applied. The player must never be shown one number and charged another.

## Who gets which face (Rob chose C)
- **New career:** the wizard shows all 61 faces, and the player picks one. The card shows the face, the speciality and its one-line effect. The player still types their own name and nationality as now.
- Then the other 60 faces are dealt **at random** to the 60 AI clubs, so every new career is a different setup. Store each face on that career's club state (career_pool_team_state) and the player's on career_saves.
- **AI manager names** come from the face's nationality and gender, replacing the current mixed FIRST/LAST hash list in utils/aiManagers.ts. Use the game's existing per-nation name data. **The game's player names are all women's names. If no men's first names exist per nation, STOP and report; don't invent a list.** Rob will decide.
- **"her" fix:** job offer text (utils/managerMoves.ts, "a failed season behind her") and any other AI-manager wording must use he/she from the face's gender.
- **Sacked AI manager:** her face goes back into the pool, and the replacement gets a face not in use. If none is free, reuse the one just freed. A club the player takes over frees its AI manager's face the same way.
- **Existing saves:** at boot, a career with no faces assigned gets them dealt out once (the player's own manager gets a random face, which they can't change). Additive only. Never re-deal a career that already has faces.

## Where faces show (M-4, M-5)
- **Your manager:** the new-career picker; the Profile page hero (replace the purple UserCog icon); the career save slot cards.
- **AI managers:** each club on the Qualified Teams page shows its manager's face, name and speciality. On the Job Market, offers and vacancies show the manager being replaced.

## Harness (new suite: harness/manager-faces.mjs)
1. All 61 faces are installed, the duplicate is not, and the manifest has 61 rows with 8 specialities, each used 7–8 times.
2. A new career: the player's chosen face is stored, all 60 AI clubs have a face, and no face is used twice.
3. Two new careers get different AI deals (random), and each career's deal survives a restart.
4. Each of the 8 specialities moves its number by the right amount for the player's club, and not for an AI club.
5. A sacked AI manager's club gets a new face, and still no duplicates.
6. Job-offer wording uses the right pronoun for a man's face and a woman's face.

## Stop when
All steps are committed, run-all is green, and STATUS-UPDATE1-MANAGERS.md says what was done, what was tested, and anything that didn't match this brief. Then Rob checks on screen: the new-career picker, Profile, Qualified Teams, and one speciality effect.

## Addendum — Rob's answers to the stop on 13 Oct (these replace the parts above they conflict with)
1. **Names: one fixed name per face. No name generator.** docs/manager-face-names.json maps each face (age, nationality and gender, from its file name) to one real name that fits that country and gender. Put the name in the manifest with the face. A face is a character: face + name + speciality, always together. When a face manages an AI club, the club's manager is that name. DELETE the FIRST/LAST name lists and the aiManagerName hash in utils/aiManagers.ts. The player's own manager keeps the name the player types. Pronouns (he/she) come from the face's gender.
2. Nations with no players are covered by point 1. Nothing is borrowed from neighbouring nations.
3. **Format: WebP**, through the same sharp pipeline as scripts/install-player-cards.cjs, to match the other 624 portraits (not JPEG).
4. The "(1)" Jamaican duplicate is skipped, as before. The names file has 61 entries, 31 women and 30 men. If any file name doesn't match a key, stop and report.
