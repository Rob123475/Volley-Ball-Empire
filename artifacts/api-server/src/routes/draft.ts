import { Router } from "express";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { db } from "@workspace/db";
import { playersTable, teamsTable, contractsTable, facilitiesTable } from "@workspace/db";
import { eq, isNull, and, lte, ne } from "drizzle-orm";

const router = Router();

const serializePlayer = (p: any) => ({
  ...p,
  height: Number(p.height),
  salary: Number(p.salary),
  askingPrice: p.askingPrice ? Number(p.askingPrice) : null,
});

// ── Portrait URL helpers ────────────────────────────────────────────────────

const NATIONALITY_CONTINENT: Record<string, string> = {
  Japan: "Asia", "South Korea": "Asia", China: "Asia", India: "Asia",
  Thailand: "Asia", Indonesia: "Asia", Philippines: "Asia", Vietnam: "Asia",
  Germany: "Europe", France: "Europe", Italy: "Europe", Spain: "Europe",
  Norway: "Europe", Sweden: "Europe", Denmark: "Europe", Netherlands: "Europe",
  Switzerland: "Europe", Poland: "Europe", Greece: "Europe", Portugal: "Europe",
  Austria: "Europe", Belgium: "Europe", Russia: "Europe",
  USA: "North America", Canada: "North America", Mexico: "North America",
  Brazil: "South America", Argentina: "South America", Colombia: "South America",
  Chile: "South America", Peru: "South America", Venezuela: "South America",
  Ecuador: "South America", Uruguay: "South America",
  Nigeria: "Africa", Ghana: "Africa", Kenya: "Africa", Egypt: "Africa",
  "South Africa": "Africa", Ethiopia: "Africa", Senegal: "Africa",
  Tanzania: "Africa", Cameroon: "Africa", Morocco: "Africa",
  Australia: "Oceania", "New Zealand": "Oceania", Fiji: "Oceania",
};

const CONTINENT_SLUG: Record<string, string> = {
  Africa: "africa", Asia: "asia", Europe: "europe",
  "North America": "northam", "South America": "southam", Oceania: "oceania",
};

function nameHash(name: string): number {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 10;
}

function getPortraitUrl(name: string, continent: string | null | undefined, playerType: string, nationality?: string): string {
  const resolved = continent ?? (nationality ? NATIONALITY_CONTINENT[nationality] : null) ?? "Europe";
  const slug     = CONTINENT_SLUG[resolved] ?? "europe";
  const prefix   = playerType === "youth" ? "y" : "s";
  return `/players/${prefix}-${slug}-${String(nameHash(name) + 1).padStart(2, "0")}.png`;
}


// ── Youth generation helpers ───────────────────────────────────────────────

const YOUTH_NAMES = [
  "Aiko Tanaka","Yuna Park","Mei Lin","Sakura Ito","Ji-Young Kim",
  "Ana Souza","Camila Lima","Isabela Costa","Mariana Santos","Julia Oliveira",
  "Emma Weber","Lena Müller","Sophie Braun","Hannah Fischer","Laura Becker",
  "Chloé Dupont","Amélie Martin","Inès Bernard","Zoé Petit","Léa Moreau",
  "Mia Rossi","Sofia Ferrari","Giulia Romano","Elena Ricci","Chiara Bruno",
  "Freya Andersen","Maja Pedersen","Astrid Larsen","Ingrid Johansen","Sigrid Berg",
  "Zara Williams","Amara Johnson","Kezia Mensah","Nadia Ahmed","Sara Hassan",
  "Valentina García","Sofía López","Isabella Martínez","Camila Rodríguez","Lucía Hernández",
  "Avery Thompson","Riley Anderson","Taylor Mitchell","Morgan Wilson","Jordan Davis",
  "Yuki Watanabe","Hana Suzuki","Rin Sato","Miku Yamamoto","Shiori Nakamura",
  "Priya Sharma","Ananya Patel","Divya Nair","Meera Krishnan","Riya Gupta",
  "Fatou Diallo","Aminata Koné","Adaeze Okafor","Efua Asante","Nkechi Eze",
];

const YOUTH_NATIONALITIES = [
  "Japan","Brazil","Germany","France","Italy","Norway","USA",
  "Australia","Canada","Spain","South Korea","Netherlands",
  "Ghana","Sweden","Denmark","Switzerland","Brazil","USA","Australia",
];

