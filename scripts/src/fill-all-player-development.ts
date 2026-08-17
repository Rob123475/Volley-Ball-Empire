/**
 * Populates / completes the `development` JSONB for:
 *   - 60 on-team senior players (partial → full)
 *   - 72 regional draft senior players (null → full)
 *   - 72 youth players (null → full)
 * Run: pnpm --filter @workspace/scripts run fill-all-player-development
 */
import { db, sqlite } from "@workspace/db";
import { playersTable } from "@workspace/db/schema";
import { isNull, or, like, notLike, eq } from "drizzle-orm";

// ── helpers ───────────────────────────────────────────────────────────────────

function clamp(v: number, min = 40, max = 99) {
  return Math.max(min, Math.min(max, Math.round(v)));
}
function jitter(base: number, range = 4): number {
  return clamp(base + Math.floor(Math.random() * range * 2) - range);
}

type Position = "spiker" | "defender" | "setter" | "blocker" | "all_rounder" | string;
type Potential = "Elite" | "High" | "Average" | "Below Average" | "Poor" | string;

function starRating(potential: Potential): number {
  return { Elite: 5, High: 4, Average: 3, "Below Average": 2, Poor: 1 }[potential] ?? 3;
}
function contractYears(age: number): number {
  return age <= 21 ? 3 : age <= 25 ? 2 : 1;
}
function marketValue(salary: number, potential: Potential, age: number): number {
  const mult = { Elite: 14, High: 11, Average: 8, "Below Average": 6, Poor: 4 }[potential] ?? 8;
  const af = age <= 22 ? 1.2 : age <= 26 ? 1.0 : 0.85;
  return Math.round((salary * mult * af) / 1000) * 1000;
}
function overallRating(speed: number, power: number, defense: number, serve: number, block: number, stamina: number) {
  return Math.round((speed + power + defense + serve + block + stamina) / 6);
}
function weightKg(heightCm: number, pos: Position): number {
  const base = (heightCm - 100) * 0.45 + 55;
  return Math.round(base + (["blocker", "spiker"].includes(pos) ? 3 : 0));
}

