# Update 1: overnight run, 14–15 Oct 2026, morning report

Branch **update-1**, started from 32b26f8. Nothing pushed. `main` and `launch-final` untouched.
Written as the night goes, part by part. The newest state is at the bottom of each section.

## What got done

All ten parts were built, in order, each committed on update-1 (details per part at the bottom):

1. **1a** The AI clubs take a coach and a medical member each on Day 8, from what is spare (5 of every
   role always left for you); wages from their balance; existing careers dealt at boot. **1b** The
   injured-wage line is 4 weeks.
2. **Item 4c** AI clubs hold 3 seniors, get the player's injury roll after their matches, heal on the
   same weekly clock (free agents too), forfeit with fewer than two fit; injured free agents ask 50% /
   75%; long-injured AI seniors aren't renewed; a full AI club can buy by releasing its weakest.
3. **AI staff bonuses** through the player's own functions (training XP, healing; off ill gives nothing).
4. **B-1/B-2/B-3** The development profile counts; the age table (with a peak shift) replaces the old
   age modifier; seasons end with a fade; serious injuries cost speed, stamina and XP; the Watch list,
   re-scouting and every scout report kept.
5. **Pre-season camp** (camp / Rest / Skip on day 7 of the off-season), AI clubs too.
6. **Difficulty** Easy / Medium / Hard, in both wizards and on Profile, driving AI training and camps.
7. **Kits** too alike → the away pair wears white; ladder dots are the real kit colours.
8. **Settings** (display, sound, controls, rules), with the gear in the sidebar and on the title screen.
9. **Build and test** (below).
10. **Soak** (below).

New suites (all in run-all): ai-staff, ai-injuries, scouting-history, preseason-camp, difficulty,
settings; club-kits extended. A soak script, harness/long-career-update1.mjs (not in run-all).

## Build counts

- Typecheck (the build's first step, run once on its own first so the build could reach the harness):
  clean on the first try.
- **Full build 1** (`pnpm run build`, 14 Oct 23:10 – 15 Oct 00:43): **92 of 112 suites passed, 20 failed**:
  board review, olympic tournament, academy intake, contract terms, youth rebirth, ledger words, ai club
  economy, money pass, youth ratings, game dates, player pictures, ai buyable, ai job market, salary cap,
  ai staff, ai injuries, scouting history, preseason camp, gameplay smoke, season rollover. Many were
  never run against items 4a/4b (the cap and the draft), which were built without a build on 14 Oct.
  Each failure's cause and fix is in part 9 below.

## Decisions made overnight

(Each with what Rob may want to change.)

1. **AI staff (1a): dealt from what is spare, no new staff made.** The generators only copy the
   existing named people, so new staff need new portraits. 10 clubs get a coach and 20 a medical member
   on Day 8; the rest fill as contracts end. *Change:* make the portraits (below) and add the people.
2. **AI staff pay the player's signing fee** (one month's salary) from their balance, and a club that
   can't pay it waits. *Change:* drop the fee for AI clubs if Rob prefers wages only.
3. **AI staff come with a club the player takes over**, on their contracts, as its players do.
4. **Staff contract ends keep the wage** (bug fix: it was set to $0, so a re-hire was free).
5. **A third AI senior only if the club can afford and fit her** (4c-1). The first two come by any
   means, as before. About 17 clubs hold 2 at the start because of the cap. *Change:* raise the cap,
   or let AI clubs carry a cheaper interchange.
6. **Fitness and fatigue stay off for AI players** (the brief's own rule: condition.ts lets injuries
   run without them). So an AI pair's risk is the base plus its stamina, the weather and Fitness Guru.
7. **The player's own opponent never forfeits to injuries.** AI-vs-AI matches with fewer than two fit
   are walkovers; for the player's match, the opponent fields its best two fit, or its best two if it
   has fewer fit, so the player's match always happens. *Change:* make it a walkover win for the player.
8. **AI clubs don't buy injured players from other clubs**; only a free agent is a gamble they take,
   and only with two fit (4c-5).
9. **AI training has no session coach** (the player books one per session); AI clubs get the staff
   bonus only (part 3).
10. **The fitness trainer's fatigue bonus does nothing for AI clubs**: AI fatigue is off (6), and the
    Day 8 deal gives AI clubs coaches and medics, not fitness trainers.
