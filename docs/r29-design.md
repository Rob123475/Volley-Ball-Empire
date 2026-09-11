# R-29 design — honest AI competitors

Status: design, written 12 Sep 2026 before any R-29 code. Every claim below was read from
the code or queried from the starter DB in this session. Where something is a
recommendation rather than a fact, it says so and gives the reason.

---

## 1. What is there today (read, not assumed)

| Piece | File | What it actually does |
|---|---|---|
| Player's fixture | `utils/seasonFixture.ts` `ensureSeasonFixtureRows` | 62 `matches` rows per season: rounds 11–70 plus World Semi Final (71) and World Final (72). `awayTeamId = homeTeamId` (the player's own team); the opponent is `awayTeamName = event.opponent`, one of **10 static strings** in `data/worldTour.ts`, none of which is a real club. |
| Player's match | `routes/matches.ts` `POST /matches/:id/simulate` | `sideRating(activePlayers)` vs `resolveOpponentRating` (roster → pool club matched **by name** → tier ladder plus a per-name offset), `pointProbability` → `simulateMatch`, then `creditRankingPoints` for the **player only**. The live tick engine (`utils/match-tick-engine.ts`) uses the same `pointProbability` and settles through this same route with `precomputedResult`. |
| AI "World Tour" results | `routes/calendar.ts` `autoSimulateAIMatches` | A **55% coin flip** on every scheduled `matches` row not owned by the current team, for the whole database. Because each career's fixture is owned by its own team, this writes **other careers'** matches and `teams.wins/losses`. No ranking points. |
| Skip match | `routes/calendar.ts` `POST /calendar/skip-match` | Random 2-1 or 1-2 written straight to the row. No engine, no economy, no ranking. Called by the match-day modal's "skip". |
| Regional leagues | `utils/regionalSeason.ts` | Real fixtures (6 continents × 6 clubs, double round-robin), run through the shared engine — but rated `100 - (poolRanking - 1) * 8`, which gives 100…28. The same clubs' two pool players average 83.4…72.5 (Europe); the stored `rating` column differs from the players by a mean of 4.1 and up to 14.4. |
| Qualification | `resolveRegionalSeason` | Top 3 per continent → `world_tour_qualifications`. **`careerSaveId` is never written**, and `GET /regional-league/qualifications` reads the latest year across **every career**. |
| Rankings | `competitor_rankings` | Per (competitor, career, seasonYear). Written only for the player's club. `competitors` already has 60 pool-club identity rows. |
| Ladder | `routes/seasons.ts` `GET /seasons/:id/ladder` | `competitor_rankings` **INNER JOIN teams**, so pool clubs could never appear even if they had rows. "Goals" are `wins*2 + teamId%10`, which is not data. |
| Leaderboard / dashboard rank | `routes/leaderboard.ts`, `routes/dashboard.ts` | Same source; leaderboard also inner-joins `teams`. |
| World Finals seeding | `routes/matches.ts` `getWorldFinalsSeedings` | Every team in the DB (all careers) by `wins`, padded with 9 hardcoded `WORLD_FINALS_RIVALS` names. The player is always seeded 1st or 2nd. |
| Final standings snapshot | `seasonRollover.ts` and the World Final branch of `/simulate` | Both snapshot **every team in the database** by `wins*3`. |
| The rules | `pages/rules.tsx` | "World Tour — 18 teams total: 3 qualifying teams from each of the 6 continental regions." |

That is the bug in one line: a header that promises 18 qualified clubs, a ladder with one
club on it, AI "results" that are coin flips on other people's saves, and finals seeded from
nothing.

---

## 2. The design

### 2.1 The field

**One World Tour field per career per season = that season's 18 regional qualifiers + the
player's club = 19 entrants.** Taken literally from the rules page and from
`resolveRegionalSeason`, which already produces exactly 3 per continent.