const FLAG_MAP: Record<string, { code: string; flag: string }> = {
  "Algeria": { code: "DZ", flag: "🇩🇿" }, "Angola": { code: "AO", flag: "🇦🇴" },
  "Cameroon": { code: "CM", flag: "🇨🇲" }, "Egypt": { code: "EG", flag: "🇪🇬" },
  "Ethiopia": { code: "ET", flag: "🇪🇹" }, "Ghana": { code: "GH", flag: "🇬🇭" },
  "Kenya": { code: "KE", flag: "🇰🇪" }, "Morocco": { code: "MA", flag: "🇲🇦" },
  "Nigeria": { code: "NG", flag: "🇳🇬" }, "Senegal": { code: "SN", flag: "🇸🇳" },
  "South Africa": { code: "ZA", flag: "🇿🇦" }, "Tanzania": { code: "TZ", flag: "🇹🇿" },
  "Tunisia": { code: "TN", flag: "🇹🇳" }, "Uganda": { code: "UG", flag: "🇺🇬" },
  "China": { code: "CN", flag: "🇨🇳" }, "Japan": { code: "JP", flag: "🇯🇵" },
  "South Korea": { code: "KR", flag: "🇰🇷" }, "Thailand": { code: "TH", flag: "🇹🇭" },
  "Vietnam": { code: "VN", flag: "🇻🇳" }, "Philippines": { code: "PH", flag: "🇵🇭" },
  "Indonesia": { code: "ID", flag: "🇮🇩" }, "Malaysia": { code: "MY", flag: "🇲🇾" },
  "India": { code: "IN", flag: "🇮🇳" }, "Kazakhstan": { code: "KZ", flag: "🇰🇿" },
  "Turkey": { code: "TR", flag: "🇹🇷" }, "Iran": { code: "IR", flag: "🇮🇷" },
  "France": { code: "FR", flag: "🇫🇷" }, "Germany": { code: "DE", flag: "🇩🇪" },
  "Italy": { code: "IT", flag: "🇮🇹" }, "Spain": { code: "ES", flag: "🇪🇸" },
  "Netherlands": { code: "NL", flag: "🇳🇱" }, "Poland": { code: "PL", flag: "🇵🇱" },
  "Russia": { code: "RU", flag: "🇷🇺" }, "Sweden": { code: "SE", flag: "🇸🇪" },
  "Norway": { code: "NO", flag: "🇳🇴" }, "Switzerland": { code: "CH", flag: "🇨🇭" },
  "Czech Republic": { code: "CZ", flag: "🇨🇿" }, "Austria": { code: "AT", flag: "🇦🇹" },
  "United States": { code: "US", flag: "🇺🇸" }, "Canada": { code: "CA", flag: "🇨🇦" },
  "Mexico": { code: "MX", flag: "🇲🇽" }, "Cuba": { code: "CU", flag: "🇨🇺" },
  "Brazil": { code: "BR", flag: "🇧🇷" }, "Argentina": { code: "AR", flag: "🇦🇷" },
  "Chile": { code: "CL", flag: "🇨🇱" }, "Colombia": { code: "CO", flag: "🇨🇴" },
  "Peru": { code: "PE", flag: "🇵🇪" }, "Venezuela": { code: "VE", flag: "🇻🇪" },
  "Australia": { code: "AU", flag: "🇦🇺" }, "New Zealand": { code: "NZ", flag: "🇳🇿" },
  "Fiji": { code: "FJ", flag: "🇫🇯" }, "Samoa": { code: "WS", flag: "🇼🇸" },
  "Tonga": { code: "TO", flag: "🇹🇴" }, "Papua New Guinea": { code: "PG", flag: "🇵🇬" },
  "England": { code: "GB", flag: "🇬🇧" }, "Greece": { code: "GR", flag: "🇬🇷" },
  "Portugal": { code: "PT", flag: "🇵🇹" }, "Jamaica": { code: "JM", flag: "🇯🇲" },
  "Maldives": { code: "MV", flag: "🇲🇻" }, "Costa Rica": { code: "CR", flag: "🇨🇷" },
  "Bolivia": { code: "BO", flag: "🇧🇴" }, "Tahiti": { code: "PF", flag: "🇵🇫" },
  // New-batch nations
  "Ecuador":        { code: "EC", flag: "🇪🇨" },
  "Ireland":        { code: "IE", flag: "🇮🇪" },
  "Laos":           { code: "LA", flag: "🇱🇦" },
  "Madagascar":     { code: "MG", flag: "🇲🇬" },
  "Mozambique":     { code: "MZ", flag: "🇲🇿" },
  "Malta":          { code: "MT", flag: "🇲🇹" },
  "Monaco":         { code: "MC", flag: "🇲🇨" },
  "Cook Islands":   { code: "CK", flag: "🇨🇰" },
  "Solomon Islands":{ code: "SB", flag: "🇸🇧" },
  "Taiwan":         { code: "TW", flag: "🇹🇼" },
  "Bahamas":        { code: "BS", flag: "🇧🇸" },
  "Panama":         { code: "PA", flag: "🇵🇦" },
  "Uruguay":        { code: "UY", flag: "🇺🇾" },
};

const PERSONALITIES = ["Determined", "Competitive", "Team Player", "Leader", "Disciplined",
  "Calm Under Pressure", "Ambitious", "Creative", "Resilient", "Passionate"];
const SPECIALITIES: Record<string, string[]> = {
  spiker:     ["Power Spiker", "Jump Serve", "Cross-Court Attack", "Sharp Angle", "Back Row Attack"],
  defender:   ["Pancake Dig", "Dive & Recover", "Aerial Defense", "Read & React", "Serve Receive Specialist"],
  setter:     ["Quick Set", "Back Set", "Jump Set", "Dump Shot", "Court Vision"],
  blocker:    ["Roof Block", "Soft Block", "Double Block", "Cross-Body Block", "Tactical Footwork"],
  all_rounder:["Serve Pressure", "Transition Play", "Clutch Performance", "All-Court Awareness", "Versatile Attack"],
  universal:  ["Serve Pressure", "Transition Play", "All-Court Awareness", "Versatile Attack", "Clutch Performance"],
};

