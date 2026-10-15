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
4. **Parts 2–6 in one commit** (`0405e8fa`). They share their files: the treatment factor *is* Parts 3, 4 and 5
   at once, and the injured list hangs off the injury start. Separate commits would not have been whole parts.
5. **Part 2, "full at 95" for every bonus.** Every staff bonus now stops at skill 95, as Rob's table says. Before
   this, the head coach's and the others' kept rising past 95: a 96 gave 15.3%.
6. **Part 2, AI players carry no tiredness** (item 4c), so for an AI club the massage therapist and the strength
   coach + fitness trainer pair have nothing to act on. Every other role and pair works for AI clubs through the
   same functions.
7. **Part 3, how "live" works:** each player keeps her *base weeks still to heal*.
   - **Each week of rest** takes (1 + the Medical Centre's share) ÷ factor of them off.
   - **Her weeks out** are always base left × today's factor.
   - **Why it can't be gamed:** hiring the right person shrinks what's left at once, losing them grows it back, and
     nothing already healed is ever given back.
   - **When it updates:** every game day for every club, and at once when the player's club hires or releases staff.
8. **Part 3, the Medical Centre facility stays** (an extra ninth of a week of rest a week per level), as before.
9. **Part 3, a new history table, `career_injuries`, replaces `injury_history` and `season_injury_stats`.** Those
   were the player's club's only, and a reconstruction needs every club's history. The starter DB has the new
   table, and the two old empty tables are dropped.
10. **Part 3, staff absences keep their own lengths.** They were set at about half the old players' average;
    players' injuries are longer now because Rob asked for that, not for staff.
11. **Part 6, the cover rule taken literally.** When she goes on the list, the club's other seniors are written
    down. Anyone at the club later who wasn't is cover. While cover is on the roster she waits, even fit. With
    none, she's back the day she's fit, or at once when the cover is released or its contract is ended.
12. **Part 6, the list is a squad role (`injured`).** Her starter or interchange slot really is free, so the Team
    page's slot limits work unchanged. She goes back as a starter if one of the two places is free, else interchange.
13. **Part 6, a free agent signed while injured doesn't go on the list.** Only an injury taken at a club does.
    Otherwise injured-bargain signings would sit outside the three places.
14. **Part 6, AI clubs:** a listed senior doesn't hold a place in their weekly upkeep. The daily step covers it from
    the academy (best 16+), else the best affordable free agent. The 4c rule that a senior out 4+ weeks isn't
    renewed stays: it's about renewals, not the list.

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

### Parts 2–6: staff roles, real injuries, reconstructions, pairs, the injured list (commit `0405e8fa`)

**Part 2, every staff role does its own job (O-6).** One constants block, `STAFF_EFFECTS` in
`artifacts/api-server/src/utils/staffBonuses.ts`. Every bonus is on the "skill above 50" scale, full at 95, and
only the best member of each role on duty counts. It applies to every club; the AI clubs use the same functions.

| Role | Does |
|---|---|
| Head / Assistant Coach | training XP up to +15% / +8% (unchanged) |
| Fitness Trainer | up to −5 tiredness per session (unchanged) |
| Promotional Manager | sponsor money up to +18% (unchanged) |
| Scout | scouting (unchanged) |
| **Strength Coach** | power and block training XP up to +10% (by the programme's main stat, in the one XP function) |
| **Nutritionist** | stamina training XP up to +10% |
| **Massage Therapist** | up to 5 more tiredness off every player every day, on top of the rest |
| **Sports Scientist** | the whole squad's match injury risk up to −15% (moved here from the medical specialist) |
| **Medical Specialist** | reconstructions (Part 4) |
| **Doctor / Physio** | treat injuries (Part 3) |

- **Deleted:** the old healer system (`healingBonus`, `MEDICAL_BONUS.healerKeys`, the weekly extra-week chance, and the
  Recovery Program's use of it). A Recovery session is now a week of rest at the club's treatment factor.
- **The Staff and Medical pages** show each member's real effect from the server's own numbers (`GET /staff/effects`,
  `utils/staffEffects.ts`), for example "+12% power and block training XP" or "Treats concussions and broken
  bones: time out ×0.64". A member who isn't the best of her role, or is off ill, is shown as giving nothing.
  The old panels' made-up claims ("+15–24% XP", a massage therapist's "extra injury recovery ticks", a strength
  coach "preventing injuries") are gone.

**Part 3, real injuries treated by the right person (O-7).** The 9 named injuries, their areas, who treats them,
base weeks and shares are in `lib/db/src/schema/injuries.ts` (shared with the pages). Time out = base × the
factor:

| Club's medical staff on duty | Factor | Broken leg (20 base weeks) |
|---|---|---|
| neither doctor nor physio | ×2 | 40 weeks |
| only the wrong one (a physio, for a doctor's injury) | ×1 | 20 weeks |
| the right one, skill 50 → 95 | ×0.7 → ×0.6 | 14 → 12 weeks |
| both (the doctor + physio pair) | ×0.5 → ×0.4 | 10 → 8 weeks |

- **Live** (decision 7); how often players get hurt is unchanged (the same roll and odds, with the sports
  scientist's −15%, proneness and the Fitness Guru).
- **Where it shows:**
  - the Medical page (name, area, who treats it, live weeks, a bar of the base weeks healed);
  - the Team page card (name and area, and an "Injury history" with each injury and its date);
  - Club News ("Name: sprained ankle (ankle). Out about 3 weeks.");
  - the Player Market's injured box (with the area);
  - the status badge, by name.
- **Older saves:** at boot, Minor becomes cramp, Major a sprained ankle and Unavailable a torn hamstring. Their
  remaining weeks are kept and they get no history.
- **Kept:** an injury of 4+ weeks is serious (B-2) and makes an injured free agent cheap (4c), both by the real weeks.

**Part 4, reconstructions (O-8).** A third injury to the same body area within 12 months (game dates, her history
at every club) becomes that area's reconstruction ("Ankle reconstruction"). That's 30 base weeks, always serious:
- ×2 with no medical staff (60 weeks);
- ×1 with a doctor or physio (30);
- ×0.5 with a specialist (15);
- ×0.25 with a specialist and a doctor or physio (7.5).

It's live, like Part 3. Her card's history makes a repeat area obvious ("Ankle: 2 in the last 12 months (one more
there and it's a reconstruction)").

**Part 5, pairs (O-9):** doctor + physio (the "both" factor), specialist + doctor or physio (a reconstruction
halves again), strength coach + fitness trainer (training adds 20% less tiredness, sessions and camps), sports
scientist + nutritionist (all training XP +5%). The Staff page lists all four and whether the club has each; the
Medical page the three medical ones.

**Part 6, the injured list, cover, promotion at 16 (O-10).**
- **Going on the list:** more than 6 weeks out puts her on it at once, at every club (decision 12). She doesn't
  take one of the three senior places in the signing check, and her wage still counts toward the cap. A promoted
  youth is never blocked by the cap (C-5, unchanged).
- **Cover rule** (decision 11): the Team page has an "Injured List" section and explains it. The Dashboard says
  "fit, waiting for a place — release, sell or loan out the cover you took on while she was out, and she plays
  again". Her role can't be changed while she's on the list.
- **Promotion from 16** (`PROMOTION_MIN_AGE`, one number for the server and the Team page). Graduation at 19 is
  unchanged. The Rules page and the Team page texts say 16.
- **AI clubs:** the same list. They cover from the academy (best 16+), else the best free agent they can afford and
  fit; when she's fit they release their weakest.

**The Rules page** has three new topics: every staff role's job, real injuries and reconstructions, and the injured
list, cover and promotion at 16. The injury numbers come from the shared constants.

**A sanity run before any testing** (a test career, 70 days): 35 named injuries in the expected mix (cramp 14,
sprained ankle 7, broken finger or toe 7, and so on), 8 players on injured lists, live base weeks, no server errors,
and every new endpoint answering.
