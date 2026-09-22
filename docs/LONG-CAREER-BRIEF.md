# Long-career brief — remove the 5-season cap (Rob, 22 Sep 2026)

Rob's decision, 22 Sep: a career must be able to run 30–40 seasons. Clubs need
history (that is what the Hall of Fame is for), juniors must be able to come up
through the ranks, play a career and retire. The 5-season arc was never his
intent. This brief replaces every "bounded five-season arc" assumption in the code
and in the docs.

Rules of engagement are unchanged: read before writing, ONE item at a time, prove
each item with harness output before reporting it, never touch the live save
(`AppData\Roaming\Beach Volleyball Empire`) — all proof runs on harness copies.
Report after each item with the exact commit hash and the harness output. Do not
start the next item until Rob has read the report.

## What is known today (verified by reading main at 2c17431)

- The cap is `FINAL_SEASON = 5` in `artifacts/api-server/src/utils/seasonRollover.ts`.
  Used in exactly two places: the terminal branch of `rolloverSeason()` (sets
  `retiredAt`, returns `career-complete`) and `board-confidence.ts` (`isFinalSeason`,
  the final season's review cannot sack).
- Everything else already runs at every season boundary with no season number in
  it: ageing, retirement at 40 (`RETIREMENT_AGE`), academy promotion at 19, youth
  intake of 3 (`youthIntake.ts`), next-season fixture inside the rollover
  transaction (R-35), board review (R-53), trophies (R-42), Olympics every fourth
  year (`isOlympicYear`).
- Player contracts (`routes/contracts.ts`): a new contract is capped at ONE year
  from the game date; "Renew +1 season" (R-51) only in the contract's final season.
  Expired player contracts are already processed on the calendar tick
  (`calendar.ts` step 5): player returned to free agency, event pushed.
- Staff have `contractLength` (months) but NOTHING expires a staff contract on the
  calendar — staff are hired forever. The only exit is manual termination (50% fee).
- AI clubs are fixed pairs (Rob's 15 Sep call, `youthIntake.ts` header): they do not
  age, retire, or get replaced. Fine over 5 seasons; visibly wrong over 30.
- R-77 (16 Sep) deleted 8 achievements as unreachable in 5 seasons. They are
  reachable again and Rob has icons for all 30. `docs/achievements-table.md` lists
  them; the 8 proposed replacements in that file are DROPPED.
- The harness plays five seasons (R-08 table, `harness/`). No run has ever gone
  past season 5.

## Items, in order

### L-01  Lift the cap and prove 30 seasons  (do this first, nothing else)

1. Remove the terminal branch. A career ends ONLY by sacking, resignation, or break
   contract — never by a season number. Delete `FINAL_SEASON` and every use of it
   (`board-confidence.ts` `isFinalSeason` goes too: every season's review can sack).
   Rewrite the header comments in `seasonRollover.ts` and `youthIntake.ts` that
   describe a bounded arc — no stale comments left behind.
2. Search the whole repo (api-server, frontend, lib/db, harness, docs) for any other
   "5 seasons" / "season 5" / "final season" / "career complete" assumption —
   including the frontend's career-end screen ("Phase 6 renders the career-end
   result") and anything that sizes an array or a name pool by 5. List every hit in
   the report and what was done with it.
3. Extend the five-season harness to 30 seasons, established difficulty, and run
   it. Report the per-season table (W-L, tier, finish, balance, squad size, squad
   average age, academy count, players retired, board verdict). It does not have to
   look good — it has to run to season 30 without an error and the report must say
   plainly what goes wrong over 30 years (balance runaway or collapse, squad
   ageing out, empty academy, standings anomalies, anything that stops making sense).
   That table is the input to L-04 and Rob's economy decisions. Do not tune
   anything in this item.
4. Restore the 8 deleted achievements exactly as they were before R-77 (git shows
   them), with their original API keys, so they match Rob's icons. Delete the
   "8 proposed replacements" section from `docs/achievements-table.md` and list all
   30 there.

### L-02  Multi-year contracts, expiry warning, automatic release

Rob's design:
- Players: contract length chosen at signing and at renewal — 1 to 5 seasons.
  Renewal allowed at any time inside the last season of the contract (not just
  +1 on the same terms).
- Staff (coaches, medical, all roles): the same — 1 to 5 seasons, renewable, and
  they EXPIRE. Build the calendar-tick expiry for staff that already exists for
  players.
- Warning: 4 weeks (28 game days) before any player or staff contract ends, a
  clear warning on the dashboard attention list and in Club News, naming the
  person and the end date.
- At the end date, if not renewed: the person leaves automatically and returns to
  the hiring pool (free agents for players, the staff pool for staff). One Club
  News line per person. This is the existing player path; make the staff path
  identical.
- Academy contracts stay as they are (managed by the academy).

### L-03  AI clubs age and turn over

The AI field must feel alive over 30 seasons: their players age on the same
rollover, retire at the same age, and are replaced from the unused real-portrait
pool so every AI player still has her own card (Rob's standing rule). Keep it
simple and honest — replacement players drawn from the same rating distribution as
the club's tier. Re-run the 30-season harness afterwards and report the table again.

### L-04  Economy over 30 seasons  (Rob decides after reading L-01's table)

Rob's expectation: "if the finances work for 5 years they should work for 30."
The L-01 table is the evidence. No economy changes without Rob reading it first.

### Later (not for the 13 Oct build unless everything above is proven early)

- Retired players entering the coaching pool as staff.
- A real job market so resignation does not end the career.

## Release note

The v0.9.1 build in Steam's review queue is a 5-season game. It cannot be the
launch build. The launch build must contain L-01 at minimum (with the 30
achievements) and goes up as a new SteamPipe build on the `achievements` branch
alongside the Steam achievements work — never replacing BuildID 25335748 until Rob
says so.