19 is odd, so every round one entrant cannot play. The player's 62-event fixture is the
existing contract (R-08 asserts it), so **the player never rests; one AI club rests per round,
rotating** (§2.4). This is the only place the design had to choose, and it is written up as an
open question for Rob in `docs/WEEKEND-STATUS.md`: making the field even is a one-function
change (`worldTourField`) and nothing else here depends on it.

Qualification rows get their `careerSaveId` (the writer is fixed), and the field is read from
**this career's** most recent resolution only.

### 2.2 Competitor rows

- Identity: `competitors` (already global; 60 pool rows plus one per team).
- Per career: at the draw, one `competitor_rankings` row per field member for
  (career, seasonYear), created at 0 points. The player's row already exists (R-26, with the
  R-11 difficulty head start).
- Nothing else holds a standing. No names from static data, no padding, no fallback ladder.

### 2.3 One table for every World Tour result — `world_tour_fixtures` (new, career-scoped)

| column | |
|---|---|
| `career_save_id`, `season_year`, `round`, `tier` | scope; tier copied from the event |
| `home_competitor_id`, `away_competitor_id` | both real competitors |
| `match_id` (nullable) | the player's `matches` row when the player is a side |
| `status` | `scheduled` / `completed` / `not_qualified` |
| `home_sets`, `away_sets`, `home_points`, `away_points`, `sets` (json) | the engine's actual output |

The player's own match stays in `matches` — lineup, economy, injuries, Unity and the tick
engine all read it, and moving it would be a rewrite with no benefit. The fixture row
**links** to it and takes its result when it completes. That way "how many matches has club X
played, with what scores" is one query over one table, for AI clubs and the player alike.

`matches` cannot hold AI-vs-AI games: `home_team_id`/`away_team_id` are foreign keys to
`teams`, and pool clubs are not teams.

### 2.4 The draw — `ensureWorldTourDraw(careerSaveId, seasonYear)`

Idempotent. Runs on the first World Tour round the calendar reaches (after regional round 10
resolves), and on demand from any route that needs a World Tour opponent.

- Field = `worldTourField(career, year)`, ordered by continent then qualifying position.
- Rounds 11–70, round index k = round − 11, n = 18 AI clubs: the player meets `field[k mod n]`;
  `field[(k + n/2) mod n]` rests; the remaining 16 are paired by the circle method. Result:
  every round is 1 player match + 8 AI matches + 1 rested club, and over 60 rounds every club
  meets the player 3 or 4 times and rests 3 or 4 times. The home side for AI pairs alternates
  by round. *(First sketched as a circle over `[PLAYER, A1…A18, REST]` with the player pinned.
  Rejected while writing it: the swap needed when the player lands on REST makes one club
  rest twice per cycle, about 6–7 times a season against about 3 for everyone else.)*
- The same function covers an even field (no rest), so Rob's Q1 options need no change here.
- Writes the player's scheduled `matches.away_team_name` to the drawn club's real name.
  Completed rows are history and are left alone.
- If the regional leagues are not finished (possible only on a legacy save that fell behind),
  the overdue regional rounds are simulated first — they are real fixtures, just late — and
  then resolved. It never invents a field.

### 2.5 Every AI fixture goes through the player's engine

`playWorldTourFixture(fixture)`:

- Strength = `sideRating(the club's two continental_pool_players)` — **the exact function that
  rates the player's squad**. Recommendation, with the reason: three different ratings for the
  same club exist today (stored `rating`, `100 - (rank-1)*8`, and its players). The players are
  the only one of the three built by the same rule as the player's side. The same function then
  replaces both the regional formula and `resolveOpponentRating`'s by-name pool lookup (which
  becomes a lookup by the fixture's competitor id).
- `pointProbability(home, away, { homeAdvantage: true, weatherPenalty })` → `simulateMatch`.
  The weather is that round's event weather, read from the player's `matches` row for the same
  round (same event, same beach). AI clubs carry no win streak, so `winStreak` is 0.
