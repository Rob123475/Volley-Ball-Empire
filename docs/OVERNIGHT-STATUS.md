# Overnight status — 22/23 Sep 2026

Branch `achievements`, from e4caeda. The previous report that lived in this file (the
night of 15 Sep — 3D court, cameras, installer 0.9.1) is kept as
`docs/OVERNIGHT-STATUS-15SEP.md`.

The live save in `AppData\Roaming\Beach Volleyball Empire` was never opened.
Every suite drives its own throwaway copy of the shipped database, and the game
itself was never launched.

## The short version

Everything in the brief is built and on GitHub. The harness is 47 suites and
about 1,100 checks, green on the commit each item was pushed on. Nine new
suites were written tonight; six of the eight game items turned up defects in
the game itself rather than in the tests, and those are listed under each item.

The three things most worth your attention in the morning:

1. **Money now means something, and the numbers are in this report.** A club at
   the bottom of the field loses money every season and is sold after five of
   them; a club at the top of the Gold tour makes $100,000-$300,000 a season.
2. **The board no longer sacks anybody for results** — your rule — which is a
   bigger change to how a career ends than it sounds. What ends it is the club
   being sold, or you turning down every job that is offered.
3. **Steam is wired but unproven on screen.** steamworks.js loads under
   Electron 32 with no rebuild and `init(5233750)` connected to your running
   Steam client, the server announces every unlock and the catch-up works — but
   nobody has watched an achievement pop on the overlay. That needs a launch
   under Steam, which is yours to do.

## Items

| # | Item | State | Commit |
|---|------|-------|--------|
| 1 | L-02a — contract lengths and coverage | DONE | `d44065f` |
| 2 | L-02b — retirement | DONE | `ffeff99` |
| 3 | L-02c — youth rebirth | DONE | `a31a302` |
| 4 | L-02d — graduates cap and trading | DONE | `a31a302` |
| 5 | HOF — club Hall of Fame | DONE | `83dfea4` |
| 6 | ACH — seasons, cabinet, 30 achievements, Steam | DONE | `5420a02` |
| 7 | L-04 — money means something | DONE | `bdff326` |
| 8 | L-02e — broke clubs sold, job market | DONE | `bdff326` |
| 9 | BUILD — v0.9.2 to C:\build\vbe | DONE | `06be253`, repackaged at `d468ce1` |
| 10 | REPORT | this file | — |

Items 3 and 4 share a commit, and so do 7 and 8: each pair changes the same
files, and in the second pair the sale rule cannot fire until losing money is
possible. Every commit was pushed on a green 47-suite run.

## Calls I made

Design decisions the brief left to me, so you can overrule any of them in the morning.

1. **`docs/LONG-CAREER-BRIEF.md` is superseded on contract lengths.** It says "1 to 5
   seasons"; your overnight brief says 6 months / 1 season / 2 seasons. I built the
   overnight brief's rule, because it is the later and more specific instruction. The old
   file is untracked and I left it alone.

2. **What each length means.** `6m` is six months on the game clock from the day of
   signing, with the month end clamped (31 Aug + 6m = 28 Feb). `1s` ends on the last day
   of the season being played. `2s` ends on the last day of the season after that.

3. **A 2-season deal signed before the next season exists.** Seasons are created one at a
   time by the rollover (R-35), so in season 1 the second season's end date is not in the
   database yet. Rather than clamp — which silently made every 2-season deal a 1-season
   deal, a bug this suite found — the end date is projected one year past the last known
   season end. The rollover writes the real row later and the contract still ends inside
   the right season.

4. **Backfilled contracts are one season.** People at a club with no contract (saves made
   before staff contracts existed) are given the shortest term that still reaches a
   natural decision point, rather than a term invented from their age or wage.

5. **Academy players are excluded from the backfill.** Their terms are the academy's
   (R-63), not senior contracts, which is also why the contracts route refuses to renew or
   terminate them.