function randStat(min = 42, max = 63): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Potential rolls weighted by Youth Academy level: L1 is base, L10 skews toward Elite/Generational */
function rollPotential(academyLevel: number): string {
  const t  = (academyLevel - 1) / 9; // 0 at L1, 1 at L10
  const pG = 0.03 + t * 0.09;        // Generational: 3% → 12%
  const pE = 0.12 + t * 0.13;        // Elite:        12% → 25%
  const pH = 0.25 + t * 0.07;        // High:         25% → 32%
  const r  = Math.random();
  if (r < pG)           return "Generational";
  if (r < pG + pE)      return "Elite";
  if (r < pG + pE + pH) return "High";
  return "Average";
}

router.post("/draft/generate-class", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }

  // Youth Academy level influences potential distribution
  const academy = await db.query.facilitiesTable.findFirst({
    where: and(eq(facilitiesTable.teamId, team.id), eq(facilitiesTable.type, "youth_academy")),
  });
  const academyLevel = academy?.level ?? 1;

  // Clear old unclaimed draft players
  await db.delete(playersTable).where(and(eq(playersTable.isDraftPlayer, true), isNull(playersTable.teamId)));

  const usedNames = new Set<string>();
  const newPlayers = [];

  for (let i = 0; i < 8; i++) {
    let name = YOUTH_NAMES[Math.floor(Math.random() * YOUTH_NAMES.length)];
    let attempts = 0;
    while (usedNames.has(name) && attempts < 20) {
      name = YOUTH_NAMES[Math.floor(Math.random() * YOUTH_NAMES.length)];
      attempts++;
    }
    usedNames.add(name);

    const nationality = YOUTH_NATIONALITIES[Math.floor(Math.random() * YOUTH_NATIONALITIES.length)];
    const age = 17 + Math.floor(Math.random() * 4); // 17-20

    const [player] = await db.insert(playersTable).values({
      name,
      nationality,
      age,
      height: String(Number((1.65 + Math.random() * 0.20).toFixed(2))),
      position: ["setter", "spiker", "defender", "blocker", "server", "all_rounder"][Math.floor(Math.random() * 6)],
      speed:   randStat(),
      power:   randStat(),
      defense: randStat(),
      serve:   randStat(),
      block:   randStat(),
      stamina: randStat(),
      morale:  75 + Math.floor(Math.random() * 16),
      fatigue: Math.floor(Math.random() * 15),
      fitness: 85 + Math.floor(Math.random() * 15),
      potential: rollPotential(academyLevel),
      salary:    String(5000 + Math.floor(Math.random() * 3001)),
      askingPrice: String(40000 + Math.floor(Math.random() * 30001)),
      isDraftPlayer: true,
      isActive:  false,
      isRetired: false,
      injuryStatus: "Healthy",
      imageUrl: getPortraitUrl(name, null, "youth", nationality),
    }).returning();

    newPlayers.push({ ...serializePlayer(player), available: true });
  }

  res.json(newPlayers);
});

router.get("/draft", async (req, res) => {
  const draftPlayers = await db.select().from(playersTable)
    .where(and(eq(playersTable.isDraftPlayer, true), lte(playersTable.age, 20), eq(playersTable.isRetired, false)));
  res.json(draftPlayers.filter(p => !p.teamId).map(p => ({
    ...serializePlayer(p),
    available: !p.teamId,
  })));
});

router.post("/draft/pick", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }
  const { draftPlayerId } = req.body;

  const player = await db.query.playersTable.findFirst({ where: eq(playersTable.id, Number(draftPlayerId)) });
  if (!player || player.teamId) { res.status(400).json({ error: "Player not available" }); return; }

  const today = new Date().toISOString().split("T")[0];
  const sixMonths = new Date();
  sixMonths.setMonth(sixMonths.getMonth() + 6);
  const endDate = sixMonths.toISOString().split("T")[0];

  const [updated] = await db.update(playersTable).set({
    teamId: team.id,
    isActive: true,
    contractEndDate: endDate,
    isDraftPlayer: false,
  }).where(eq(playersTable.id, Number(draftPlayerId))).returning();

  await db.insert(contractsTable).values({
    playerId: Number(draftPlayerId),
    teamId: team.id,
    salary: player.salary || "5000",
    startDate: today,
    endDate,
    bonusPerWin: "500",
  });

  res.status(201).json(serializePlayer(updated));
});

export default router;
