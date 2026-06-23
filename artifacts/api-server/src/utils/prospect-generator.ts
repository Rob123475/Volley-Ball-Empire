import { db } from "@workspace/db";
import { youthProspectsTable } from "@workspace/db";
import { generateScoutingReport } from "./scouting-report-generator";

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

const TALENT_CONFIG: Record<string, {
  ratingMin: number;
  ratingMax: number;
  costMin: number;
  costMax: number;
  potentials: string[];
}> = {
  Elite:   { ratingMin: 55, ratingMax: 68, costMin: 12000, costMax: 22000, potentials: ["High", "Elite", "Elite", "Generational"] },
  High:    { ratingMin: 52, ratingMax: 65, costMin:  8000, costMax: 18000, potentials: ["Average", "High", "High", "Elite"]       },
  Average: { ratingMin: 48, ratingMax: 62, costMin:  5000, costMax: 14000, potentials: ["Average", "Average", "High", "High"]     },
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

function rollEliteEvent(): EliteEventType | null {
  const r = Math.random() * 100;
  if (r < 1)  return "Generational Talent";
  if (r < 3)  return "Olympic Wonderkid";
  if (r < 6)  return "Physical Freak";
  if (r < 10) return "Local Hero";
  return null;
}

function applyEliteBoosts(
  event: EliteEventType,
  base: { currentRating: number; potentialStars: string; age: number; signingCost: number; speciality: string },
): { currentRating: number; potentialStars: string; age: number; signingCost: number; speciality: string } {
  switch (event) {
    case "Generational Talent":
      return {
        ...base,
        age:            rand(14, 16),
        currentRating:  Math.min(99, base.currentRating + rand(18, 28)),
        potentialStars: "Generational",
        signingCost:    Math.round(base.signingCost * (2.0 + Math.random())),
      };
    case "Olympic Wonderkid":
      return {
        ...base,
        age:            rand(14, 16),
        currentRating:  Math.min(99, base.currentRating + rand(12, 20)),
        potentialStars: Math.random() < 0.55 ? "Generational" : "Elite",
        signingCost:    Math.round(base.signingCost * (1.6 + Math.random() * 0.7)),
      };
    case "Physical Freak":
      return {
        ...base,
        age:            rand(15, 17),
        currentRating:  Math.min(99, base.currentRating + rand(8, 15)),
        potentialStars: Math.random() < 0.4 ? "Elite" : "High",
        speciality:     Math.random() < 0.5 ? "Power" : "Speed",
        signingCost:    Math.round(base.signingCost * (1.4 + Math.random() * 0.5)),
      };
    case "Local Hero":
      return {
        ...base,
        age:            rand(15, 18),
        currentRating:  Math.min(99, base.currentRating + rand(6, 13)),
        potentialStars: Math.random() < 0.35 ? "Elite" : "High",
        signingCost:    Math.round(base.signingCost * 0.8),
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

function getProspectCount(scoutingRating: number, durationMonths: number): number {
  let base = scoutingRating >= 86 ? 4 : scoutingRating >= 71 ? 3 : scoutingRating >= 51 ? 3 : scoutingRating >= 31 ? 2 : 1;
  const durationBonus = durationMonths >= 6 ? 2 : durationMonths >= 3 ? 1 : 0;
  const luck = Math.random() < 0.35 ? 1 : 0;
  return Math.min(5, base + durationBonus + luck);
}

function getRatingBonus(scoutingRating: number): number {
  if (scoutingRating >= 86) return 8;
  if (scoutingRating >= 71) return 5;
  if (scoutingRating >= 51) return 3;
  if (scoutingRating >= 31) return 0;
  return -5;
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

    await db.insert(youthProspectsTable).values({
      teamId,
      name,
      age:           rand(14, 18),
      continent,
      currentRating: rand(cfg.ratingMin, cfg.ratingMax),
      potentialStars: cfg.potentials[Math.floor(Math.random() * cfg.potentials.length)]!,
      speciality:    SPECIALITIES[Math.floor(Math.random() * SPECIALITIES.length)]!,
      signingCost:   rand(cfg.costMin, cfg.costMax),
      status:        "pending",
    });
  }
}

// ── Continental scouting: scout quality–aware generation ──────────────────

export async function generateContinentalProspects(params: {
  teamId: number;
  region: string;
  missionId: number;
  scoutingRating: number;
  scoutName: string | null;
  durationMonths: number;
}): Promise<number> {
  const { teamId, region, missionId, scoutingRating, scoutName, durationMonths } = params;

  const talentKey   = CONTINENT_TALENT[region] ?? "Average";
  const cfg         = TALENT_CONFIG[talentKey]!;
  const ratingBonus = getRatingBonus(scoutingRating);
  const count       = getProspectCount(scoutingRating, durationMonths);
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
    let currentRating = Math.min(99, Math.max(40, rand(cfg.ratingMin, cfg.ratingMax) + ratingBonus));
    let signingCost   = Math.max(3000, Math.min(35000, rand(cfg.costMin, cfg.costMax)));

    // Roll for rare elite event
    const eliteEvent = rollEliteEvent();
    if (eliteEvent) {
      const boosted = applyEliteBoosts(eliteEvent, { currentRating, potentialStars: truePotential, age, signingCost, speciality });
      age           = boosted.age;
      speciality    = boosted.speciality;
      truePotential = boosted.potentialStars;
      currentRating = boosted.currentRating;
      signingCost   = Math.min(80000, boosted.signingCost);
    }

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

  return count;
}
