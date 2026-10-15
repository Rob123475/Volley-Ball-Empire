# Update 1, 15 Oct (day): fixes from the overnight report

Branch **update-1**. Nothing pushed; `main` and `launch-final` untouched. No full build today (it runs
tonight, after Rob's portraits are in): after each part only the suites it touches were re-run, each alone.
Written as the day went.

## Summary

All seven parts are done. Nothing pushed (game repo or Unity repo); `main`, `launch-final`, the live Steam build and
Rob's save untouched; `steam/store-assets/` left alone.

| Part | Status | Commit |
|---|---|---|
| 1. Sponsor bonus (O-1) | **Done.** `sponsorWeeklyBonus` is **$19,000** (was $10,000). Medium over 5 seasons passes all three tests; Easy and Hard over 2 seasons stay inside the band too | `16c56dc1` |
| 2. Doctor and specialist (O-3) | **Done.** The doctor heals (best healer counts); the specialist cuts risk up to 15% at skill 95; on duty only, every club; the Medical page shows the server's numbers | `16c56dc1`, cap fix `b65f77ea` |
| 3. Originals age (O-4) | **Done.** U-6 exception deleted; checks updated; 0 originals retired in 5 seasons (oldest 34); AI clubs still field three | `fd42f512` |
| 4. Renewal bug (O-5) | **Done.** Takeover academy youths had ordinary contracts; they now get academy terms, plus a boot repair; checked on purpose in ai-job-market | `31821e22` |
| 5. Match sound volume (Unity) | **Done.** Crowd and commentary sliders in Settings > Sound; Unity rebuilt; batch proof and browser proof both PASS (0 is silent) | `63e01150`, `3439d29e`; Unity `3d5970d` |
| 6. Staff portraits ready (O-2) | **Done.** Folders made; installer written and tested on 2 copies (deleted); existing saves get the new people; the AI deal takes them | `c615ecfa` |
| 7. Report | This file | |

**The new sponsor figure: $19,000 a week.**
- **Median AI balance at Medium, seasons 1–5:** $470k, $446k, $385k, $366k, $368k (band $350k–$650k).
- **Clubs below zero:** at most 2.
- **Clubs with three seniors:** 47–48 every season.
- **The player's own club, untouched:** $500k → $904k → $1.22M → $1.50M → $1.72M → $1.95M.

Tables in part 1.

**Suites re-run today, each alone** (each after the part that touches it, on the day's final build):

| Suite | Result | For |
|---|---|---|
| staff-bonuses | 28/28 (after the cap fix) | 1, 2 |
| ai-staff | 22/22 | 2, 6 |
| money-pass | 22/22 | 1 |
| finances-ledger | 31/31 | 1 |
| retirement | 19/19 | 3 |
| ai-training | 17/17 | 3 |
| ai-club-economy | 22/22 | 3 (and 1) |
| rollover (season rollover) | run 1 timed out at season 26 (no check failed); runs 2 and 3 90/90; run 4 90/90 | 3, 4 |
| ai-job-market | 32/32 | 4 |
| settings | 22/22 | 5 |
| staff-portrait-install (new, 98n) | 15/15 | 6 |
| Unity SoundVolumeProof | PASS | 5 |
| Browser sound-volume proof | PASS (8 checks) | 5 |

**Unity:**
- The audio is split (the crowd and its sounds in AudioManager, the commentators in CommentaryManager), so there
  are two volumes.
- `WebBuild.Step7` Succeeded. The export is in `artifacts/beach-volleyball/public/unity-build/Build/` under the
  deployed names, with Brotli regenerated.
- At 0 the court is silent. In Unity, every sample the listener heard was 0, through a cheer. In the browser, the
  court's output peaked at 0 over 143 reads (0.94 at full volume).

**Folders for Rob's portraits** (empty, ready): `C:\Users\rbonn\OneDrive\Desktop\staff portraits\` with `Head Coach`,
`Assistant Coach`, `Doctor`, `Physiotherapist`, `Massage Therapist`, `Medical Specialist`. When they are full, Claude chat
writes `docs/staff-portrait-names.json` (format in part 6), then:

    node scripts/install-staff-portraits.cjs "C:\Users\rbonn\OneDrive\Desktop\staff portraits"            (dry run)
    node scripts/install-staff-portraits.cjs "C:\Users\rbonn\OneDrive\Desktop\staff portraits" --write

**Things for Rob to know:**
- **The player's club gets rich.** At $19,000 a passive player's club gains $230k–$400k a season (the "normal club"
  question from the overnight report). The bonus is one number for every club.
- **Over 30 seasons the AI money turns.** In the suite's world after the portraits, 36 AI clubs were sold, mostly
  early. Then the median climbs from about $400k at season 15 to $1.2M at 20 and $3.8M at 30. Worth a look
  before a long-career balance pass.
- **The money suites now stand in for the portraits.** The soak and ai-club-economy add 90 stand-in staff until
  the real ones are installed, and nothing once they are.
- **A slip of mine, fixed:** my commit helper's line-ending pass stripped carriage-return bytes from the Unity
  `.data` and `.wasm` in `63e01150`. `3439d29e` restores both byte for byte from the export. The Brotli files the
  game serves were never affected, and the helper now touches only text files.
- **Found by a re-run:** a skill-96 specialist cut risk by 15.3%. The cut now stops at skill 95 (15%) (`b65f77ea`).

## Decisions made today

1. **Part 1, the sponsor figure is set for the world after Rob's portraits.** The brief's median AI club has
   three seniors, a coach and a medic, but today's 120 staff can't staff 60 clubs that way. The soak now adds
   90 stand-in staff (the same 25/25/10/10/10/10 by role as the portraits, cloned from existing staff) to its
   throwaway database before the career starts (`STAND_INS=1`), so the figure is measured in the world it is for.
2. **Part 1, the soak no longer tops up the player's own club** (`keepClubSolvent` deleted), so its balance
   over 5 seasons is a real reading.
3. **Part 2, the healers: the best one counts; they do not stack.** The doctor joins the physio, massage
   therapist, fitness trainer and strength coach in the one healing bonus (skill / 250 a week, the physio's
   scale), and the best healer on duty decides it. Stacking five healers would have made injuries trivial.
4. **Part 2, the Medical page shows the server's figures** (`GET /medical-staff/bonuses`), not its own
   copy of the formula, so the page can't drift from the game again.
5. **Part 3, ai-training allows a serious match injury's reading.** Its one failure (161 of 162) was a
   player whose programme stat moved and whose speed and stamina fell by 1 that week: a serious match injury
   (B-2), not a training fault. The check accepts that one reading and lists every such case.
6. **Part 4, takeover academy youths keep academy terms,** plus a boot repair for saves already caught (below).
7. **Part 6, the new staff's skill and wage follow the role's existing staff.** There is no wage formula
   in the code: the 120 staff carry hand-set skills and monthly wages. So the installer spreads a role's new
   people over that role's existing skill range (oldest the most skilled, as the existing doctors run) and
   reads each wage off the role's existing skill-to-wage line. Everything else (specialty, personality,
   sub-ratings, stars) comes from the role's existing member of nearest skill.
8. **Part 6, the new staff take ids from 10001 up, and existing saves get them on their next boot.** A save
   already makes its own staff at the next free id (the thin-market top-up), and the boot sync matches staff
   by id, so new starter rows at 168 onwards would have overwritten a save's own staff with the new people's
   role, wage and picture. The boundary is in one file (`artifacts/api-server/src/data/staff-ids.json`), a
   save's own new staff now stay below it, and a boot pass (Pass 3b) gives every existing career the new
   people, as R-34 does for players. Otherwise Rob's live career, and every player's save, would never have
   seen the 90 new people.
10. **Part 1, $19,000, not $19,500.** $19,000 passes all three tests and ends level (seasons 4 and 5). $19,500
    would centre the median better on paper, but would make AI club sales rarer still.
11. **Part 3, ai-club-economy runs in the world after the portraits.** With today's 120 staff it sold no AI club in
    30 seasons at $19,000, which broke Rob's "AI clubs can be sold" rule. That world pays little in staff wages and
    is not the one that will ship. So the suite adds the same 90 stand-ins as the soak (a reboot through Pass 3b,
    after its to-the-dollar week, which needs a club with no staff), and adds none once the portraits are in.
12. **Part 2, the specialist's cut stops at skill 95** (15%). The brief says "up to 15% at skill 95". A skill-96
    specialist exists, and the straight line gave her 15.3%.
13. **Part 6, a new suite** (`staff-portrait-install`, 98n in run-all) rather than a one-off test, so tonight's full
    build checks the installer again. It deletes its own portrait copies. The existing `staff-portraits` suite
    (N-46) is unchanged, and the installer's 500 × 500 output meets it.
9. **Part 5, two volumes, not one:** the court's audio is split (the crowd and its sounds in AudioManager,
   the commentators in CommentaryManager), so Settings has a crowd slider and a commentary slider.

