# Daytime brief Fri 2 Oct 2026: status

Brief: `C:\Users\rbonn\Downloads\DAYTIME-BRIEF-02OCT.md`, followed in its order. Branch `fix-batch-29sep` (started at `d641514`).
- **Your saves:** your live save is never opened. Tests use copies of `Downloads\volleyball-empire-backup-02oct-0845.sqlite` or of the starter DB.
- **No Steam upload, no music work.**
- **ElevenLabs key:** never copied. The pre-push key check runs on every push.

SUMMARY-PLACEHOLDER

## 1. Sponsor money table (Q-2): you pick from this

**How it was run:**
- **Shipped numbers untouched:** `lib/db/src/schema/money.ts` still says +$20,000. Each test setting was run in a throwaway copy of the repo (`C:\vbe-sp5`, `C:\vbe-sp10`, `C:\vbe-sp15`), with only `sponsorWeeklyBonus` changed in its built server; nothing from those copies was committed.
- **Same suites as last night:**
  - `harness/ai-club-economy.mjs`: the whole world, 30 seasons, every match played.
  - `harness/economy.mjs`: your own club, 12 seasons, as an established club and as an underdog.
- **"Before"** is the code from before the money pass (`f51d2c8`): no manager salary, no wage rise, no sponsor raise. The AI figures are last night's run; your club's figures were re-run today in a worktree at that commit.
- **"+$20k"** is what ships now (last night's run).
- **Everything except the sponsor raise is as now:** manager salary $16,000–$20,000 a month, wage rise $5,000–$10,000 a month, head coach cap $20,000.

**Bank balance at the end of the season**, in $ thousands. "sold" means sold that season and reopened at $500k.

| Club | Setting | S1 | S2 | S5 | S10 | S20 | S30 | Times sold |
|---|---|---|---|---|---|---|---|---|
| Rio Copacabana Queens (top, 92) | before | 475 | 484 | 491 | 957 | 1,345 | 1,588 | 0 |
| | +$5k | 189 | −5 | −169 | 498 | −19 | 592 | 2 |
| | +$10k | 453 | 490 | 760 | 1,120 | 2,503 | 4,876 | 0 |
| | +$15k | 964 | 1,574 | 2,857 | 4,932 | 9,351 | 13,869 | 0 |
| | +$20k | 959 | 1,433 | 3,597 | 7,070 | 14,472 | 21,972 | 0 |
| LA Beach Legends (top, 90) | before | 464 | 500 | 590 | 1,368 | 2,991 | 4,072 | 0 |
| | +$5k | 286 | 117 | 311 | sold | −57 | sold | 3 |
| | +$10k | 719 | 985 | 1,231 | 1,612 | 3,288 | 4,645 | 0 |
| | +$15k | 725 | 988 | 1,911 | 3,783 | 8,122 | 12,905 | 0 |
| | +$20k | 1,254 | 1,952 | 4,108 | 7,461 | 15,215 | 22,263 | 0 |
| Vancouver Pacific Orcas (middle, 75) | before | 478 | 704 | 896 | 1,069 | 1,382 | 1,688 | 0 |
| | +$5k | 331 | 163 | sold | sold | sold | sold | 6 |
| | +$10k | 573 | 597 | 667 | 838 | 1,230 | 1,486 | 0 |
| | +$15k | 858 | 1,286 | 2,529 | 4,454 | 7,858 | 11,270 | 0 |
| | +$20k | 1,117 | 1,735 | 3,580 | 6,450 | 12,110 | 17,986 | 0 |
| Fiji Island Breakers (middle, 74) | before | 447 | 404 | sold | 414 | sold | 661 | 4 |
| | +$5k | 311 | 84 | sold | sold | sold | sold | 6 |
| | +$10k | 599 | 698 | 984 | 1,160 | 1,447 | 1,696 | 0 |
| | +$15k | 856 | 1,212 | 2,286 | 3,611 | 6,490 | 9,340 | 0 |
| | +$20k | 1,125 | 1,707 | 3,600 | 6,422 | 11,806 | 17,303 | 0 |
| Wellington Southern Cross (last, 58) | before | 485 | 463 | sold | sold | sold | 445 | 5 |
| | +$5k | 324 | 150 | sold | sold | sold | sold | 6 |
| | +$10k | 588 | 675 | 940 | 1,372 | 2,212 | 3,059 | 0 |
| | +$15k | 841 | 1,179 | 2,213 | 3,954 | 7,406 | 10,868 | 0 |
| | +$20k | 1,101 | 1,706 | 3,508 | 6,549 | 12,617 | 18,673 | 0 |
| Dar es Salaam Swahili Stars (last, 57) | before | 503 | 506 | 513 | 518 | 505 | 525 | 0 |
| | +$5k | 355 | 209 | sold | sold | sold | sold | 6 |
| | +$10k | 615 | 733 | 1,083 | 1,662 | 2,815 | 3,975 | 0 |
| | +$15k | 871 | 1,245 | 2,367 | 4,253 | 8,003 | 11,756 | 0 |
| | +$20k | 1,138 | 1,778 | 3,686 | 6,884 | 13,248 | 19,617 | 0 |

**Each setting: all 60 AI clubs over 30 seasons, and your club for 12 seasons**

| | before | +$5k | +$10k | +$15k | +$20k (ships now) |
|---|---|---|---|---|---|
| AI clubs sold over 30 seasons | 145 (18 clubs never sold) | 333 (1 never sold) | 20 (47 never sold) | 0 | 0 |
| AI clubs that end a season below $0 | 5 (13 club-seasons) | 49 (527 club-seasons) | 0 | 0 | 0 |
| Median AI balance at season 30 | $585k | $500k | $2.90M | $10.79M | $18.53M |
| Richest AI club at season 30 | $4.12M | $0.97M | $8.12M | $15.92M | $23.77M |
| Poorest AI club at season 30 | $221k | −$235k | $500k | $7.29M | $15.06M |
| Your club, a season in the bottom three | −$79,500 to −$183,840 (4 seasons; sold after season 5) | −$125,695 and −$272,829 (sold after season 5) | +$60,839, +$28,173, −$5,675, −$25,545, −$127,445 (the underdog sold after season 7) | +$205,871 to +$355,341 (7 seasons, never sold) | +$477,659 to +$554,436 (7 seasons, never sold) |
| Your club, a season as Gold champion | +$240,370 to +$405,970 (6 titles) | −$72,263 (1 title; even the champion lost money, and the established club was sold after season 5) | +$126,391 to +$215,775 (3 titles) | +$463,403 to +$518,441 (4 titles; one over $500k) | +$720,754 to +$791,554 (6 titles) |

**Does it keep the 22 Sep rule?** The rule is that bottom clubs go backwards and get sold, and that a Gold champion gains under $500,000 a season.
- **Before:** **yes**, both halves. This was the old economy.
- **+$5k:** **only the first half, and far too hard.** Bottom clubs go backwards and are sold, but so is nearly everyone: 333 sales, and 49 of 60 clubs go below $0. Your Gold-winning established club still lost money and was sold. It is harsher than before, because the manager salary and wage rise cost more than $5k a week.
- **+$10k:** **mostly yes.** A Gold champion gains $126k–$216k (under $500k). Bottom clubs about break even: 3 of 5 bottom seasons lost money, 2 gained under $61k. The underdog was still sold after season 7, and 20 AI clubs were sold over 30 seasons. None went below $0, but every AI club still grows (median $2.9M at season 30).
- **+$15k:** **no.** Bottom clubs gain $206k–$355k a season and nobody is ever sold. The Gold champion is right at the line ($463k–$518k).
- **+$20k (ships now):** **no.** Bottom clubs gain about $480k–$554k a season, champions $721k–$792k, nobody is ever sold, and every club runs away.

**Raw output:** `docs/proof-02oct-pm/q2_30_seasons_sponsor_plus5k.txt`, `_plus10k.txt` and `_plus15k.txt` (every club, every season); `q2_player_club_before.txt` and `q2_player_club_sponsor_plus5k/10k/15k.txt`. The before and +$20k files are last night's (`docs/proof-02oct/n41_*`).

**Note:** last night's report gave the "before" median as $612k. Parsing the same before file the same way as the others gives $585k, which is the figure used here.

## Items

| # | Item | Status | Commit | What changed, and how it is proven |
|---|---|---|---|---|
| 1 | Sponsor money table (Q-2) | Done (report only; nothing in the game changed) | `4cd27e9` | The table above. |
| 2 | N-46 Staff and medical portraits show another person's name | Done | `b9a4551` | **Cause:** all 199 staff and medical portraits (the 120 in the role folders, which saves use, and the 79 the market templates name) were cut from finished card images. Each had the card's name band, flag, stats, "World Tour" footer and frame baked into its lower part, and most had big "Beach Volleyball World Tour" boards behind the person. The cards show these pictures under whichever generated name a staff member has, so Valentino Greco carried "JAMES WHITMORE" and Ana Vieira "SOFIA PETROVA" with the Bulgarian flag. **Looked at:** every one of the 199, on contact sheets. **Now** each is rebuilt from its source card as the person alone (`scripts/portraits/crop-staff-portraits.py`, run once): <ul><li>found by face detection, with hand-set boxes for the 16 faces it missed, mostly sunglasses under caps (`staff-face-boxes.json`);</li><li>cropped square, head and shoulders, ending above the name band, the face whole and in the middle third;</li><li>the scenery behind the person blurred, so no board, banner or wall logo can be read;</li><li>500 × 500, which suits the near-square staff cards, the wider market cards and the round avatars.</li></ul> The files keep their names, so existing saves show the new pictures with nothing to migrate. The originals are in git (`d641514`). **Also found:** four market templates (Isabella Rodriguez and Natalie Thompson, fitness; Zandile Mokwena and Marta García, sports science) named files that never existed, so those staff had no picture. They now point at their own pictures in the role folders. **Proof:** <ul><li>before/after sheets of all 199: `docs/proof-02oct-pm/n46-portraits-before-after-1…4.jpg`;</li><li>new `harness/staff-portraits.mjs` 5/5: every file 500 × 500; every picture the generators and staff data name exists and is one; every staff row of the starter DB and of a copy of your 2 Oct save is one; Valentino's and Ana's included;</li><li>new `scripts/webgl-proof/staff-portraits-proof.mjs` on a copy of your 2 Oct save: /staff, /staff-market and /medical-market show 170 pictures, all the new ones; screenshots `n46-staff-page.png`, `n46-card-valentino-greco.png`, `n46-card-ana-vieira.png`, `n46-staff-market-page.png`, `n46-medical-market-page.png`;</li><li>staff-bonuses 22/22, staff-name-sync 9/9, staff-slots 9/9, staff-scouting 15/15, staff-labels 5/5, staff-contracts 12/12, club-pages 7/7, market-order 4/4, nationality-countries 7/7, fresh-install 40/40, contract-terms 40/40.</li></ul> **Cannot be removed by cropping** without cutting into the person: small branding on clothing, i.e. the "World Tour" mark on caps and shirt chests (beach assistant coaches, fitness trainers, some strength coaches and massage therapists) and the role word stitched on uniforms ("Physiotherapist", "Nutritionist", "Sports Scientist"). No names, flags, card text or frames remain (Q-1). |
| Pkg | Package from `fix-batch-29sep` (items 1–2) | Done | `b9a4551` | `C:\build\vbe-unity-02oct-pm\win-unpacked` (601 MB, electron-builder `--win dir`, output redirected). before-pack: only the Brotli Unity files packed; better-sqlite3 loads under Electron 32.3.3. after-pack: starter DB clean, no steam_appid.txt, steamworks.js unpacked. Holds the new 500 × 500 portraits. **Not launched**: the package's own server, run by its exe, was booted on a **copy** of your 2 Oct save, and your career loaded (Sydney Riptide), the page and the Unity files were served. Full harness on `b9a4551`: see "Harness". |

## Questions for Rob

- **Q-1 (item 2, N-46)** The portraits keep the small branding on clothes: the "World Tour" mark on caps and shirt chests, and role words such as "Physiotherapist" on uniforms. Cropping can't remove those without cutting into the person. Is that fine, or do you want those pictures regenerated without branding?

## What Rob must check on screen