11. **Medical staff don't lower injury risk, for anyone.** For the player's club the server uses medics
    only for healing: the best of Fitness Trainer, Strength Coach, Massage Therapist and
    Physiotherapist gives a chance of an extra week off. **Doctor and Medical Specialist do nothing on
    the server** for either club (the Medical page shows a doctor "+% recovery" that nothing reads).
    I didn't invent a new rule. *Rob may want:* doctors and specialists to cut injury risk or speed
    healing, for every club.
12. **AI staff fall ill too** (same odds, no Club News), so "off ill gives nothing" means something
    for AI clubs.
13. **B-2, which stat's age counts in a session:** the stat the programme builds (its primary stat).
    The secondary stat rides on the same XP, as before.
14. **B-2, how much a fading stat loses:** speed −1 a season from 26, −2 from 30; power and stamina −1
    or −2 at random each season; defense, serve and block −1. A workEthic of 80+ halves it; a half
    point is a coin flip. *Change:* any of these in AGEING (lib/db/src/schema/ageing.ts).
15. **B-2, the AI clubs' originals still don't age** (U-6: an original at an AI club is timeless), **but
    they fade at the age they are**, because the brief says every player. So an older original slowly
    declines and her club replaces her. *Rob may want:* timeless originals not to fade either, or to
    age like everyone (they would then retire at 40 and the AI world would rely on free agents and
    youth).
16. **B-1, the profile counts in the shared session rule only** (player's sessions, AI training, the
    camp). The academy's weekly development has its own rule and is untouched (the brief: the
    academy's own youth bonus stays).
17. **B-2, "read from the injury history":** the injury_history table only holds the player's club, so
    each player's serious injuries are counted on her career state (serious_injuries) when they
    happen, for every club. Older injuries aren't counted backwards.
18. **Camp sessions run on the camp's last day** (all at once), not spread over it; and a camp only
    builds through the shared session rule with the club's staff bonus and manager's Coach (no session
    coach, philosophy or facilities: it's away from home).
19. **Power House trains Power Camp every session** (it builds power first and block second); no
    programme builds block first.
20. **AI camp affordability:** 3× the camp's cost in the bank (the 4a rule's "three months' wage"
    margin). An AI club picks its weakest pair of stats and the longest length it can afford, or one
    shorter on a coin flip.
21. **The AI clubs choose on the player's day 7** (one moment for the whole world), and only camps that
    end before the next season's first round.
22. **If the player never chooses, it's a Skip.**
23. **Kits "too alike":** RGB distance under 100 (of 441) between the two primary colours. The away
    pair wears white with its own primary as the trim (near-black if the home kit is near white).
    *Change:* KITS.tooAlike in utils/kits.ts.

## Skipped, and why

- **Match sound volume** (part 8): the 3D court takes no volume message; it needs a Unity method and a
  rebuild, which the brief said not to do. Music volume and mute are in Settings.
- **More AI staff than are spare** (part 1a): needs 90 new portraits (below). The deal takes what is
  spare and fills as contracts end.
- **The three GPU proof scripts** in scripts/webgl-proof/ still look for the match screen's old Auto/Manual
  button; they are run by hand with a GPU, not by the build, and were not updated.

## Images Rob must make

**Staff portraits (part 1a), 90 in all,** so every one of the 60 AI clubs can have a coach and a medical
member on Day 8 while 5 of every role stay on the market:

| Role | Have | Must make |
|---|---|---|
| Head Coach | 10 | 25 |
| Assistant Coach | 10 | 25 |
| Doctor | 10 | 10 |
| Physiotherapist | 10 | 10 |
| Massage Therapist | 10 | 10 |
| Medical Specialist | 10 | 10 |

(The coaches can be split any way between Head and Assistant, 50 in all. Add one more of a role for each
of that role the player hires in his first week, if Rob wants 5 left even then.) Each new member needs a
name, nationality, age, skill and wage too, as in utils/staff-generator.ts; once the pictures exist, the
new people go in the staff data and the deal takes them with no code change (AI_STAFF.marketFloor stays 5).

## Olympic clashes with the pre-season camp

**None possible.** The Olympics are played inside the season (between World Tour round 70 and the World
Finals, in Olympic years), and qualifying is the season's World Tour points with no separate dates. A camp
runs in the off-season and must end before the club's first match of next season, so it can never overlap
an Olympic or qualifying date. No length is withheld for them.

## 5-season soak tables

## Rob's on-screen check list for all of Update 1

