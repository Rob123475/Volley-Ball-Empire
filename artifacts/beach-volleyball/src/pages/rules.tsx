import { CONTINENT_COUNT } from "@shared/continents";
import { INJURY_TYPES, INJURY_TREATMENT, RECONSTRUCTION, INJURED_LIST, PROMOTION_MIN_AGE } from "@shared/injuries";
import { MONEY } from "@shared/money";
import { PRESEASON } from "@shared/preseason";
import { GAME_DIFFICULTY } from "@shared/game-difficulty";
import { PERKS, COUNTER_OFFER, AI_TRANSFER_TERMS, YOUTH_DEALS, youthSaleChance } from "@shared/transfers";
import { SCOUT_REPORTS_AT_ONCE } from "@shared/staff-roles";
import { STAFF_BUDGET } from "@shared/staff-budget";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Trophy,
  Award,
  Globe,
  ArrowUpDown,
  Timer,
  Users,
  Ruler,
  Hand,
  Camera,
  Keyboard,
  Sparkles,
} from "lucide-react";

// — Sport Rules —
const SPORT_RULES = [
  {
    icon: Trophy,
    title: "Match Format",
    text: "Best of three sets, every set to 11 points. A set must be won by two clear points: at 10–10, play continues until one team leads by two.",
  },
  {
    icon: Users,
    title: "Teams & Touches",
    text: "Played 2-on-2. Each team gets a maximum of three touches to return the ball, and a block counts as the first touch.",
  },
  {
    icon: Award,
    title: "Rally Scoring",
    text: "A point is scored on every rally regardless of who served. Whichever team wins the point serves next.",
  },
  {
    icon: ArrowUpDown,
    title: "Side Switches",
    text: "Teams switch sides every 7 combined points in the 21-point sets, and every 5 combined points in a 15-point third set, plus between sets — since wind and sun matter outdoors.",
  },
  {
    icon: Timer,
    title: "Timeouts",
    text: "Each team gets one 30-second timeout per set, called only when the ball is out of play.",
  },
  {
    icon: Ruler,
    title: "The Court",
    text: "A sand court measuring 16m long by 8m wide (8m x 8m per side) — smaller than an indoor volleyball court.",
  },
  {
    icon: Hand,
    title: "Ball Contact",
    text: "Players may contact the ball with any part of their body, including their feet — but the serve must be hit with the hand or arm.",
  },
];

// — Competition Structure —
const COMP_TIERS = [
  {
    title: "Regional League",
    badge: "6 teams / continent",
    color: "text-sky-400",
    bg: "bg-sky-500/10",
    border: "border-sky-500/25",
    points: [
      "Positions 1–3 qualify for the World Tour",
      "Positions 4–5 remain in regional competition",
      "Position 6 is relegated to the continental pool",
    ],
  },
  {
    title: "Continental Pool",
    badge: "4 teams / continent",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/25",
    points: [
      "After Round 10 completes each season, the highest-ranked pool team is promoted to the regional league",
      "Promotion is never processed early — projections only confirm once the season ends",
    ],
  },
  {
    title: "World Tour",
    badge: "19 clubs",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/25",
    points: [
      `3 qualifying clubs from each of the ${CONTINENT_COUNT} continental regions, plus your club`,
      "Europe, Asia, North America, South America, Africa & Middle East, Australia & Pacific Islands",
      "57 rounds: each round one club, yours included, has a bye — no match and 0 ranking points",
      "Every club plays 54 matches and has 3 byes, one in every 19 rounds",
    ],
  },
  {
    title: "Olympics",
    badge: "12 national teams",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/25",
    points: [
      "The Olympics are for national teams, not clubs",
      "A country qualifies on the World Tour ranking points its players earned this season: the sum across all of that country's players, whichever club they play for",
      "The top 12 countries qualify; ties are broken by the best single-player total",
      "Player ratings play no part in qualifying",
      "Played in Olympic years only (years divisible by 4), after the last regular World Tour round and before the World Finals",
      "Each nation is represented by its two highest-rated players at any club; injured players cannot be picked, and a nation that cannot field two gives its place to the next nation that can",
      "4 groups of 3, each a round robin; the top two of each group reach the quarter-finals, then semi-finals, a bronze medal match and the gold medal match",
      "Medals go on the players' records, and a club whose player wins one gets the Olympic medal in its trophy cabinet",
    ],
  },
  {
    title: "Academy",
    badge: "3 a season",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/25",
    points: [
      "The academy holds 6 players: 3 on the youth team and 3 reserves",
      "Every new season up to three youth players aged 16 to 18 join your club's academy, never past 6",
      "A club that already has more than 6 in its academy keeps every one of them, but signs no one and takes no intake until it is under 6",
      "An academy player is paid a weekly academy wage set by her potential, once a week with the rest of the squad's wages",
      "About half come from your club's country, the rest from the other nations of its region",
      "Their ratings are drawn from the same spread as the game's other youth players",
      "An academy player becomes a senior player at the season change when she reaches 19",
      "Only your club takes an intake; the AI clubs run academies of their own",
    ],
  },
];