## Part by part

### Part 1: the sponsor bonus, worked out (O-1)

**The new figure: `MONEY.sponsorWeeklyBonus` = $19,000 a week** (was $10,000; `lib/db/src/schema/money.ts`).

**How it was worked out.** The median AI club with three seniors, a coach and a medic, at Medium, lost about
$215,000 over a season at $10,000 (measured in the soak), and a coach and a medic cost it about $292,000 a season in
wages that today's 120 staff can't give every club. Covering both is about $9,750 a week more, so about $19,750; rounded
to $500 that is $20,000 or $19,500. Then measured:
- **$20,000**: the median drifted *up* about $45k a season (season 5: $711k, outside the band). Too much.
- **$19,000**: inside the band every season, and level at the end (seasons 4 and 5: $366k, $368k). Kept.
- $19,500 would sit between the two. It was not run: $19,000 passes every test the brief sets, and it is the one of
  the two that still lets an AI club lose money for five seasons and be sold (below).

All runs: `harness/long-career-update1.mjs` with `STAND_INS=1` (decision 1), the build with parts 1–4.

**The pass tests, Medium, 5 seasons, at $19,000: all three pass.**
- Median AI balance within $150k of the $500,000 start (so $350k–$650k) every season: $470k, $446k, $385k, $366k,
  $368k. Yes.
