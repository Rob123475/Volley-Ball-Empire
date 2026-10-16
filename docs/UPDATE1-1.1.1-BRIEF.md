# 1.1.1, 16–17 Oct: the Clubs page, the transfer window, perks and the calendar

Branch **update-1**, on top of 1.1.0 (BuildID 25976250, live on Steam since 16 Oct, packaged from `3592767f`). Rob starts this on Friday afternoon and checks it in the morning. Work straight through without waiting for him.

## Rules
- Don't stop to wait. Where something isn't covered here, make the most reasonable choice, write it under "Decisions made" in the report, and carry on.
- Never push. Never touch main or launch-final. Commit after each part.
- Read the code before changing it. Delete what you replace. One set of rules for every club, Rob's and the AI clubs'. Every number goes in one place (the rules constants), named.
- Keep LF line endings.
- Test each part with its own suite as you go, run alone. Run the **full `pnpm run build` once at the end** (Part 9).
- Report: **docs/STATUS-1.1.1.md**, written as you go.
- Existing saves must load and carry on. Write down what a 1.1.0 save gets on first load under these rules.

## Part 1: the Clubs page
- A new page in the side menu, **between Finances and Career**, called **Clubs**. It lists every club, Rob's included.
- **Each club's row shows:** badge and name, continent, tier, ladder position, this season's record, balance, senior wages ("$X of $60,000"), and injuries this season.
- **Sort menu:** richest, poorest, most successful (by ladder, then World Tour points; say which you used), most injury-prone (injuries this season), continent, and name.
- **Click a club** and choose **Players** or **Staff & Medical**:
  - **Players:** every senior and youth, with picture, rating, role, age, wage, **contract end date**, and any injury with weeks out. Show the manager (face, name, speciality), the record and the last 5 results above the list.
  - **Staff & Medical:** every staff member with role, skill, wage and **contract end date**.
- **Scouting (AC-2 A):** same rule as the Player Market. An unscouted player shows "?" and locked attributes.
- **Buttons (AC-3 A):** the same Watch star, Scout and Buy buttons as her Player Market card, through the market's existing routes. Buying follows Part 2's rules.
- Rob's own club opens his own Club page.
- Club names elsewhere in the game stay as they are (not clickable).
- **Watch List:** add the same Sort menu as the Player Market.

## Part 2: buying a senior, the transfer window
Rob's rule replaces today's "last 6 months of her contract" rule (`routes/contracts.ts`, the "Transfer Available" tab). Delete the old rule.
- **The transfer window is the off-season.** Read the off-season dates from the calendar's existing Off-Season events and report them. The window runs alongside anything else then (for example the Olympics).
- **You can watch, scout and buy a senior from another club at any time of year**, but she **moves only when the window opens**. Rob's example: buy her in March to beat her club's renewal, and she arrives at the start of the window.
- **AC-8 A:** the transfer fee is paid the day the deal is agreed. That locks it, and her club can't renew her after that. Her wage starts the day she arrives. The cap is checked when the deal is made, against the buying club's senior wages **on her arrival date**: contracts that end before then don't count, and other players bought ahead do.
- **No dumping seniors mid-season:** a club can't release or sell a senior outside the window. It carries her until then. A contract that simply runs out still ends on its date.
- **AC-7 B:** delete the starting squad's free first-week release (Rob's 28 Sep rule). Taking a pick back while the draft is still open stays.
- **Free agents** can still be signed at any time.
- **Staff, medical and youths** are not covered by the window. They can be hired, bought or loaned at any time.
- **AC-9 A:** AI clubs buy ahead too, from each other and from Rob, using the same rules. They decide by need, money and cap, like their existing buying.
- **Clash to check:** today, a player on the injured list can't play again until her cover has gone. If the cover is a senior, the no-dumping rule keeps the cover until the window. Read how it works, choose the most sensible way to keep both rules, and report it.
- The Player Market shows a bought-ahead player as "Joins [club] on [date]". The Team page shows Rob's incoming players and their arrival dates.

## Part 3: one chance to keep her
- When a club bids for a senior under contract at another club, the club holding her gets **one chance** to beat the offer. If she accepts the counter-offer, she stays; if not, she moves (in the window). One bid, one counter, done.
- **AC-10:** the holding club has **14 game days** to answer. No answer means she goes. Rob gets a message naming the bidding club and its full offer (wage, length, perks), with Counter and Let her go.
- **How she decides:** she adds up each offer: wage over the contract, plus perks (by their pull). If the counter is worth at least as much as the bid, she stays. **When the two are close, morale decides:** low morale at a losing club means she walks, and high morale at a winning club means she stays. Put "close" and the morale weight in the constants, and report them with two worked examples.
- AI clubs counter too, by their money and cap.

## Part 4: perks
- **Any senior contract in the game can carry perks:** a new signing, a renewal, a bid, a counter-offer, and AI clubs' deals.
- **A perk's monthly cost starts the day she arrives** (or the day a renewal starts), is added to her wage cost, and **counts toward the cap**. Show it in Finances as its own line, "Player perks", so Rob can find it.
- The 10 perks, monthly cost (AC-11, all 10 = $10,000 a month):

