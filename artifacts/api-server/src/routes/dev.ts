import { Router } from "express";
import { generateStaffMember, type StaffRole } from "../utils/staff-generator.js";
import { generateMedicalStaffMember, type MedicalRole, MEDICAL_ROLES } from "../utils/medical-staff-generator.js";
import { db } from "@workspace/db";
import { matchesTable, seasonsTable, calendarStateTable, teamsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { WORLD_TOUR } from "../data/worldTour.js";

const WEATHER_CONDITIONS = ["sunny", "clear", "cloudy", "windy", "hot", "overcast", "perfect"];
function quickWeather() {
  const w = WEATHER_CONDITIONS[Math.floor(Math.random() * WEATHER_CONDITIONS.length)]!;
  const wind = String((Math.random() * 20).toFixed(1));
  const temp = String((22 + Math.random() * 15).toFixed(1));
  return { weather: w, windSpeed: wind, temperature: temp };
}

const router = Router();

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: readonly T[] | T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

// ── Name/nationality pools — mirror the real draft & prospect systems ────────

const SENIOR_NAMES = [
  "Aiko Tanaka", "Yuna Park", "Mei Lin", "Sakura Ito", "Ji-Young Kim",
  "Ana Souza", "Camila Lima", "Isabela Costa", "Mariana Santos", "Julia Oliveira",
  "Emma Weber", "Lena Müller", "Sophie Braun", "Hannah Fischer", "Laura Becker",
  "Chloé Dupont", "Amélie Martin", "Inès Bernard", "Zoé Petit", "Léa Moreau",
  "Mia Rossi", "Sofia Ferrari", "Giulia Romano", "Elena Ricci", "Chiara Bruno",
  "Freya Andersen", "Maja Pedersen", "Astrid Larsen", "Ingrid Johansen", "Sigrid Berg",
  "Zara Williams", "Amara Johnson", "Kezia Mensah", "Nadia Ahmed", "Sara Hassan",
  "Valentina García", "Sofía López", "Isabella Martínez", "Camila Rodríguez", "Lucía Hernández",
  "Avery Thompson", "Riley Anderson", "Taylor Mitchell", "Morgan Wilson", "Jordan Davis",
  "Yuki Watanabe", "Hana Suzuki", "Rin Sato", "Miku Yamamoto", "Shiori Nakamura",
  "Priya Sharma", "Ananya Patel", "Divya Nair", "Meera Krishnan", "Riya Gupta",
  "Fatou Diallo", "Aminata Koné", "Adaeze Okafor", "Efua Asante", "Nkechi Eze",
];

const SENIOR_NATIONALITIES = [
  "Japan", "Brazil", "Germany", "France", "Italy", "Norway", "USA",
  "Australia", "Canada", "Spain", "South Korea", "Netherlands",
  "Ghana", "Sweden", "Denmark", "Switzerland", "Brazil", "USA", "Australia",
];

const POSITIONS = ["setter", "spiker", "defender", "blocker", "server", "all_rounder"] as const;

const YOUTH_NAMES = [
  "Emma Weber", "Lena Müller", "Sophie Braun", "Hannah Fischer", "Laura Becker",
  "Chloé Dupont", "Amélie Martin", "Inès Bernard", "Zoé Petit", "Léa Moreau",
  "Mia Rossi", "Sofia Ferrari", "Giulia Romano", "Elena Ricci", "Chiara Bruno",
  "Freya Andersen", "Maja Pedersen", "Astrid Larsen", "Ingrid Johansen", "Sigrid Berg",
  "Valentina García", "Sofía López", "Isabella Martínez", "Camila Rodríguez",
  "Fatou Diallo", "Aminata Koné", "Adaeze Okafor", "Efua Asante", "Nkechi Eze",
  "Abena Amponsah", "Ama Boateng", "Chiamaka Obi", "Ngozi Eze", "Adaora Nwosu",
  "Nadia Ahmed", "Sara Hassan", "Layla Omar", "Amina Ndiaye",
  "Avery Thompson", "Riley Anderson", "Taylor Mitchell", "Morgan Wilson", "Jordan Davis",
  "Brooke Sullivan", "Paige Harris", "Sydney Clark", "Kayla Lewis", "Alexis Walker",
  "Ana Souza", "Camila Lima", "Isabela Costa", "Mariana Santos", "Julia Oliveira",
  "Valentina Ramos", "Lucía Fernández", "Sofía Castro", "Gabriela Moreno", "Daniela Ruiz",
  "Aiko Tanaka", "Yuna Park", "Mei Lin", "Sakura Ito", "Ji-Young Kim",
  "Yuki Watanabe", "Hana Suzuki", "Rin Sato", "Miku Yamamoto", "Shiori Nakamura",
  "Priya Sharma", "Ananya Patel", "Divya Nair", "Meera Krishnan",
  "Zoe Harrison", "Chloe Martin", "Emma Wilson", "Lily Thompson", "Grace Anderson",
  "Mia Cooper", "Ella Davis", "Sophie Evans", "Charlotte Moore", "Olivia Turner",
];

const YOUTH_NATIONALITIES = [
  "Germany", "France", "Italy", "Spain", "Norway", "Sweden", "Netherlands", "Poland", "Denmark",
  "Ghana", "Nigeria", "Kenya", "South Africa", "Senegal", "Egypt", "Morocco",
  "USA", "Canada",
  "Brazil", "Colombia", "Argentina", "Chile",
  "Japan", "South Korea", "China", "India", "Thailand",
  "Australia", "New Zealand",
];

const YOUTH_SPECIALITIES = ["Power", "Defense", "Serve", "Speed", "Block", "All-Rounder"] as const;

const STAFF_ROLES: StaffRole[] = [
  "head_coach", "assistant_coach", "fitness_trainer",
  "strength_conditioner", "massage_therapist", "promotions_manager",
];

type TestItem = {
  name: string;
  age: number;
  nationality: string;
  roleOrPosition: string;
  imageUrl: string;
  sourceSystem: string;
};

function generateSeniorPlayerItem(): TestItem {
  const name = pick(SENIOR_NAMES);
  const nationality = pick(SENIOR_NATIONALITIES);
  const age = rand(17, 20);
  const position = pick(POSITIONS);
  return {
    name,
    age,
    nationality,
    roleOrPosition: position,
    imageUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name + "_draft")}&backgroundColor=b6e3f4,c0aede,d1d4f9&backgroundType=gradientLinear`,
    sourceSystem: "Draft (Senior)",
  };
}

function generateYouthPlayerItem(): TestItem {
  const name = pick(YOUTH_NAMES);
  const nationality = pick(YOUTH_NATIONALITIES);
  const age = rand(14, 18);
  const speciality = pick(YOUTH_SPECIALITIES);
  const position = (speciality === "Serve" || speciality === "Defense") ? "setter" : "spiker";
  return {
    name,
    age,
    nationality,
    roleOrPosition: position,
    imageUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name + "_youth")}&backgroundColor=b6e3f4,c0aede,d1d4f9&backgroundType=gradientLinear`,
    sourceSystem: "Youth Scouting",
  };
}