Use a **test profile** (not your Steam save). In this order:

1. **Faces.** New career: the wizard's face picker; pick a face and read its speciality. Profile shows
   the face, the speciality and (new) **Difficulty**. Club pages show AI managers' faces.
2. **The draft.** Still in the wizard, pick **Easy / Medium / Hard** (new, beside Underdog / Established).
   Then the Day 1 draft: draft a star from an AI club, plus one or two more; the calendar won't move
   until you have 2 or 3. Play a day and open that AI club: it has filled its gap.
3. **The salary cap.** Team and Finances show "Senior wages $X of $60,000". Try a signing that would go
   over: it is refused, with the amount to free up.
4. **Staff on Day 8.** Hire a coach or medic in the first week; play to Day 8: the Staff and Medical
   Markets lose some (5 of every role always stay); open an AI club to see its coach/medic.
5. **An injured bargain.** Play a few weeks; on the Player Market find a free agent with the red
   "injured, out N weeks" box: she asks half (4+ weeks out) or three quarters of her wage. Sign her at
   that and check the contract keeps it.
6. **AI training and scouting history.** Watch AI clubs' ratings creep up over a few weeks (every 2 weeks
   on Medium). Hire a Scout, scout a player, star her (Watch List tab), and scout her again after 5 days:
   the card shows two dated reports.
7. **A camp.** Play to the end of the season: on day 7 of the off-season the Dashboard asks for a camp,
   Rest or Skip. Book a camp (a length that won't end before your first match is greyed out with the
   reason); the ledger shows "Pre-season camp"; your seniors can't train while there; at the end their
   XP and fatigue go up. (Or choose Rest and see fitness 100 / fatigue 0 at the new season.)
8. **Difficulty.** Profile says which. On Easy the AI clubs train every 4 weeks and never camp; on Hard
   every week and they camp if they can afford it.
9. **Kits.** Pick a club colour close to an AI club's kit and watch a match against it on the 3D court:
   the away pair wears white. Ladders: each club's dot is its kit colour.
10. **Settings.** The gear on the title screen and in the sidebar: Windowed/Fullscreen, a window size, the
    zoom slider (all apply at once and again next launch); music volume and mute; Auto/Manual and the
    controls list (the match screen no longer has the Auto/Manual button; Tab still switches on court);
    Rules shows "New in Update 1".

---

## Part by part

### Part 1a: the AI clubs' staff on Day 8 (done, not yet run)

**Can the game make new staff without new pictures? No.** utils/staff-generator.ts and
utils/medical-staff-generator.ts only copy the named people already in the game (same name, same
portrait), and every one of the 120 staff (10 per role) has a portrait made for them under
images/staff/. So I took the brief's second path: deal what is spare, and keep at least 5 of every
role on the market for the player.

What is built (utils/aiStaff.ts, one constants block `AI_STAFF`):
- `career_staff_state.pool_team_id`: the AI club that employs someone, stored exactly as the
  player's staff are, so `loadStaffTx(tx, cid, { poolTeamId })` reads an AI club's staff the way
  `loadStaff(cid, { teamId })` reads the player's (Rob's correction of 14 Oct). The market
  ("unhired") is now "nobody's": neither the player's club nor an AI club. The Staff and Medical
  Markets and both hire routes refuse anyone at an AI club.
