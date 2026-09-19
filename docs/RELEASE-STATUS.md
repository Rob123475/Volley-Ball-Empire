# Release status — Rob's four design decisions (15 Sep 2026)

**Added 19 Sep 2026:** the R-79 soundtrack batch — item 19 in the table below, checks 27-33 in section 2,
and a Steam item in section 3 that needs Rob's answer before the music can ship.

Written at the end of the batch that carried out Rob's decisions on R-55, R-60, R-61 and R-62, on top
of the overnight batch of 14 Sep (R-50, R-42, R-43, R-49/56/57/59, R-58 — section 1b). Rules:
`docs/REPAIR-REGISTER.md` rules of engagement — never the live save, commit per item, decide-and-go on
anything that is not game design. Every number below comes from a run in this batch; nothing is
estimated.

---

## 1. Done

| Item | Register | Commit | What changed | Proof |
|---|---|---|---|---|
| 1 | R-55 | `0bf9a71` | Closed by Rob's decision: the board's bands stay (established: top 4 met, 5th–8th a warning, 9th+ a strike, two strikes sack). 1 established career in 10 sacked over four seasons is intended | register entry; no code change |
| 2 | R-60 | `3267c4b` | Resign and Break Contract END the career through the sacking path with their own reason; the dialog says "This ends your career at <club>. There is no job market yet."; the save keeps its club; a clubless save an older build left is finished at boot; the finished screen names each ending | career-ends 12/12 |
| 3 | R-61 | `d5bbd96` | A real Olympic tournament in Olympic years (2028 for a 2026 career): the 12 qualified nations' real top-two pairs from any club, 4 groups of 3, quarter-finals, semi-finals, bronze and gold on the World Tour engine, 25 Nov (after round 70, before the World Finals); medals on the players' records, trophies for their club, Club News. The projected draw, the manager-picked squads with invented wildcards, `olympic_selections` and the Locations page are deleted | olympics-tournament 24/24; olympic-qualification 29/29; fake-content-removed 11/11 |
| 4 | R-62 | `8eb6bde` | Every rollover that opens a season brings the player's club 3 youth players: the youth template card, 16–18, ratings from the shipped youth's distribution, real names of the club's country and region; Club News; a dry academy says it found no one. Players a career creates are owned by it and no longer leak into later careers | youth-intake 22/22 |
| 5 | R-63 | `3bc6c70` | The academy holds 12: signing and the intake both stop there, and the Team page banner reads the same cap from the roster. Academy wages billed once, in the weekly wage run; the per-match charge deleted. A full academy costs $71,500 a season in wages (12 players, 52 weeks), plus 20% in staff costs on the wage bill | academy-cap-wages 17/17 |
| 6 | R-64 | `27fecd1` | Release build 0.9.0: the NSIS installer (336,203,636 bytes) and win-unpacked (557,170,430 bytes), installed and run from the install folder against the live save and on a first run | build chain 32/32; install proof in the register |
| 7 | R-65 | `7974e06` | Rebuilt 0.9.0: exe CompanyName "Bean & Label"; no menu bar, dev tools only when unpackaged; the starter DB is only copied (to the save, and to `userData/starter-reference.db` per launch) and never opened in the install folder; after-pack guard keeps sidecars out of the package. Installer 336,204,338 bytes | live-save run and read-only first run both left the install folder's 953 files unchanged |
| 8 | R-67 | `95f178e` | Staff salaries were annual figures charged as monthly — a Head Coach hire took $145,000 of a new underdog club's $150,000. Starter DB and seed scripts now monthly ($4,833–$23,333), older saves repaired on boot, hired staff billed weekly (salary ÷ 52/12). Rob's career keeps its balance; the charge already made is not refunded | wizard-career-economy 11/11 |
| 9 | R-68 | `c787e14` | The running clock is visible: the date re-animates each day, a bar fills across the ticker interval, a dot pulses. Interim — R-72's 7-day strip replaces it | calendar-tick 7/7 |
| 10 | R-70 | `3f57266` | The top bar shows the round of the competition being played — Continental R7/10, World Tour R31/57, Finals · Semi-finals / Final, Off-season — and the dashboard pill counts the season's 69 rounds. 78 was the schedule's slots: 10 continental + 60 World Tour (57 events, 3 open dates) + 2 finals days + 6 off-season. Match Day, Simulate, the bye card, World Tour Results and the leaderboard stopped showing slots as rounds | season-phase 16/16 |
| 11 | R-73 | `75e8ed8` | The wizard's colours were always sent for the home pair; the away pair was two club-less free agents with no kit, painted in Unity's red fallback. The away side is now the fixture's own AI club pair in that club's kit; all 60 AI clubs have two distinct hexes (12-primary palette, no primary repeated inside a continent); a null kit is logged as a warning. HUD team names ship with the Unity export | club-kits 14/14; unity-match-state-payload 9/9 |
| 12 | R-75 | `85ca86c` | Pool players had no skin tone at all (the court showed stand-ins). All 120 now carry one, drawn from their nation's own tone counts among the 276 seeded players (continent counts for the 5 nations with none), reproducibly. 20 of 60 pairs share a tone — the seeded tones are themselves uniform random picks, so "same country looks alike" is as strong as that data allows | pool-skin-tones 4/4 |
| 13 | R-77 | `def721c` | A match watched in 3D never completed — it sat "in progress" with no win, purse, stats or achievements, and blocked the calendar. It now completes on its own through the same code as Sim Result. Achievements: 30 → 22; Continental Champion, the 10/20/30-season ones, 10 World Finals, 2 Olympic golds and First Pay Day deleted; every description states its real trigger | watched-match 10/10; rollover Local Legend check |
| 14 | R-71 | `2d23dcc` | 3D Court zoom on all three cameras: mouse wheel and +/- dolly the camera, clamped per preset, reset when the camera changes; the overhead camera starts at 24 m (was 40). The first batch test saw no zoom because the preset positions lived in a Dictionary that a mid-Play domain reload emptied; nothing is stored now. Unity `347e193` | CourtPlayProbe 3/3 presets, clean and after a forced reload: close 19.09 m, +9/−8 m; wide 17.08 m, +8/−10; overhead 21.40 m (was 37.40), +10/−16 |
| 15 | R-76 | `2d23dcc` | Players move: the set lands at the net and the attacker meets it; the nearer defender blocks at the net, her partner covers deep; on court, with the existing locomotion clips. The movement test had sampled nothing (an Editor-folder component Unity would not attach); it now samples in the player loop and waits out the launch recompile. Unity `707defe` | CourtPlayProbe: all four left their spots by 4.48–6.53 m, all within 0.60 m of the net; 28 spikes at a mean 1.39 m, blocker 0.60 m |
| 16 | R-74 | `2d23dcc` | Spectators: 25 of 25 animate on the spot (clapping, cheering, photo, idles already in the project); no controller holds a walk, so the three walkers on the left stand and animate. Unity `415375c` | CourtPlayProbe: 25/25, 0/25 controllers with a walk clip, walkers moved 0.00 m |
| 17 | R-66 | `b85ae80` | The installer's folder is always "Beach Volleyball Empire" under Programs. It used to offer whatever folder an earlier install had recorded: on this machine a test folder, and before that "Volley-Ball-Empire" from the build before the rename. The old version is still removed from its own folder | install test: stale folder recreated with the 0.9.0 installer; the 0.9.1 directory page offers …\Programs\Beach Volleyball Empire; the silent install lands there, old folder 953 → 0 files; live save unchanged |
| 18 | 0.9.1 | `b85ae80` | Release build 0.9.1, carrying R-66/71/73/74/75/76/77. Installer 335,301,232 bytes (sha256 `548f6206…`); win-unpacked 952 files / 556,297,102 bytes (manifest `ab3b700e…`); native ABI OK, only Brotli Unity files, no starter DB sidecars, no menu bar | full harness 38/38 on the rerun (first run 35/38, see R-78) |
| 19 | R-79 | `5c11336` + `81d5dfa` + `a148c01` | The game was silent. Rob's ten Suno tracks now play through it, with volume, mute and skip. One `<audio>` element in a provider above the top `<Switch>` in `App.tsx` — it cannot live in `Shell`, because `/login`, `/new-career`, `/career-end` and `/court` render outside it, so music there would stop the moment the 3D Court opened. Title track first, then shuffled, nothing repeating until all ten have played. The bar (skip, mute, slider, current title) is in the sidebar footer — one copy covers the desktop rail and the mobile sheet — and on the profile picker. Volume and mute persist under `bve.music`, 40% and unmuted by default. Electron now sets `autoplayPolicy: "no-user-gesture-required"`, so it starts by itself. The Unity export does have audio of its own (crowd ambience, cheer, referee whistle), so the music ducks to a third on `/court` | music playlist 27/27 on every run; full harness 39/39, 830/830 at its best, 38/39 on the final commit with only R-78's chance forfeit in *gameplay smoke* — that suite passes 4 runs in 6 on identical code; ten mp3s in the packaged `resources/public/audio/music`, sha256-identical, all served at HTTP 200 `audio/mpeg`. Driven on screen here on a throwaway starter DB: both playlist passes ten-distinct with the title track first, skip / mute / persistence, and the sidebar and mobile-sheet fit — which is how `a148c01` was found, the volume slider being painted in the sidebar's own colour |

