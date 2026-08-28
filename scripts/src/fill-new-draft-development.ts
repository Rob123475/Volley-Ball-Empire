/**
 * Fills the `development` JSONB field for all 40 new draft players (player-cards/new-draft).
 * Derives extended attributes from each player's position, age, height, core stats and potential.
 * Run: pnpm --filter @workspace/scripts run fill-new-draft-development
 */

import { db } from "@workspace/db";
import { playersTable } from "@workspace/db/schema";
import { eq, like } from "drizzle-orm";

type Position = "spiker" | "defender" | "setter" | "blocker" | "all_rounder";
type Potential = "Elite" | "High" | "Average" | "Below Average";

// ── helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number, min = 40, max = 99) {
  return Math.max(min, Math.min(max, Math.round(v)));
}

function jitter(base: number, range = 4): number {
  return clamp(base + Math.floor(Math.random() * range * 2) - range);
}

function weightKg(heightCm: number, position: Position): number {
  const base = (heightCm - 100) * 0.45 + 55;
  const heavy = ["blocker", "spiker"].includes(position) ? 3 : 0;
  return Math.round(base + heavy);
}

function starRating(potential: Potential): number {
  return { Elite: 5, High: 4, Average: 3, "Below Average": 2 }[potential];
}

function contractYears(age: number): number {
  if (age <= 21) return 3;
  if (age <= 25) return 2;
  return 1;
}

function marketValue(salary: number, potential: Potential, age: number): number {
  const mult = { Elite: 14, High: 11, Average: 8, "Below Average": 6 }[potential];
  const ageFactor = age <= 22 ? 1.2 : age <= 26 ? 1.0 : 0.85;
  return Math.round(salary * mult * ageFactor / 1000) * 1000;
}

function overallRating(speed: number, power: number, defense: number, serve: number, block: number, stamina: number): number {
  return Math.round((speed + power + defense + serve + block + stamina) / 6);
}

// Position-derived volleyball skill ratings
function volleyballSkills(pos: Position, speed: number, power: number, defense: number, serve: number, block: number, stamina: number) {
  switch (pos) {
    case "spiker":   return { reception: jitter(62), setting: jitter(52), attack: jitter(power + 2), digging: jitter(58), agility: jitter(speed - 2), jump: jitter(power - 2), recovery: jitter(stamina) };
    case "defender": return { reception: jitter(defense + 2), setting: jitter(63), attack: jitter(54), digging: jitter(defense + 3), agility: jitter(speed + 2), jump: jitter(58), recovery: jitter(stamina + 2) };
    case "setter":   return { reception: jitter(70), setting: jitter(serve + 4), attack: jitter(54), digging: jitter(64), agility: jitter(speed), jump: jitter(62), recovery: jitter(stamina) };
    case "blocker":  return { reception: jitter(56), setting: jitter(52), attack: jitter(power), digging: jitter(54), agility: jitter(speed - 3), jump: jitter(block + 2), recovery: jitter(stamina - 2) };
    case "all_rounder": return { reception: jitter(68), setting: jitter(66), attack: jitter(power - 2), digging: jitter(defense - 2), agility: jitter(speed), jump: jitter(70), recovery: jitter(stamina) };
  }
}

function mentalAttributes(pos: Position, age: number, potential: Potential) {
  const exp = Math.min(age - 17, 12);
  const base = 60 + exp * 1.5;
  const isElite = potential === "Elite";
  switch (pos) {
    case "setter":     return { volleyballIQ: jitter(base + 10), decisionMaking: jitter(base + 8), anticipation: jitter(base + 6), positioning: jitter(base + 8), composure: jitter(base + 4), clutch: jitter(isElite ? base + 6 : base) };
    case "defender":   return { volleyballIQ: jitter(base + 6), decisionMaking: jitter(base + 4), anticipation: jitter(base + 10), positioning: jitter(base + 10), composure: jitter(base + 3), clutch: jitter(base) };
    case "spiker":     return { volleyballIQ: jitter(base + 4), decisionMaking: jitter(base + 4), anticipation: jitter(base + 3), positioning: jitter(base + 6), composure: jitter(base + 5), clutch: jitter(isElite ? base + 8 : base + 2) };
    case "blocker":    return { volleyballIQ: jitter(base + 5), decisionMaking: jitter(base + 3), anticipation: jitter(base + 8), positioning: jitter(base + 8), composure: jitter(base + 4), clutch: jitter(base + 2) };
    case "all_rounder":return { volleyballIQ: jitter(base + 8), decisionMaking: jitter(base + 6), anticipation: jitter(base + 6), positioning: jitter(base + 6), composure: jitter(base + 6), clutch: jitter(base + 4) };
  }
}

