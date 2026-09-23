# Overnight status — 22/23 Sep 2026

Branch `achievements`, from e4caeda. The previous report that lived in this file (the
night of 15 Sep — 3D court, cameras, installer 0.9.1) is kept as
`docs/OVERNIGHT-STATUS-15SEP.md`.

The live save in `AppData\Roaming\Beach Volleyball Empire` was never opened.
Every suite drives its own throwaway copy of the shipped database, and the game
itself was never launched.

## The short version

Everything in the brief is built and on GitHub. The harness is 47 suites and
1,081 checks, green on the commit each item was pushed on. Nine new suites were
written tonight; six of the eight game items turned up defects in the game
itself rather than in the tests, and those are listed under each item.

**The ten items took about half the night.** The rest went on re-reading what I
had just written, and it found twelve more defects in the game — nearly all of
them in the seam the job market opened between a CAREER and a CLUB, or in a
number a page shows — plus four things wrong with the tests that are supposed
to catch them. They are all under "Fixed after the ten items" below. Two would
have been the first things you noticed: a club you took over was sold again at
the end of your first season, in a review that said five; and the Finances
page's new Running Costs line read $0 for every club in the game.

**Since then: every club in this world keeps books.** Your 23 Sep rule — one
set of rules for every club, and the broke-club rule firing for AI clubs too —
is built, and there is a thirty-season table of all sixty clubs' balances below
to read it off. It left you one decision I would not make for you, about clubs
that never reach the World Tour.

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
| 9 | BUILD — v0.9.2 to C:\build\vbe | DONE | `06be253`, repackaged at `5ac755c` |
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
    Seasons and reputation come along because ACH put them on the career save
    for exactly this; the achievements come along because their rows are moved
    to the new club, which is a defect found later and written up below. The
    squad, the academy, the staff, the trophies and the balance stay with the
    club that was sold, and the new club starts as a new club does — an
    underdog's budget and a squad signed from the free agents, whatever the
    club's rating says about it. Its purse access for that first season is the
    seat's, not the club's: it inherits the World Tour seat of the club that
    was sold, so a manager relegated to the bottom takes a Bronze tour with
    them — cheap to enter and cheap to travel, which is the right way round
    for somebody starting again.

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

48 suites, 1,107 checks. The harness, the build in `C:\build\vbe` and
`origin/achievements` are all the SAME COMMIT — the one this report is
committed in. `git log -1` on the branch names it, and nothing in this file
can go stale by naming it here instead.

`pnpm run test:harness` runs them; `pnpm run build` runs the typecheck, the
builds and then the harness, which is how every item was verified before it was
pushed.

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
| `job-market.mjs` | five loss-making seasons, the sale, the vacancies, the career carried across — seasons, achievements and all — the new club judged on its own seasons, a club never offered twice, retirement by declining |
| plus the shared `harness-club.mjs` helpers | renewing, fielding and keeping a club solvent, so three long walks stopped losing their clubs to rules they were not testing |

**It is stable, and that is measured rather than asserted.** Nine full runs
end to end tonight. The three on the ten items came back green every time
(1,044, 1,044 and 1,047 checks); the six after them were green, green, RED,
green, green and green (1,077, 1,076, two failed checks, 1,077, 1,079 and
1,081) — the same 47 suites throughout.

The red one is the point of running it more than once. Nothing had changed
between it and the green run before it: twelve simulated seasons simply gave
the established club eight second places and no first, and a check that
required a winner failed. That is a check failing on a dice roll, it is the
second of those found tonight, and both are written up below. A check that can
fail on a good or bad roll is worse than no check, because it teaches you to
ignore a red result — and the only thing that finds them is running the suite
again on code you did not touch.

Two older suites had to change because a rule changed under them, which is the
point of having them: `board-review.mjs`'s table of verdicts (eight seasons that
used to end a career are a final warning now) and `fake-content-removed.mjs`
(which banned the words "job market" rather than the invented list R-43 deleted).

## The build