### Rob's questions, answered
- **R-61, the brief's harness line said 16 knockout matches.** Four groups of 3 with the top two to
  quarter-finals is 4 QF + 2 SF + bronze + gold = **8**, plus 12 group matches. Built and asserted
  as 8.
- **R-61, calendar.** Round 70 (23 Nov) is followed directly by the World Finals (27 Nov); there is no
  slot between. The Games are played on that transition, dated 25 Nov. No clash with any fixture.
- **R-61, nations with fewer than two eligible players:** 52 nations can field a pair; **2 cannot —
  Ireland and Portugal, one each.** Neither has qualified in any run. Rule applied, no invented
  players: such a nation gives its place to the next nation that can field two.
- **R-62, portraits.** 89 distinct portraits in `attached_assets` have no player row; tags are
  filenames only (45 country, 43 region, 1 malformed); every one is an adult senior card. By Rob's
  decision they are not used for youth — reserved for a senior free-agent refresh (V2). Intake cards
  are the youth template, so cards never run out.
- **R-62, how long the pool lasts.** The finite pool is names. After a five-season Brazil club used
  12, South America still holds **194 unused names — 64 more seasons of intakes of 3.**
- **R-62, "five rollovers produce five intakes".** A five-season career crosses 5 boundaries; 4 open
  a new season and bring an intake (2027–2030); the 5th ends the career. Asserted as 4.