function buildDevelopment(player: {
  name: string; nationality: string; age: number; height: number;
  position: string; potential: string; salary: number; speed: number;
  power: number; defense: number; serve: number; block: number; stamina: number;
  playerType: string; existingDev?: Record<string, unknown> | null;
}, regenerationSeed: string) {
  const pos = player.position;
  const pot = player.potential as Potential;
  const age = player.age;
  const ht = Number(player.height);
  const sal = Number(player.salary);
  const flag = FLAG_MAP[player.nationality] ?? { code: "??", flag: "🏐" };
  const overall = overallRating(player.speed, player.power, player.defense, player.serve, player.block, player.stamina);
  const pool = SPECIALITIES[pos] ?? SPECIALITIES["all_rounder"];
  const shuffled = [...pool].sort(() => Math.random() - 0.5);

  // Mental attributes by position
  const exp = Math.min(age - 16, 12);
  const base = 58 + exp * 1.5;
  const isElite = pot === "Elite";
  const mental = {
    volleyballIQ:    jitter(base + (pos === "setter" ? 10 : pos === "all_rounder" ? 8 : 5)),
    decisionMaking:  jitter(base + (pos === "setter" ? 8 : 4)),
    anticipation:    jitter(base + (pos === "defender" ? 10 : 6)),
    positioning:     jitter(base + (["defender", "setter"].includes(pos) ? 10 : 6)),
    composure:       jitter(base + (age > 25 ? 6 : 3)),
    clutch:          jitter(isElite ? base + 8 : base + 2),
  };

  // Extended physical
  const physical = {
    agility:  jitter(player.speed + (pos === "defender" ? 2 : -2)),
    jump:     jitter(pos === "blocker" ? player.block : pos === "spiker" ? player.power - 2 : 65),
    recovery: jitter(player.stamina),
  };

  // Volleyball skills beyond core stats
  const vSkills = {
    reception: jitter(pos === "defender" ? player.defense + 2 : pos === "setter" ? 70 : 60),
    setting:   jitter(pos === "setter" ? player.serve + 4 : 55),
    attack:    jitter(pos === "spiker" ? player.power + 2 : pos === "blocker" ? player.power : 58),
    digging:   jitter(pos === "defender" ? player.defense + 3 : 60),
  };

  const hidden = {
    injuryProneness:       jitter(30 + Math.min(age - 16, 10), 5),
    bigMatchTemperament:   jitter(isElite ? 82 : pot === "High" ? 72 : 62, 6),
    loyalty:               jitter(60 + Math.min(age - 16, 10) * 2, 8),
    ambition:              jitter(isElite ? 84 : pot === "High" ? 74 : 62, 6),
    coachability:          jitter(age < 24 ? 78 : 68, 5),
    professionalismHidden: jitter(65 + Math.min(age - 16, 8), 5),
    mediaFriendliness:     jitter(62, 8),
    trainingIntensity:     jitter(isElite ? 80 : 68, 5),
    retirementAge:         30 + Math.floor(Math.random() * 8),
    growthCurve:           isElite ? jitter(80, 5) : pot === "High" ? jitter(70, 5) : jitter(55, 5),
  };

  const isYouth = player.playerType === "youth";
  const personality = PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];

  return {
    regenerationSeed,
    generationVersion: "1.0",
    gender: "Female",
    countryCode: flag.code,
    flag: flag.flag,
    weightKg: weightKg(ht, pos),
    preferredHand: "Right",
    overallRating: overall,
    starRating: starRating(pot),
    contractYears: isYouth ? 0 : contractYears(age),
    marketValue: isYouth ? 0 : marketValue(sal, pot, age),
    personality,
    leadership:      jitter(pos === "setter" || isElite ? 72 : 60, 6),
    professionalism: jitter(65 + (age > 25 ? 5 : 0), 5),
    workEthic:       player.existingDev?.workEthic as number ?? jitter(isElite ? 76 : 68, 5),
    consistency:     player.existingDev?.consistency as number ?? jitter(60 + (age > 24 ? 8 : 0), 6),
    coachability:    player.existingDev?.coachability as number ?? hidden.coachability,
    injuryProneness: player.existingDev?.injuryProneness as number ?? hidden.injuryProneness,
    // extended physical
    ...physical,
    // volleyball skills
    ...vSkills,
    // mental
    ...mental,
    // specialities
    speciality1: shuffled[0],
    speciality2: shuffled[1],
    speciality3: shuffled[2],
    // hidden
    hiddenAttributes: hidden,
    // form
    confidence: 50,
    form: 50,
    chemistry: 50,
    // career stats — youth and draft have zeros; on-team have modest history
    careerMatches: isYouth ? 0 : 0,
    careerWins: 0, careerLosses: 0, careerWinPercentage: 0,
    careerAces: 0, careerServiceErrors: 0, careerKills: 0, careerAttackErrors: 0,
    careerBlocks: 0, careerDigs: 0, careerReceives: 0, careerAssists: 0,
    careerMVPs: 0, careerPlayerOfTheTournament: 0,
    careerPrizeMoney: 0, careerFans: 0, careerSocialFollowers: 0,
    currentSeasonMatches: 0, currentSeasonWins: 0, currentSeasonLosses: 0,
    currentSeasonAces: 0, currentSeasonKills: 0, currentSeasonBlocks: 0, currentSeasonDigs: 0,
    worldRanking: 0, continentalRanking: 0,
    bio: `${player.name} is a ${age}-year-old ${pos.replace("_", " ")} from ${player.nationality} with ${pot.toLowerCase()} potential.`,
  };
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  // ── 1. On-team seniors (60) — expand partial development JSON ─────────────
  console.log("=== On-team seniors (60) ===");
  const onTeam = await db
    .select()
    .from(playersTable)
    .where(like(playersTable.imageUrl, "%/players/s-%"));

  let count = 0;
  for (const p of onTeam) {
    const dev = buildDevelopment(
      { ...p, existingDev: p.development as Record<string, unknown> | null },
      "BVM_SENIOR_SQUAD_V1_2026_07_07",
    );
    await db.update(playersTable).set({ development: dev as any }).where(eq(playersTable.id, p.id));
    count++;
  }
  console.log(`  ✓ Updated ${count} on-team senior players.\n`);

  // ── 2. Regional draft seniors (72) — generate from scratch ────────────────
  console.log("=== Regional draft seniors (72) ===");
  const regionalDraft = await db
    .select()
    .from(playersTable)
    .where(like(playersTable.imageUrl, "%/objects/player-cards/%"))

  // filter out new-draft (already done)
  const regional = regionalDraft.filter(
    (p) => p.imageUrl && !p.imageUrl.includes("new-draft"),
  );

  count = 0;
  for (const p of regional) {
    const dev = buildDevelopment(
      { ...p, existingDev: null },
      "BVM_SENIOR_DRAFT_REGIONAL_V1_2026_07_07",
    );
    await db.update(playersTable).set({ development: dev as any }).where(eq(playersTable.id, p.id));
    count++;
  }
  console.log(`  ✓ Updated ${count} regional draft players.\n`);

  // ── 3. Youth players (72) ─────────────────────────────────────────────────
  console.log("=== Youth players (72) ===");
  const youth = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.playerType, "youth"));

  count = 0;
  for (const p of youth) {
    const dev = buildDevelopment(
      { ...p, existingDev: null },
      "BVM_YOUTH_SQUAD_V1_2026_07_07",
    );
    await db.update(playersTable).set({ development: dev as any }).where(eq(playersTable.id, p.id));
    count++;
  }
  console.log(`  ✓ Updated ${count} youth players.\n`);

  // ── final verification ────────────────────────────────────────────────────
  const verify = sqlite.prepare(`
    SELECT
      CASE
        WHEN image_url LIKE '%new-draft%' THEN 'new-draft (40)'
        WHEN image_url LIKE '%/objects/player-cards/%' THEN 'regional-draft (72)'
        WHEN image_url LIKE '%/players/s-%' THEN 'on-team (60)'
        ELSE 'youth (72)'
      END as pool,
      COUNT(*) as total,
      COUNT(CASE WHEN development->>'regenerationSeed' IS NOT NULL THEN 1 END) as has_seed
    FROM players
    WHERE is_retired = false
    GROUP BY 1
    ORDER BY 1
  `).all() as any[];

  console.log("=== Final verification ===");
  for (const row of verify) {
    const status = row.has_seed === row.total ? "✅" : "⚠️";
    console.log(`  ${status} ${row.pool}: ${row.has_seed}/${row.total} have regenerationSeed`);
  }

  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