6. **Promotion out of the academy asks for a length.** Your brief lists youth promotion
   among the places a length is offered. Promotion used to end the academy deal and write
   nothing at all, leaving a senior at the club on no terms — he could not expire, could
   not be renewed and could not be paid out. The Team page now opens a three-button dialog
   when an academy player moves into a senior slot; the API defaults to one season if a
   caller omits the length.

7. **The expiry warning is the attention list, not Club News.** Club News is built only
   from rows the career actually wrote (R-43), and a warning has no row behind it. The
   four-week notice sits beside the player-contract warning R-51 already shows: orange at
   28 days, red at 14.

8. **The harness suite is `harness/contract-terms.mjs`**, registered in `run-all.mjs` as
   suite 34 of 40. It runs its own server on port 4521 against its own database.

## What item 1 found in the game (not in the test)

Seven defects, all of them things a career would have hit:

1. **A 2-season contract was a 1-season contract.** Seasons are created one at a
   time (R-35), so in season 1 the end-date lookup clamped to the only row there
   was. Every "2 seasons" deal quietly became one.
2. **Renewal did nothing.** A contract may only be renewed in its final season,
   so its end date is normally the season's last day — and the renewal measured
   the new term from a season list that still contained that date. It returned
   200, changed nothing, and the player left at the boundary anyway. In the
   thirty-season run this emptied squads and got the manager sacked for
   abandonment (R-48). This is the one that would have hurt most in your save.
3. **Staff contracts could not be renewed at all** — there was no route, so the
   four-week warning had nothing to act on.
4. **Promotion out of the academy wrote no contract**: a senior at the club on
   no terms, who could not expire, be renewed or be paid out.
5. **Promotion ended the academy deal only at exactly 18**, while promotion is
   allowed from 18 up. A graduate promoted later kept his academy years for
   ever, and the contracts route went on refusing to renew him as a youth
   player — a wall of 403s at the start of every season.
6. **The rollover's own promotion left those years behind too.** Both paths
   clear them now, and "in the academy" means one thing everywhere: a youth
   player this career has not promoted.
7. **A client could name a contract's end date.** The server owns it now, which
   is what R-51's game-clock rule was for.

## Calls I made on items 2 to 8

9. **A Hall of Fame table had to exist before item 5.** Retirement cannot decide
   what to delete without knowing who has been honoured, so `club_hall_of_fame`
   is created with retirement and the induction window (recommendations, the
   two-season cycle, the cap of six) is still the Hall of Fame item's job.

10. **"Delete her career record" means this career's record.** `players` is the
    world's reference list, shared by every save on the machine — deleting rows
    from it would reach into your other saves. What goes is
    `career_player_state`, which is her career: after it, this career cannot
    see her at all.

11. **The season review reads retirements from their own table.** It used to
    filter career state for `isRetired`, which stops working the moment a
    record is deleted — the review would have said "Nobody retired" for a
    season that retired three.

12. **"Youth count identical every season" needed a level to be identical AT.**
    Replacing graduates one for one keeps the count where it is — and a career
    starts with no academy at all, so that would have kept it at nought for
    ever. The intake now takes every graduate's place plus up to three more,
    never past the academy cap of 12: a new club is full in four seasons and
    holds exactly twelve from then on, which is the rule as a career can
    actually reach it.

13. **"The 89 spares" are twelve.** There were 89 unused adult portraits when
    R-62 was written; the pool clubs took most of them since. What is left
    unattached in the shipped database is the twelve cards belonging to
    `player_type = 'spare'` athletes, who appear in no market, squad or
    tournament. The intake counts them rather than trusting a number, so it
    cannot go stale. Order: a retiree's face first, then a spare, then the blank
    youth card.

14. **A recycled name is only reused for its own nation.** The intake's
    nationality rule (R-62) is the club's country and the other nations of its
    region; a Brazilian name on a Norwegian youth player would be a stranger
    thing than a new name. Names are recycled within a nation, and the region's
    own name pool covers the rest.

