# Overnight 30 Sep → 1 Oct 2026: morning status

Written at 21:50 on 30 Sep, once every item was done and the final full harness was green. Nothing was changed after it; no item was left to start before 06:30.

Brief: `C:\Users\rbonn\Downloads\OVERNIGHT-BRIEF-30SEP.md`, followed in its order (A → D → B → C → F → E → C15).
Game repo branch `fix-batch-29sep`, last code commit `ef2ec27`. Unity repo `main`, last commit `344b3c6`.
Every item has its own row, with what changed and how it is proven, in `docs/OVERNIGHT-30SEP-STATUS.md`. This page is the summary.

- Your live save was never opened. Tests ran on copies of the starter DB and of `Downloads\volleyball-empire-backup-30sep-0921.sqlite` (only ever copied).
- No Steam upload.
- Local package: `C:\build\vbe-unity-01oct\win-unpacked\Beach Volleyball Empire.exe`. It was built from `ef2ec27` and not launched (the packaged game opens the real save folder). `C:\build\vbe` was not touched.
- Soundtrack still 18 songs.

## Every item

| # | Item | Status | Commit(s) |
|---|---|---|---|
| 1 | Career > Records shows the manager's records | Done | `7e3b510` |
| 2 | Manager Profile: earned salary; one reputation measure | Done | `119833d` |
| 3 | Old records' PC dates converted to game dates at boot | Done | `4ec7173` |
| 16 | Proportions and jump height | Done | Unity `57c206e` |
| 17 | Light skin no longer yellow | Done | Unity `d4a2d75` |
| 18 | Crowd heard under the music fade | Done | Unity `807d213` |
| 19 | Boost buttons no longer stick | Done | Unity `86a1e73`, game `5064c73` |
| 20 | Boost squares gone; ring at the feet and a lit button | Done | Unity `6f9f1e4` |
| 20b | Action words in one fixed banner | Done | Unity `79b206c`, game `cbfdb7b` |
| 21 | Two commentators (Kailey, Hukum), ElevenLabs, 48 clips | Done | Unity `04dfec5`, `3b10d08`; game `10dfd43` |
| 22 | Commentary says she/her | Done | game `10dfd43` |
| 23 | Leave-match confirm box | Done | `b5fd4ae` |
| 24 | Leaving = forfeit | Done | `2eeb758` |
| 25 | Colour wash at match start (D-7) | Blocked, as the brief says | — |
| 4 | All scouting takes 5 game days and costs $1,500, on the ledger | Done | `9d7c45c` |
| 5 | The report is the hired Scout's; no Scout, no player scouting | Done | `bc33542` |
| 6 | Market pages refresh when the clock moves | Done | `89189ae` |
| 7 | No rating on anyone unscouted or unsigned | Done | `6929bf5` |
| 8 | Staff and medical wage range until scouted or hired | Done | `1f290ed` |
| 9 | Attribute labels in plain words | Done | `ca8e400` |
| 10 | Card order follows the role buttons | Done | `b1472f1` |
| 11 | Nationality as the country everywhere (saves too) | Done | `9609688` |
| 12 | Youth market on senior rules; potential drives growth | Done | `9e5b863` |
| 13 | Missions find youth only, with your odds | Done | `3bd125a` |
| 14 | Academy cap 6 | Done | `759679b` |
| 30 | Established shows Silver from day one | Done | `70c3281` |
| 31 | Boosts stronger | Done | `150e2d0` + Unity `344b3c6` |
| 32 | Transfer fee goes to the selling club | Done | `4cf1628` |
| 33 | 4 staff + 4 medical slots | Done | `d100728` |
| 33b | Contract lengths for every staff and medical hire | Done | `2e65340` |
| 34 | Left for later (Q-6, Q-10, Q-12, Q-13; staff illness) | Nothing done tonight, as the brief says | — |
| 26 | Transaction History in plain words | Done | `f212c01` |
| 27 | One round numbering | Done | `a7633bf` |
| 28 | Sponsor Reputation badge readable | Done | `d4764ee` |
| 29 | Money achievements in one format | Done | `a48b6cc` |
| 15 | Youth loan market | Done (built, not just planned) | `af08004`, page tidy `ef2ec27` |

## Harness