const PERSONALITIES = ["Determined", "Competitive", "Team Player", "Leader", "Disciplined", "Calm Under Pressure", "Ambitious", "Creative", "Resilient", "Passionate"];

function pickPersonality(pos: Position, potential: Potential): string {
  if (potential === "Elite") return ["Leader", "Determined", "Ambitious"][Math.floor(Math.random() * 3)];
  if (pos === "setter") return ["Creative", "Team Player", "Leader"][Math.floor(Math.random() * 3)];
  if (pos === "defender") return ["Disciplined", "Resilient", "Determined"][Math.floor(Math.random() * 3)];
  if (pos === "blocker") return ["Determined", "Competitive", "Calm Under Pressure"][Math.floor(Math.random() * 3)];
  return PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];
}

const SPECIALITIES: Record<Position, string[]> = {
  spiker:     ["Power Spiker", "Jump Serve", "Cross-Court Attack", "Sharp Angle", "Back Row Attack"],
  defender:   ["Pancake Dig", "Dive & Recover", "Aerial Defense", "Read & React", "Serve Receive Specialist"],
  setter:     ["Quick Set", "Back Set", "Jump Set", "Dump Shot", "Court Vision"],
  blocker:    ["Roof Block", "Soft Block", "Double Block", "Cross-Body Block", "Tactical Footwork"],
  all_rounder:["Serve Pressure", "Transition Play", "Clutch Performance", "All-Court Awareness", "Versatile Attack"],
};

function pickSpecialities(pos: Position): [string, string, string] {
  const pool = [...SPECIALITIES[pos]];
  const s1 = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
  const s2 = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
  const s3 = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
  return [s1, s2, s3];
}

function hiddenAttributes(age: number, potential: Potential) {
  const senior = Math.min(age - 17, 10);
  return {
    injuryProneness:       jitter(30 + senior, 5),
    bigMatchTemperament:   jitter(55 + (potential === "Elite" ? 15 : potential === "High" ? 8 : 0), 6),
    loyalty:               jitter(60 + senior * 2, 8),
    ambition:              jitter(potential === "Elite" ? 82 : potential === "High" ? 72 : 62, 6),
    coachability:          jitter(65 + (age < 24 ? 8 : 0), 5),
    professionalismHidden: jitter(65 + senior, 5),
    mediaFriendliness:     jitter(60, 8),
    trainingIntensity:     jitter(68 + (potential === "Elite" ? 10 : 0), 5),
    retirementAge:         30 + Math.floor(Math.random() * 8),
    growthCurve:           potential === "Elite" ? jitter(80, 5) : potential === "High" ? jitter(70, 5) : jitter(55, 5),
  };
}

function bio(name: string, nationality: string, pos: Position, age: number, potential: Potential): string {
  const posLabel = { spiker: "powerful spiker", defender: "tenacious defender", setter: "creative setter", blocker: "dominant blocker", all_rounder: "versatile all-rounder" }[pos];
  const potLabel = { Elite: "elite potential", High: "high potential", Average: "solid", "Below Average": "developing" }[potential];
  return `${name} is a ${age}-year-old ${posLabel} from ${nationality} with ${potLabel}. Known for her determination and technical ability on the sand, she is available for clubs seeking to strengthen their squad.`;
}