- Points: `creditRankingPoints` for **both** sides, via `awardedPoints(tier, won, pointsBefore)`
  — the same tier table and the same D4(b) gate the player is judged by, using each club's own
  points before the match.
- The player's match credits the **opponent** too, with the inverse result, everywhere a player
  match can complete: `/simulate` (instant and tick-engine paths), `/forfeit`, and the Unity
  `game-api` result route.

`ensureWorldTourUpTo(career, round)` plays every scheduled AI fixture up to `round`. The
calendar calls it as days pass (replacing `autoSimulateAIMatches`), and `/simulate` calls it
before a World Tour match, so when the player plays round r the whole world has played to
round r too.

### 2.6 Standings — one function, every reader

`worldTourStandings(career, year)` over `competitor_rankings` LEFT JOIN `teams` and
`continental_pool_teams` for the name. Order: ranking points, then wins, then set difference
(from `world_tour_fixtures`), then fewer losses, then competitor id (stable). Sets for and
against and the last-five form come from `world_tour_fixtures`, replacing both the
`teamId % 10` "goals" and the frontend's `mockForm`.

**Before the draw, the ladder is the player's own row only.** No field has been decided yet, and
R-26 (closed) made the player's row visible from day one; that stays. From the first World Tour
round the ladder is the whole field. The smoke checks R-20/R-06 said "ladder contains only F's
own team", which encoded the one-club world. They become "contains only F's own competitors —
its team plus AI clubs, never another career's team".

### 2.7 World Finals, seeded from the rows (D5)

On round 71, seeds are the top 4 of `worldTourStandings`. Semi 1 is 1v4, Semi 2 is 2v3.

- **Player in the top 4:** the player's semi row gets its real opponent; the other semi is
  played through §2.5. On round 72 the player's final row gets the other semi's winner if the
  player won, or becomes `not_qualified` if the player lost, with the final then played between
  the two AI winners.
- **Player not in the top 4:** the player's semi and final rows become `not_qualified` (no
  match, no purse, no ranking), and both semis and the final are played through §2.5.

`getWorldFinalsSeedings`, `WORLD_FINALS_RIVALS`, and the lazy seeding block in
`GET /matches/fixture` are deleted. `bracketBlockReason` stays as defence in depth.

### 2.8 Final standings snapshot

The rollover snapshot is written from `worldTourStandings(career, year)`: this career's 19
clubs with real records, not every team in the database. The duplicate writer in the World
Final branch of `/simulate` goes, and the manager summary reads the player's rank from the
standings function directly.

---

## 3. What changes — every screen and query

### Server

| File | Change |
|---|---|
| `lib/db/src/schema/game.ts` | + `world_tour_fixtures`. `ensureSchema` derives the table from the schema at boot, so existing saves get it (R-01). |
| `utils/worldTour.ts` (new) | `worldTourField`, `ensureWorldTourDraw`, `playWorldTourFixture`, `ensureWorldTourUpTo`, `worldTourStandings`, `seedWorldFinals`, `poolClubRating`. |
| `utils/regionalSeason.ts` | Qualification rows carry `careerSaveId`; ratings from `poolClubRating`. |
| `utils/seasonFixture.ts`, `data/worldTour.ts` | Regular-round opponents start as `TBD`; the static `opponent` strings are deleted. |
| `utils/seasonRollover.ts` | Standings snapshot from `worldTourStandings`. |
| `routes/calendar.ts` | `autoSimulateAIMatches` deleted and replaced by `ensureWorldTourUpTo` + `seedWorldFinals`. `skip-match` stops writing random scores: it refuses (409) unless the pending match is already completed, and the client simulates first. |
| `routes/matches.ts` | Opponent rating by competitor; opponent credited on `/simulate` and `/forfeit`; draw and catch-up before a World Tour match; seeding helpers and the World Final standings writer deleted. |
| `routes/game-api.ts` | Unity-submitted result credits the opponent too. |
| `routes/seasons.ts` | Ladder = `worldTourStandings`; `teamId` nullable; + `competitorId`, `isPlayer`, `form`; `goalsFor`/`goalsAgainst` carry real sets. |
| `routes/leaderboard.ts` | Same source; AI clubs included; `teamId`/`userId` nullable. |
| `routes/dashboard.ts` | Rank from `worldTourStandings`. |
| `routes/regional-league.ts` | `/qualifications` scoped to the career. |
| `routes/world-tour.ts` (new) | `GET /world-tour/fixtures?round=` (every fixture in a round, plus field size); `GET /world-tour/finals` (seeds, semis, final, results). |
| `routes/dev.ts` | `migrate-season-78` writes `TBD` rather than static names. |
| `lib/api-spec/openapi.yaml` | Ladder/leaderboard entry changes, two new paths, `not_qualified` status; regenerate the client. |