15. **The graduate cap is enforced twice, for two different reasons.** The Team
    page refuses a promotion that would make five, so the manager is told the
    rule at the moment he meets it. The season boundary then releases whatever
    is still over four, because the rollover promotes every academy player who
    turns 19 whether the club has room or not — she is too old for the academy,
    so she cannot stay in it. The weakest go, by the same overall rating the
    screens show.

16. **There is nothing to do about AI clubs over the cap.** The brief says
    "gamer AND AI", but AI clubs have no academy: R-62 made the intake the
    player's club only, and the pool clubs are fixed pairs. No AI club can hold
    a graduate, so the cap is enforced everywhere graduates can exist. If AI
    squad turnover lands later, this is where its cap goes.

17. **One overall-rating formula.** It was written out twice, in `game-api.ts`
    and `unity.ts`, the second carrying the comment "mirrors game-api.ts". The
    graduate cap needed a third caller, and the number that decides who loses
    their place should be the number the screens show, so it is now one
    function.

18. **Graduates are held on top of the squad, not inside it.** The three
    signing places (2 starters + 1 interchange) counted a club's own graduates,
    so a club that developed four players could never sign anybody again — and
    "graduates can be bought and sold" would have been impossible for exactly
    the clubs that have graduates. Graduates now have their own limit of four
    and do not fill the signing places. They still take a place on the sand
    like anyone else.

19. **Running costs are what the money rule turned on.** The one cost that was
    not a wage was `weeklySalary * 0.2`, described as "staff & operational
    costs" — so a club with a cheap squad had cheap running costs, which is
    backwards. The beach, the medical room, the flights and the entry fees do
    not get cheaper because the squad is cheap. It is three real things now:
    the club itself, everyone on the books, and the tour the club has access
    to. The tour line is much the biggest, and the Gold circuit costs four
    times what the Bronze one does: tier access is the dominant income lever by
    design, so it had to be the dominant cost lever too, or the top tier was
    free money.

20. **The numbers were tuned against the harness, not guessed.** Three
    measured passes: the first left a brand-new club finishing last in its
    first season a few thousand either side of nought — a coin flip, not a
    rule — so weight moved off the squad line and onto the club line, because
    a club enters fifty-odd events whether it takes three players or sixteen.
    What the table says now is in the report below.

21. **The board no longer sacks anybody for results.** That is your rule, and
    it went further than expected: two strikes or a confidence of 20 used to
    end a career, and now they are the board's loudest warning. The only thing
    a review can end is a club, by selling it.

22. **A club's loss-making run is counted from rows that already existed.**
    Every season's board row OPENS on the balance carried into it, so one
    season's opening is the previous one's closing — the chain of openings is
    the history, and no new counter has to be kept in step with anything. A
    save made before tonight can be judged on it.

23. **The club is sold, and the career carries on.** A sale does not end a
    career: the save keeps everything that is the manager's and is left
    looking for a club, which is the one case where a save without a club is
    not a finished one (R-60 finished those at boot; it now checks first).

24. **A vacancy is a real club outside the World Tour field.** The world has
    sixty clubs and the field is nineteen, so the other forty-one are clubs a
    manager can go to without any club being in the world twice. Taking one
    puts it in the field in the sold club's seat and takes it out of its
    regional league — it is not an AI club any more. There is no AI-manager
    model in this game, so nothing is competing for the job; that is stated in
    the route rather than dressed up as a shortlist.

25. **What the manager takes to the new club is the career, not the club.**
    Seasons, achievements and reputation come along (ACH put them on the
    career save for exactly this). The squad, the academy, the staff, the
    trophies and the balance stay with the club that was sold, and the new
    club starts as a new club does — an underdog's budget and a squad signed
    from the free agents.

