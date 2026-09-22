# Overnight status — 22/23 Sep 2026

Branch `achievements`, from e4caeda. The previous report that lived in this file (the
night of 15 Sep — 3D court, cameras, installer 0.9.1) is kept as
`docs/OVERNIGHT-STATUS-15SEP.md`.

Written as the night goes, so the state below is
whatever was true when the last item finished. The live save in AppData was not touched:
every suite drives its own throwaway database.

## Items

| # | Item | State | Commit |
|---|------|-------|--------|
| 1 | L-02a — contract lengths and coverage | IN PROGRESS | — |
| 2 | L-02b — retirement | NOT STARTED | — |
| 3 | L-02c — youth rebirth | NOT STARTED | — |
| 4 | L-02d — graduates cap and trading | NOT STARTED | — |
| 5 | HOF — club Hall of Fame | NOT STARTED | — |
| 6 | ACH — seasons, cabinet, 30 achievements, Steam | NOT STARTED | — |
| 7 | L-04 — money means something | NOT STARTED | — |
| 8 | L-02e — broke clubs sold, job market | NOT STARTED | — |
| 9 | BUILD — v0.9.2 to C:\build\vbe | NOT STARTED | — |
| 10 | REPORT | this file | — |

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

## Anything Rob must check on screen

- **Team page → moving a youth into Match Player or Interchange** now opens "Promote
  <name>" with three buttons. Nothing else about the squad screen changed.
- **Squad page → offering a contract** has three buttons where the 1–12 month slider was.
  The slider computed the end date from the real-world clock, which is the same class of
  bug R-51 fixed on the server.
- **Club balances go deeply negative** in a long career (the 30-season table below). That
  is what item 7 (L-04) is for; item 1 did not change any wage or prize figure.
