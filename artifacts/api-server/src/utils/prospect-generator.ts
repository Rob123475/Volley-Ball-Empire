import { db } from "@workspace/db";
import { missionQuality, findOdds, rollFound, playersWatched } from "./missionFinds.js";
import { youthTierPrice } from "./marketScouting.js";
import { youthProspectsTable } from "@workspace/db";
import { generateScoutingReport } from "./scouting-report-generator";
import { drawYouthStats } from "./youthIntake.js";
import { overallRating } from "./overallRating.js";

const NAMES_BY_CONTINENT: Record<string, string[]> = {
  Europe: [
    "Emma Weber", "Lena Müller", "Sophie Braun", "Hannah Fischer", "Laura Becker",
    "Chloé Dupont", "Amélie Martin", "Inès Bernard", "Zoé Petit", "Léa Moreau",
    "Mia Rossi", "Sofia Ferrari", "Giulia Romano", "Elena Ricci", "Chiara Bruno",
    "Freya Andersen", "Maja Pedersen", "Astrid Larsen", "Ingrid Johansen", "Sigrid Berg",
    "Valentina García", "Sofía López", "Isabella Martínez", "Camila Rodríguez",
  ],
  Africa: [
    "Fatou Diallo", "Aminata Koné", "Adaeze Okafor", "Efua Asante", "Nkechi Eze",
    "Abena Amponsah", "Ama Boateng", "Chiamaka Obi", "Ngozi Eze", "Adaora Nwosu",
    "Nadia Ahmed", "Sara Hassan", "Layla Omar", "Amina Ndiaye",
  ],
  "North America": [
    "Avery Thompson", "Riley Anderson", "Taylor Mitchell", "Morgan Wilson", "Jordan Davis",
    "Brooke Sullivan", "Paige Harris", "Sydney Clark", "Kayla Lewis", "Alexis Walker",
    "Peyton Moore", "Cameron White", "Hayden Brown", "Quinn Martinez",
  ],
  "South America": [
    "Ana Souza", "Camila Lima", "Isabela Costa", "Mariana Santos", "Julia Oliveira",
    "Valentina Ramos", "Lucía Fernández", "Sofía Castro", "Gabriela Moreno", "Daniela Ruiz",
    "Antonella Silva", "Renata Pereira", "Fernanda Alves",
  ],
  Asia: [
    "Aiko Tanaka", "Yuna Park", "Mei Lin", "Sakura Ito", "Ji-Young Kim",
    "Yuki Watanabe", "Hana Suzuki", "Rin Sato", "Miku Yamamoto", "Shiori Nakamura",
    "Priya Sharma", "Ananya Patel", "Divya Nair", "Meera Krishnan",
  ],
  Oceania: [
    "Zoe Harrison", "Chloe Martin", "Emma Wilson", "Lily Thompson", "Grace Anderson",
    "Mia Cooper", "Ella Davis", "Sophie Evans", "Charlotte Moore", "Olivia Turner",
  ],
};

const NATIONALITIES: Record<string, string[]> = {
  Europe:          ["Germany", "France", "Italy", "Spain", "Norway", "Sweden", "Netherlands", "Poland", "Denmark"],
  Africa:          ["Ghana", "Nigeria", "Kenya", "South Africa", "Senegal", "Egypt", "Morocco"],
  "North America": ["USA", "Canada", "USA", "USA"],
  "South America": ["Brazil", "Colombia", "Argentina", "Brazil", "Brazil", "Chile"],
  Asia:            ["Japan", "South Korea", "China", "India", "Thailand"],
  Oceania:         ["Australia", "New Zealand", "Australia", "Australia"],
};

const SPECIALITIES = ["Power", "Defense", "Serve", "Speed", "Block", "All-Rounder"] as const;

const REGION_SPECIALITIES: Record<string, string[]> = {
  Europe:          ["All-Rounder", "Defense", "Serve", "Speed"],
  Asia:            ["Serve", "Defense", "Speed", "All-Rounder"],
  Africa:          ["Block", "Power", "Speed", "Power"],
  "North America": ["All-Rounder", "Power", "Block", "Speed"],
  "South America": ["Defense", "Power", "Speed", "All-Rounder"],
  Oceania:         ["Speed", "Defense", "All-Rounder", "Serve"],
};

/**
 * A region's talent: the potentials its youths are drawn from. Their ratings
 * are the one youth rule's (N-44) and their price the youth market's
 * (youthTierPrice); the per-region rating and cost ranges this table held are gone.
 */
const TALENT_CONFIG: Record<string, { potentials: string[] }> = {
  Elite:   { potentials: ["High", "Elite", "Elite", "Generational"] },
  High:    { potentials: ["Average", "High", "High", "Elite"]       },
  Average: { potentials: ["Average", "Average", "High", "High"]     },
};