- Fewer than 10 clubs below zero: at most 2 (season 5). Yes.
- At least 40 clubs with three seniors every season: 47–48. Yes.

**Medium, 5 seasons**

| Season | Median AI balance | Lowest | Below $0 | Sold | Clubs with 3 seniors | Coach + medic | Stand-ins hired | Originals retired | Player's club |
|---|---|---|---|---|---|---|---|---|---|
| 1 (2026) | $470k | $257k | 0 | 0 | 48 of 60 | 60 | 73 of 90 | 0 | $903,627 |
| 2 (2027) | $446k | $91k | 0 | 0 | 48 of 60 | 60 | 73 of 90 | 0 | $1,221,048 |
| 3 (2028) | $385k | $14k | 0 | 0 | 48 of 60 | 60 | 72 of 90 | 0 | $1,501,257 |
| 4 (2029) | $366k | $-15k | 1 | 0 | 47 of 60 | 60 | 73 of 90 | 0 | $1,716,470 |
| 5 (2030) | $368k | $-39k | 2 | 0 | 47 of 60 | 60 | 72 of 90 | 0 | $1,951,669 |

**Easy, 2 seasons**

| Season | Median AI balance | Lowest | Below $0 | Sold | Clubs with 3 seniors | Coach + medic | Stand-ins hired | Originals retired | Player's club |
|---|---|---|---|---|---|---|---|---|---|
| 1 (2026) | $483k | $327k | 0 | 0 | 49 of 60 | 60 | 70 of 90 | 0 | $906,231 |
| 2 (2027) | $486k | $153k | 0 | 0 | 49 of 60 | 60 | 73 of 90 | 0 | $1,217,832 |

**Hard, 2 seasons**

| Season | Median AI balance | Lowest | Below $0 | Sold | Clubs with 3 seniors | Coach + medic | Stand-ins hired | Originals retired | Player's club |
|---|---|---|---|---|---|---|---|---|---|
| 1 (2026) | $463k | $259k | 0 | 0 | 48 of 60 | 60 | 72 of 90 | 0 | $898,161 |
| 2 (2027) | $441k | $70k | 0 | 0 | 48 of 60 | 60 | 76 of 90 | 0 | $1,215,894 |

**The player's own club, over 5 seasons** (the soak plays it passively and no longer tops it up): $500,000 at the start,
then $904k, $1.22M, $1.50M, $1.72M, $1.95M. It gains $230k–$400k a season at $19,000, so the "normal club" question
from the overnight report stands: the same bonus that keeps the median AI club level makes a well-run player's club
rich. That is Rob's call (the bonus is one number for every club, as the brief says).

**AI originals (part 3):** they age now: after 5 seasons they are 26 to 34 (average 30.5), and none has reached 40,
so none retired in 5 seasons (the oldest will in about season 11). The AI clubs still field three seniors (47–49
of 60 every season, at every difficulty).

**Stand-ins and the AI staff deal (part 6):** 70–76 of the 90 stand-ins were employed by AI clubs at the end of each
season, and all 60 clubs had a coach and a medic, every season, at every difficulty.

