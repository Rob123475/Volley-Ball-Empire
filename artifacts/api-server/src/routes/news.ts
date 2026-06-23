import { Router } from "express";
import { db } from "@workspace/db";
import { teamsTable, playersTable, staffTable, trophiesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

// ── Static world pools ──────────────────────────────────────────────────────

const NATIONS: { name: string; flag: string }[] = [
  { name: "Brazil",       flag: "🇧🇷" },
  { name: "Japan",        flag: "🇯🇵" },
  { name: "Australia",    flag: "🇦🇺" },
  { name: "USA",          flag: "🇺🇸" },
  { name: "Germany",      flag: "🇩🇪" },
  { name: "France",       flag: "🇫🇷" },
  { name: "Italy",        flag: "🇮🇹" },
  { name: "Spain",        flag: "🇪🇸" },
  { name: "Netherlands",  flag: "🇳🇱" },
  { name: "Cuba",         flag: "🇨🇺" },
  { name: "China",        flag: "🇨🇳" },
  { name: "South Korea",  flag: "🇰🇷" },
  { name: "Argentina",    flag: "🇦🇷" },
  { name: "Canada",       flag: "🇨🇦" },
  { name: "Poland",       flag: "🇵🇱" },
  { name: "Turkey",       flag: "🇹🇷" },
  { name: "Norway",       flag: "🇳🇴" },
  { name: "Kenya",        flag: "🇰🇪" },
  { name: "Switzerland",  flag: "🇨🇭" },
  { name: "New Zealand",  flag: "🇳🇿" },
];

const TOURNAMENTS = [
  "Rio Masters", "Tokyo Beach Slam", "Sydney Open", "Huntington Beach Pro",
  "Berlin Masters", "Paris Beach Grand Prix", "Rome Open", "Barcelona Showcase",
  "Shanghai Open", "Seoul Pro Challenge", "Buenos Aires Classic", "Canadian Open",
  "Warsaw Grand Slam", "Istanbul Open", "Lausanne Elite", "Nairobi Challenge",
  "Auckland Pro", "Vienna Masters", "Doha Open", "Durban Beach Classic",
];

const FIRST_NAMES = [
  "Ana", "Maria", "Yuki", "Chloe", "Ingrid", "Agata", "Sofia", "Isabelle",
  "Priya", "Amara", "Mei", "Nina", "Camila", "Valeria", "Erika", "Linh",
  "Keiko", "Adriana", "Fernanda", "Petra", "Katja", "Alinta", "Tala", "Nia",
  "Luciana", "Mia", "Elena", "Zara", "Hana", "Sara",
];

const LAST_NAMES = [
  "Silva", "Tanaka", "Johnson", "Müller", "Dupont", "Rossi", "García",
  "de Vries", "Ivanova", "Zhang", "Park", "Santos", "Trudeau", "Kowalski",
  "Yilmaz", "Novak", "Kimani", "Cooper", "Ferreira", "Kim", "Romano",
  "Lindqvist", "Walsh", "Osei", "Nakamura", "Fischer", "López", "Nguyen",
];

const POSITIONS_LABEL: Record<string, string> = {
  setter: "setter", spiker: "spiker", defender: "defender",
  blocker: "blocker", server: "server", all_rounder: "all-rounder",
};

const STAFF_ROLES = [
  "head coach", "assistant coach", "sports scientist",
  "strength & conditioning trainer", "nutritionist", "mental performance coach",
];

const INJURY_TYPES = [
  "knee ligament strain", "shoulder inflammation", "ankle sprain",
  "lower back injury", "hamstring strain", "wrist tendinitis",
];

const FACILITY_TYPES = [
  "training centre", "medical facility", "performance gym",
  "sports science lab", "youth academy", "recovery suite",
];

// ── Seeded PRNG (mulberry32) ─────────────────────────────────────────────────

function seedFrom(n: number) {
  let t = n >>> 0;
  return () => {
    t |= 0; t = t + 0x6D2B79F5 | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = r + Math.imul(r ^ (r >>> 7), 61 | r) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function pickTwo<T>(arr: T[], rng: () => number): [T, T] {
  const a = pick(arr, rng);
  let b = pick(arr, rng);
  while (b === a) b = pick(arr, rng);
  return [a, b];
}

function randomName(rng: () => number) {
  return `${pick(FIRST_NAMES, rng)} ${pick(LAST_NAMES, rng)}`;
}

function daysAgo(n: number, rng: () => number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(Math.floor(rng() * 20) + 4);
  d.setMinutes(Math.floor(rng() * 60));
  return d.toISOString();
}

// ── News generators ──────────────────────────────────────────────────────────

type NewsItem = {
  id: string;
  type: string;
  headline: string;
  detail: string;
  nation: string;
  flag: string;
  publishedAt: string;
  isUserTeam: boolean;
};

function generateWorldNews(seed: number): NewsItem[] {
  const rng = seedFrom(seed);
  const items: NewsItem[] = [];

  const usedNations = new Set<string>();
  const freshNation = () => {
    for (let i = 0; i < 10; i++) {
      const n = pick(NATIONS, rng);
      if (!usedNations.has(n.name)) { usedNations.add(n.name); return n; }
    }
    return pick(NATIONS, rng);
  };

  // ── Tournament results (3 items)
  for (let i = 0; i < 3; i++) {
    const nation = freshNation();
    const tournament = pick(TOURNAMENTS, rng);
    const player = randomName(rng);
    items.push({
      id: `t_${seed}_${i}`,
      type: "tournament",
      headline: `${nation.name} wins ${tournament}`,
      detail: `${player} led ${nation.name} to victory in a dominant performance at the ${tournament}, claiming the title with back-to-back set wins.`,
      nation: nation.name, flag: nation.flag,
      publishedAt: daysAgo(i, rng),
      isUserTeam: false,
    });
  }

  // ── Player transfers (2 items)
  for (let i = 0; i < 2; i++) {
    const [from, to] = pickTwo(NATIONS, rng);
    const player = randomName(rng);
    const pos = pick(Object.keys(POSITIONS_LABEL), rng);
    items.push({
      id: `tr_${seed}_${i}`,
      type: "transfer",
      headline: `${to.name} signs ${from.name} ${POSITIONS_LABEL[pos]}`,
      detail: `${player} has agreed a two-season contract with the ${to.name} national programme after an impressive run on the World Tour.`,
      nation: to.name, flag: to.flag,
      publishedAt: daysAgo(i + 1, rng),
      isUserTeam: false,
    });
  }

  // ── Staff signings (1 item)
  {
    const nation = freshNation();
    const coach = randomName(rng);
    const role = pick(STAFF_ROLES, rng);
    items.push({
      id: `s_${seed}`,
      type: "staff_signing",
      headline: `${nation.name} appoints new ${role}`,
      detail: `${coach} joins the ${nation.name} setup as ${role}, bringing experience from three previous World Tour programmes.`,
      nation: nation.name, flag: nation.flag,
      publishedAt: daysAgo(2, rng),
      isUserTeam: false,
    });
  }

  // ── Youth discovery (2 items)
  for (let i = 0; i < 2; i++) {
    const nation = freshNation();
    const player = randomName(rng);
    const pos = pick(Object.keys(POSITIONS_LABEL), rng);
    const age = 15 + Math.floor(rng() * 4);
    const adj = pick(["elite", "prodigious", "exceptional", "outstanding", "rare"], rng);
    items.push({
      id: `y_${seed}_${i}`,
      type: "youth",
      headline: `${nation.name} discovers ${adj} youth ${POSITIONS_LABEL[pos]}`,
      detail: `${player}, aged ${age}, has been fast-tracked into the ${nation.name} junior programme after scouts described her potential as ${adj}.`,
      nation: nation.name, flag: nation.flag,
      publishedAt: daysAgo(i + 2, rng),
      isUserTeam: false,
    });
  }

  // ── Injury (1 item)
  {
    const nation = freshNation();
    const player = randomName(rng);
    const injury = pick(INJURY_TYPES, rng);
    const weeks = 2 + Math.floor(rng() * 8);
    items.push({
      id: `inj_${seed}`,
      type: "injury",
      headline: `${nation.name} star out ${weeks} weeks with ${injury}`,
      detail: `${player} will miss the next ${weeks} weeks after sustaining a ${injury} during training. ${nation.name} are monitoring her recovery ahead of the next World Tour leg.`,
      nation: nation.name, flag: nation.flag,
      publishedAt: daysAgo(3, rng),
      isUserTeam: false,
    });
  }

  // ── Olympic qualification (1 item)
  {
    const nation = freshNation();
    const quota = 1 + Math.floor(rng() * 2);
    items.push({
      id: `oly_${seed}`,
      type: "olympic",
      headline: `${nation.name} secures Olympic quota place`,
      detail: `${nation.name} confirmed ${quota === 1 ? "a" : "two"} Olympic quota place${quota > 1 ? "s" : ""} following a strong continental qualifying campaign, locking in beach volleyball representation at the next Games.`,
      nation: nation.name, flag: nation.flag,
      publishedAt: daysAgo(4, rng),
      isUserTeam: false,
    });
  }

  // ── Facility upgrade (1 item)
  {
    const nation = freshNation();
    const facility = pick(FACILITY_TYPES, rng);
    items.push({
      id: `fac_${seed}`,
      type: "facility",
      headline: `${nation.name} upgrades national ${facility}`,
      detail: `${nation.name} volleyball federation has completed a major investment in their ${facility}, expected to benefit both senior and youth pathways into the World Tour.`,
      nation: nation.name, flag: nation.flag,
      publishedAt: daysAgo(5, rng),
      isUserTeam: false,
    });
  }

  // ── Record breaker (1 item)
  {
    const nation = freshNation();
    const player = randomName(rng);
    const record = pick([
      "most career wins in a single World Tour season",
      "youngest player to win a major international title",
      "longest winning streak on the women's World Tour",
      "most consecutive final appearances on the circuit",
    ], rng);
    items.push({
      id: `rec_${seed}`,
      type: "record",
      headline: `${player} breaks record for ${record}`,
      detail: `The ${nation.name} star set a new benchmark for ${record}, cementing her place among the all-time greats of women's beach volleyball.`,
      nation: nation.name, flag: nation.flag,
      publishedAt: daysAgo(6, rng),
      isUserTeam: false,
    });
  }

  return items;
}

// ── Route ────────────────────────────────────────────────────────────────────

router.get("/news/world-tour", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = req.user.id;

  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.userId, userId));

  const userItems: NewsItem[] = [];

  if (team) {
    // Real event: recent trophies won by user's team
    const recentTrophies = await db
      .select()
      .from(trophiesTable)
      .where(eq(trophiesTable.teamId, team.id))
      .orderBy(desc(trophiesTable.createdAt))
      .limit(3);

    for (const trophy of recentTrophies) {
      const typeMap: Record<string, string> = {
        world_championship: "tournament", continental_championship: "tournament",
        grand_final: "tournament", olympic_gold: "olympic", olympic_silver: "olympic",
        olympic_bronze: "olympic",
      };
      const headlineMap: Record<string, string> = {
        world_championship: `${team.name} wins World Championship!`,
        continental_championship: `${team.name} claims Continental Championship!`,
        grand_final: `${team.name} wins Grand Final!`,
        olympic_gold: `${team.name} wins Olympic Gold! 🥇`,
        olympic_silver: `${team.name} wins Olympic Silver! 🥈`,
        olympic_bronze: `${team.name} wins Olympic Bronze! 🥉`,
      };
      const detailMap: Record<string, string> = {
        world_championship: `Your team delivered a world-class performance to claim the ${trophy.name}, etching their name into beach volleyball history.`,
        continental_championship: `${team.name} triumphed at the ${trophy.name}, winning the continental title in a thrilling final.`,
        grand_final: `A dominant run through the bracket saw ${team.name} lift the trophy at the ${trophy.name}.`,
        olympic_gold: `${team.name} delivered a flawless Olympic performance, claiming the gold medal on the sport's biggest stage.`,
        olympic_silver: `${team.name} finished as Olympic runners-up, bringing home the silver medal in a closely-fought final.`,
        olympic_bronze: `${team.name} secured the Olympic bronze medal, completing a memorable campaign at the Games.`,
      };
      userItems.push({
        id: `user_trophy_${trophy.id}`,
        type: typeMap[trophy.type] ?? "tournament",
        headline: headlineMap[trophy.type] ?? `${team.name} wins ${trophy.name}!`,
        detail: detailMap[trophy.type] ?? `${team.name} claimed the ${trophy.name}.`,
        nation: team.name, flag: "🏐",
        publishedAt: trophy.createdAt.toISOString(),
        isUserTeam: true,
      });
    }

    // Real event: recent player signings
    const recentPlayers = await db
      .select()
      .from(playersTable)
      .where(eq(playersTable.teamId, team.id))
      .orderBy(desc(playersTable.createdAt))
      .limit(2);

    for (const player of recentPlayers) {
      const pos = POSITIONS_LABEL[player.position] ?? player.position;
      userItems.push({
        id: `user_signing_${player.id}`,
        type: "transfer",
        headline: `${team.name} sign ${player.position === "all_rounder" ? "versatile all-rounder" : pos} ${player.name}`,
        detail: `${player.name} has joined ${team.name} from ${player.nationality ?? "the international circuit"}, adding ${pos} depth to the squad.`,
        nation: team.name, flag: "🏐",
        publishedAt: player.createdAt.toISOString(),
        isUserTeam: true,
      });
    }

    // Real event: recent staff signings
    const recentStaff = await db
      .select()
      .from(staffTable)
      .where(eq(staffTable.teamId, team.id))
      .orderBy(desc(staffTable.createdAt))
      .limit(1);

    for (const staff of recentStaff) {
      userItems.push({
        id: `user_staff_${staff.id}`,
        type: "staff_signing",
        headline: `${team.name} appoint ${staff.name} as ${staff.role.replace(/_/g, " ")}`,
        detail: `${staff.name} joins the ${team.name} backroom team as ${staff.role.replace(/_/g, " ")}, bringing their expertise to the programme.`,
        nation: team.name, flag: "🏐",
        publishedAt: staff.createdAt.toISOString(),
        isUserTeam: true,
      });
    }
  }

  // Seed world news by day so stories feel stable within a session
  const today = new Date();
  const daySeed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  const worldItems = generateWorldNews(daySeed);

  // Merge: user items first, then world items — sort combined by date desc, cap at 12
  const all = [...userItems, ...worldItems]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 12);

  res.json({ items: all });
});

export default router;