### Final full harness

**31/31 suites passed** (`node harness/run-all.mjs`, launched without `ELECTRON_RUN_AS_NODE`), with
every static guard and typecheck clean and the starter database matching the model (50 tables).
**After R-63: 32/32**, the new suite 30 being *academy cap and wages* 17/17, every other suite at the
same count as below and the season rollover still 78/78 with no career sacked.

| # | Suite | Checks | # | Suite | Checks |
|---|---|---|---|---|---|
| 1 | guard self-test | 42/42 | 17 | world tour byes | 18/18 |
| 2 | schema drift | 12/12 | 18 | all-star removed | 12/12 |
| 3 | reference data backfill | 8/8 | 19 | olympic qualification | 29/29 |
| 4 | reference data update | 6/6 | 20 | starting contracts | 15/15 |
| 5 | reference data new players | 9/9 | 21 | contract renewal | 23/23 |
| 6 | save folder migration | 7/7 | 22 | empty squad forfeit | 11/11 |
| 7 | wal checkpoint on shutdown | 7/7 | 23 | injuries and fitness | 27/27 |
| 8 | unity match-state payload | 9/9 | 24 | season trophies | 14/14 |
| 9 | unity career scoping | 15/15 | 25 | invented content removed | 11/11 |
| 10 | match tick fallback roster | 9/9 | 26 | dashboard standing | 11/11 |
| 11 | migration fixtures | 62/62 | 27 | **career ends (R-60)** | 12/12 |
| 12 | fresh install | 40/40 | 28 | **olympic tournament (R-61)** | 24/24 |
| 13 | fixture transaction | 3/3 | 29 | **academy intake (R-62)** | 22/22 |
| 14 | career difficulty | 15/15 | 30 | gameplay smoke | 75/75 |
| 15 | board review | 58/58 | 31 | season rollover | 78/78 |
| 16 | world tour competitors | 38/38 | | | |

Along the way (all fixed before this run, none a game fault):
- The first Olympic runs were sacked for abandonment because the harness never renewed contracts.
- The club-honours check then found the club's players weren't in the field: first because their
  nations didn't qualify, then because USA's seniors are draft-pool players, not free agents.