router.post("/dev/generate-test", (req, res) => {
  const body = req.body as { type?: string; count?: number };
  const { type } = body;
  const safeCount = Math.min(200, Math.max(1, Number(body.count) || 100));

  const results: TestItem[] = [];

  switch (type) {
    case "senior_players":
      for (let i = 0; i < safeCount; i++) results.push(generateSeniorPlayerItem());
      break;

    case "youth_players":
      for (let i = 0; i < safeCount; i++) results.push(generateYouthPlayerItem());
      break;

    case "staff":
      for (let i = 0; i < safeCount; i++) {
        const s = generateStaffMember(pick(STAFF_ROLES));
        results.push({
          name:           s.name,
          age:            s.age,
          nationality:    s.nationality,
          roleOrPosition: s.role,
          imageUrl:       s.imageUrl,
          sourceSystem:   "Staff Market",
        });
      }
      break;

    case "medical_staff":
      for (let i = 0; i < safeCount; i++) {
        const m = generateMedicalStaffMember(pick(MEDICAL_ROLES as MedicalRole[]));
        results.push({
          name:           m.name,
          age:            m.age,
          nationality:    m.nationality,
          roleOrPosition: m.role,
          imageUrl:       m.imageUrl,
          sourceSystem:   "Medical Market",
        });
      }
      break;

    default:
      res.status(400).json({ error: `Unknown type: ${type ?? "(none)"}` });
      return;
  }

  res.json(results);
});