- **Day 8** (`career_saves.ai_staff_deal_on`, set to the career's first day + 7 when it is made):
  every AI club, in random order, gets one coach (Head or Assistant, random) and one medical
  member (Doctor, Physiotherapist, Massage Therapist or Medical Specialist, random), on a normal
  contract of random length (6m / 1s / 2s, the player's own `contractEndDate`), as long as the
  role keeps 5 on the market. The signing fee is the player's rule (one month's salary), paid from
  the AI club's balance; a club that can't pay it waits.
- **Wages:** weekly, from the AI club's balance, in `chargePoolClubsWeekTx`, through the same
  `weeklyWageBill` as its players. Never the salary cap (the cap's bill reads seniors only).
- **Every day after Day 8:** AI contracts that have ended go back to the market, and a club with no
  coach (or no medical member) takes one when a role has a spare. So clubs that missed out fill
  one coach and one medical member at a time, as contracts end (the player's and the AI's).
- **Older careers:** dealt once at boot, the same way, on their current game date
  (`dealAiStaffToOlderCareers`, index.ts).
- **A takeover:** when the player takes over an AI club, its staff come with it on their
  contracts (as its players and academy already did).
- **Bug fixed on the way:** when the player's staff contract ran out, the calendar set their wage
  to $0, so a re-hire cost $0 and was paid $0. A contract that ends now leaves the wage as it was,
  exactly as a release does (one patch, `STAFF_BACK_ON_MARKET`, for the player's and the AI's).
- New suite **harness/ai-staff.mjs** (run-all 98h).

**How many clubs get staff today:** 10 of the 60 AI clubs get a coach (5 Head + 5 Assistant are
spare) and 20 get a medical member (5 of each of the four roles are spare), fewer if the player
hires a coach or medic in his first week.

### Part 1b: injured players come cheap, in weeks (done)

`MONEY.salaryCap.injuredLongMonths = 3` is now `injuredLongWeeks = 4` (lib/db/src/schema/money.ts).
Out 4 weeks or more: 50% of her wage; less: 75%. The AI no-renewal rule reads the same number. Nothing
read the old constant yet: both rules are built in part 2 (4c items 3 and 4), on this one.

### Part 2: item 4c in full (done, not yet run)

All of 4c, the full-club buy and part 1b, as written in docs/STATUS-UPDATE1-SALARY-CAP.md
("Overnight 14–15 Oct"). In short: AI clubs refill to 3 seniors (a third only if they can afford and fit
her); AI players get the player's own injury roll after their matches (Fitness Guru counts for AI
managers now) and heal on the same weekly clock, free agents too; an AI club with fewer than two fit
forfeits; an injured free agent asks 50% (4+ weeks out) or 75% through the one asking-wage path, and
signs at it; a long-injured AI senior isn't renewed; AI clubs gamble on an injured free agent only with
two fit; a full AI club buys by releasing its weakest. Suite harness/ai-injuries.mjs (run-all 98i).

### Part 3: AI staff bonuses (done, not yet run)

An AI club's staff are read exactly as the player's (`loadStaffTx(tx, cid, { poolTeamId })`) and go
through the same functions:
- **Head Coach and Assistant Coach → AI senior training XP:** `trainingStaffBonuses(...).xpMultiplier`
  in `aiSeniorsTrainWeekTx`, the same number the player's sessions get.
- **Medical → healing:** the one weekly `injuryRecoveryWeekTx` (part 2) takes the club's own medics.
- **Off ill or hurt gives nothing:** the AI clubs' staff now fall ill on the player's odds
  (`aiStaffAbsenceDayTx`, utils/staffIllness.ts; not written to Club News), and every bonus reads only
  staff on duty (`staffOnDuty`), as for the player.
- Checks added to harness/ai-staff.mjs (section 8); ai-training.mjs's source check follows the new call.

**Decisions (see "Decisions made overnight"):** the fitness trainer's bonus (fatigue) and medical
"injury risk" have nothing to act on for AI clubs; details below.

### Part 4, B-1 and B-2: the development profile, age and injuries (done, not yet run)

One constants block, **lib/db/src/schema/ageing.ts** (`AGEING`), read by the server and by the Training
page's preview (aliased `@shared/ageing`, as money.ts is now `@shared/money`).
- **B-1:** `profileXpMultiplier` (workEthic and coachability's average: ×0.8 at 40 to ×1.2 at 100) in the
  shared XP rule `trainingSessionXp`, so the player's sessions and the AI clubs' training both get it.
  `pronenessFactor` (×0.7 at 1 to ×1.3 at 100) in the one `injuryRisk`. A boot pass
  (`giveEveryPlayerAProfile`, utils/player-development.ts) gives every player with no profile one, and
  every profile a peak shift; an AI club's original (made from a continental pool player, given the
  default potential) also gets a weighted potential (Average 60, High 28, Elite 10, Generational 2).
  New originals get both when they are made. Fixed for good. Consistency and leadership unused.
- **B-2:** `getAgeModifier` is deleted (server and the Training page's copy). The age table by stat with
  a peak shift of −2..+2 replaces it. **The session's age factor is the one for the stat the programme
  builds** (Power Camp: power's phase; Recovery: holds ×1).
- **Season end:** `fadeAgedPlayersTx` (utils/seasonFade.ts) runs in the rollover after ageing and
  retirement, for every player in the career (AI clubs' and free agents too), never below 1.
- **Injuries:** an injury of 4+ weeks (MONEY.salaryCap.injuredLongWeeks, the one "serious" number)
  takes 1 point off speed and stamina at once and adds to `career_player_state.serious_injuries`; each
  takes 5% off her training XP for good, at most 20% (`newInjuryPatch`, every club's injuries).
- Suites changed knowingly: ai-training.mjs's XP oracle now uses the age table, the profile, serious
  injuries and the AI club's staff bonus; its "nothing else moved" check no longer includes injuries
  (AI players are hurt in matches now).

### Part 4, B-3: watching players (done, not yet run)

- **Watch list:** a star on every Player Market card (any club or none), and a **Watch List** tab on
  the Player Market. Stored per career (`career_watch_list`; `GET /watch-list`,
  `POST /players/:id/watch {watch}`).
- **Re-scouting** whenever the club likes once a report is in, at the same price and 5 days. One scout
  at a time on a player (a second while one is out is refused, as before).
- **Every report is kept** (`career_scout_reports`: sent, in, her rating, the scout's potential reading).
  The card shows the history, oldest first ("Mar 2027 71 → Jun 73 → Sep 76", then the latest potential
  reading). While a re-scout is out the card keeps the old report and says the new one is coming; when
  it is in it becomes her report (`applyDueScoutReportsTx`, every game day).
- **Reports no longer lapse:** `lapseMarketScouting` and its call in the rollover are deleted. (Staff
  and medical scouting still lapse, as the brief didn't mention them.)
- **AI clubs' players and moved players:** scouting is per career and player, whoever she plays for, so
  an AI club's player is scouted like a free agent. **One thing was wrong:** when an AI club signed a
  player, it cleared the player's scouting (`signToAiClub`), so a scouted free agent who moved to an AI
  club lost her report. That clearing is removed. New suite **harness/scouting-history.mjs** (run-all 98j)
  checks both; player-market.mjs's season-end check now expects the report kept (knowingly changed).
- The Watch list stars the senior market's cards; the youth pool's cards don't have one (the youth pool
  is its own list).

### Part 5: the pre-season camp (done, not yet run)

- **Carry-over (Rob):** I found nothing at the season rollover that heals, rests or resets injury,
  fatigue or fitness (seasonRollover.ts writes none of them; the only `fitness: 100` in the server is a
  new youth's starting value). Healing stays on its weekly clock, off-season included. **Bench rest
  confirmed:** every game day the calendar rests every player at the club, bench included: fitness +2
  and fatigue −5 (injured: +1 and −3), utils/condition.ts `REST_RECOVERY`.
- **When:** the off-season starts with the club's last match (`career_saves.offseason_started_on`,
  stamped when the off-season window opens); on its **day 7** the choice opens: a Dashboard notice and
  a day line, and the new **Pre-season** page (`/preseason`). If he never chooses, it is a Skip.
- **A camp must end before the club's first match of next season** (the first round it played this
  season, on next season's dates). A length that wouldn't, or that the club can't pay for, is shown
  but can't be booked, with the reason.
- **Olympics:** checked. The Olympic tournament is played in Olympic years between World Tour round 70
  and the World Finals (inside the season), and qualifying is the season's World Tour points, with no
  separate qualifier dates (utils/olympics.ts). So **no camp length ever overlaps an Olympic date** and
  none is withheld for them.
- **Camps:** Altitude Camp (speed + stamina: Agility Camp / Conditioning), Power House (power + block:
  Power Camp each time, since no programme builds block first), Beach Academy (serve + defense: Serving
  Academy / Defensive Systems, and morale +5). 1w / 2w / 4w: 3 / 6 / 12 sessions at ×1.5 / ×1.75 / ×2,
  $10,000 / $20,000 / $35,000, fatigue +10 / +20 / +30 at the end. Each session goes through the shared
  XP rule (age, profile, potential, serious injuries, the club's staff bonus and its manager's Coach),
  times the camp's multiplier; the sessions run on the camp's last day. Paid from the balance, ledger
  "Pre-season camp (Power House, 2 weeks)". **No normal training for seniors while at camp** (the
  academy carries on).
- **Rest:** free; no senior training for the rest of the off-season; when the new season opens, every
  senior who isn't injured has fitness 100, fatigue 0 and morale +5.
- **AI clubs** choose on the player's day 7, by difficulty (part 6): never / a coin flip each / every
  club, only if it has 3× the camp's cost in the bank. It picks the camp for its weakest pair of stats
  and the longest length it can afford, one shorter on a coin flip. AI camps add no fatigue (AI
  fitness and fatigue are off, item 4c).
- Every number in **lib/db/src/schema/preseason.ts** (`PRESEASON`). `roundToDate` moved from
  routes/calendar.ts to utils/roundDates.ts so the camp uses the same rule. New suite
  **harness/preseason-camp.mjs** (run-all 98k).

### Part 6: difficulty, Easy / Medium / Hard (done, not yet run)

- One table, **lib/db/src/schema/game-difficulty.ts** (`GAME_DIFFICULTY`): Easy (AI train every 4 weeks,
  no camps), Medium (every 2, a coin flip each for a camp if affordable), Hard (every week, every club
  that can afford a camp). Nobody's player ratings change.
- Picked in **both new-career wizards** (new-career.tsx and Career Management's new-career window),
  beside Underdog / Established; default Medium. Stored on `career_saves.game_difficulty`, fixed for the
  career, shown on **Profile** under the manager's speciality. Careers made before this are Medium.
- `AI_TRAIN_EVERY_WEEKS` is gone; AI training reads the career's difficulty (no second knob).
- The API spec and its generated types gained `gameDifficulty` (hand-edited like `managerFaceId` was).
- New suite **harness/difficulty.mjs** (run-all 98l).

### Part 7: kits (done, not yet run)

- **Too alike → the away pair wears white**, one rule in **utils/kits.ts** (`KITS`): the two clubs'
  primary colours less than 100 apart in RGB (straight-line distance, 0 to 441). The away pair then
  wears white with its own primary colour as the trim; if the home kit is itself close to white, it
  wears near-black instead. It rides on `/unity/match-state`'s per-player colours (plus
  `awayKitChanged: true`), so **no Unity change is needed**.
- **Ladder dots** are each club's real kit primary colour: the season ladder, the history standings and
  the club Hall of Fame bubbles now carry `kitColor` from the server; the name hash (`teamColor`) is
  deleted (it was the only copy). Player cards keep their national colours.
- harness/club-kits.mjs extended (section 2b: a forced clash goes white; every ladder dot is the real
  kit; the hash is gone), and its away-kit check now allows the change kit (knowingly changed).

### Part 8: Settings (done, not yet run)

- **The gear:** a Settings entry in the sidebar and a gear at the top right of the title screen (the
  manager picker). Settings, and a Rules page reached from it, sit outside the career guard, so they
  work before a career is loaded.
- **Display** (desktop game only): Windowed or Fullscreen; 1280×800, 1400×900 (default), 1600×1000,
  1920×1080; a zoom slider 80–150% (Electron webContents zoom). Stored in
  `window-settings.json` in the game's user-data folder (`electron/window-settings.js`), applied at once
  through a new `electron/preload.js` (exposes only get/set) and again at the next launch. **A game
  that has never set a size still opens maximised**, as it always has; picking a size makes it a
  window of that size.
- **Sound:** music volume and mute are the music bar's own state (`useMusic`); the bar stays for
  skipping songs. **Match sound volume is left out:** the 3D court's page listens for one message only
  (the control mode, `MatchManager.SetControlMode`), so a volume needs a Unity method and a rebuild.
- **Controls:** Auto or Manual is chosen here, under the same stored key
  (`vbe-court-control-mode`, now in `lib/court-settings.ts`); **the match screen's toggle button is
  removed** (the court still switches with Tab / View / Share and the page remembers it). A Controls
  panel lists what the court uses in Manual (W A S D, J dig, K set, L spike/block/serve, Space dive, Q
  switch, Tab Auto/Manual, Esc pause, H help; Xbox A/X/Y/B, LB, View, Menu; PlayStation
  Cross/Square/Triangle/Circle, L1, Share), from the court's own proof of 5–6 Oct.
- **Rules:** a "New in Update 1" card: the Day 1 draft, the salary cap and what counts, "hire your
  staff and medical in your first week, because on Day 8 the AI clubs take staff", injured players
  are cheaper, pre-season camps (its table read from PRESEASON), difficulty, ageing and injuries,
  scouting and the Watch list, manager specialities. The old "the AI clubs keep their pairs" academy
  line is corrected.
- New suite **harness/settings.mjs** (run-all 98m), headless (no Electron window, no save touched).
- Not updated: the three GPU proof scripts in scripts/webgl-proof/ still click the old match-screen
  button (they are run by hand, not by the build).
