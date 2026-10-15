# Update 1, night 2 (15–16 Oct): finish, test, build

Branch **update-1**. Nothing pushed, nothing uploaded to Steam; `main` and `launch-final` untouched; Rob's save
never opened.

## Summary

**Every part is done. 1.1.0 is packaged in `C:\build\vbe-1.1.0\win-unpacked\` and ran end to end. Not uploaded.**

| Part | Status | Commit |
|---|---|---|
| 1. Rob's 123 staff portraits | Done: 123 installed (ids 10001–10123, 243 staff), three new roles, Iranian and Puerto Rican, 11 name clashes renamed; Day 8 deal: 60/60 AI clubs get a coach and a medic; existing saves get all 123 | `71f4b838` |
| 2. Every staff role has its own job | Done: one constants block, the healer system deleted, real effects on the Staff and Medical pages | `0405e8fa` |
| 3. Named injuries, treated live | Done: 9 injuries with areas, ×2 / ×1 / 0.7→0.6 / 0.5→0.4, live on hire and release, shown everywhere, older saves converted | `0405e8fa` |
| 4. Reconstructions | Done: a third injury to one area in 12 months, 30 base weeks, ×2 / ×1 / ×0.5 / ×0.25 | `0405e8fa` |
| 5. Four pairs | Done, shown on the Staff page | `0405e8fa` |
| 6. The injured list | Done: over 6 weeks, the cover rule, promotion from 16, AI clubs alike | `0405e8fa` |
| 7. Tests and the full builds | Done: four new suites (69/69 alone); **build #1: 108 of 118 suites passed**, **build #2: 114 of 118 passed**; every failure fixed in its suite (2 real game faults found and fixed after build #1, none after build #2) and re-run alone | `1a1fa1f1`, `c03e917f`, `dcfcc450`, `1589736f` |
| 8. The soak | Done: Medium 5 seasons, Easy and Hard 2: **no flags, all money tests pass**; 3 balance questions with numbers below | `1589736f` (harness) |
| 9. 1.1.0 | Done: version stamped, packaged the 12 Oct way into a new folder, **proved running** (draft, a full 3D match, Settings) on a throwaway profile, patch notes written. **Not uploaded** | `b77d3841`, this commit |

**Both builds' counts:**
- Build #1 (23:08–00:33): 108 of 118 suites passed, 10 failed: all knowingly changed expectations, plus 2 real
  faults (the `squadRules` import; the boot writing a retired table).
- Build #2 (01:41–03:40): 114 of 118 passed, 4 failed: three knowingly changed expectations and one chance result.

**The soak (Part 8; full tables in its section):**

| Run | Median AI balance | Below zero | Clubs with 3 seniors | Over cap and signed | AI injuries a season | Reconstructions | Put on the injured list a season |
|---|---|---|---|---|---|---|---|
| Medium S5 | $361,207 | 5 | 55 | 0 | 99–137 | 28 in 5 seasons | 21–35 |
| Easy S2 | $458,926 | 1 | 55 | 0 | 102–105 | 6 in 2 | 20 |
| Hard S2 | $388,881 | 1 | 54 | 0 | 95–97 | 6 in 2 | 22–26 |

Weeks out at Medium: the right medic 2.33, the wrong one 3.06, none 7.03.

**Balance questions for Rob** (nothing retuned):
1. Reconstructions are nearly all legs built from 1-week cramps.
2. 29 of 59 AI clubs' only medic can't treat an ordinary injury.
3. The Medium money drifts down about $27k a season, as on Day 2.

**The 1.1.0 folder:** `C:\build\vbe-1.1.0\win-unpacked\`; the exe says 1.1.0. It ran from a fresh test profile:
- Day 1 draft picked in the UI;
- days passed;
- a whole 3D match played and saved (0–2), then Continue;
- the next match day;
- Settings.

Screenshots are in `C:\build\vbe-1.1.0\proof\`. Rob's save is byte for byte the same.

**Skipped:** nothing from the brief.
- **Not built:** the NSIS installer. The 12 Oct launch build was the same `--win dir` folder that Steam uploads.
- **Not seen:** "Doctor + physio" never happens at an AI club in the soak, because each gets one medic. It's proved for
  the player's club in the suites.

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
15. **Part 9, the version was set before build #2** (`b77d3841`, `package.json` 0.9.3 → 1.1.0). electron-builder
    stamps the exe's file version and the installer from it; nothing in the game shows a version on screen, so
    `package.json` is the only place. Setting it before build #2 means the packaged commit is the one the harness passed.
16. **Part 8, the soak's "over the cap" check follows C-5.** Its first runs flagged 6–7 AI clubs a season "over the
    cap that added anyone". Every one was a youth promoted from the academy (injured-list cover, or the usual top-up),
    and C-5 says a promoted youth is never blocked by the cap; a listed senior's wage still counts, as Rob asked. The
    check now measures a club's *signings* without its promoted youths' wages (as `ai-injuries` already did) and
    counts "over only through a promotion" on its own line. Not a game change.
17. **Part 8, the soak's final numbers come from runs after build #2.** The first runs (01:13) used the same game code
    but ran alongside the `ai-club-economy` re-run and had the old over-the-cap check; they were re-run afterwards
    with nothing else running.
18. **Part 9, the proof run uses the real packaged window on a throwaway profile.** Electron's `--user-data-dir`
    switch moves the whole save root (tested first on the same Electron 32.3.3 with a probe that only prints the
    path), so the game's save folder becomes `<temp>\Beach Volleyball Empire`. Rob's save files were hashed before and
    after the run. The game also refuses to start if port 4173 is in use, so it can't attach to a running copy.
19. **Part 9, the Unity `.br` files were made fresh before build #2** (`compress-unity-data.cjs`, 9.6 min; Day 2's
    volume sliders changed the Unity build), so build #2's frontend carries them and the package is cut straight
    from build #2's output, exactly the 12 Oct order: compress → `pnpm run build` → `electron-builder --win dir`. The
    native-module step (0b) was skipped: better-sqlite3 hasn't changed since 12 Oct and electron-builder's before-pack
    check loads it under Electron's own runtime and stops the package if it's wrong.
20. **Build #2 had a false start that ran no suite.** The first attempt (01:41) set `PORT` and `BASE_PATH=/` as
    `docs/packaging.md` shows for PowerShell; Git Bash rewrote `/` into `C:/Program Files/Git/`, and the pre-flight
    `check-build-env` stopped the build before any workspace was built and before the harness. Re-run without them,
    as build #1 was. It counts as nothing; the counts below are the full run.
21. **Part 8, the soak ran with staff absences on**, as the game ships; run-all turns them off so suites don't move
    by chance. The first final attempt started with them off by habit and was stopped within a minute.
22. **Part 9, the proof's screenshots live beside the package**, in `C:\build\vbe-1.1.0\proof\`. That's outside
    `win-unpacked`, the folder Steam uploads, and not in the repo (12 PNGs). The script that made them is in the repo,
    `scripts/webgl-proof/package-proof.mjs`.
23. **Part 9, the Steam script is a ready copy in the repo** (`steam/app_build_5233750-1.1.0.vdf`). Rob's Steamworks
    scripts folder wasn't touched: it still names the launch build, and replacing it is step 1 of the upload.
24. **The on-screen check runs 1.1.0 on a copy of Rob's save.** Opening his real save with 1.1.0 converts it, and the
    live 1.0 Steam game can't use it after that. The check's first step makes the copy.

## Rob's 10-minute on-screen check

**First, keep your Steam save safe.** Don't start 1.1.0 on your own save while Steam still runs 1.0. On its first boot
1.1.0 converts the save: named injuries, and the two old injury tables dropped. 1.0 can't play a save after that. Test
on a copy instead:

```powershell
New-Item -ItemType Directory -Force "C:\vbe-test-1.1.0\Beach Volleyball Empire"
Copy-Item "$env:APPDATA\Beach Volleyball Empire\volleyball-empire.sqlite*" "C:\vbe-test-1.1.0\Beach Volleyball Empire\"
& "C:\build\vbe-1.1.0\win-unpacked\Beach Volleyball Empire.exe" --user-data-dir=C:\vbe-test-1.1.0\root
```

(Close the Steam game first; the game won't start if one is already running. With `--user-data-dir` the game keeps
its saves in `C:\vbe-test-1.1.0\Beach Volleyball Empire\`, the copy.)

1. **Your career carries on.** Your club loads as you left it. Any injured player now has a named injury with its body
   area (Team page and Medical page).
2. **Staff page.** Each member has a line saying what they do for you, and there's the pairs panel. Hire screen:
   Rob's new people with their portraits, including a fitness trainer, a strength coach and a sports scientist.
3. **Medical page.** The treatment panel shows who treats what. With a player injured, hire (or release) a doctor or
   physio, and her weeks out change at once.
4. **Team page.** Open an injured player's card: her injury history, with "Ankle: 2 in the last 12 months" when one
   area repeats. If anyone is out more than 6 weeks, she's in the Injured List section and her place is free for cover.
5. **A 3D match and the sound.** Watch a match. In Settings → Sound, move Crowd and Commentary, and the court follows.
6. **A new career** (New Profile on the first screen): the Day 1 draft, then play to Day 8. The AI clubs take their
   staff from the market (Club News and the Staff hire list). The exe's Properties → Details say **1.1.0**.

## The Steam upload, for the 1.1.0 folder (as Rob did it on 12–13 Oct; not done tonight)

1. **Point the build script at 1.1.0.** In `C:\STEAMWORKS\steamworks_sdk_165\sdk\tools\ContentBuilder\scripts\`:
   - keep a copy of today's `app_build_5233750.vdf` (it names the launch build, `vbe-final-12oct-c`), for example as
     `app_build_5233750.vdf.before-1.1.0`;
   - then copy the repo's `steam\app_build_5233750-1.1.0.vdf` over `app_build_5233750.vdf`.

   The only changes are `"Desc" "v1.1.0 Update 1 (update-1 a09c6d54)"` (the 16 Oct evening repackage, docs/STATUS-UPDATE1-PRE-UPLOAD.md) and
   `"ContentRoot" "C:\build\vbe-1.1.0\win-unpacked\"`. `SetLive` stays empty. `depot_build_5233751.vdf` is unchanged
   (the repo's copy matches it).
2. **Upload.** Open a terminal in `C:\STEAMWORKS\steamworks_sdk_165\sdk\tools\ContentBuilder\builder\` and run:
   ```
   steamcmd.exe +login rtbonner +run_app_build ..\scripts\app_build_5233750.vdf +quit
   ```
   Enter the Steam Guard code if asked. It ends with "Successfully finished AppID 5233750 build (BuildID …)". Note the
   BuildID.
3. **Set it live.** Steamworks website → App 5233750 → SteamPipe → Builds. Find the new BuildID ("v1.1.0 Update 1")
   and set it live on the **default** branch. If the page then shows unpublished changes, Publish them as before.
4. **Tell the players.** Post `docs/UPDATE1-PATCH-NOTES.md` as a Patch Notes event (Community → Events &
   Announcements).
5. **Rolling back** is the same step 3 with the launch build's BuildID. But saves already opened by 1.1.0 won't play
   on 1.0 (see the warning above).

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

### Part 7: tests and the full builds

**Four new suites, in run-all (98o–98r), each passing alone before the build.** The shared helper is
`harness/night2-world.mjs`; dev-only probes (`/dev/injuries/roll`, `/factor`, `/start`) exist only outside production.

| Suite | What it proves | Alone |
|---|---|---|
| `injury-treatment` | the 9 injuries' shares over 100,000 of the game's rolls; a broken leg 40 / 20 / 14→12 / 10→8; older saves' injuries converted (same weeks, no history); live: a doctor hired mid-injury shrinks it at once, released it grows back, a week of rest at the factor; serious; history, Club News, card | 17/17 |
| `reconstruction` | a third ankle injury in a year is an ankle reconstruction (30 base weeks, serious); 60 / 30 / 15 / 7.5; a specialist hired mid-reconstruction 60 → 15, with a physio 7.5; two ankle injuries over a year ago don't count; a third in a different area doesn't; the card says "Ankle: 3 in the last 12 months" | 13/13 |
| `staff-roles` | Rob's numbers in one block; the healer gone from the server; each role's real effect at its skill, for the player's club; the four pairs; a weaker second member gives nothing, one off ill gives nothing; the massage therapist measured (5 a day resting, 5 + her share with her); an AI club's broken leg treated by its own medical staff | 22/22 |
| `injured-list` | 6 weeks out is not on the list, a broken leg is (role "injured", inactive); a fourth senior signed as cover with three on the books; fit with cover still there: waiting, Dashboard says so, role locked; cover released: back at once; no cover: back the next day; a 15-year-old can't be promoted, a 16-year-old can; an AI club covers from its academy and releases its weakest when she's fit | 17/17 |

**Suites whose expectations this update knowingly changed** (each a direct consequence of Rob's O-6 to O-10; none hides a fault):

| Suite | What changed, and why |
|---|---|
| ai-staff | Part 3's source checks: the treatment factor and the sports scientist instead of the healer chance. With 20–35 of each role on the market, the spare count is per role in the career, not a fixed 10, and the club with a gap may re-sign the medic whose contract ended, on a new contract that day |
| staff-bonuses | section 3: `/staff/effects`, the doctor treats (×0.7–0.6) and the sports scientist prevents (−15%); 243 distinct staff names (was 120); the Staff page panel reads each member's role key from the server |
| club-pages | the injuries are one named table; the Treatment Queue bar is the base weeks healed |
| staff-injuries | counts `career_injuries`; staff time off is half a player's or less (players' injuries are longer, staff causes unchanged, decision 10); the physio check reads the live treatment factor (off: without her; back: her full factor) instead of "two weeks in one" |
| real-world-dates | injuries are in `career_injuries`, on game dates by construction |
| settings | twelve Rules topics (three new) |
| staff-portrait-install | proves the installer and Pass 3b in the world before the 123 (they are in the starter DB now) |
| wizard-career-economy | 120 seeded staff plus Rob's 123 at ids from 10001 (was "120 in all") |
| condition, injured-match-player | a test "heal" also takes her off the injured list (a serious injury rolled in a match can put her on it) |
| ai-club-economy | the to-the-dollar week measures a staffed club and counts its staff's Day 8 signing fees (every club has staff now) |
| ai-buyable | a senior on the injured list doesn't hold one of the three places (squads up to 3 *holding a place*; "short of two" still counts her); an injured-list or renewal release picked up the same day by another club isn't a transfer |
| ai-injuries | an AI player's weeks out follow her club's staff live, so the clock read is her base weeks; the roll's source pattern includes the staff factor; the injured gamble may be taken by her own club; a club over the cap only through an academy promotion is allowed (C-5) |
| manager-faces | the Fitness Guru roll's source pattern includes the staff factor |
| ai-training | every staff bonus is full at 95; the strength coach and nutritionist by programme; a 14–18-year-old senior (now a common AI cover) trains 20% faster, the existing rule; a senior seriously hurt mid-week, or an academy reshuffled by a cover promotion, is not that week's reading |

**Two real faults the suites caught, fixed in the game:**
- The boot's real-world-date pass still wrote the retired `injury_history` table with raw SQL. A new save no longer
  has that table, so the loop was deleted.
- `squadRules.ts` re-exported the promotion age from `@workspace/db`, which broke every suite that loads it on
  its own. The server now takes the number from `@workspace/db` directly.

**Full build #1** (`pnpm run build`, 23:08–00:33): typecheck and every workspace build OK; **the harness: 108 of 118
suites passed, 10 failed** (corrected: an earlier draft of this report, and commit c03e917f's message, said "120 of 130"; the run's own summary lists 118 suites):
- condition (injuries and fitness), wizard career economy, staff bonuses, ai club economy, ai buyable, staff injuries,
  manager faces, ai training, ai staff, ai injuries.

Every one was a knowingly changed expectation above, or the `squadRules` import fault (manager faces and ai training
crashed on start). Each was re-run alone after its fix:
- **The ten failures:** condition 27/27, wizard career economy 12/12, staff bonuses 28/28, staff injuries 20/20,
  manager faces 56/56, ai staff 22/22, ai injuries 16/16, ai buyable 25/25, ai training 17/17 (twice), and
  ai club economy 22/22. It needed two passes: after the first fix (Day 8 signing fees) it was 21/22, because after 30
  seasons 18 clubs had just promoted a youth as injured-list cover and had 3 in their academy for the week until the
  next intake. The check now allows 3 in that week (`dcfcc450`). That one is a knowingly changed expectation too.

**Full build #2** (`pnpm run build`, 01:41–03:40, on `dcfcc450`; game code identical to the packaged commit
`1589736f`, which adds only suite and report changes): typecheck and every workspace build OK; **the harness: 114 of
118 suites passed, 4 failed**:
- injuries and fitness (condition), invented content removed, dashboard standing, player pictures.

Each was fixed in its suite (no game change) and re-run alone:

| Suite | Why it failed | Alone after |
|---|---|---|
| condition | in `/simulate` a pair player can now be hurt for more than 6 weeks; she goes on the injured list (inactive) at once, and the suite only looked up active players, so it crashed reading her. It now looks her up active or not. (It passed alone earlier only because no long injury was rolled.) | 27/27 |
| invented content removed | Club News's new injury items (Part 3) weren't in its list of news kinds. Each is now traced to its `career_injuries` row: her club, its game date, the injury in the headline (checked against build #2's two items, injury-23 and injury-27) | 11/11 |
| player pictures | an AI club's injured-list cover can be a generated academy youth promoted mid-season (Part 6); at the boundary she graduates with Europe's pictures run out and keeps the card she was made with. The check expected every run-out graduate to hold the shipped flag card; it now checks that no run-out graduate got a graduate picture | 35/35 |
| dashboard standing | chance: its Underdog club went 23–17 and sat 3rd, so there were no bands below it to test (no AI walkovers in that run; the game code that decides results is unchanged since build #1, where it passed). Alone it sat 14th | 12/12 |

Per the brief, run-all was not run again after build #2.

### Part 8: the soak (`harness/long-career-update1.mjs`)

Run after build #2 on the packaged commit's game code: Medium 5 seasons, Easy 2, Hard 2, all at once on their own
ports, with **staff absences on** (as the game ships; run-all turns them off). Each takes a new career through the
Day 1 draft and plays on headless. The player's own club is kept healed and fielded by the harness, so its
injuries aren't the game's own course: **the injury columns count the 60 AI clubs only.** "Weeks out by treatment"
reads back the factor each injury got on the day (weeks out = base weeks × factor, kept to two decimals): a doctor
and a physio, the right medic, the wrong one, or none.

**All three runs: no flags.** Rob's money tests pass in every run (checked at the last season):

| Run | Median AI balance (±$150k of $500k) | Clubs below zero (fewer than 10) | Clubs with 3 seniors (at least 40) |
|---|---|---|---|
| Medium, season 5 | $361,207: pass | 5: pass | 55: pass |
| Easy, season 2 | $458,926: pass | 1: pass | 55: pass |
| Hard, season 2 | $388,881: pass | 1: pass | 54: pass |

No AI club over the cap signed anyone, in any season. The clubs "over only through a promoted youth" (2–12 a season)
are C-5's allowed case: a listed senior's wage still counts, and the youth promoted as her cover is never blocked.

**Medium, 5 of 5 seasons** (no flags)

| Season | AI avg | AI top | Over cap, signed (must be 0) / by promotion | Clubs with 3 seniors | Coach + medic | Stats out of range | AI balances: lowest / median | Below zero | Sold | Free agents | Champion |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 (2026) | 75.5 | Fernanda Silva 92 | 0 / 5 | 52 of 60 | 60 | 0 | $262,149 / $495,661 | 0 | 0 | 159 | Bali Island Legends |
| 2 (2027) | 76.1 | Fernanda Silva 93 | 0 / 8 | 54 of 60 | 60 | 0 | −$105,050 / $426,510 | 1 | 0 | 195 | Accra Goldcoast Waves |
| 3 (2028) | 75.6 | Beatriz Costa 93 | 0 / 6 | 54 of 60 | 60 | 0 | −$7,972 / $404,476 | 1 | 0 | 248 | Paris Sables Royales |
| 4 (2029) | 75.6 | Beatriz Costa 95 | 0 / 7 | 54 of 60 | 59 | 0 | −$104,754 / $385,625 | 2 | 0 | 311 | Honolulu Aloha Warriors |
| 5 (2030) | 73.8 | Beatriz Costa 96 | 0 / 12 | 55 of 60 | 59 | 0 | −$111,388 / $361,207 | 5 | 0 | 357 | Bondi Beach Legends |

| Season | Injuries (AI clubs) | By type | Avg weeks out by treatment: doctor+physio · right medic · wrong medic · none (count) | Reconstructions | Put on injured list | On it at season end | AI cover promoted | Rob's new staff at AI clubs |
|---|---|---|---|---|---|---|---|---|
| 1 | 100 | Cramp or strained muscle 41, Sprained ankle 21, Broken finger or toe 9, Torn hamstring 8, Concussion 7, Torn shoulder 5, Broken wrist 4, Leg reconstruction 4, Broken leg 1 | – (0) · 2.36 (23) · 2.78 (18) · 6.11 (55) | 4 | 23 | 6 | 11 | 71 |
| 2 | 116 | Cramp or strained muscle 37, Sprained ankle 24, Broken finger or toe 17, Torn hamstring 13, Broken wrist 8, Concussion 7, Broken leg 4, Torn shoulder 3, Leg reconstruction 3 | – (0) · 2.34 (21) · 3.68 (19) · 8.11 (73) | 3 | 35 | 10 | 12 | 71 |
| 3 | 99 | Cramp or strained muscle 48, Sprained ankle 13, Broken wrist 8, Torn hamstring 8, Broken finger or toe 7, Concussion 6, Torn shoulder 4, Leg reconstruction 2, Broken leg 2, Hand/foot reconstruction 1 | – (0) · 3.14 (17) · 2.25 (28) · 6.67 (51) | 3 | 21 | 6 | 8 | 79 |
| 4 | 121 | Cramp or strained muscle 41, Sprained ankle 27, Broken finger or toe 23, Broken wrist 10, Torn hamstring 7, Concussion 5, Leg reconstruction 3, Torn shoulder 3, Broken leg 1, Hand/foot reconstruction 1 | – (0) · 2.33 (29) · 3.19 (32) · 6.68 (56) | 4 | 35 | 4 | 11 | 76 |
| 5 | 137 | Cramp or strained muscle 53, Sprained ankle 32, Torn hamstring 14, Broken wrist 11, Broken finger or toe 8, Leg reconstruction 6, Concussion 6, Ankle reconstruction 2, Torn shoulder 2, Broken leg 1, Torn knee ligament (ACL) 1, Hand/foot reconstruction 1 | – (0) · 1.95 (37) · 3.42 (31) · 7.17 (60) | 9 | 32 | 11 | 25 | 69 |

Money tests at the last season: median $361,207 (within ±$150k of $500k: **pass**); below zero 5 (fewer than 10: **pass**); clubs with 3 seniors 55 (at least 40: **pass**).

**Easy, 2 of 2 seasons** (no flags)

| Season | AI avg | AI top | Over cap, signed (must be 0) / by promotion | Clubs with 3 seniors | Coach + medic | Stats out of range | AI balances: lowest / median | Below zero | Sold | Free agents | Champion |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 (2026) | 75 | Nyasha Ncube 90 | 0 / 2 | 54 of 60 | 60 | 0 | $184,053 / $489,302 | 0 | 0 | 161 | Vancouver Pacific Orcas |
| 2 (2027) | 75 | Fernanda Silva 90 | 0 / 5 | 55 of 60 | 60 | 0 | −$2,065 / $458,926 | 1 | 0 | 178 | Manila Bay Pearls |

| Season | Injuries (AI clubs) | By type | Avg weeks out by treatment: doctor+physio · right medic · wrong medic · none (count) | Reconstructions | Put on injured list | On it at season end | AI cover promoted | Rob's new staff at AI clubs |
|---|---|---|---|---|---|---|---|---|
| 1 | 105 | Cramp or strained muscle 43, Torn hamstring 23, Broken finger or toe 14, Sprained ankle 12, Broken wrist 6, Concussion 5, Torn shoulder 2 | – (0) · 2.18 (31) · 3.33 (24) · 6.6 (50) | 0 | 20 | 1 | 5 | 68 |
| 2 | 102 | Cramp or strained muscle 30, Sprained ankle 23, Torn hamstring 13, Concussion 12, Broken finger or toe 11, Leg reconstruction 6, Broken wrist 4, Torn shoulder 2, Broken leg 1 | – (0) · 2.32 (28) · 3.18 (34) · 6.24 (34) | 6 | 20 | 6 | 7 | 74 |

Money tests at the last season: median $458,926 (within ±$150k of $500k: **pass**); below zero 1 (fewer than 10: **pass**); clubs with 3 seniors 55 (at least 40: **pass**).

**Hard, 2 of 2 seasons** (no flags)

| Season | AI avg | AI top | Over cap, signed (must be 0) / by promotion | Clubs with 3 seniors | Coach + medic | Stats out of range | AI balances: lowest / median | Below zero | Sold | Free agents | Champion |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 (2026) | 77.5 | Fernanda Silva 92 | 0 / 4 | 53 of 60 | 60 | 0 | $198,550 / $460,009 | 0 | 0 | 160 | São Paulo Beach Warriors |
| 2 (2027) | 78.9 | Beatriz Costa 96 | 0 / 5 | 54 of 60 | 60 | 0 | −$1,824 / $388,881 | 1 | 0 | 188 | Warsaw Vistula Waves |

| Season | Injuries (AI clubs) | By type | Avg weeks out by treatment: doctor+physio · right medic · wrong medic · none (count) | Reconstructions | Put on injured list | On it at season end | AI cover promoted | Rob's new staff at AI clubs |
|---|---|---|---|---|---|---|---|---|
| 1 | 97 | Cramp or strained muscle 41, Torn hamstring 17, Broken finger or toe 15, Sprained ankle 13, Concussion 5, Torn shoulder 3, Broken wrist 2, Leg reconstruction 1 | – (0) · 2.07 (25) · 3.08 (25) · 6.09 (46) | 1 | 22 | 3 | 8 | 78 |
| 2 | 95 | Cramp or strained muscle 31, Sprained ankle 20, Broken finger or toe 14, Torn hamstring 8, Concussion 6, Broken wrist 5, Torn shoulder 5, Leg reconstruction 5, Broken leg 1 | – (0) · 3.06 (19) · 3.78 (18) · 5.92 (53) | 5 | 26 | 5 | 13 | 71 |

Money tests at the last season: median $388,881 (within ±$150k of $500k: **pass**); below zero 1 (fewer than 10: **pass**); clubs with 3 seniors 54 (at least 40: **pass**).


**Weeks out by treatment, all seasons together (AI clubs, not reconstructions):**

| Run | Doctor + physio | Right medic | Wrong medic | None |
|---|---|---|---|---|
| Medium | none happened | 127 injuries, 2.33 weeks (base 3.70) | 128, 3.06 (base 3.06) | 295, 7.03 (base 3.51) |
| Easy | none happened | 59, 2.25 (base 3.54) | 58, 3.24 (base 3.24) | 84, 6.45 (base 3.23) |
| Hard | none happened | 44, 2.50 (base 3.93) | 43, 3.37 (base 3.37) | 99, 6.00 (base 3.00) |

The factors work as written: the right medic takes 3.7 base weeks to 2.3 (×0.63), the wrong one leaves them as they
are, and none doubles them. "Doctor + physio" never happens at an AI club, because the Day 8 deal gives each one
medic; the player's club gets it by hiring both (proved in `injury-treatment` and `staff-roles`).

**Reconstructions:** Medium 28 in 5 seasons, Easy 6 and Hard 6 in 2 (every club's, from the history), averaging 28–40
weeks out.

**The injured list and cover:** 20–35 AI players a season go on the list. 1–11 are on it at a season's end, and 5–25
academy youths a season are promoted as cover. Clubs holding 3 seniors stay at 52–55 of 60.

**Not changed from Day 2:** the Medium median AI balance runs $496k, $427k, $404k, $386k, $361k. Day 2's soak, before
any of tonight's work, ran $470k, $446k, $385k, $366k, $368k. Part 2–6 don't move the money.

**Bugs found by the soak:** none in the game. Two in the soak itself, both fixed:
- Its over-the-cap check counted C-5's allowed promotions (decision 16).
- It counted the player's club, which the harness heals, among the injuries. Your club's players had "reconstructions"
  back to back because a heal left their history in place.

**Balance questions for Rob (numbers and a suggestion; nothing was retuned):**
1. **Reconstructions are nearly all legs, built from cramps.** Medium: 23 of 28 were legs, and 22 of the 28 followed
   at least one cramp. Easy and Hard: 12 of 12 legs, all after cramps. A cramp is 40% of injuries, lasts a week, and
   its area is "leg", so three cramps in a year (or two and a broken leg) become a 30-week reconstruction (60 weeks
   untreated). *Suggestion:* don't count injuries of 1 base week toward the three; or give cramp its own area
   ("muscle") that has no reconstruction. Either is one line in `lib/db/src/schema/injuries.ts`.
2. **Half the AI clubs' injuries go untreated.** The Day 8 deal gives each AI club "a medic", and 29 of 59 got a
   massage therapist or medical specialist. Neither treats an ordinary injury, so those clubs' injuries all run ×2
   (295 of 550 at Medium are untreated, these clubs and a medic off ill together). *Suggestion:* the Day 8 deal's medic is a doctor or physio when one is on the market;
   the massage therapist and specialist come second. One rule for every club, and AI clubs would field their
   injured back sooner.
3. **The money still drifts down at Medium, about $27k a season**, as on Day 2; 5 clubs are below zero at season 5.
   It passes Rob's test at season 5 and would reach the band's edge ($350k) around season 6. Day 2's 30-season run
   turned upward after season 15. *Suggestion:* leave it. Day 2 measured $20,000 drifting *up* about $45k a season,
   so if Rob wants it level from season 1, $19,500 (not yet run) sits between the two.

### Part 9: version 1.1.0, the package, the proof, the patch notes

**1. The version.** `package.json` 0.9.3 → **1.1.0** (`b77d3841`). electron-builder stamps the exe from it: the
packaged exe's file version reads **1.1.0** (product version 1.1.0.0). The launch exe in `vbe-final-12oct-c` still reads
0.9.3, dated 12 Oct 12:49, untouched. The game shows no version anywhere on screen, so there is nowhere else to change.

**2. The package: `C:\build\vbe-1.1.0\win-unpacked\`** (1,425 files, 619 MB; the launch build was 1,235 files,
612 MB). It was made the way the launch build was (docs/packaging.md):
- `node scripts/compress-unity-data.cjs` (fresh `.br` files: .data 80.8%, .wasm 17.4%);
- `pnpm run build` (build #2);
- strip `artifacts/api-server/dist/public`;
- `npx electron-builder --win dir "-c.directories.output=C:\build\vbe-1.1.0"`.

From `update-1` at `1589736f`, whose game code is build #2's. Every packaging check passed:
- only Brotli Unity files (the raw .data/.wasm stripped);
- better-sqlite3 loads under Electron's runtime;
- the starter DB alone in `resources/starter-db`;
- no `steam_appid.txt`;
- steamworks.js unpacked.

No other folder under `C:\build` was written.

**3. It runs** (`scripts/webgl-proof/package-proof.mjs`; screenshots, steps and the window's log in
`C:\build\vbe-1.1.0\proof\`, outside `win-unpacked` so they never upload). The real packaged exe, its own window and
server, started with `--user-data-dir` on a fresh temporary folder (decision 18). The test profile's saves went to
`%TEMP%\vbe-1.1.0-proof-BaPqc2\Beach Volleyball Empire\`, and the first screen was "No profiles yet". Driven through
the window:

| Step | What happened | Screenshot |
|---|---|---|
| start | the game window on its login screen in 1 s; a new profile and an Established career (Sydney Riptide) | 01 |
| title screen | CONTINUE pressed | 02 |
| Day 1 draft | picked in the UI from Free agents: Lani Faumuina $10,500, Naomi Talo $10,500, Qistina Zulkifli $11,500 ("Senior wages $32,500 of $60,000"), then Finish | 03, 04 |
| days pass | Next match: 1 Jan → 17 Feb 2026, the MATCH DAY box (World Tour R1, Bronze, v Paris Sables Royales) | 05, 06 |
| 3D match | Watch Match: Unity loaded in 4 s; the whole match played on the 3D court (6.5 min, with commentary): lost 0–2 (12–14, 8–11), "Result saved." in the result box; Continue pressed; back on the dashboard | 07, 08, 09, 10 |
| more days | Next match: 22 Feb, the next match day | 11 |
| Settings | opened: Display, Sound (music, crowd, commentary sliders), Controls | 12 |

**Rob's save:** `%APPDATA%\Beach Volleyball Empire\volleyball-empire.sqlite` is the same file before and after
(2,404,352 bytes, 13 Oct 17:07, SHA-1 `10796c5e…`). It was never opened.

Two earlier attempts were stopped and fixed in the script:
- The first waited on the title screen, which a reload brings back, while the unattended PC let the window stop painting.
- The second clicked a Watch Match button that isn't in the match day box.

Your save was checked unchanged after each.

**4. Patch notes:** `docs/UPDATE1-PATCH-NOTES.md` (plain words, for the Steam announcement).

**5. Not uploaded.** A ready script for the upload is in the repo, `steam/app_build_5233750-1.1.0.vdf`
(ContentRoot `C:\build\vbe-1.1.0\win-unpacked\`). Rob's Steamworks scripts folder was not changed; the steps are
at the end of this report.