// Country code map (partial — covers our 40 players)
const FLAG_MAP: Record<string, { code: string; flag: string }> = {
  "United States":    { code: "US", flag: "🇺🇸" },
  "Australia":        { code: "AU", flag: "🇦🇺" },
  "Bolivia":          { code: "BO", flag: "🇧🇴" },
  "Brazil":           { code: "BR", flag: "🇧🇷" },
  "Canada":           { code: "CA", flag: "🇨🇦" },
  "China":            { code: "CN", flag: "🇨🇳" },
  "Costa Rica":       { code: "CR", flag: "🇨🇷" },
  "England":          { code: "GB", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  "Fiji":             { code: "FJ", flag: "🇫🇯" },
  "France":           { code: "FR", flag: "🇫🇷" },
  "Germany":          { code: "DE", flag: "🇩🇪" },
  "Greece":           { code: "GR", flag: "🇬🇷" },
  "Italy":            { code: "IT", flag: "🇮🇹" },
  "Jamaica":          { code: "JM", flag: "🇯🇲" },
  "Nigeria":          { code: "NG", flag: "🇳🇬" },
  "Malaysia":         { code: "MY", flag: "🇲🇾" },
  "Maldives":         { code: "MV", flag: "🇲🇻" },
  "New Zealand":      { code: "NZ", flag: "🇳🇿" },
  "Peru":             { code: "PE", flag: "🇵🇪" },
  "Papua New Guinea": { code: "PG", flag: "🇵🇬" },
  "Portugal":         { code: "PT", flag: "🇵🇹" },
  "Samoa":            { code: "WS", flag: "🇼🇸" },
  "South Africa":     { code: "ZA", flag: "🇿🇦" },
  "Sweden":           { code: "SE", flag: "🇸🇪" },
  "Tahiti":           { code: "PF", flag: "🇵🇫" },
  "Thailand":         { code: "TH", flag: "🇹🇭" },
  "Tonga":            { code: "TO", flag: "🇹🇴" },
};

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const rows = await db
    .select()
    .from(playersTable)
    .where(like(playersTable.imageUrl, "%player-cards/new-draft%"));

  console.log(`Found ${rows.length} new-draft players to update.\n`);

  for (const player of rows) {
    const pos = player.position as Position;
    const pot = player.potential as Potential;
    const age = player.age;
    const ht = Number(player.height);
    // salary moved to career state; askingPrice is the reference equivalent.
    const sal = Number(player.askingPrice ?? 0) / 12;

    const flag = FLAG_MAP[player.nationality] ?? { code: "??", flag: "🏐" };
    const overall = overallRating(player.speed, player.power, player.defense, player.serve, player.block, player.stamina);
    const vSkills = volleyballSkills(pos, player.speed, player.power, player.defense, player.serve, player.block, player.stamina);
    const mental = mentalAttributes(pos, age, pot);
    const hidden = hiddenAttributes(age, pot);
    const [s1, s2, s3] = pickSpecialities(pos);
    const personality = pickPersonality(pos, pot);

    const development = {
      generationVersion: "1.0",
      gender: "Female",
      countryCode: flag.code,
      flag: flag.flag,
      weightKg: weightKg(ht, pos),
      preferredHand: "Right",
      overallRating: overall,
      starRating: starRating(pot),
      contractYears: contractYears(age),
      marketValue: marketValue(sal, pot, age),
      personality,
      leadership:      jitter(pos === "setter" || pot === "Elite" ? 72 : 60, 6),
      professionalism: jitter(65 + (age > 25 ? 5 : 0), 5),
      workEthic:       jitter(68 + (pot === "Elite" ? 8 : 0), 5),
      consistency:     jitter(60 + (age > 24 ? 8 : 0), 6),
      // extended physical
      agility:  vSkills.agility,
      jump:     vSkills.jump,
      recovery: vSkills.recovery,
      // volleyball skills (supplement core DB stats)
      reception: vSkills.reception,
      setting:   vSkills.setting,
      attack:    vSkills.attack,
      digging:   vSkills.digging,
      // mental
      ...mental,
      // specialities
      speciality1: s1,
      speciality2: s2,
      speciality3: s3,
      // hidden
      hiddenAttributes: hidden,
      // form / confidence (start at neutral)
      confidence: 50,
      form:       50,
      chemistry:  50,
      // career stats (all zero — fresh draft entrant)
      careerMatches: 0, careerWins: 0, careerLosses: 0, careerWinPercentage: 0,
      careerAces: 0, careerServiceErrors: 0, careerKills: 0, careerAttackErrors: 0,
      careerBlocks: 0, careerDigs: 0, careerReceives: 0, careerAssists: 0,
      careerMVPs: 0, careerPlayerOfTheTournament: 0,
      careerPrizeMoney: 0, careerFans: 0, careerSocialFollowers: 0,
      currentSeasonMatches: 0, currentSeasonWins: 0, currentSeasonLosses: 0,
      currentSeasonAces: 0, currentSeasonKills: 0, currentSeasonBlocks: 0, currentSeasonDigs: 0,
      worldRanking: 0,
      continentalRanking: 0,
      bio: bio(player.name, player.nationality, pos, age, pot),
    };

    await db
      .update(playersTable)
      .set({ development: development as any })
      .where(eq(playersTable.id, player.id));

    console.log(`✓ ${player.name} (${player.nationality}) — OR:${overall} ★${starRating(pot)} — ${personality}`);
  }

  console.log(`\nDone — ${rows.length} players updated.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