// ── POST /api/dev/migrate-season-78 ──────────────────────────────────────────
// Restructures the 2026 season to the 78-slot schedule:
//   Slots  1–10  Regional Period   (no matches — handled by regional league tables)
//   Slots 11–70  World Tour Period (60 events, one match per team)
//   Slots 71–72  Finals Period     (2 finals matches per team)
//   Slots 73–78  Holiday Period    (no matches)
//
// Safe to call multiple times: deletes and recreates all scheduled WT matches.

router.post("/dev/migrate-season-78", async (_req, res) => {
  try {
    // 1. Load the active season
    const seasons = await db.select().from(seasonsTable).where(eq(seasonsTable.status, "active")).limit(1);
    const season = seasons[0];
    if (!season) { res.status(400).json({ error: "No active season found" }); return; }

    // 2. Load all teams
    const teams = await db.select({ id: teamsTable.id, name: teamsTable.name }).from(teamsTable);
    if (teams.length === 0) { res.status(400).json({ error: "No teams found" }); return; }

    // 3. Delete all scheduled matches for this season
    await db.delete(matchesTable)
      .where(eq(matchesTable.season, season.year));

    const deletedCount = 0; // approximate — drizzle delete doesn't return count easily

    // 4. Update season: 78 slots, reset regional tracking
    await db.update(seasonsTable)
      .set({ totalRounds: 78, currentRound: 1, regionalRoundsProcessed: 0 })
      .where(eq(seasonsTable.id, season.id));

    // 5. Seed new matches for each team × each WORLD_TOUR event (slots 11–72)
    const matchRows: Array<typeof matchesTable.$inferInsert> = [];
    for (const team of teams) {
      for (const event of WORLD_TOUR) {
        const { weather, windSpeed, temperature } = quickWeather();
        matchRows.push({
          homeTeamId:    team.id,
          awayTeamId:    team.id,
          homeTeamName:  team.name,
          awayTeamName:  event.opponent,
          locationId:    event.locId,
          locationName:  event.locName,
          season:        season.year,
          round:         event.round,
          tier:          event.tier,
          continent:     event.continent,
          scheduledAt:   event.date,
          prizeAmount:   String(event.prize),
          status:        "scheduled",
          teamSize:      2,
          weather,
          windSpeed,
          temperature,
        });
      }
    }

    // Insert in batches of 100 to avoid statement size limits
    const BATCH = 100;
    let inserted = 0;
    for (let i = 0; i < matchRows.length; i += BATCH) {
      await db.insert(matchesTable).values(matchRows.slice(i, i + BATCH));
      inserted += Math.min(BATCH, matchRows.length - i);
    }

    // 6. Reset calendar state for all teams to the season start
    await db.update(calendarStateTable)
      .set({
        currentDate:    season.startDate,
        pendingMatchId: null,
        lastSalaryDate: season.startDate,
        calendarSpeed:  "pause",
      });

    res.json({
      ok: true,
      seasonId:       season.id,
      seasonYear:     season.year,
      totalRounds:    78,
      teamsProcessed: teams.length,
      matchesCreated: inserted,
      deletedPrior:   "all scheduled matches for season",
      slots: {
        regional:   "1–10  (auto-simulated via regional league tables)",
        worldTour:  "11–70 (60 events, 10 per continent)",
        finals:     "71–72 (Semifinals + World Final)",
        holiday:    "73–78 (off-season rest)",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

export default router;
