# Achievements — the 30 (for Steamworks entry)

Source: `artifacts/api-server/src/utils/achievement-definitions.ts` on the `achievements`
branch after L-01 step 4. API Name must be typed EXACTLY as the key. Display Name and
Description as shown. Order follows the definitions file (the order the in-game page shows).

L-01 (22 Sep 2026): a career has no last season, so the six achievements R-77 deleted only
because of the five-season cap are back with their original keys and names (rows 9, 11, 23,
24, 25, 26). Two are still pending Rob's definition (rows 29 and 30): they are NOT in the code
yet and must not be entered in Steamworks until they are.

| # | API Name (key) | Display Name | Description | Category |
|---|---|---|---|---|
| 1 | first_steps | First Steps | Win your first match. | Career |
| 2 | battle_hardened | Battle Hardened | Win 50 matches across your career. | Career |
| 3 | century_wins | Century Club | Win 100 matches across your career. | Career |
| 4 | perfect_season | Perfect Season | Win the World Final in a season in which you lost no match. | Career |
| 5 | tournament_winner | Tournament Winner | Win a Gold-tier World Tour event. | Competition |
| 6 | champion | Champion | Win the World Final. | Competition |
| 7 | world_champion | World Champion | Win the World Final in two different seasons. | Competition |
| 8 | dynasty_begins | Dynasty Begins | Win the World Final three times. | Competition |
| 9 | volleyball_empire | Beach Volleyball Empire | Win the World Final ten times. | Competition |
| 10 | olympic_gold | Olympic Gold | Have a player from your club win Olympic gold. | Competition |
| 11 | double_olympic_gold | Back-to-Back Gold | Have players from your club win Olympic gold at two Games. | Competition |
| 12 | making_money | Making Money | Reach a club balance of $1,000,000. | Finance |
| 13 | millionaires_club | Millionaire's Club | Reach a club balance of $5,000,000. | Finance |
| 14 | debt_free | Debt Free | Win the World Final with the club's balance above $0. | Finance |
| 15 | financially_secure | Financially Secure | Win the World Final five times with the club's balance above $0. | Finance |
| 16 | talent_spotter | Talent Spotter | Sign a youth prospect found by scouting. The yearly academy intake does not count. | Youth |
| 17 | youth_pipeline | Talent Pipeline | Sign 20 youth prospects found by scouting. The yearly academy intake does not count. | Youth |
| 18 | youth_graduate | Youth Graduate | Promote an academy player to starter or interchange. | Youth |
| 19 | youth_factory | Youth Factory | Promote 10 academy players to starter or interchange. | Youth |
| 20 | future_superstar | Future Superstar | Have a player in your squad whose peak rating reaches 85. | Youth |
| 21 | star_factory | Star Factory | Have 3 players in your squad whose peak rating reaches 85. | Youth |
| 22 | local_legend | Local Legend | Complete 5 seasons with the same club. | Legacy |
| 23 | mr_loyalty | Mr Loyalty | Complete 10 seasons with the same club. | Legacy |
| 24 | decade_in_sand | Decade in the Sand | Complete 10 seasons as a beach volleyball manager. | Legacy |
| 25 | veteran_coach | Veteran Coach | Complete 20 seasons on the beach circuit. | Legacy |
| 26 | hall_of_fame | Hall of Fame | Reach 30 career seasons. | Legacy |
| 27 | world_traveller | World Traveller | Play matches on 6 continents. | Legacy |
| 28 | globe_trotter | Globe Trotter | Play matches on 4 continents. | Legacy |
| 29 | continental_champion | Continental Champion | **Definition pending Rob.** The game has no continental final, so the old definition ("Win a continental championship") can never unlock. Not in the code. | Competition |
| 30 | first_pay_day | First Pay Day | **Definition pending Rob.** The old threshold ($100,000) is below every career's starting balance, so it unlocked on day one. Not in the code. | Finance |

## Notes on the restored six

- `volleyball_empire` and `double_olympic_gold` were reworded the way R-77 reworded the
  achievements it kept ("World Final" rather than "championship"; Olympic gold is won by
  the club's players, at the Games every fourth year from 2028). Keys and display names
  are unchanged, so they match Rob's icons.
- `mr_loyalty` used to count `seasonsInCurrentLocation`, a counter nothing ever moved
  (R-77 deleted it). It now counts `seasonsCompleted`, exactly as Local Legend does.
- `decade_in_sand`, `veteran_coach` and `hall_of_fame` are restored unchanged.