- **After every item:** targeted suites in a snapshot of the repo holding exactly that item's code (`C:\vbe-snap`).
- **Full-harness checkpoints** at items 24, 6, 10, 12, 14, 33b and 29, and after C15.
- **Final full run** on `ef2ec27`: **90/90 suites passed, ALL HARNESSES PASSED** (30 Sep, 21:50).

Checkpoint results. Every failure was fixed and rerun green before its commit:

| Checkpoint | Result | What failed, and the fix |
|---|---|---|
| 24 | 74/77 | The old leave-early suites were updated for the forfeit rule; economy was a chance season. All green on rerun. |
| 6 | 78/78 | — |
| 10 | 79/80 | fresh-install read the exact wage item 8 now hides. |
| 12 | 82/82 | — |
| 14 | 80/83 | Academy-intake and academy-cap suites for the cap of 6; a "Your scout" fallback read as a placeholder name. |
| 33b | 85/85 | — |
| 29 | 89/89 | — |
| C15 | 89/90 | The academy-intake name rule (see row 15). |

Each commit's row names its suites and results.

Four suites also needed updating because an item changed what they check:
- staff-bonuses (item 7)
- wizard-career-economy (item 8)
- olympic-qualification (item 11)
- watched-result (item 27)

Each is described in that item's row.

The ElevenLabs key check runs before every push in both repos. The key is in neither repo, nor in any build, log or this file.

## Numbers you asked for

**Item 13, mission finds** (0 / 1 / 2 / 3 / 4 found; 40,000 simulated missions per row; `utils/missionFinds.ts`):

| Case | Odds | Measured |
|---|---|---|
| Average scout (60), department L1, 1 month | 12 / 35 / 30 / 15 / 8 % | 12.1 / 35.1 / 30.0 / 14.7 / 8.1 % |
| Top scout (90), department L10 | 5 / 20 / 30 / 27 / 18 % | 5.2 / 19.9 / 29.8 / 27.2 / 17.9 % |
| Weak scout (30), department L1 | 20 / 40 / 25 / 10 / 5 % | 20.2 / 40.0 / 24.7 / 10.1 / 5.1 % |

Between those, the odds blend by a quality score:
- q = (s < 0 ? s : 0.75·s) + 0.5·d + length
- s is the scout's rating from −1 to +1 around 60.
- d is the department level from 0 to 1.
- length adds +0.1 for 3 months and +0.2 for 6 months (Q-D).

Never more than 4 finds. A blank explains itself.

**Item 31, boosts:** attack 0.06, defence 0.055 per point while on (they were 0.04 and 0.03); 3 points on, 5 off. Measured on the Unity code, 20,000 matches a cell:

| Match | No boosts | Attack every time | Defence every time | Alternating |
|---|---|---|---|---|
| Even (70 v 70) | 51.8% | 64.9% | 63.3% | 64.1% |
| 10 points weaker (65 v 75) | 39.8% | 52.9% | 52.3% | 52.5% |
| 10 points stronger | 63.9% | 75.7% | 74.1% | 75.2% |

**Item 21, commentary:**
- **Characters:** 2,007 characters of text sent. The API's character-cost header totalled 241 (Q-F).
- **Where the game reads clips:** `artifacts/beach-volleyball/public/unity-build/StreamingAssets/commentary/` (in the package: `resources/public/unity-build/StreamingAssets/commentary/`). Replace a clip by file name; no code change.
- **Voices:** Kailey `h1nUqvAFfvrCaHydX12x`, Hukum `CSyG9YhQsyznH6ETWS8Q`, eleven_v4, excited.
- **Steam:** the AI disclosure needs a line for AI-generated voice (ElevenLabs commentary).

## Questions for you