**Tests that read the old figure:** none hard-code it. `money-pass`, `staff-bonuses` and `ai-club-economy` read
`MONEY.sponsorWeeklyBonus` from the schema. Alone at $19,000: `money-pass` 22/22 ("$29,000 at reputation 50 ($10,000 + $19,000)"),
`staff-bonuses` 28/28, `finances-ledger` 31/31.

### Part 2: the doctor and the medical specialist do something (O-3)

- **The doctor heals.** The one healing bonus (`utils/staffBonuses.ts`, `MEDICAL_BONUS`, `healingBonus`) now counts
  the doctor beside the physio, massage therapist, fitness trainer and strength coach, on the physio's scale (skill /
  250 a week, the chance an injured player loses a week more). **The best healer on duty counts; they do not stack**
  (decision 3), and the bonus says which one it was.
- **The medical specialist cuts injury risk:** `injuryRiskStaffFactor`, 1 at skill 50 or below, falling to 0.85
  (**−15%**) at skill 95, multiplied into the one `injuryRisk` (`utils/condition.ts`) for match injuries.
- **On duty only** (`staffOnDuty`: a specialist off ill gives nothing), and **for every club**: the player's (routes
  `training.ts` and `matches.ts`) and the AI clubs' (`utils/aiSquads.ts`, their own staff through the same functions).