`C:\build\vbe\Beach Volleyball Empire Setup 0.9.2.exe` (370,088,160 bytes) and
`C:\build\vbe\win-unpacked\`, cut from the commit this report is committed
in — the same one the harness is green on and the tip of
`origin/achievements`. It was
first built at `06be253` and repackaged as each follow-up fix below landed, so
what is on disk is what is on GitHub, and it was launch-tested every time.
electron-builder 25.1.8, Electron 32.3.3, x64.

Checked in the package rather than assumed:

- the packaged server carries tonight's rules — the running costs, the sale
  after five loss-making seasons, the three contract lengths, the graduate cap
  and `first_inductee`
- the packaged starter database has `player_retirements`, `club_hall_of_fame`,
  the three new `career_saves` columns and the two added since —
  `board_seasons.team_id` and `career_pool_team_state.taken_over_at` — 52
  tables, counted in the package rather than in the repository. An upgrading
  save gets all of them on its next boot: the packaged build reported "schema
  check: save is up to date, 0 missing columns" over 52 tables and 646 columns
  derived from the model it queries through.
- **your own save opens on it.** This is the one thing the harness cannot
  prove, because every suite starts from the shipped database and yours has a
  history. I took a COPY of
  `AppData\Roaming\Beach Volleyball Empire\volleyball-empire.sqlite` — the
  original was never opened for writing, and its fingerprint
  (`e887920d...9b9d2fe76`) is the same before and after — and started tonight's
  server on the copy. It came up on the first try: 50 tables became 52,
  `club_hall_of_fame` and `player_retirements` created, eight columns added
  (including `board_seasons.team_id` and `career_pool_team_state.taken_over_at`),
  two indexes, `problems: []`, one staff member given the contract they never
  had, and all four of your recorded board seasons matched to the club that
  played them. Then it checkpointed and closed cleanly. Your save is not
  migrated by a script anyone wrote by hand: the repair is derived at boot from
  the same schema the code queries through.

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
exactly as that run printed it. It walks two clubs and reads every dollar in and
out of `finance_transactions`.

**The numbers are one run's, not the rule's.** These are real simulated seasons,
so `node harness/economy.mjs` prints different figures every time — a later run
took the established club to $2.13 million rather than $1.67 million, and its
underdog finished 15th in its fourth season rather than 19th. What does not move
is what the suite asserts: a club in the bottom three goes backwards every
season, a club that wins the Gold tour goes forwards every time and by under
$500,000, and four seasons at the bottom cost more than the club started with.
Read the table for the shape of it, and the run for the numbers.

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

- **One question I did not answer for you: whose seasons open the Hall of
  Fame?** The window is "every two seasons", counted on the manager's whole
  career, because that is what your rule says seasons are counted on. Now that
  a manager can change clubs, the two readings come apart: a manager on their
  thirteenth season who takes over a new club can induct into that club's
  honour board immediately, and the players they would be honouring have
  played nothing for it. If you meant the CLUB's own seasons for its own
  board, it is one line — `seasonsAtClub` already exists and is already
  counted. I left it reading your rule as written rather than guess.

- **Nothing checks that a route returns what the API spec promises.** The
  Running Costs line below is what that costs: the spec declared the field, the
  generated client type had it, the page read it by name, the server never sent
  it, and all three typechecked. A suite that walks the spec's response schemas
  against live responses would have caught it the day the field was added. It
  needs care to be worth having — an absent optional field is not always a
  fault — which is why it is a job of its own rather than something to bolt on
  at four in the morning.

- **`DELETE /contracts/:id` does not check the contract belongs to your club.**
  Every other route on that file does. Nothing can reach it today, because the
  only list of contract ids a client ever sees is its own club's, so it is
  defence that is missing rather than a bug that fires. Worth two lines the
  next time that file is open.

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

- **A club taken over played out of the wrong continent.** The comment said
  the club takes "the first location on its own continent" and the code took
  the first location full stop — so Tokyo Surf Samurai would have run out of
  Copacabana Beach. It matches the continent now. (The game ships eleven
  beaches and its clubs carry a continent but no country, so a north American
  club may get Cancún rather than a US beach; that is as close as the data
  goes, and it is checked.)

- **One harness check could fail by chance, and did.** "A club at the top of
  the Gold tour went forwards" held for a club that finished 1st or 2nd — and
  a 2nd-place season lost $50,120 for the tier-access reason above. A check
  that can fail on a dice roll is worse than no check: it teaches you to
  ignore a red result. It asserts on champions now, which is certain by
  construction, and prints the runners-up as what they are — variable.

- **A manager's achievements stayed with the club that was sold.** The job
  market screen promises that everything the manager has done comes with them,
  and for the seasons and the reputation it did. The achievements did not: they
  are stored against a team id, and nothing moved them. The cabinet read empty
  at the new club, the career-end screen counted nought — and the achievement
  check, seeing a club with nothing unlocked, would have popped all thirty a
  second time. They move with the manager now. The trophies do not: they were
  won by the club that was sold and they stay with it.

- **The career-end screen counted out of 25.** The total was a number written
  into `careerLifecycle.ts` while the game shipped 25 achievements. It ships
  thirty. A manager who had unlocked 28 of them was told "28 / 25", over a
  progress bar drawn past its own end. It counts the list now, so the list is
  the only place the number lives.

- **A club taken over inherited the sold club's five losing seasons, and was
  sold at the end of the manager's first.** This is the one I would have been
  sorriest to ship. There is one board row per career per season, which was the
  same thing as one per club until tonight. The rollover opens the next
  season's row for the club it is about to sell, and the manager joins that
  same season at a new club days later — so the new club's first season was
  measured against the sold club's opening balance, which made it loss-making
  by arithmetic, and the losing run was counted off the career, which made it
  the sixth. Take a job, have one bad season, and the board sells that club too
  and tells you it was five. Board seasons now name the club that played them,
  and the run, the strikes and the previous season's verdict are each that
  club's. A save made before the column existed has every row matched to its
  team on the next boot — a career had exactly one club until tonight, so its
  rows can only be that club's — and the suite shuts the game down, blanks the
  column and starts it again to prove the repair.

- **League Ladders showed a career that had played five seasons as having
  played none.** The manager's record moved onto the career save earlier
  tonight, and `teams.career_stats` has not been written since. `/history/records`
  was still reading it, and three of its numbers are headline tiles on that
  page: Seasons Completed, Perfect Seasons and Peak Balance. On any career
  started on this build all three read nought. They read the career now, and
  the column is marked in the schema as read-once, for the migration and
  nothing else.

- **A second sale offered the manager the club it had just sold.** The
  vacancies are the highest-rated clubs outside the World Tour field, and a
  club the manager has just lost is exactly that — so a career that lost two
  clubs would have been shown the second one, by name, in the list of jobs
  going. A club the manager has run is stamped as taken over now. That is a
  different question from whether it is in its regional league, which clubs
  leave and re-enter by relegation and promotion, and it is why the stamp had
  to be its own column.

- **The Steam log could say "unlocked" when Steam had refused.**
  `achievement.activate()` answers with a boolean and `electron/main.js` threw
  it away, printing `[steam] achievement unlocked: first_steps` whether Steam
  took the key or not. The likeliest reason for a refusal is the exact thing
  that is true right now — the achievement has not been created in Steamworks
  yet — so the one line you have to diagnose a missing pop with would have
  told you the opposite of what happened. It now says which it was, and the
  boot catch-up counts the ones Steam would not take.

- **A second harness check could fail on a dice roll, and did.** Running the
  full harness again on unchanged code turned `economy.mjs` red: "a club that
  WON the Gold tour went forwards, every time" required the run to produce a
  winner, and that run gave the established club eight second places and no
  first. Twelve simulated seasons against eighteen real clubs is a race, not a
  guarantee. It is a rule about seasons that WERE won now — if a run wins none
  there is nothing to judge and the line says so, and the run prints how many
  top-three Gold seasons it had instead. What carries the weight is the
  bottom-three check and the sale, which are certain by construction: a club at
  the bottom cannot earn its costs at any tier.

- **The Finances page's new "Running Costs" line read $0.** L-04 put the line
  on the page and the weekly charge writes the category, but the summary the
  page asks the server for never returned the field — so the biggest expense
  most clubs have showed as nothing, and the money itself fell through to
  "Other". Every layer agreed it was fine: the API spec declares
  `expenseBreakdown.runningCosts`, the generated client type has it, the page
  reads it, and the server is plain Express and is not typed against the spec.
  It is returned now, and `economy.mjs` checks the summary against the ledger
  for both clubs it walks — $10,042,500 against $10,042,500, and $1,726,400
  against $1,726,400 on the run that wrote this line.

- **The four-week contract warning was written down in three places.**
  `CONTRACT_WARNING_DAYS = 28` on the server, `daysLeft <= 28` in
  `contract-renew-bar.tsx`, and `28` again in the suite that tests it. They
  agreed — and would have gone on agreeing on the wrong number the day the
  server's changed: the page would warn on the old window and the harness would
  assert the old window and stay green. The suite reads the server's constant
  now and holds the renew bar's copy against it, which is the same trick it
  already used on the three contract lengths. The browser cannot import the
  server's module (lib/db opens a SQLite connection the moment it loads), so
  the copy stays; the drift does not.

## The three hashes, and why there were three

You asked what `04d44a0`, `5ac755c` and `478fd3a` were doing in one report. They
were the harness, the build and the branch tip, and they had come apart because
I kept committing after the last package was made:

```
$ git log --oneline 5ac755c..HEAD
2b494a2 L-02: a contract you can end is one of yours          CODE + harness
478fd3a REPORT: the first page says what the second half...   docs only
93a0c53 REPORT: the warning-window drift is fixed...          docs only
04d44a0 L-02: the contract warning window is read...          harness only
28994b8 REPORT: fact-checked against the repo...              docs only
56edfef REPORT: the Finances line that read $0...             docs only
```

Four of the six touched nothing but `docs/OVERNIGHT-STATUS.md`. One touched a
harness suite. One, `2b494a2`, touched the game — `routes/contracts.ts` — and
that is the one that made the build stale, because it landed after the package
was cut and I did not cut another. Three hashes is three chances to be wrong
about what is in the folder you upload.

**There is one hash now**, and this report does not write it down — writing it
down is what made it wrong last time, because the commit that carries the
report always comes after the commit the report describes. The rule instead:
**the branch tip is the build and the harness.** The package was cut from the
commit this report is committed in, the full harness was run green on it, and
`git log -1` names it. If those three ever disagree again, the way to tell is
`git log --oneline` — anything after the tip that touched `artifacts/`, `lib/`
or `electron/` means the folder in `C:\build\vbe` is behind the code.

## Every club in this world keeps books

Your rule, and it is done: one set of rules for every club, not an AI economy
beside the real one. The pieces that decide anything are shared, and the
sharing is the point:

| what | where it is decided | who reads it |
|---|---|---|
| a week's running costs | `utils/runningCosts.ts` | the player's club and all sixty |
| a week's wages and sponsors | `utils/clubFinances.ts` | both — it was lifted out of the weekly block in `routes/calendar.ts`, which now imports it |
| what a result pays | `prizeFor()` on `data/worldTour.ts`'s purses | both |
| what purse a club may take | `purseAccessFor()` on last season's points | both |
| contract lengths and end dates | `utils/contractTerms.ts` | both |
| what a loss-making season is, and how many sell a club | `utils/board-confidence.ts` | both |

What is new is only where an AI club has to keep something the player's club
keeps in `teams`: a balance and a reputation on `career_pool_team_state`, the
chain of season openings in `pool_club_seasons` (`board_seasons` is one row per
career and cannot hold sixty clubs as well), and `pool_player_contracts` (a
pool player is not a `players` row, so `contracts` cannot hold her).

**No wage is invented.** The 192 priced seniors in the shipped database carry an
asking price that is exactly twelve months of salary, so the game's own data
already says what a player of a given standard is worth. A least squares fit
through those 192 gives the salary an AI club pays, clamped to the range the
shipped players actually span ($6,500 to $14,500 a month).

**The results were always real.** Every AI-vs-AI fixture is played through the
player's own engine and credited to `competitor_rankings` — that has been true
since R-29. What was missing was somewhere to put the money, not a way to know
what the money was. The 22 Sep report said AI clubs "have no balance sheet, so
there is no such thing as a loss-making season for them". That was true of the
tables and not of the game, and it was the wrong call.

### Proved to the dollar

`harness/ai-club-economy.mjs` is the new suite (48 of 48). It does not check
that an AI club is charged *something*: it reads the constants out of the server
source, works out what a club with no World Tour place owes for one week — the
ground, its squad, no tour — advances one week and checks the balance moved by
exactly that. On the run that wrote this: **moved $1,892, the rules say $1,892.**

### Thirty seasons of the whole world

Every club's balance at every season boundary, in thousands. Every fifth season
shown to fit the page; the suite prints all thirty. `*` marks a season the club
was sold in — the balance beside it is what it opened the next season on, under
new owners.

```
  club                             1     5    10    15    20    25    30
  Rio Copacabana Queens          525  1160  1994  2836  3887  4868  6141
  Berlin Sand Queens             684  1014  1344  2492  3196  3454  4501
  Miami Shoreline Queens         483   982  1522  1835  2580  2973  4079
  LA Beach Legends               402   870  1474  2632  3674  3648  3728
  Riyadh Dune Dominators         589   947  1397  1846  2293  2742  3190
  Kuala Lumpur Monsoon FC        584   921  1344  1767  2188  2611  3032
  Tonga Polynesian Power         584   921  1344  1767  2188  2611  3032
  Buenos Aires Pampas Storm      661  1307  1637  1812  2015  2315  2840
  Stockholm Northern Lights      564   822  1146  1470  1792  2116  2438
  São Paulo Beach Warriors       519   579   987  1672  1869  2145  2238
  Manila Bay Pearls              554   770  1041  1312  1583  1854  2124
  San Juan Caribbean Pearls      554   770  1041  1312  1583  1854  2124
  Tokyo Surf Samurai             418  500*   345   564   511  1804  2102
  Lagos Surf Queens              473   835  1737  1616  1868  2257  2039
  Barcelona Playa Elites         364   468   563   637  1039  1642  1950
  Bondi Beach Legends            451   876  1061  1233  1243  1534  1881
  Caracas Caribbean Coast        544   718   937  1155  1373  1592  1810
  Vanuatu Coral Crushers         564   755  500*   824  1146  1470  1792
  Seoul Han River Queens         439  500*    41   501   949  1355  1778
  Rome Beach Gladiators          455  500*   640   778   916  1184  1482
  Shanghai Yangtze Elites        540  1121  1273  1312  1501  1269  1468
  Cairo Desert Eagles            455  500*   226   520  1005  1118  1373
  Myrtle Beach Sunblazers        523   613   727   841   954  1068  1181
  Dar es Salaam Swahili Stars    523   613   727   841   954  1068  1181
  Gold Coast Thunderbirds        443  500*   327   457   419   879  1169
  Warsaw Vistula Waves           533   671  500*   666   832   998  1164
  Durban Indian Ocean Tides      466   243   462   513  500*  1015  1060
  La Paz Andean Queens           517   587   675   763   850   938  1025
  Cancún Coral Storm             470   401   517   368   756   783   938
  Taipei Formosa Spikers         512   561   622   684   745   806   867
  Nassau Island Blazers          512   561   622   684   745   806   867
  Athens Aegean Stars            477  500*   561   623   684   745   806
  Fiji Island Breakers           516   232   549   610   672   733   794
  Montevideo Río Elites          512   534   512   574   635   696   757
  Honolulu Hula Warriors         491   369   483   314   477   496   754
  Paris Sables Royales           450  500*   191   666  1038   868   736
  Tunis Mediterranean Aces       507   535   570   606   641   676   711
  Ho Chi Minh City Delta Star    507   535   570   606   641   676   711
  Wellington Southern Cross      507   535   570   606   641   676   711
  Dublin Emerald Spikers         507   535   570   606   641   676   711
  Lima Pacific Soarers           429   150   262   374   485   597   708
  Casablanca Atlantic Spikers    544   638   648   658   668   678   687
  Auckland Pacific Diamonds      460  500*  500*   630   750   383   658
  Accra Goldcoast Waves          575   825   784   742   701   659   618
  Nairobi Savannah Stars         523   281   584   523   334   356   556
  Lisbon Atlantic Blaze          502   509   518   527   536   546   555
  Vancouver Pacific Orcas        502   509   518   527   535   544   553
  Mumbai Coastal Warriors        512   449   412   468   512   486   528
  Bali Island Legends            484  500*   379   386   545   631  500*
  Havana Salsa Spikers           427  500*   440   157   684   828  500*
  Port Moresby Coral Aces        481  500*  500*  500*  500*  500*  500*
  Georgetown Guyana Waves        439  500*  500*  500*  500*  500*  500*
  Dubai Sand Aces                500   355  500*   298   330   469   490
  Santiago Atacama Aces          481  500*  500*  500*  500*   186   443
  Honolulu Aloha Warriors        470   379   470   346   441   441   441
  Bangkok Palm Beach Stars       491   166   423   423   424   423   424
  Kingston Reggae Spikers        497   483   466   448   431   414   397
  Samoa Southern Swells          533   376   460   388   297   492   377
  Amsterdam Dune Riders          491   231   262   366   395   180   160
  Bogotá Altitude Queens         470   423   421   275   282   228    52