| Perk | Per month | Pull |
|---|---|---|
| Phone and internet | $220 | Small |
| Gym membership | $270 | Small |
| New car | $450 | Medium |
| Clothing allowance | $540 | Small |
| Beauty salon | $670 | Medium |
| Family flights home | $900 | Medium |
| Personal media agent | $900 | Medium |
| Private chef | $1,120 | Medium |
| Personal trainer | $1,350 | Large |
| Beach house | $3,580 | Large |

- Set each pull's value in the constants and report them.
- Existing contracts have no perks.

## Part 5: AI clubs' youths
- **AC-6 A:** an AI club's youth can be **loaned or bought at any time**.
- **The selling club must agree.** It weighs its own position. If it has few youths or plans for her, it prefers a loan; if it has too many youths or needs cash, a sale is more likely.
- **The buyer's scout negotiates.** With a low-skill scout, a sale is very unlikely and only a loan is offered. A high-skill scout makes a sale much more likely. Use the scout staff that exist today; read how scouting works first. Put the chances in the constants, and report a table: scout skill 50 / 70 / 90 against a club with few or many youths.
- A bought youth goes into the buyer's academy (6 places, as now) and the selling club is paid her youth price.
- AI clubs can buy youths from each other the same way.

## Part 6: the calendar
Rob asked: "Is the calendar up to date with all our changes?" The legend today shows Regional/Pool, World Tour, World Finals, Olympic Qualifier, Olympics, Off-Season, Financial, Contract Deadline and Facility/Club.
- List every dated rule in the game (1.1.0's and this brief's) and check each is on the calendar. At least:
  - the Day 1 draft (Jan 1);
  - Jan 8, when the AI clubs take staff (and the reminder from Jan 1);
  - the pre-season choice day and each camp's dates;
  - the transfer window opening and closing;
  - Rob's bought-ahead players' arrival dates;
  - each counter-offer's 14-day deadline;
  - Rob's players' and staff's contract end dates.
- Add what's missing, with colours that fit the legend. Report the list: already there, added, or not added and why.

## Part 7: words
- The Rules page: the transfer window, buying ahead, no dumping, one chance to keep her, perks, youth deals and scouts, and the Clubs page.
- Patch notes for 1.1.1 in plain player words: **docs/UPDATE1-1.1.1-PATCH-NOTES.md**.

## Part 8: tests
- New suites, each added to run-all:
  - clubs-page (list, sort orders, Players and Staff & Medical, scouting "?");
  - transfer-window (buy ahead, arrival in the window, fee at signing, wage on arrival, cap on arrival date, no release outside the window, renewal blocked once sold, AI clubs buying ahead);
  - counter-offer (one bid, one counter, 14 days, no answer means she goes, morale deciding a close call both ways, AI counters);
  - perks (cost from arrival, cap, Finances line, renewals with perks);
  - youth-deals (loan or buy, scout skill table, club position);
  - calendar (every dated rule from Part 6 on the calendar).
- Update any existing check that knowingly expected the old rules (the 6-month window, the free first-week release, release mid-season). Say which and why.

## Part 9: the full build and 1.1.1
- Run the full `pnpm run build` (all suites). Fix every failure in its cause and re-run that suite alone. If time allows, run a second full build.
- **The soak:** harness/long-career-update1.mjs on Medium, 5 seasons. Report, per season:
  - AI clubs with 3 seniors;
  - transfers made in the window;
  - bought-ahead deals;
  - counters won and lost;
  - perks paid (all clubs);
  - youth sales and loans;
  - the median AI balance, and the number below zero.
  
  Flag anything that breaks: clubs going broke from perks, nobody ever moving, or everybody moving.
- Stamp the version **1.1.1**. Run compress-unity-data.cjs, then package to a **new** folder: `npx electron-builder --win dir "-c.directories.output=C:\build\vbe-1.1.1"`. Prove it on a throwaway profile, never Rob's save:
  - the draft;
  - the Clubs page and its sorts;
  - a buy-ahead;
  - a 3D match with Pause;
  - Settings and Exit.
  
  Confirm the exe Properties say 1.1.1.
- Load a **copy** of a 1.1.0 save and confirm it carries on.
- Write `steam/app_build_5233750-1.1.1.vdf` with ContentRoot `C:\build\vbe-1.1.1\win-unpacked\`, SetLive empty, Desc "v1.1.1 Clubs page and transfers (update-1 <hash>)".
- **Do not upload.**

## Report
At the top of docs/STATUS-1.1.1.md:
- each part done or not;
- the decisions made;
- the constants with their values (pulls, "close", morale weight, the youth sale table);
- the off-season window dates;
- the calendar list;
- the suites and counts for both builds;
- the soak table;
- the package proof;
- the final commit hash.

Then stop.