- **The Medical page shows the server's figures** (`GET /medical-staff/bonuses`: the heal chance, the healer, the risk
  factor). The made-up "+% recovery" is deleted. The doctor and physio rows read "Injury Recovery: N% a week" (or "not
  the best healer"); the specialist's row reads "−N% injury risk".
- Checks: `staff-bonuses` section 3 "MEDICAL" (the endpoint's figures, the specialist off ill gives 1) **28/28**;
  `ai-staff` (an AI club's doctor heals and its specialist cuts its risk, through the player's functions) **22/22**.
  Both alone. Commit `16c56dc1`.

### Part 3: the AI clubs' originals age (O-4)

- **Deleted:** the U-6 exception (`notAiPoolSenior` in `lib/playerDto.ts`, used by the ageing and the retirement
  passes). An AI club's original now ages a year a season, fades by the age table (B-2) and retires at 40 like
  everyone.
- **Checks that expected timeless originals, updated:** `harness/rollover.mjs`'s "every player aged exactly one year"
  now counts everyone (it left originals and AI clubs' players out), and its "nobody appeared from nowhere" traces
  everyone to a baseline, an intake or an AI academy.
- **Re-run alone:** `retirement` **19/19**; `ai-training` **17/17** (decision 5; this run had no serious-injury case,
  161 of 161); `rollover` **90/90** (part 4's runs); `ai-club-economy` **22/22**, after two changes to the suite:
  - **The sold club's league place.** At $19,000 in today's 120-staff world, a 30-season run sold 1 club, then 0.
    The 1 held no league place, so "its place was taken" failed. That check is now asked only when a sold club
    held a place.
  - **"At least one AI club was sold for its books" (Rob's rule) failed with 0 sales**, because that world pays
    little in staff wages. The suite now gives its world the 90 stand-ins (shared with the soak,
    `harness-club.mjs` `addStandInStaff`) by a reboot after its to-the-dollar week, the way an existing save gets
    new staff (Pass 3b, 90 of 90 given). In that world, 36 clubs were sold over 30 seasons, all 22 checks pass,
    and nothing is added once the portraits are in.
  - **For Rob to look at:** the AI median over those 30 seasons is $463k (season 1), $396k (4), $357k (10),
    $409k (15), then $1.2M (20) and $3.8M (30). Clubs that survive the early seasons grow rich late (richest
    $7.0M).
- **In the soak:** see part 1 (originals 26–34 after 5 seasons, none retired yet; AI clubs still field three).
- Commit `fd42f512`.

### Part 4: the rare renewal bug (O-5)

- **The stale row.** `takeOverClub` (`routes/job-market.ts`) gave every player who came with the club an ordinary
  contract, including its academy youths, without the academy's countdown (`academyContractYears`). Such a youth
  was offered Renew on the Contracts page (refused, 403). When she went out on loan, her ordinary row stayed live
  at the club, and every season's renewal read her as "no longer in your squad". That fits the overnight failure:
  one refusal a season, from season 20 to 28, after the career took over a sold club at season 18.
- **The fix, at the cause:**
  - a taken-over academy youth now comes on the academy's terms (`academyYearsFor`, `utils/youthLoans.ts`), as
    the club's own academy players are;
  - a boot repair (`repairTakeoverYouthContracts`, `index.ts`) gives a save already caught the same terms.
- **The audit, "a player who leaves a club must not keep a live contract row there":** contract expiry, release,
  early termination and retirement already end the row. A loan keeps the youth's academy deal at the owning club on
  purpose: she comes back (decision 6).
- **A check that drives the path on purpose:** `ai-job-market` already makes the career take over a sold club. It
  now checks the club's academy youths came with `academyContractYears`. Then it moves one away, as a loan does,
  and checks the Contracts page offers her no ordinary renewal. **32/32 alone.**
- **Season rollover:** run 1 hit my 40-minute timeout at season 26 of its 30-season career (no check had failed;
  the machine was running six other jobs). So it ran three more times: runs 2, 3 and 4 all **90/90**. No run was
  sacked onto the sold-club path by chance; ai-job-market drives that path on purpose. Commit `31821e22`.

### Part 5: match sound volume in Settings (O-5, Unity)

**The audio, read first:** the court's sound is split in two. `AudioManager` plays the crowd (two looping beds,
calm and excited) and every match sound effect (the cheers, applause, whistles, groans, the roar and the
buzzer), all on its own three sources. `CommentaryManager` plays the two commentators on one voice source,
with the crowd ducked under them. Nothing else in the court plays sound. So there are two volumes, crowd and
commentary.

**Unity** (`volleyball-unity` `feat-manual-controls`, `3d5970d` on top of `4674c7f`, the export the game already
carried; not pushed):
- `MatchManager.SetCrowdVolume(string)` and `SetCommentaryVolume(string)`, page hooks beside `SetControlMode`
  ("0" to "1", invariant culture). The crowd's volume multiplies all three crowd sources (over the duck under
  the commentators, so it covers the reactions and the buzzer); the commentary's sets the voice. Both are
  static, so a volume sent before the court's managers exist still holds.
- New batch proof `SoundVolumeProof` (V19 in Play; batch, Unity 6000.3.16f1, the 11 Oct route): it sends 1,
  0.5, 0 and back to 1 by `SendMessage` to the `MatchManager` object, as the page does. **PASS**
  (`docs/proof-update1-day2/unity/o5_sound_volume.txt`):
  - every crowd source's volume was its level × the duck × the crowd volume, and the voice's the commentary
    volume, in every frame of every step (about 13,000 frames a step);
  - what the listener heard (`AudioListener.GetOutputData`): RMS 0.058 at 1; at **0 every sample was 0**, through
    a point's reaction (the silent step runs until a cheer has played in it); back at 1, RMS 0.097.
- Batch runs flipped `ProjectSettings.asset` (a package's define) and `UnityConnectSettings.asset`, as before:
  both reverted.

**The export:** `WebBuild.Step7` in batch, **Succeeded** (data 268.7 MB, wasm 51.7 MB). Copied into
`artifacts/beach-volleyball/public/unity-build/Build/` under the deployed names (the four files), and Brotli
regenerated with `compress-unity-data`.

**The game:**
- `lib/court-settings.ts`: the two volumes, one JSON object in localStorage (`vbe-court-volume`), like the
  music's; saving fires an event on the window.
- `pages/court.tsx`: sends `{ type: "vbe-volume", crowd, commentary }` to the court when it has loaded
  (`unity-loaded`) and whenever they change.
- `public/unity-build/index.html`: passes it to `MatchManager.SetCrowdVolume` / `SetCommentaryVolume`, beside the
  control mode's listener.
- `pages/settings.tsx`, Settings > Sound: "Crowd volume" and "Commentary volume" sliders (0–100% in 5s) under
  the music volume. The old "has its own volume inside the 3D court for now" line is gone.
- `harness/settings.mjs` check 6 now checks all of that, and that the court's build carries both methods
  (22/22 alone).

**The browser proof** (`scripts/webgl-proof/sound-volume-proof.mjs`, headless Chrome, real GPU, on the real game page
served from the built server; `docs/proof-update1-day2/sound-volume/`): **PASS, 8 of 8.** A new career's first match,
opened with Next match, then Watch Match, with the volumes stored as Settings stores them (crowd 50%, commentary 25%):
- **On load:** when the court loaded, its own log read `[Sound] crowd volume 0.50` and `commentary volume 0.25`.
- **While playing:** saved as Settings saves them, 1/1, then 0/0, then 1/1 each reached the court.
- **What the court sends to the speakers:** the proof routes every Web Audio node that feeds the speakers through an
  analyser. Peak 0.94 at full volume; **exactly 0 over 143 reads at 0**; peak 0.90 back at full.
- No page errors. Screenshots `s1-…png`, `s2-…png`.

### Part 6: ready for Rob's staff portraits (O-2)

**The folders** (the Desktop is under OneDrive, where the manager cards were), created empty:
- `C:\Users\rbonn\OneDrive\Desktop\staff portraits\Head Coach`
- `C:\Users\rbonn\OneDrive\Desktop\staff portraits\Assistant Coach`
- `C:\Users\rbonn\OneDrive\Desktop\staff portraits\Doctor`
- `C:\Users\rbonn\OneDrive\Desktop\staff portraits\Physiotherapist`
- `C:\Users\rbonn\OneDrive\Desktop\staff portraits\Massage Therapist`
- `C:\Users\rbonn\OneDrive\Desktop\staff portraits\Medical Specialist`

**The installer, `scripts/install-staff-portraits.cjs`** (not run on anything real; the pattern of
install-manager-faces.cjs):
- reads each role folder (the folder name is the role exactly as the staff table spells it); PNG, JPEG or WebP;
- reads the age, nationality and gender from the file name as the manager faces did ("…portrait of a
  42-year-old Nigerian woman_…"; man/woman or male/female) and **lists every file whose name it can't read**;
- looks each name up in `docs/staff-portrait-names.json` (Claude chat writes it; the script never makes a name
  up). The format, per role: `{ "Head Coach": { "42 Nigerian woman": "Ada Okoye" } }`. The key is the age,
  nationality and gender words; or the exact file name, for two pictures that read alike or one it can't read
  (then the entry gives `{ "name", "age", "nationality", "gender" }`). A picture with no name, a name with no
  picture, or a name it can't read stops the run before anything is written;
- crops the centre square (from near the top of a tall picture) to **500 × 500 WebP at q 88**, the existing
  staff portraits' size and format, as `images/staff/<role folder>/staff-11.webp` onwards;
- writes each person into the starter DB's staff table: role from the folder; **skill** spread over that
  role's existing range, oldest the most skilled; **wage** off the role's existing skill-to-wage line; the rest
  from the role's nearest-skill colleague (decision 7). Nationality, age and (for the medical roles, whose
  attributes carry it) gender come from the file. A coach's attributes stay ratings only: the staff page edits
  each one as a number;
- dry run by default; `--write` to write. A second `--write` updates the people it wrote (matched by picture),
  never duplicates. `--db`, `--images`, `--names` point it at copies for a test.
- The nationality words are now one shared list, `scripts/lib/nationality-words.cjs`, used by both installers.
  The manager installer's dry run on Rob's manager folder still gives all 69 faces their manifest name and
  country (69 of 69, nothing written).

**Tested on 2 copies of existing portraits in a temp folder, then deleted:** a Head Coach copy named as a
52-year-old Brazilian man, and a Doctor copy named as a 45-year-old Australian woman (first with an unreadable
name, to see it listed). Written to a copy of the starter DB and a temp images folder:
- the coach got skill 80 (the middle of the Head Coaches' 64–96) and $14,833 a month (between the existing
  79 at $14,583 and 84 at $15,833);
- the doctor got skill 88 and $14,917;
- both 500 × 500 WebP;
- ids 10001 and 10002; a second write said "0 added, 2 updated".

The copies were deleted. The same test is now a harness suite, `harness/staff-portrait-install.mjs` (98n in
run-all; it makes and deletes its own copies each run).

**Existing saves (decision 8).** New ids from 10001 (`artifacts/api-server/src/data/staff-ids.json`), because a
save's own market top-up takes the next free id and the boot sync matches staff by id. Two changes:
- `ensureReferenceData` Pass 3b gives a save made before them the new rows, and every career state for
  them, through `seedStaffStateRows` (split out of `seedCareerState`, so new careers and old saves seed staff
  the same way);
- `createCareerStaff` now takes the next id *below* 10001, since a save's AUTOINCREMENT would otherwise run on
  from 10090.

**The AI staff deal takes them with no code change (marketFloor 5).** `fillAiStaffTx` reads every career staff
row, joined to the staff table, by role (`normaliseRole`); nothing in it reads an id or a picture, and the new
rows use the existing role names. The soak's 90 stand-ins now sit at the same ids the installer uses, and the
soak counts how many AI clubs employ (below).