// — Update 1: what's new (Rob, 14 Oct; docs/UPDATE1-OVERNIGHT-BRIEF.md part 8) —
const money = (n: number) => "$" + n.toLocaleString("en-US");
const camp = PRESEASON.lengths;
export const UPDATE1_RULES: ReadonlyArray<{ title: string; points: string[] }> = [
  { title: "The Day 1 draft", points: [
    "A new career starts with no squad. On Day 1 you pick 2 or 3 seniors from every senior in the world: the free agents and every AI club's players.",
    "On Day 1 nobody owns anyone, so there is no transfer fee, only her wage. You choose each one's contract length.",
    "The calendar won't move on until you have 2 or 3. Then the AI clubs fill their gaps from who is left.",
  ] },
  { title: "The salary cap", points: [
    `Every club's senior wages must stay under ${money(MONEY.salaryCap.monthlyCap)} a month.`,
    "What counts: your seniors' wages (starters, interchange and promoted graduates). The academy, staff, the manager and youths out on loan don't count.",
    "A signing, a renewal at a higher wage or a raise that would take you over is refused. The Team and Finances pages show where you stand.",
    "At renewal a senior asks the wage for her rating now, so a player who has improved asks more. The AI clubs obey the same cap.",
  ] },
  { title: "Hire your staff and medical in your first week", points: [
    "On 8 January every season (Day 8 of a new career) the AI clubs take a coach and a medical member each from the market, so hire the ones you want before then.",
    "There are always at least 5 of every role left for you. An AI club's staff are off the market until their contracts end.",
  ] },
  { title: "Injured players come cheap", points: [
    `An injured free agent asks less: out ${MONEY.salaryCap.injuredLongWeeks} weeks or more, half her wage; out less, three quarters. She signs at that wage for the whole contract.`,
    "The AI clubs' players get injured in their matches too, and an AI club won't renew a senior who is out for a long time, so stars do reach the market injured.",
    "An AI club with fewer than two fit seniors can't play and forfeits.",
  ] },
  { title: "Pre-season camps", points: [
    `On day ${PRESEASON.choiceDay} of the off-season, choose: a camp, Rest or Skip. Seniors only; the academy carries on.`,
    "Altitude Camp builds speed and stamina, Power House power and block, Beach Academy serve and defense (and morale +5).",
    `1 week: ${camp["1w"].sessions} sessions at x${camp["1w"].xp} XP, ${money(camp["1w"].cost)}, fatigue +${camp["1w"].fatigue}. 2 weeks: ${camp["2w"].sessions} at x${camp["2w"].xp}, ${money(camp["2w"].cost)}, +${camp["2w"].fatigue}. 4 weeks: ${camp["4w"].sessions} at x${camp["4w"].xp}, ${money(camp["4w"].cost)}, +${camp["4w"].fatigue}.`,
    "A camp must end before your first match of the new season. No normal training while you're there.",
    "Rest is free: no training for the rest of the off-season, and every fit senior starts the season at full fitness, no fatigue and morale +5.",
    "Injuries and fatigue carry over from one season to the next.",
  ] },
  { title: "Difficulty", points: [
    `Easy: ${GAME_DIFFICULTY.easy.blurb}`,
    `Medium: ${GAME_DIFFICULTY.medium.blurb}`,
    `Hard: ${GAME_DIFFICULTY.hard.blurb}`,
    "Nobody's player ratings change. You pick it when you start a career, and it's fixed (shown on your Profile).",
  ] },
  { title: "Ageing and injuries", points: [
    "Each skill grows best while she is young, holds, then fades: speed first (from 26), then stamina (30), power (31), and defense, serve and block last (33).",
    "A fading skill trains at half speed and loses a point or two at each season's end. Every player's ages are a little different, and a hard worker fades more slowly.",
    "A hard-working, coachable player trains faster; an injury-prone one gets hurt more often.",
    "An injury of 4 weeks or more costs a point of speed and stamina, and a little of her training for good.",
  ] },
  { title: "Every staff role has its own job", points: [
    "Head and Assistant Coach: more training XP. Fitness Trainer: less tiredness from training. Promotional Manager: more sponsor money. Scout: scouts players.",
    "Strength Coach: more power and block training. Nutritionist: more stamina training. Massage Therapist: more tiredness off every day.",
    "Sports Scientist: fewer injuries for the whole squad. Doctor and Physio: treat injuries. Medical Specialist: reconstructions.",
    "Pairs add an extra: Doctor + Physio heal every injury faster; Specialist + Doctor or Physio halve a reconstruction again; Strength Coach + Fitness Trainer mean less tiredness from training; Sports Scientist + Nutritionist give better training techniques.",
    "Each bonus grows with the member's skill, the best of each role counts, and one off ill gives nothing. The Staff page shows exactly what each of yours does.",
  ] },
  { title: "Real injuries", points: [
    `An injury has a name and a body area, and the doctor or the physio treats it: ${INJURY_TYPES.map((i) => `${i.name.toLowerCase()} (${i.baseWeeks} wk, ${i.treatedBy === "doctor" ? "doctor" : "physio"})`).join(", ")}.`,
    `Time out is those weeks times the treatment: with neither a doctor nor a physio x${INJURY_TREATMENT.none}, with only the other one x${INJURY_TREATMENT.wrong}, with the right one x${INJURY_TREATMENT.right.at50} to x${INJURY_TREATMENT.right.at95} by skill, with both x${INJURY_TREATMENT.both.at50} to x${INJURY_TREATMENT.both.at95}.`,
    "Hire the right person while she's out and the rest of her time shrinks; lose them and it grows back.",
    `A third injury to the same body area within a year is a reconstruction (1-week injuries don't count):${RECONSTRUCTION.baseWeeks} weeks of surgery and rehab, x${RECONSTRUCTION.factor.none} with no medical staff, x${RECONSTRUCTION.factor.doctorOrPhysio} with a doctor or physio, x${RECONSTRUCTION.factor.specialist} with a Medical Specialist, x${RECONSTRUCTION.factor.specialistWithDoctorOrPhysio} with both. Her card shows her injury history.`,
  ] },
  { title: "The injured list, cover and promotion at " + PROMOTION_MIN_AGE, points: [
    `An injury of more than ${INJURED_LIST.overWeeks} weeks puts her on the injured list: she gives up her senior place, so you can promote, sign or loan in cover. Her wage still counts toward the cap.`,
    "If you take on cover while she's out, she can't play again until that cover has gone (released, sold or loaned out), even when she's fit: \"Fit, waiting for a place\". With no cover she's back as soon as she's fit.",
    `Academy players can be promoted into the seniors from age ${PROMOTION_MIN_AGE}. The AI clubs use the same list and cover from their academies.`,
  ] },
  { title: "Scouting and the Watch list", points: [
    "Star any player on the Player Market to put her on your Watch list (its own tab).",
    "Scout a player again whenever you like, at the same price and 5 days. Every report is kept with its date, so you can see her rating move.",
    "Reports no longer run out at the end of the season. Scouting works on AI clubs' players too, and stays with a player who moves club.",
    `Each person who scouts (a Scout, Head Coach or Assistant Coach) works on ${SCOUT_REPORTS_AT_ONCE} reports at a time: players, youths, staff and medical alike. Ask for another and you're told who is busy and the day the next report is ready. The Staff page shows who is working on what.`,
    "A Scout away on a youth scouting mission does no reports, and can't be sent on a second mission, until he is back.",
    `Asking an AI club to sell you a youth is a negotiation: it takes one of your negotiator's ${SCOUT_REPORTS_AT_ONCE} places for 5 days (a loan needs none). The AI clubs work to the same limit.`,
  ] },
  // 1.1.1 (Rob, 16 Oct; docs/UPDATE1-1.1.1-BRIEF.md part 7).
  { title: "The transfer window", points: [
    "Players change clubs in the transfer window: the Off-Season, 7 to 31 December. It is on the calendar.",
    "You can buy at any time of year, but the player joins you when the window opens.",
  ] },
  { title: "Buying ahead", points: [
    "Buy a player under contract at another club whenever you like. Her club gets the fee the day the deal is agreed.",
    "She arrives when the window opens, or the day after her contract ends if that comes first. Until then her old club pays her; her wage (and perks) start with you the day she arrives.",
    "Your salary cap is checked for the day she arrives, so a contract ending before then makes room. The Player Market shows \"Joins [club] on [date]\" and the Team page's Transfers tab shows who is coming.",
    "The AI clubs buy ahead too, from each other and from you.",
  ] },
  { title: "No dumping", points: [
    "Outside the window you can't release or sell a senior. A contract that runs out still ends.",
    "Cover signed for a player on the injured list can go at any time once she is fit again.",
    "A player you have sold ahead can't be renewed: she is leaving.",
  ] },
  { title: "One chance to keep her", points: [
    `When an AI club bids for one of your players, you see its whole offer and have ${COUNTER_OFFER.answerDays} days to answer. Say nothing and she goes, and the fee is yours.`,
    "You get one counter-offer. She weighs both: wage over the contract, plus what her perks mean to her.",
    `If the two are within ${Math.round(COUNTER_OFFER.closeShare * 100)}% of each other her mood decides: a happy player at a winning club stays, an unhappy one at a losing club goes.`,
    `The AI clubs answer your bids the same way. They will pay her up to ${Math.round((AI_TRANSFER_TERMS.counterCeiling - 1) * 100)}% over what she is worth to keep her, if they can afford it and it fits their cap.`,
  ] },
  { title: "Perks", points: [
    `A senior contract can carry perks, paid monthly with her wage and counted toward the salary cap: ${PERKS.map((k) => `${k.label.toLowerCase()} ${money(k.monthly)}`).join(", ")}.`,
    "They show as \"Player perks\" in Finances. When she weighs two offers, the big perks (a personal trainer, a beach house) count for more than they cost.",
    "Contracts signed before 1.1.1 have none. Add them at renewal.",
  ] },
  { title: "Youth deals and scouts", points: [
    "Any AI club's academy youth can be asked for, on loan or to buy, at any time (the Clubs page). A loan of 6 or 12 months is always agreed while her age allows it.",
    "A sale is her club's choice, and your Scout does the talking. Without a Scout, your best coach does.",
    `A weak scout gets only a loan. With a scout of 50, 70 or 90, a club with few youths sells about ${[50, 70, 90].map((k) => `${Math.round(youthSaleChance(k, 3, false, false) * 100)}%`).join(", ")} of the time, and a club with many about ${[50, 70, 90].map((k) => `${Math.round(youthSaleChance(k, 5, false, false) * 100)}%`).join(", ")}. Half that if she plays in its youth team; more if it needs cash.`,
    `Its answer holds for ${YOUTH_DEALS.answerDays} days. A bought youth joins your academy (6 places), and her club is paid her youth price. The AI clubs buy each other's youths the same way.`,
  ] },
  { title: "The Clubs page", points: [
    "Every club in the game, yours included: badge, continent, tier, World Tour ladder and regional position, record, balance, wages against the cap and injuries.",
    "Sort by richest, poorest, most successful, most injury prone, continent or name.",
    "Open an AI club for its players (scout, watch or buy each senior on her market card; loan or buy each youth) and its staff and medical team.",
  ] },
  // 1.1.1, Part 11 (Rob, SB-1 to SB-5).
  { title: "Your main sponsor and the staff budget", points: [
    `Your main sponsor sets your staff budget: all your staff and medical wages together must stay under it. A new club's is about ${money(STAFF_BUDGET.firstSeason)} a month: enough for a good head coach, a good medic and two average staff, but not the two best-paid staff in the game together.`,
    "On Day 1 and at the start of every season you choose one of three main sponsor offers. Each has its own staff budget and its own bonus: money for every win, a share on top of your prize money, or a big payment for reaching the World Finals.",
    `The offers grow with your success and your money: a top-${STAFF_BUDGET.finishSteps[0].rankAtMost} World Tour finish and money in the bank make the next season's offers bigger, up to ${money(STAFF_BUDGET.max)} a month, enough for several top staff.`,
    "A hire that would take you over is refused, with the amount to free up. Staff you already have keep their jobs, but while you're over you can't hire or renew anyone. Finances and the Staff and Medical markets show the room left.",
    "The AI clubs choose a main sponsor too, and hire their staff within their budget.",
  ] },
  { title: "Manager specialities", points: [
    "Your manager's face comes with a speciality: Talent Recruiter, Negotiator, Contracts Expert, Sponsor Magnet, Leader, Coach, Youth Developer or Fitness Guru.",
    "The AI clubs' managers have them too; for an AI club, Coach, Youth Developer and Fitness Guru count.",
  ] },
];