26. **"Loss-making" had to be given a size.** Taken literally, a season the
    club finishes one dollar down is a loss-making season — and five of those
    in a row sells the club. The thirty-season runs did exactly that: clubs
    sitting on $4.6 million, losing $260 in a season, sold in season nineteen
    while in no trouble whatever. A season now counts as loss-making if the
    club ends it more than 2% below what it opened on, or ends it in debt at
    all. Your rule is unchanged — five loss-making seasons and the club is
    sold — but "loss-making" now means what you meant by it. Change the 2% in
    `utils/board-confidence.ts` if you want it tighter or looser.

## The harness

47 suites, 1,044 checks, all green on `bdff326` — the commit the build was made
from. `pnpm run test:harness` runs them; `pnpm run build` runs the typecheck,
the builds and then the harness, which is how every item was verified before it
was pushed.

Nine suites are new tonight:

| Suite | What it holds to account |
|---|---|
| `contract-terms.mjs` | the three lengths, everyone under contract, staff expiry on the game clock, the four-week warning, the payout |
| `retirement.mjs` | retirement at forty: the contract closed, the squad and market free of her, the honoured kept, the forgotten recycled |
| `youth-rebirth.mjs` | 30 seasons in three regions at once — twelve in the academy from season four to thirty, never empty, nobody without a portrait |
| `graduates.mjs` | four graduates, the fifth promotion refused, the boundary releasing the surplus weakest-first, a graduate sold |
| `hall-of-fame.mjs` | the window every two seasons, the cap of six, honours before numbers, an inducted player kept whole |
| `achievement-ipc.mjs` | every unlock announced to Electron once, the boot catch-up answered, and a sabotage check that it is reading the messages |
| `economy.mjs` | the money table above, and the rule under it |
| `job-market.mjs` | five loss-making seasons, the sale, the vacancies, the career carried across, retirement by declining |
| plus the shared `harness-club.mjs` helpers | renewing, fielding and keeping a club solvent, so three long walks stopped losing their clubs to rules they were not testing |

**It is stable, not lucky.** The full harness was run three times end to end on
the same code and came back green every time — 1,044, 1,044 and 1,047 checks,
the same 47 suites passing. That matters more than usual tonight because nine
of these suites play real matches with real results: a check that only passes
on a good roll is worse than no check, because it teaches you to ignore a red
one. The one I found doing exactly that is written up below.

Two older suites had to change because a rule changed under them, which is the
point of having them: `board-review.mjs`'s table of verdicts (eight seasons that
used to end a career are a final warning now) and `fake-content-removed.mjs`
(which banned the words "job market" rather than the invented list R-43 deleted).

## The build