```

- **71 clubs were sold** across the thirty seasons, every one of them with five
  falling season openings behind it. The first: $500,000 > $449,560 > $399,120
  > $348,680 > $298,240.
- **A sold club does not vanish.** There are sixty clubs in this world and no
  more are written, so a broke club changes hands: new owners, the same opening
  balance any club of this world gets, and it gives up its place in its
  continent's league.
- **Its place is taken by a club of the same continent**, and that club was in
  the league at the boundary that gave it the place — 18 of 18 on this run.
  Six clubs to a continent in all thirty seasons, which is what the regional
  season's thirty fixtures are built on.

### One thing in that table you should look at

Two clubs — Port Moresby Coral Aces and Georgetown Guyana Waves — read `500*`
at every sample. They are being sold every five seasons, for ever. They are
clubs that never reach the World Tour field, and under your rule their only
income is sponsors, which does not quite cover the ground and two players. So
they bleed slowly, hit five seasons, change hands, and start again.

Nothing is broken — that is the rule doing exactly what it says — but it is a
decision you have not actually made yet: **whether a club outside the World Tour
field should be able to pay for itself.** The three ways out are all yours to
pick: the regional league pays something (there is no purse data for it, so
that is a number you would have to give me), a club outside the field carries a
smaller wage bill than one on the tour, or it stands as it is and the bottom of
the world turns over every five years. I did not choose one, because choosing
it is choosing how your world works.

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
  makes finishing last cost something. Check it is not $0: it was, until late
  tonight, and that is written up below.
- **The board's "How the board judges you" panel** now says what is true: the
  board will not sack you for results, and what ends your time at a club is
  five seasons of losing money.
- **The job market** (`/job-market`) is a new screen. You will only see it if a
  club of yours is sold. It lists real clubs with vacancies, takes one, or
  retires you.
- **The title screen after a sale** says CONTINUE and takes you back to the job
  market. Quitting at the job market is the obvious moment to stop — you have
  just lost your club — and until tonight coming back offered you START NEW
  CAREER over the top of the career you still had.
- **Achievements**: thirty now. `docs/achievements-table.md` is the list to
  copy into Steamworks — API name, display name, description — generated from
  the game's own definitions by `node scripts/achievements-table.cjs`.
- **Steam**: the packaged build connected to your Steam client on its own
  (`[steam] connected (app 5233750, rbonner006)`) and ran the boot catch-up.
  What is left for you is the pop: play a career under Steam, win a match, and
  see whether "First Steps" appears on the overlay and then in your
  achievements list. If it does not, the log now tells you which half failed:
  `[steam] achievement unlocked: first_steps` means Steam took it, and
  `[steam] Steam would not take first_steps — is it created in Steamworks?`
  means it did not, which is what you would expect until the thirty are created
  from `docs/achievements-table.md`. If Steam is not running the game behaves
  exactly as it does today, and says so in one line.

## What I would do next, in your place

1. **Play a season of your real save on 0.9.2** before anything else. The money
   change is the one a career feels immediately, and your save has a history
   these numbers were never run against.
2. **Decide whether 2% is the right size for "loss-making"** (call 26). It is
   the number that decides how forgiving the sale rule is.
3. **Create the thirty achievements in Steamworks** from
   `docs/achievements-table.md`, then prove one pops.
4. **What is left undone** is listed above under "Found on the way", and it
   grew over the night as I kept reading: the squad-role slot limits, AI clubs
   having no books of their own, the academy's own contract years, nothing
   checking a route against the API spec, and the ownership check on
   `DELETE /contracts/:id`. (Two things were on this list earlier in the night
   and are not any more — `local_legend` and the four-week warning window —
   both fixed and written up below.) None of them blocks a release; all of them
   get worse the longer they sit.

## If something in here is wrong

Every number in this report came out of a command, and the commands are all in
the repo: `pnpm run test:harness` for the lot, or any single suite by name
(`node harness/economy.mjs`, `node harness/job-market.mjs`, and so on). Nothing
was measured once and quoted from memory — where a number moved between runs, I
re-ran it and used the later one. If a rule reads wrong to you, the file that
states it says why it is that way, and changing the constant at the top of it
is usually the whole job.