- **Q-A (item 5)** Player and youth scouting now needs a hired Scout. Staff and medical scouting still accept a Head Coach or Assistant Coach. Should those need a Scout too?
- **Q-B (item 14)** Answered by C15: the academy's youth team of 3 now plays; the reserves don't. See Q-J.
- **Q-C (item 32)** A fee now goes to the club that sells her, but no AI club owns a player the market sells: AI clubs field pool players, who are never on the market. So today no fee ever reaches an AI club. Should AI clubs' players become buyable?
- **Q-D (item 13)** Mission length also shifts the odds (+0.1 for 3 months, +0.2 for 6). Keep it, or should length only change how many players are watched?
- **Q-E (item 21)** The subtitles say "Kailey:" and "Hukum:". Keep those names, or give the commentators their own?
- **Q-F (item 21)** 2,007 characters were sent; the API's header said 241. Please check the usage on your ElevenLabs account page.
- **Q-G (item 24)** Forfeits already in a save were stored as 0-2 and stay that way: a real 0-2 loss looks the same, so they can't be told apart safely. New forfeits show "Forfeit".
- **Q-H (item 12)** Youth prices by talent: Low $600, Average $900, High $1,300, Elite $1,700, Generational $2,000. Each shows as a ±15% range on $100 steps, held inside $500–$2,000. OK?
- **Q-I (item 31)** Boost strength (attack 0.06, defence 0.055) is provisional, for you to tune after playing.
- **Q-J (C15)** Court time: reserves develop at 50% of the youth team's weekly rate. Is 50% right?
- **Q-K (C15)** AI academies: each of the 60 AI clubs keeps 4 youths (3 youth team + 1 reserve), made by your intake's rule. At 19 an AI academy player leaves the game rather than joining the senior market (60 academies would add about 80 seniors a season). Keep, or should AI graduates join the market or their club?
- **Q-L (C15)** AI behaviour: an AI club lists its reserve, and borrows a listed youth rated 5 or more above its weakest youth-team player. One loan at a time per club; at most 3 new AI loans a week. A listed youth's rating shows on the loan list even though she is unscouted. OK?

## Before you open your own save

The first launch of this build changes your save for good. It:
- adds the new columns and the loan table;
- converts real-world dates to game dates (item 3), and nationalities to countries (item 11);
- renames the old prize lines to the event's round (27), and refiles the mission line as scouting (26);
- gives your hired staff with no end date one at the end of this season (33b).

In the first salary week the AI academies are created. Your 30 Sep backup is in Downloads if you want the old state back.

I opened a copy of that backup with this build and it all went through cleanly:
- Dashboard: Silver tier, World Tour R4/57 after four matches.
- Transaction History in plain words; prize lines named "World Tour R4 vs …".
- The Youth Loans tab, with the AI clubs' listings after one salary week.

## What to check on screen

**The 3D match (items 16–24, 31):**
- Players' proportions and jumps against the net (only head and shoulders clear it).
- The Light and Medium Light skin tones on the sand.
- The crowd still audible when the music fades.
- Boost buttons that never stick, with a ring at the players' feet and a lit button (no squares).
- Action words in the banner high in the frame.
- Kailey and Hukum alternating, excited, with subtitles naming them, and she/her throughout.
- Leave match: the confirm box, then "Forfeit" in the results.
- Whether the stronger boosts feel right.

**Career:**
- Career > Records shows your records, not the Trophy Cabinet (1).
- Manager Profile shows your earned salary; the stars match your "Local Coach" level (2).
- First Steps is dated in 2026 game time (3).

**Markets:**
- Scouting takes 5 days, costs $1,500 and is on the ledger (4); the report is signed by your Scout (5).
- A card counts its days down while you watch (6).
- Unscouted staff and medical show "?" and a wage range (7, 8); attributes in words (9); cards in button order (10).
- Countries, not "British" or "Australian" (11).
- The youth market shows price ranges and "?"; scouting a youth reveals her potential; signing asks for confirmation (12).

**Youth:**
- A mission's report lists her finds with Sign or Reject, or explains a blank (13).
- The academy holds 6 (14).
- Team > Youth Loans: swap into the youth team, list a reserve, borrow for 6 or 12 months, the confirm box, each club's half on the ledger ("Youth loan: half of …") (15).

**Club:**
- The Silver badge on an Established career (30).
- 4 of 4 staff and 4 of 4 medical, each hire with 6 months / 1 season / 2 seasons (33, 33b).
- Transaction History in words (26).
- The top bar, the Match Day box and the ledger agree on the round (27).
- The Sponsor Reputation badge is readable (28).
- Money achievements shown as money in both the Trophy Cabinet and the Career page (29).

## Proof files

`docs/proof-01oct/`:
- Unity renders and logs for items 16–21: `u16-spike-side.png`, `u17-five-tones-*.png`, `u20-*.png`, `u20b-word-*.png`, and the `.txt` measurements.
- The Youth Loans tab and borrow box: `c15-youth-loans-tab.jpg`, `c15-borrow-dialog.jpg`.