- The intake harness first ran out of its day budget one season short.

### Five-season table (season rollover suite, real fixtures)

Three established careers (the strongest starting squad) and three underdog careers (the weakest),
each played through five seasons on the real draw. The academy intake (R-62) is live in every one of
these careers from season 2, and 2028 is an Olympic year. Every season crowned a real champion from
the field. **Sacked: established 0 of 3, underdog 0 of 3.**

| Career | Season 1 (2026) | Season 2 (2027) | Season 3 (2028) | Season 4 (2029) | End |
|---|---|---|---|---|---|
| RollStrong (est.) | 39-17, #2, Gold, runner-up | 37-19, #2, Gold, runner-up | 36-20, #2, Gold, runner-up | 40-16, #2, Gold, runner-up | complete |
| RollStrong2 (est.) | 37-18, #2, Gold, semi-final | 28-26, #11, Bronze | 40-16, #1, Gold, **champion** | 40-15, #2, Gold, semi-final | complete |
| RollStrong3 (est.) | 41-14, #1, Gold, semi-final | 38-18, #2, Gold, runner-up | 34-20, #5, Gold | 43-13, #1, Gold, **champion** | complete |
| RollWeak (und.) | 15-39, #19, Bronze | 23-31, #16, Bronze | 18-36, #17, Bronze | 19-35, #17, Bronze | complete |
| RollWeak2 (und.) | 18-36, #17, Bronze | 16-38, #19, Bronze | 26-28, #9, Silver | 11-43, #19, Bronze | complete |
| RollWeak3 (und.) | 19-35, #16, Bronze | 20-34, #17, Bronze | 17-37, #19, Bronze | 15-39, #19, Bronze | complete |

Each season is 54–56 of 59 matches played: 57 World Tour rounds less 3 byes, plus the World Finals
for the four that qualify. Balances still rise every season with the intake's academy wages
(RollStrong $1.13M → $3.97M; RollWeak $451K → $1.20M).

The board's season reviews for the established careers:
- RollStrong: met in all five (2nd, 2nd, 2nd, 2nd, 3rd against top 4).
- RollStrong2: met, **failed** (11th against top 4 — a strike and the final warning), met as
  champion, met, met (6th against top 7). The strike did not become a sacking because the next
  season met.
- RollStrong3: met, met, **below** (5th against top 4 — a warning, no strike), met as champion
  (1st against top 6), met.

This is the R-55 band Rob chose to keep: one failed season in 15 established seasons here, no
sacking.

---

## 1b. The overnight batch before this one (14 Sep)

| Register | Commit | What changed | Proof |
|---|---|---|---|
| R-50 | `56c40ba` | Injured players cannot be selected; fitness scales a player's contribution 0.6–1.0; rest days recover; injuries heal weekly | condition 27/27 |
| R-42 | `06488d3` | Season trophies written at the boundary and shown in the cabinet and the season review | season trophies 14/14 |
| R-43 | `b8f730a` | Invented world news, Manager Movements, the youth league, the Job Market, poaching, the Reputation Bonus card deleted; Club News built only from real rows | fake-content-removed 11/11 |
| R-49, R-56, R-57, R-59 | `92d928e` | Harness faults fixed properly | 62/62, 58/58, 27/27 |
| R-58 | `bb37664` | Dashboard tier badge and the board's standing line | dashboard-standing 11/11 |

---

## 2. What Rob must check on screen

Start the app from your own terminal (R-39) and confirm `http://localhost:4173/api/health` answers.
Use a test profile for anything that ends a career — never *mary*.

**On the live save's first launch with this build** the server, once: drops `olympic_selections`
(log: `removed content dropped`), creates `olympic_tournaments`, `olympic_matches`, `olympic_medals`
and `youth_intakes`, adds `players.origin_career_save_id`, and marks every season row whose year is
divisible by 4 as Olympic. Players the live save's careers created BEFORE this build (draft picks,
scouted signings) cannot be traced to their career, so they stay unowned; only players created from
now on are kept out of other careers.

**R-60 — Resign / Break Contract**
1. Career → Career Options → Resign: the dialog reads *This ends your career at <club>. There is no
   job market yet.* Confirm → the finished screen says *You Resigned* with the reason. The save
   appears finished in Career Management, still showing its club.