### Screens

| Screen | Change |
|---|---|
| `competition/wt-ladder.tsx` — World Tour Standings | 19 real rows once drawn; the "You" row comes from `isPlayer`; the column reads Sets +/−. |
| `competition/wt-fixtures.tsx` — World Tour Fixtures | Every fixture of the round from `/world-tour/fixtures`, not only the player's; the header count comes from the field size, not a hardcoded "18". |
| `competition/world-finals.tsx` | Bracket, results and champion from `/world-tour/finals`, not "top 4 of a ladder, final always TBD". |
| `competition/qualified-teams.tsx` | Same page, now reading only this career's qualifiers. |
| `league-ladders.tsx` — Seniors ladder | Keyed by `competitorId`; `isMe` from `isPlayer`; real form replaces `mockForm`. |
| `dashboard.tsx` | Ladder widget and rank from the real standings. |
| `leaderboard.tsx` | AI clubs appear; null earnings and reputation render as "—". |
| `matches.tsx` — World Finals section | `not_qualified` state ("Did not qualify — finished #N"); real opponents. |
| `hooks/use-calendar.ts`, `components/match-day-modal.tsx` | Skip = simulate through the real engine, then advance. |

### Not changed, noted for R-10

- Olympics qualification (`routes/olympics.ts`) is country-rating based, while the rules page
  says "Top 12 World Tour teams qualify".
- The Unity payload's away pair is still two free agents; it could be the drawn club's two
  real pool players.
- `rules.tsx` says "18 teams total", which will stay true or change with Rob's answer.

---

## 4. Harness — `harness/world-tour-competitors.mjs`

Two careers, A and B, in one fresh DB, each advanced through the regional period and N World
Tour rounds, with every player match played through `/simulate`.

1. **Field:** each career has exactly 19 World Tour competitors — its own 18 qualification rows
   (all carrying its `careerSaveId`, 3 per continent) plus its player club.
2. **Every AI club played, for real:** after N rounds, each AI club's `world_tour_fixtures`
   count equals N minus its scheduled rests; exactly one AI club rests per round; every result
   is 2-0 or 2-1 with legal set scores (21/21/15 targets, win by 2).
3. **Records reconcile:** each club's `competitor_rankings` wins and losses equal its fixture
   results.
4. **Points sum correctly:** each club's ranking points equal a recomputation from its fixtures
   in round order, using the tier table and the gate — computed independently inside the
   harness.
5. **Order:** the ladder endpoint's order equals the standings rule applied to those rows.
6. **Isolation:** B's ladder contains no competitor row, result or player club belonging to A;
   each career's numbers reconcile against its own fixtures only.
7. **The old bug, with sabotage:** during the World Tour the ladder has 19 rows (not 1) and the
   fixtures endpoint's field size matches it. Then the same checks run against a sabotaged copy:
   AI ranking rows deleted (the old "1 team" state), and one AI club's points bumped by 1. Both
   checks must **fail** there, or the harness itself fails, proving they can catch the bug.

Then `rollover.mjs` (R-08), with a per-season table that adds final rank, finals qualification
and the champion. **Pass condition from Rob: the player must not win every season by default.**