const CONTINENT_TALENT: Record<string, string> = {
  Europe:          "Elite",
  Africa:          "High",
  "North America": "High",
  "South America": "Elite",
  Asia:            "High",
  Oceania:         "Average",
};

const TRUE_POTENTIAL_INDEX: Record<string, number> = {
  Low: 0, Average: 2, High: 3, Elite: 4, Generational: 4,
};

const SCOUTED_LABELS = ["Very Low", "Low", "Moderate", "High", "Elite"] as const;
type ScoutedLabel = typeof SCOUTED_LABELS[number];

// ── Elite event types ─────────────────────────────────────────────────────────

type EliteEventType =
  | "Generational Talent"
  | "Olympic Wonderkid"
  | "Physical Freak"
  | "Local Hero";

/**
 * Overnight brief 1 Oct, N-44: "Generational Talent" is exactly the 1-in-100
 * super-gifted youth of the one stats rule (utils/youthIntake.ts drawYouthStats),
 * so it is not rolled here. The other three rare finds keep their own odds and
 * shape her potential, age and speciality, but no longer raise her rating: her
 * rating is her stats', like every other youth's.
 */
function rollEliteEvent(superGifted: boolean): EliteEventType | null {
  if (superGifted) return "Generational Talent";
  const r = Math.random() * 100;
  if (r < 2)  return "Olympic Wonderkid";
  if (r < 5)  return "Physical Freak";
  if (r < 9)  return "Local Hero";
  return null;
}

function applyEliteBoosts(
  event: EliteEventType,
  base: { currentRating: number; potentialStars: string; age: number; speciality: string },
): { currentRating: number; potentialStars: string; age: number; speciality: string } {
  switch (event) {
    case "Generational Talent":
      return {
        ...base,
        age:            rand(14, 16),
        potentialStars: "Generational",
      };
    case "Olympic Wonderkid":
      return {
        ...base,
        age:            rand(14, 16),
        potentialStars: Math.random() < 0.55 ? "Generational" : "Elite",
      };
    case "Physical Freak":
      return {
        ...base,
        age:            rand(15, 17),
        potentialStars: Math.random() < 0.4 ? "Elite" : "High",
        speciality:     Math.random() < 0.5 ? "Power" : "Speed",
      };
    case "Local Hero":
      return {
        ...base,
        age:            rand(15, 18),
        potentialStars: Math.random() < 0.35 ? "Elite" : "High",
      };
  }
}

// ── Scouted potential with elite event awareness ───────────────────────────────

function getScoutedPotential(
  truePotential: string,
  scoutingRating: number,
  eliteEvent: EliteEventType | null,
): ScoutedLabel {
  // Generational Talent is so obvious even poor scouts recognise it
  if (eliteEvent === "Generational Talent") return "Elite";
  // Olympic Wonderkid: at most 1 level off even for weak scouts
  if (eliteEvent === "Olympic Wonderkid") {
    const baseIdx = TRUE_POTENTIAL_INDEX[truePotential] ?? 4;
    const error = scoutingRating >= 51 ? 0 : (Math.random() < 0.5 ? 0 : -1);
    return SCOUTED_LABELS[Math.max(0, Math.min(4, baseIdx + error))]!;
  }

  const baseIdx = TRUE_POTENTIAL_INDEX[truePotential] ?? 2;
  let error = 0;
  const roll = Math.random();
  if      (scoutingRating >= 86) { error = 0; }
  else if (scoutingRating >= 71) { error = roll < 0.90 ? 0 : roll < 0.95 ? -1 : 1; }
  else if (scoutingRating >= 51) { error = roll < 0.50 ? 0 : roll < 0.75 ? -1 : 1; }
  else if (scoutingRating >= 31) {
    if      (roll < 0.30) error = 0;
    else if (roll < 0.60) error = -1;
    else if (roll < 0.80) error = 1;
    else if (roll < 0.90) error = -2;
    else                  error = 2;
  } else { error = Math.floor(Math.random() * 5) - 2; }
  return SCOUTED_LABELS[Math.max(0, Math.min(4, baseIdx + error))]!;
}

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickName(continent: string, used: Set<string>): string {
  const pool = NAMES_BY_CONTINENT[continent] ?? NAMES_BY_CONTINENT["North America"]!;
  for (let i = 0; i < 30; i++) {
    const candidate = pool[Math.floor(Math.random() * pool.length)]!;
    if (!used.has(candidate)) return candidate;
  }
  return pool[0]!;
}

/** The nations a region's finds come from (N-44: the boot pass reads the country back out of a report). */
export function regionNations(region: string): string[] {
  return [...new Set(NATIONALITIES[region] ?? [])];
}