2. Same for Break Contract on another test career: *You Broke Your Contract*; the $25,000 release
   clause is gone from the balance first.

**R-61 — Olympics**
3. Olympics → Schedule in 2026: no draw and no scores; it names the next Games (2028).
4. Olympics → National Squads: each nation's current pair, with their clubs; a *Fewer than two
   players* count, and those nations badged *Cannot enter* (Ireland and Portugal in the harness
   career — your own squad's nationalities can change the count).
5. Rules → Olympics: the eight lines match the above.
6. Only if you play a career to late November 2028: the schedule shows four group tables, the
   bracket and the medals; Club News "<nation> win Olympic gold 2028"; a medal in a player's
   record and in the Trophy Cabinet if one of your players won one.

**R-62 — academy intake**
7. Play (or open) a career past its first season boundary: Club News "3 youth players join the
   <club> academy" dated 1 January, with names, nations and ages.
8. Team → Youths: the three on the youth template card, aged 16–18. The banner reads *N / 12* with
   twelve dots and the subtitle *holds up to 12 players* (R-63). Signing a 13th academy player is
   refused with *Academy is full (12/12)*.
9. Finances → transactions (R-63): academy wages appear only inside the weekly *Weekly player
   salaries (… in the academy)* row — never a *Youth Academy wages* row after a match.
10. Rules → Academy: six lines, including the intake stopping at the Team page's limit and the weekly
    academy wage.

**R-67 — staff wages** (needs the next build; the live save is repaired on its first launch with it)
11. Staff market: salaries read in the thousands a month (a Head Coach $10k–$23k), not $100k+.
12. Hire a Head Coach on a new underdog career: the balance drops by one month's salary; the next
    salary week's Finances ledger has a "Weekly staff wages" line at salary ÷ 4.33.
13. Your "Rob Matthews" career: Sofia Andersen now reads $12,083/month; the balance keeps the $145,000
    already taken.

**R-68 — the clock**
14. Press Slow: the date animates each day, a thin bar fills under it every 3 seconds, and a dot pulses
    beside SLOW. Pause stops all three.

**R-70 — the round in the top bar**
15. New career: the top bar reads "2026 · Continental R1/10", and the dashboard pill shows the same
    label at 1%.
16. Play into the World Tour. On its first date the top bar reads "World Tour R1/57", the next-match
    chip shows "WT R… · opponent", and the Match Day dialog names the same round. No screen shows a
    round above 57 or a "/78".

**R-73 — club kits** (the opponent's kit and the HUD names need the R-71/74/76 Unity export)
17. On a career past the World Tour draw, open a match in 3D Court. Your pair wears the wizard's
    colours, the opponent's pair wears its own club's two colours (never plain red), and the HUD names
    both clubs.

**R-75 — pool pairs' skin tones** (needs the same export)
18. In that match, the opponent's two players have skin tones set, not the prefab default. The
    Unity console has no "skin tone … is not one of the known bands" error.

**R-77 — watched matches and achievements**
19. Watch a match in 3D to the end, then open the Dashboard. The record shows one more win or loss,
    the Finances page has the purse, and the calendar is no longer stuck on that match day.
20. Career → Achievements lists 22. None mentions loans, towns, 10+ seasons or a continental
    championship. After your first win, First Steps is unlocked.

**R-71 — camera zoom** (needs the 0.9.1 build)
21. In 3D Court, roll the mouse wheel forward: the camera moves in and stops short of the umpire chair;
    roll it back: the camera moves out. Holding + or − does the same.
22. Press 2 (overhead): it starts much closer than before, and the wheel works there and on 1 (wide).
    Pressing any camera key puts that camera back to its starting view.

**R-76 — players move**
23. Watch a rally. On a set, the attacker runs to the net and spikes from there. On the other side,
    the nearer player goes to the net to block while her partner drops back. Nobody leaves the court,
    and they walk rather than slide.

**R-74 — spectators**
24. The three girls by the tent clap and cheer on the spot. The figures on the left stand and move in
    place; nobody walks off anywhere.

**R-66 and 0.9.1 — the installer**
25. Run `C:\build\vbe\Beach Volleyball Empire Setup 0.9.1.exe`. On "Choose Install Location" the folder
    ends in `\Programs\Beach Volleyball Empire`, with no "Volley-Ball-Empire" and no test folder
    anywhere in it.
26. Finish the install and start the game from the Start menu. There is no File/Edit/View menu bar,
    and your profiles are there.

**R-79 — the soundtrack** (needs a rebuilt app; `pnpm run electron:dev` in your own cmd window)
27. The profile picker plays music the moment it appears, with no click. The bar under *New Profile*
    names the song — the first one is always *Beach Volleyball Empire*.
28. Open a career and walk Dashboard → Team → Finances. The song keeps playing straight
    through; it does not restart or cut out, and the title in the sidebar does not change until the
    song ends.
29. Skip: the title changes and a different song starts. Keep skipping — no song comes back
    until all ten have played.
30. Mute silences it and the icon changes; unmute returns at the same level. Drag the slider: the
    volume follows it.
31. Quit and relaunch: your volume and mute setting are as you left them. (They live in
    `bve.music` in localStorage.)
32. Open Match Day → 3D Court. The music drops to about a third under the crowd and the
    whistle, and comes back up when you leave the court.
33. Nothing ever shows an error dialog about music. To prove the skip-on-failure path, rename one
    mp3 in the directory the run actually serves — `artifacts/api-server/dist/public/audio/music`
    for `electron:dev`, `resources/public/audio/music` in an installed copy — then launch and watch it
    move straight to the next song, with one warning in the console. Rename it back afterwards: the
    harness fails on a missing file by design.

**Still open from 14 Sep** (unchanged): R-50 fitness and injury display (Team, Dashboard Next Match,
lineup picker); R-42 honours in the season review and the Trophy Cabinet; R-43 — Club News with game
dates, no Manager Movements, no Youth League, no Job Market, no Reputation Bonus, a test profile still
deletes; R-58 tier badge and board line. (14 Sep item 8, "Olympics → Schedule: Projected draw", is
replaced by check 3 above.)

---

## 3. Between this build and a Steam review copy

Honest, in the order it would have to happen. Nothing in this section was done in this batch.

### Packaging — done: 0.9.0 (R-64, rebuilt in R-65)
- **Built and proven on a clean install.** `C:\build\vbe\Beach Volleyball Empire Setup 0.9.0.exe`
  (336,204,338 bytes, sha256 `5d3d0237…`) for our testing, and `C:\build\vbe\win-unpacked`
  (557,172,057 bytes, 952 files) for Steam's depot. Installed silently and launched from the install
  folder against the live save (no data changed, profiles listed, 3D Court rendered, WAL checkpointed
  on quit) and, with the install folder **read-only**, on an empty user-data folder (fresh save from
  the starter DB, Select Manager with no profiles). The install folder was unchanged by both runs.
  Details and hashes in the register, R-64 and R-65.
- **The game never writes to its install folder** (R-65). The starter DB is only copied: to the save
  on first run, and to `userData/starter-reference.db` on every launch for the server's reference
  check. The package's `resources/starter-db` is checked to hold only the `.sqlite` (after-pack).
- **Metadata** (R-65). CompanyName and Publisher "Bean & Label"; description set.
- **Window** (R-65). No File/Edit/View/Window/Help menu bar; no dev tools shortcut in a packaged build.
- **Not code-signed.** No certificate is configured; Windows SmartScreen warns on the installer. Steam
  installs from the depot, so this matters for the NSIS copy, not the Steam build.
- **Size.** 320.6 MB installer / 531.4 MB unpacked; the Unity `.data` is most of it. The lever is the
  Unity project's texture and audio import settings, not the build.
- **Dev route shipped.** `/dev/generation-test` is still routed in the production frontend with a
  dead API behind it (R-10 audit finding 9).

### Steam — first build uploaded (16 Sep 2026, v0.9.1, BuildID 25335748)
Done on 16 Sep with Rob at the keyboard for every Steam login and website click; nothing below is
estimated. Steamworks App ID **5233750**, Windows depot **5233751** ("Beach Volleyball Empire Content").

1. **Depot configuration — done.** Content root `C:\build\vbe\win-unpacked`; launch option
   `Beach Volleyball Empire.exe`, Windows only, added under Installation → General Installation.
   No `steam_appid.txt` or Steamworks SDK is in the package, and none is needed for a plain depot.
2. **Auto-Cloud — not configured.** Still as planned: root **WinAppDataRoaming**, subdirectory
   **"Beach Volleyball Empire"**, pattern **`*.sqlite`**. The whole save is `volleyball-empire.sqlite`
   (R-23); `*.sqlite` does not match the `-wal`/`-shm` sidecars, and R-64 proved a normal quit
   checkpoints the WAL and leaves neither behind. Not covered: after a crash the latest writes sit
   in `-wal`, and Auto-Cloud would sync the older `.sqlite`.
3. **Build upload — done.** The brief said v0.9.0, but `win-unpacked` held the **0.9.1** build (exe
   dated 15 Sep 4:24 PM, 15 seconds before the 0.9.1 installer; `latest.yml` says 0.9.1), so 0.9.1
   is what went up — it carries R-66/71/73/74/75/76/77 on top of 0.9.0 and passed the harness 38/38.
   Scripts `steam/app_build_5233750.vdf` and `steam/depot_build_5233751.vdf` (copies of the ones in
   `C:\STEAMWORKS\steamworks_sdk_165\sdk\tools\ContentBuilder\scripts\`; SDK 1.65, already on
   the PC). `SetLive` left empty in the script. Rob ran steamcmd himself:
   `steamcmd.exe +login rtbonner +run_app_build ..\scripts\app_build_5233750.vdf +quit` — 952 files,
   556.3 MB uploaded, "Successfully finished AppID 5233750 build (BuildID 25335748)" at 10:59 AM.
   Set live on the **default** branch from the website (history: "Set live BuildID 25335748 for
   branch default"), then Publish → Prepare for Publishing → Really Publish with the note
   "v0.9.1 first review build (BuildID 25335748) set live on default; launch option added".
   Checklist afterwards: every DEPOTS item ticked — At Least One Depot Configured, At Least One
   Build Configured, Launch Options Defined, Install Directory Set, Depot Languages Configured,
   Store And Devcomp Packages Match, Package Includes Windows Depot, All Depots Attached.
4. **Store assets — open.** The STORE part of the same checklist is still unticked: Platform Support
   Matches, Pricing For At Least One Package, Published Pricing For At Least One Package, Trailer
   Uploaded (App Configuration is ticked). Capsule images, screenshots, descriptions, tags, system
   requirements and the content survey are separate from the build and were not part of this batch.
5. **Review copy.** Keys come from Steamworks once the store side is done. The App Admin page warns
   that the specified release date is less than three weeks away.

### The soundtrack, before Steam (R-79) — Rob's, not code
- **Confirm the Suno plan.** Only songs downloaded while on a paid plan (Pro/Premier) carry
  commercial rights. If the ten were made on the free plan they cannot ship as they are. This is the
  one thing that could force the music back out of the build, so it is worth settling before the
  store page goes up.
- **Update the AI disclosure.** The Steam AI content disclosure already says generative AI was used;
  it should now also say the music is generative. Website change on the App Admin page, not code.
- **Credit.** Nothing in the game names the tracks' origin. If the store page or the credits should
  say so, that is a decision for Rob, not something this batch assumed.

### Known gaps in the game
- **Academy graduates fill the senior squad** (found in R-63, not changed): a promoted graduate stays
  in the reserve role and counts as a senior, so by season 3 or 4 graduates fill the three-senior
  signing limit and a senior can only be signed after a release. Graduates are never released or
  offered a senior contract. Rob's call.
- **Retirement is effectively off** (triage 3z): one senior retires in five seasons.
- **No Career Result screen** for a completed five-season career (R-10): the season-5 review dialog is
  the end.
- **Design-doc screens not built** (R-10): Rankings screen, per-event qualification, tier status
  detail.
- **Economy invariants (R-07)**: I1 *monotonic return* and I9 *money stays meaningful* still violated.
- **Club News** does not list contract renewals: a renewal records no date.
- **Created players are not deleted with their career**: owned reference rows stay in `players`,
  unseen by every other career.
- **Open design questions** (triage §3): AI club reserves (3a), a qualifying competition (3b).

### V2 (`docs/triage.md`)
- **A real job market** from real AI clubs and reputation — Rob wants it if time allows (R-60).
- **A senior free-agent refresh** from the 89 unused adult portraits (R-62).
- **AI squad turnover** — ageing, retirements and intake for AI clubs (R-62).
