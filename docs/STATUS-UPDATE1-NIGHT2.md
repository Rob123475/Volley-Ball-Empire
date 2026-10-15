# Update 1, night 2 (15–16 Oct): finish, test, build

Branch **update-1**. Nothing pushed, nothing uploaded to Steam; `main` and `launch-final` untouched; Rob's save
never opened. Written as the night goes.

## Summary

(Filled in at the end.)

## Decisions made overnight
1. **No time limit (Rob, 22:22, in the brief and in his message):** every feature in Parts 1–6 is finished before
   any testing, then Parts 7–9 in full. The 03:30 budget no longer applies.
2. **Part 1, 11 name clashes renamed:** each took another real surname from the same country (table in Part 1).
3. **Part 1, five countries the game half-knew:**
   - Iran, Latvia, Ethiopia, Serbia and Turkey had no flag code, so they got one, written the way the others are
     (`lib/db/src/schema/continents.ts`);
   - Turkey also had no continent, so it went into Europe (volleyball's CEV). The Turkish manager face benefits too;
   - Puerto Rico was already known.

## Part by part

### Part 1: Rob's 123 staff portraits, installed (commit `71f4b838`)

- **Copied** (never moved) from `Desktop\extra download cards\<role>-extra` into the installer's folders under
  `Desktop\staff portraits\`: 25 + 25 + 11 + 11 + 10 + 10 + 10 + 10 + 11 = **123**, in three new role folders (Fitness
  Trainer, Strength Coach, Sports Scientist).
- **Installer:**
  - the three roles added to `ROLES`, with the game's own picture folders (`fitness_trainer`, `strength_conditioner`,
    `sports_scientist`);
  - `Iranian` and `Puerto Rican` added to the nationality words.
- **Names:** every picture has its entry by exact file name in `docs/staff-portrait-names.json`. All 123 file names
  are cut short, so all were read from the entries (the dry run lists them; none is a problem).
- **Flags and continents:** checked for all 46 nationalities among the new people; five countries added (decision 3).
- **Name clashes:** checked against the game's 120 staff, 69 manager faces, players and AI pool players (548 names).
  11 matched; each took another real surname from the same country:

  | Role | Was | Now | Matched |
  |---|---|---|---|
  | Assistant Coach | Rania Haddad | Rania Khoury | a manager face |
  | Assistant Coach | Moussa Diop | Moussa Ndiaye | a manager face |
  | Massage Therapist | Abena Asante | Abena Boateng | an AI pool player |
  | Massage Therapist | Siriporn Chaiyaporn | Siriporn Wongsakul | a manager face |
  | Medical Specialist | Olena Kovalenko | Olena Shevchenko | a manager face |
  | Medical Specialist | Lan Nguyen | Lan Tran | a manager face |
  | Strength Coach | Dmitri Volkov | Dmitri Sokolov | a manager face |
  | Head Coach | Marieke de Vries | Marieke Bakker | a manager face |
  | Head Coach | Maricel Santos | Maricel Reyes | a manager face |
  | Head Coach | Hiroshi Tanaka | Hiroshi Watanabe | Dr. Hiroshi Tanaka (Doctor) |
  | Head Coach | Ahmed Mansour | Ahmed Fathy | a manager face |

  Re-checked: no clash, and no name twice among the 123.
- **Dry run, then `--write`:**
  - 123 added at ids 10001–10123 (243 staff in all);
  - 123 portraits written as 500 × 500 WebP (`staff-11` onwards in each role's folder);
  - skills and wages follow each role's existing rules (day 2). Head Coaches $9,833–$20,000 a month, skill 64–96.
- **The deal** (a new career on the new starter DB, 12 days played):

New career, after Day 8 (12 days played), 243 staff in this career:
| Role | In the game | At AI clubs | On the market |
|---|---|---|---|
| Assistant Coach | 35 | 30 | 5 |
| Doctor | 21 | 16 | 5 |
| Fitness Trainer | 20 | 0 | 20 |
| Head Coach | 35 | 30 | 5 |
| Massage Therapist | 20 | 15 | 5 |
| Medical Specialist | 20 | 15 | 5 |
| Nutritionist | 10 | 0 | 10 |
| Physiotherapist | 21 | 14 | 7 |
| Promotional Manager | 10 | 0 | 10 |
| Scout | 10 | 0 | 10 |
| Sports Scientist | 21 | 0 | 21 |
| Strength Coach | 20 | 0 | 20 |
AI clubs with a coach and a medic: 60 of 60
Fewest of any coaching or medical role left on the market: 5 (marketFloor 5)
Older save (made on the starter DB before the portraits): 120 staff in its career before; on its next boot 243; 123 of 123 new people with this career's state at their wage.