function pickNationality(continent: string): string {
  const pool = NATIONALITIES[continent] ?? ["USA"];
  return pool[Math.floor(Math.random() * pool.length)]!;
}

function pickSpeciality(continent: string): string {
  const pool = REGION_SPECIALITIES[continent] ?? Array.from(SPECIALITIES);
  return pool[Math.floor(Math.random() * pool.length)]!;
}

// ── Legacy: used by old youth-scouting system ─────────────────────────────

export async function generateScoutingProspects(teamId: number, continent: string): Promise<void> {
  const talentKey = CONTINENT_TALENT[continent] ?? "Average";
  const cfg       = TALENT_CONFIG[talentKey]!;
  const used      = new Set<string>();

  for (let i = 0; i < 3; i++) {
    const name = pickName(continent, used);
    used.add(name);

    // N-44: rated by the one youth rule, like every other youth.
    const { stats } = drawYouthStats();
    const potential = cfg.potentials[Math.floor(Math.random() * cfg.potentials.length)]!;
    await db.insert(youthProspectsTable).values({
      teamId,
      name,
      age:           rand(14, 18),
      continent,
      nationality:   pickNationality(continent),
      stats,
      currentRating: overallRating(stats),
      potentialStars: potential,
      speciality:    SPECIALITIES[Math.floor(Math.random() * SPECIALITIES.length)]!,
      signingCost:   youthTierPrice(potential, Math.random()).price,
      status:        "pending",
    });
  }
}

// ── Continental scouting: scout quality–aware generation ──────────────────

/**
 * Overnight brief 30 Sep, item 13: a mission finds youth (14-18), 0 to 4 of
 * them, by the odds in utils/missionFinds.ts (scout rating, Scouting
 * Department level, mission length). Each is priced by the youth market's
 * rule ($500-$2,000 by talent). Returns how many were found and how many
 * players the scout watched (a blank report says so).
 */
export async function generateContinentalProspects(params: {
  teamId: number;
  region: string;
  missionId: number;
  scoutingRating: number;
  scoutName: string | null;
  durationMonths: number;
  departmentLevel: number;
}): Promise<{ count: number; watched: number }> {
  const { teamId, region, missionId, scoutingRating, scoutName, durationMonths, departmentLevel } = params;

  const talentKey   = CONTINENT_TALENT[region] ?? "Average";
  const cfg         = TALENT_CONFIG[talentKey]!;
  const count       = rollFound(findOdds(missionQuality(scoutingRating, departmentLevel, durationMonths)), Math.random());
  const watched     = Math.max(count, playersWatched(durationMonths, Math.random()));
  const used        = new Set<string>();

  const discoveredBy = scoutName
    ? `Discovered in ${region} by Scout ${scoutName} (Rating: ${scoutingRating})`
    : `Discovered in ${region}`;

  for (let i = 0; i < count; i++) {
    const name        = pickName(region, used);
    used.add(name);
    const nationality = pickNationality(region);

    // Base stats
    let age           = rand(14, 18);
    let speciality    = pickSpeciality(region);
    let truePotential = cfg.potentials[Math.floor(Math.random() * cfg.potentials.length)]!;
    // N-44: her stats by the one youth rule; about 1 in 100 is super-gifted.
    const { stats, superGifted } = drawYouthStats();
    let currentRating = overallRating(stats);

    // Roll for rare elite event (Generational Talent = the super-gifted one)
    const eliteEvent = rollEliteEvent(superGifted);
    if (eliteEvent) {
      const boosted = applyEliteBoosts(eliteEvent, { currentRating, potentialStars: truePotential, age, speciality });
      age           = boosted.age;
      speciality    = boosted.speciality;
      truePotential = boosted.potentialStars;
      currentRating = boosted.currentRating;
    }
    const signingCost = youthTierPrice(truePotential, Math.random()).price;

    const scoutedLabel = getScoutedPotential(truePotential, scoutingRating, eliteEvent);

    const reportText = generateScoutingReport({
      name,
      age,
      nationality,
      speciality,
      region,
      scoutedPotential: scoutedLabel,
      eliteEventType:   eliteEvent,
    });

    await db.insert(youthProspectsTable).values({
      teamId,
      name,
      age,
      continent:             region,
      nationality,
      stats,
      currentRating,
      potentialStars:        truePotential,
      speciality,
      signingCost,
      status:                "pending",
      scoutingReportText:    reportText,
      discoveredBy,
      scoutedPotentialLabel: scoutedLabel,
      continentalMissionId:  missionId,
      eliteEventType:        eliteEvent ?? undefined,
    });
  }

  return { count, watched };
}