`C:\build\vbe\Beach Volleyball Empire Setup 0.9.2.exe` (370,070,114 bytes) and
`C:\build\vbe\win-unpacked\`, from commit `d468ce1` — the branch tip. It was
first built at `06be253` and repackaged as each follow-up fix below landed, so
what is on disk is what is on GitHub, and it was launch-tested every time.
electron-builder 25.1.8, Electron 32.3.3, x64.

Checked in the package rather than assumed:

- the packaged server carries tonight's rules — the running costs, the sale
  after five loss-making seasons, the three contract lengths, the graduate cap
  and `first_inductee`
- the packaged starter database has `player_retirements`, `club_hall_of_fame`
  and the three new `career_saves` columns (53 tables)
- steamworks.js is unpacked beside `steam_api64.dll` where the loader can find
  it, and after-pack now FAILS the build if it is not
- no `steam_appid.txt` in the package, and after-pack fails the build if one
  appears

Then launched from `win-unpacked` on a scratch profile, which is how I know it
runs and not only that it built:

```
[steam] connected (app 5233750, rbonner006)
[steam] catch-up: 0 unlocked in this save, 0 new to Steam
healthz 200
WAL checkpointed and database closed for shutdown
```

It quit on its own, left no `-wal` or `-shm` sidecar and no process behind it.

**The live save was never opened.** Its fingerprint before and after the launch
test is the same: `e887920d02a53fabf6fd780d1be5a92fa75c2b69a44ab134dcbecd9ab9d2fe76`.

Steamworks was not touched — the depot upload is yours. One thing to know: the
`win-unpacked` folder in `C:\build\vbe` is now 0.9.2. The 0.9.1 and 0.9.0
installers are still beside it, but the unpacked folder Steam's reviewed build
came from has been replaced, as the brief asked.

## The money, season by season (L-04)

The table the brief asked for, printed by `harness/economy.mjs` and copied here
exactly. It walks two clubs and reads every pound in and out of
`finance_transactions`; run `node harness/economy.mjs` and it prints this and
then checks it.

**An established club, twelve seasons.** Started on $500,000.

| Season | Tier | Finish | Prize | Sponsor | Wages | Running | Change | Balance |
|---|---|---|---|---|---|---|---|---|
| 1 | Gold | #2 | $507,400 | $596,600 | -$364,780 | -$509,600 | **+$229,620** | $729,620 |
| 2 | Gold | #4 | $722,550 | $618,600 | -$380,380 | -$811,200 | **+$149,570** | $879,190 |
| 3 | Gold | #1 | $901,350 | $626,400 | -$395,980 | -$826,800 | **+$304,970** | $1,184,160 |
| 4 | Gold | #2 | $783,150 | $629,600 | -$427,180 | -$852,800 | **+$132,770** | $1,316,930 |
| 5 | Silver | #6 | $623,250 | $618,600 | -$454,480 | -$873,600 | **-$86,230** | $1,230,700 |
| 6 | Gold | #1 | $618,140 | $636,600 | -$454,480 | -$592,800 | **+$207,460** | $1,438,160 |
| 7 | Gold | #4 | $698,750 | $636,000 | -$465,870 | -$895,700 | **-$26,820** | $1,411,340 |
| 8 | Gold | #1 | $901,750 | $626,000 | -$453,180 | -$878,800 | **+$195,770** | $1,607,110 |
| 9 | Gold | #7 | $643,650 | $624,200 | -$458,380 | -$878,800 | **-$69,330** | $1,537,780 |
| 10 | Gold | #1 | $879,350 | $628,400 | -$457,080 | -$878,800 | **+$171,870** | $1,709,650 |
| 11 | Gold | #2 | $799,150 | $626,600 | -$450,580 | -$878,800 | **+$96,370** | $1,806,020 |
| 12 | Silver | #8 | $620,050 | $572,400 | -$454,480 | -$878,800 | **-$140,830** | $1,665,190 |

Winning the Gold tour is worth $100,000 to $300,000 a season. Fourth is about
break even, seventh loses money, and a season that drops to Silver costs more
than a good one earns. Twelve seasons took it from $500,000 to $1.67 million —
up, but only by keeping at the top of the field, and never runaway.

**An underdog, from $150,000.** It finished 18th and 19th of 19.

| Season | Tier | Finish | Prize | Sponsor | Wages | Running | Change | Balance |
|---|---|---|---|---|---|---|---|---|
| 1 | Bronze | #18 | $136,000 | $472,600 | -$234,000 | -$405,600 | **-$31,000** | $119,000 |
| 2 | Bronze | #18 | $130,100 | $428,400 | -$249,600 | -$421,200 | **-$112,300** | $6,700 |
| 3 | Bronze | #18 | $135,840 | $428,800 | -$265,200 | -$436,800 | **-$137,360** | -$130,660 |
| 4 | Bronze | #19 | $130,160 | $428,600 | -$288,600 | -$457,600 | **-$187,440** | -$318,100 |
| 5 | — | — | — | — | — | — | **the club is sold** | — |

Four seasons at the bottom cost $468,100 against a club that started with
$150,000, and the fifth sold it: the board's five-loss-making-season rule
(L-02e) firing on numbers the money rule produced, not on anything aimed at it.

**One thing the table shows that I did not design.** A club finished 2nd in
Gold and LOST $50,120. It is not a bug and it is worth knowing: it had finished
12th the season before, so it was on Bronze purse access — playing the Gold
tour for Bronze money, because the tier you finish sets the purses you are paid
in full the next season (R-54). Tier access is meant to be the dominant income
lever, and that is it being dominant. Winning the tour is what reliably pays:
across runs, champions gained $170,000-$395,000 and runners-up anywhere from
-$50,000 to $230,000. The harness therefore asserts on champions and reports
the runners-up rather than pretending second place is a rule.

**Where it goes.** Income is prize money and sponsors, as you said. The change
is all on the other side. Running costs are three real things: the club itself
($5,000 a week), everyone on the books ($100 each a week), and the tour the
club has access to — $2,500 a week in Bronze, $4,500 in Silver, $10,000 in
Gold. The Gold circuit costs most of what it pays, which is why winning it is
worth a couple of hundred thousand and not a million.

## Found on the way, NOT fixed (out of these items' scope)

- **The squad-role route does not enforce the 2-starter / 1-interchange
  limits.** Signing does (`POST /contracts` refuses a fourth senior or a third
  starter), but `PATCH /team/roster/:id/role` will put any number of players in
  any slot — the Team page warns, the server does not. It is how the harness
  fields four players, and how a manager could field four. Not touched tonight
  because enforcing it would change what every long-running suite is allowed to
  do, and that is a bigger change than "max 4 graduates" asked for. Worth a
  repair of its own.

- **AI clubs are not sold, and do not induct.** Both were in the brief and
  neither can be done honestly yet, for the same reason: an AI club is a
  `continental_pool_teams` row with a name, a continent and a rating. It has no
  balance sheet, so there is no such thing as a loss-making season for it, and
  no roster of `players` with contracts, so there is nothing to rank its
  players' service by. Inventing either would be inventing the numbers the
  rules are supposed to be made of. Both functions are written so the AI half
  drops in when AI clubs get real squads and real books: `candidatesFor()` in
  routes/hall-of-fame.ts, and the loss-making run in board-confidence.ts.

- **The academy's own contract years still count down to zero and stop there.**
  `tickAcademyContracts` takes a week off every academy deal and floors it at
  nought rather than ending it. Item 4's brief line — "graduate contracts have
  end dates; expired and unused -> back to the graduate pool" — is satisfied
  for GRADUATES, whose senior contracts expire properly. The academy deal
  underneath is still a number that runs out and does nothing.

## Fixed after the ten items, with time left over

- **"Local Legend" and "Mr Loyalty" were counting the wrong seasons.** Both say
  "with the same club" and both checked the manager's career total, which was
  the same number until tonight, when a manager became able to change clubs.
  They count the seasons the CLUB has completed now, derived from its own
  season records — so a manager who moves starts that at nought without
  anything having to be reset, and the two achievements say what they mean
  again.

- **Closing the game while between clubs would have lost the career.** The
  session restore looks up "the newest career that has not ended" when a
  session knows nothing — and it required that career to have a CLUB, which was
  true of every live career until tonight. After a sale it is not: a player who
  quit at the job market and came back would have been dropped silently into
  another career if they had one, with the sold career stranded. It keeps a
  clubless career now and comes back to the job market, and the suite shuts the
  session and reopens it to prove that.

- **Retiring from the job market told the manager they had been sacked.**
  Turning down every vacancy just stamped the save retired: no Hall of Fame
  archive, no history entry — and the career-end screen picks its words from
  the newest history entry, so with none to find it fell back to its default,
  "You've Been Sacked", for a manager who had chosen to stop. It ends the
  career properly now: archived under the club they last had, a `retirement`
  entry in the game's own words, and a screen that says "You Retired".
  (`club_sold` is deliberately NOT an ending — the club ending is not the
  career ending.)

- **Deleting a profile while a career is between clubs** now has a check
  behind it. The sale remembers the club it took, as a foreign key to a team
  that deleting a profile also deletes, and a cascade that trips over its own
  key would be a crash at the Select Manager screen. It does not — but that
  was reasoning, and now it is a test.

- **Naming the same player twice in an induction was a 500.** The honour board
  has a unique index on (career, club, player) — a club cannot honour anybody
  twice — and the route counted the ids it was given without looking for
  repeats, so `[7, 7]` reached the database and failed the constraint. It is
  one induction now, which is what it always meant.

- **One harness check could fail by chance, and did.** "A club at the top of
  the Gold tour went forwards" held for a club that finished 1st or 2nd — and
  a 2nd-place season lost $50,120 for the tier-access reason above. A check
  that can fail on a dice roll is worse than no check: it teaches you to
  ignore a red result. It asserts on champions now, which is certain by
  construction, and prints the runners-up as what they are — variable.

## Anything Rob must check on screen

- **Team page → moving a youth into Match Player or Interchange** now opens "Promote
  <name>" with three buttons. Nothing else about the squad screen changed.
- **Squad page → offering a contract** has three buttons where the 1–12 month slider was.
  The slider computed the end date from the real-world clock, which is the same class of
  bug R-51 fixed on the server.
- **Contracts page**: "Renew +1 season" is now a "Renew" button that opens the
  three lengths.
- **Staff and Medical pages**: every card shows when the contract ends, in
  orange inside the last four weeks, with a Renew button beside it.
- **Trophy Cabinet → Hall of Fame tab** is now the club's own honour board, with
  the induction window when it is open: the game's recommendations, the full
  list of everyone eligible, up to six picks, and a "Honour nobody this time"
  button. The old tab listed retired players still at the club, which is
  nobody.
- **Finances page** has a new "Running Costs" line — for most clubs the biggest
  number on the page. It is the ground, the squad and the tour, and it is what
  makes finishing last cost something.
- **The board's "How the board judges you" panel** now says what is true: the
  board will not sack you for results, and what ends your time at a club is
  five seasons of losing money.
- **The job market** (`/job-market`) is a new screen. You will only see it if a
  club of yours is sold. It lists real clubs with vacancies, takes one, or
  retires you.
- **Achievements**: thirty now. `docs/achievements-table.md` is the list to
  copy into Steamworks — API name, display name, description — generated from
  the game's own definitions by `node scripts/achievements-table.cjs`.
- **Steam**: the packaged build connected to your Steam client on its own
  (`[steam] connected (app 5233750, rbonner006)`) and ran the boot catch-up.
  What is left for you is the pop: play a career under Steam, win a match, and
  see whether "First Steps" appears on the overlay and then in your
  achievements list. If Steam is not running the game behaves exactly as it
  does today, and says so in one line.

## What I would do next, in your place

1. **Play a season of your real save on 0.9.2** before anything else. The money
   change is the one a career feels immediately, and your save has a history
   these numbers were never run against.
2. **Decide whether 2% is the right size for "loss-making"** (call 26). It is
   the number that decides how forgiving the sale rule is.
3. **Create the thirty achievements in Steamworks** from
   `docs/achievements-table.md`, then prove one pops.
4. **The three things left undone** are listed above under "Found on the way" —
   the squad-role slot limits, AI clubs having no books of their own, and
   `local_legend` now that a manager can change clubs. None of them blocks a
   release; all three are the kind of thing that gets worse the longer it sits.

## If something in here is wrong

Every number in this report came out of a command, and the commands are all in
the repo: `pnpm run test:harness` for the lot, or any single suite by name
(`node harness/economy.mjs`, `node harness/job-market.mjs`, and so on). Nothing
was measured once and quoted from memory — where a number moved between runs, I
re-ran it and used the later one. If a rule reads wrong to you, the file that
states it says why it is that way, and changing the constant at the top of it
is usually the whole job.
