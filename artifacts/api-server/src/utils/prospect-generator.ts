import { db } from "@workspace/db";
import { youthProspectsTable } from "@workspace/db";

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

const SPECIALITIES = ["Power", "Defense", "Serve", "Speed", "Block", "All-Rounder"] as const;

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
  "South America": "High",
  Asia:            "Average",
  Oceania:         "Average",
};

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