// — Camera Controls —
const CAMERA_KEYS = [
  { key: "1", label: "Camera Angle 1" },
  { key: "2", label: "Camera Angle 2" },
  { key: "3", label: "Camera Angle 3" },
];

export default function Rules() {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
          <Trophy className="h-6 w-6 text-amber-400" />
          Rules &amp; Competition Guide
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          How beach volleyball works, how the competition is structured, and how to control the match camera.
        </p>
      </div>

      {/* Update 1 */}
      <Card data-testid="rules-update1">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            New in Update 1
          </CardTitle>
          <CardDescription>The draft, the salary cap, camps, difficulty and more</CardDescription>
        </CardHeader>
        <CardContent className="pt-0 grid gap-3 sm:grid-cols-2">
          {UPDATE1_RULES.map((r) => (
            <div key={r.title} className="rounded-xl border border-white/10 bg-black/20 p-3.5">
              <div className="text-sm font-bold text-white/90 mb-1">{r.title}</div>
              <ul className="space-y-1">
                {r.points.map((pt) => (
                  <li key={pt} className="text-xs text-white/60 leading-relaxed pl-3 relative before:content-['—'] before:absolute before:left-0 before:text-white/25">{pt}</li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Sport Rules */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Hand className="h-4 w-4 text-muted-foreground" />
            How Beach Volleyball Works
          </CardTitle>
          <CardDescription>The official rules of the sport</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-3 sm:grid-cols-2">
            {SPORT_RULES.map((rule) => (
              <div
                key={rule.title}
                className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-3.5"
              >
                <div className="h-8 w-8 shrink-0 rounded-lg bg-white/8 flex items-center justify-center">
                  <rule.icon className="h-4 w-4 text-white/70" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white/90">{rule.title}</div>
                  <div className="text-xs text-white/55 mt-1 leading-relaxed">{rule.text}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Competition Structure */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            How the Competition Works
          </CardTitle>
          <CardDescription>The path from regional league to Olympic gold</CardDescription>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {COMP_TIERS.map((tier, i) => (
            <div key={tier.title} className={`rounded-xl border p-4 ${tier.bg} ${tier.border}`}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-black ${tier.color}`}>
                    {i + 1}. {tier.title}
                  </span>
                </div>
                <Badge variant="outline" className={`text-[10px] font-bold ${tier.color} border-current/30`}>
                  {tier.badge}
                </Badge>
              </div>
              <ul className="space-y-1">
                {tier.points.map((p) => (
                  <li key={p} className="text-xs text-white/60 leading-relaxed pl-3 relative before:content-['—'] before:absolute before:left-0 before:text-white/25">
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Camera Controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Camera className="h-4 w-4 text-muted-foreground" />
            Match Camera Controls
          </CardTitle>
          <CardDescription>Switch between camera angles during a live match</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-3">
            {CAMERA_KEYS.map((c) => (
              <div
                key={c.key}
                className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/20 px-3.5 py-2.5"
              >
                <div className="h-8 w-8 rounded-lg border border-white/20 bg-white/5 flex items-center justify-center font-black text-sm text-white/80">
                  {c.key}
                </div>
                <span className="text-xs font-semibold text-white/70">{c.label}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5 mt-3 text-[11px] text-white/40">
            <Keyboard className="h-3 w-3" />
            Press 1, 2, or 3 during a live match to cycle between camera angles
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
