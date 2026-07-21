import { Router } from "express";
import { generateStaffMember, type StaffRole } from "../utils/staff-generator.js";
import { generateMedicalStaffMember, type MedicalRole, MEDICAL_ROLES } from "../utils/medical-staff-generator.js";
import { db } from "@workspace/db";
import {
  matchesTable, seasonsTable, calendarStateTable, teamsTable,
  continentalPoolTeamsTable, continentalPoolPlayersTable,
} from "@workspace/db";
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

// ── POST /api/dev/ensure-continental-pool-extension ───────────────────────────
// Idempotent save migration: ensures every continent has exactly 10 pool teams
// (6 active + 4 bench).  Safe to call multiple times — skips stableIds that
// already exist.  Returns a per-continent status report.

const POOL_EXTENSION_TEAMS = [
  // Africa and Middle East
  { stableId:"AFM_09", continent:"Africa and Middle East", teamName:"Tunis Mediterranean Aces",    rating:60, form:35, poolRanking:9,  players:[{stableId:"AFM_09_P1",name:"Sarah Ben Ammar",   nationality:"Tunisian",          age:24,speed:74,power:72,defense:74,serve:73,block:71,stamina:76,imageUrl:"/images/players/seniors/player_senior_tunisia_01.webp"},{stableId:"AFM_09_P2",name:"Habiba Mzoughi",      nationality:"Tunisian",          age:25,speed:67,power:81,defense:65,serve:62,block:88,stamina:70,imageUrl:"/images/players/seniors/player_senior_tunisia_02.webp"}] },
  { stableId:"AFM_10", continent:"Africa and Middle East", teamName:"Dar es Salaam Swahili Stars", rating:57, form:32, poolRanking:10, players:[{stableId:"AFM_10_P1",name:"Zawadi Kimaro",      nationality:"Tanzanian",         age:27,speed:72,power:71,defense:72,serve:71,block:69,stamina:72,imageUrl:"/images/players/seniors/player_senior_tanzania_03.webp"},{stableId:"AFM_10_P2",name:"Asha Msuya",            nationality:"Tanzanian",         age:25,speed:66,power:78,defense:65,serve:62,block:83,stamina:71,imageUrl:"/images/players/seniors/player_senior_tanzania_01.webp"}] },
  // Asia
  { stableId:"ASI_09", continent:"Asia",                   teamName:"Ho Chi Minh City Delta Stars",rating:62, form:35, poolRanking:9,  players:[{stableId:"ASI_09_P1",name:"Nguyen Mai Anh",    nationality:"Vietnamese",        age:21,speed:77,power:64,defense:75,serve:83,block:60,stamina:76,imageUrl:"/images/players/seniors/player_senior_vietnam_03.webp"},{stableId:"ASI_09_P2",name:"Le Minh Anh",            nationality:"Vietnamese",        age:21,speed:76,power:70,defense:73,serve:71,block:68,stamina:73,imageUrl:"/images/players/seniors/player_senior_vietnam_02.webp"}] },
  { stableId:"ASI_10", continent:"Asia",                   teamName:"Taipei Formosa Spikers",      rating:59, form:32, poolRanking:10, players:[{stableId:"ASI_10_P1",name:"Chen Yu-Hsin",       nationality:"Taiwanese",         age:23,speed:80,power:81,defense:62,serve:70,block:65,stamina:76,imageUrl:"/images/players/seniors/player_senior_taiwan_02.webp"},{stableId:"ASI_10_P2",name:"Huang Yi-Ting",          nationality:"Taiwanese",         age:22,speed:81,power:80,defense:62,serve:70,block:64,stamina:76,imageUrl:"/images/players/seniors/player_senior_taiwan_01.webp"}] },
  // Australia and Pacific Islands
  { stableId:"AUS_09", continent:"Australia and Pacific Islands", teamName:"Port Moresby Coral Aces",  rating:61, form:35, poolRanking:9,  players:[{stableId:"AUS_09_P1",name:"Alina Kora",       nationality:"Papua New Guinean", age:25,speed:82,power:88,defense:64,serve:75,block:70,stamina:78,imageUrl:"/images/players/seniors/player_senior_papua_new_guinea_04.webp"},{stableId:"AUS_09_P2",name:"Kiriwina Tau",           nationality:"Papua New Guinean", age:21,speed:73,power:83,defense:68,serve:70,block:77,stamina:72,imageUrl:"/images/players/seniors/player_senior_papua_new_guinea_02.webp"}] },
  { stableId:"AUS_10", continent:"Australia and Pacific Islands", teamName:"Wellington Southern Cross",rating:58, form:32, poolRanking:10, players:[{stableId:"AUS_10_P1",name:"Zoe Walker",        nationality:"New Zealander",     age:25,speed:68,power:82,defense:67,serve:64,block:86,stamina:73,imageUrl:"/images/players/seniors/player_senior_new_zealand_01.webp"},{stableId:"AUS_10_P2",name:"Lily Mackenzie",          nationality:"New Zealander",     age:23,speed:84,power:59,defense:85,serve:66,block:53,stamina:82,imageUrl:"/images/players/seniors/player_senior_new_zealand_02.webp"}] },
  // Europe
  { stableId:"EUR_09", continent:"Europe",                 teamName:"Lisbon Atlantic Blaze",        rating:63, form:35, poolRanking:9,  players:[{stableId:"EUR_09_P1",name:"Sofia Almeida",      nationality:"Portuguese",        age:28,speed:79,power:83,defense:63,serve:71,block:67,stamina:76,imageUrl:"/images/players/seniors/player_senior_portugal_04.webp"},{stableId:"EUR_09_P2",name:"Aoife O'Sullivan",        nationality:"Irish",             age:22,speed:75,power:71,defense:74,serve:72,block:70,stamina:74,imageUrl:"/images/players/seniors/player_senior_ireland_01.webp"}] },
  { stableId:"EUR_10", continent:"Europe",                 teamName:"Dublin Emerald Spikers",       rating:60, form:32, poolRanking:10, players:[{stableId:"EUR_10_P1",name:"Sara Borg",           nationality:"Maltese",           age:22,speed:75,power:71,defense:74,serve:72,block:70,stamina:74,imageUrl:"/images/players/seniors/player_senior_malta_02.webp"},{stableId:"EUR_10_P2",name:"Yasmin Grech",             nationality:"Maltese",           age:24,speed:68,power:80,defense:66,serve:63,block:85,stamina:72,imageUrl:"/images/players/seniors/player_senior_malta_01.webp"}] },
  // North America
  { stableId:"NAM_09", continent:"North America",          teamName:"Kingston Reggae Spikers",      rating:65, form:35, poolRanking:9,  players:[{stableId:"NAM_09_P1",name:"Kayla Thompson",     nationality:"Jamaican",          age:23,speed:80,power:75,defense:74,serve:73,block:65,stamina:78,imageUrl:"/images/players/seniors/player_senior_jamaica_01.webp"},{stableId:"NAM_09_P2",name:"Niah Myers",              nationality:"Jamaican",          age:22,speed:84,power:80,defense:62,serve:70,block:63,stamina:79,imageUrl:"/images/players/seniors/player_senior_jamaica_02.webp"}] },
  { stableId:"NAM_10", continent:"North America",          teamName:"Nassau Island Blazers",        rating:62, form:32, poolRanking:10, players:[{stableId:"NAM_10_P1",name:"Aaliyah Rolle",       nationality:"Bahamian",          age:25,speed:76,power:72,defense:74,serve:73,block:70,stamina:75,imageUrl:"/images/players/seniors/player_senior_bahamas_01.webp"},{stableId:"NAM_10_P2",name:"Jada Knowles",             nationality:"Bahamian",          age:22,speed:74,power:64,defense:73,serve:81,block:59,stamina:74,imageUrl:"/images/players/seniors/player_senior_bahamas_02.webp"}] },
  // South America
  { stableId:"SAM_09", continent:"South America",          teamName:"Georgetown Guyana Waves",      rating:68, form:35, poolRanking:9,  players:[{stableId:"SAM_09_P1",name:"Nia Campbell",        nationality:"Guyanese",          age:28,speed:73,power:85,defense:79,serve:78,block:86,stamina:79,imageUrl:"/images/players/seniors/player_senior_guyana_03.webp"},{stableId:"SAM_09_P2",name:"Amara James",              nationality:"Guyanese",          age:26,speed:84,power:86,defense:70,serve:78,block:74,stamina:78,imageUrl:"/images/players/seniors/player_senior_guyana_01.webp"}] },
  { stableId:"SAM_10", continent:"South America",          teamName:"La Paz Andean Queens",         rating:65, form:32, poolRanking:10, players:[{stableId:"SAM_10_P1",name:"Valeria Mamani",      nationality:"Bolivian",          age:26,speed:66,power:79,defense:66,serve:62,block:85,stamina:71,imageUrl:"/images/players/seniors/player_senior_bolivia_04.webp"},{stableId:"SAM_10_P2",name:"Camila Torrez",             nationality:"Bolivian",          age:21,speed:79,power:79,defense:61,serve:68,block:63,stamina:73,imageUrl:"/images/players/seniors/player_senior_bolivia_02.webp"}] },
] as const;

router.post("/dev/ensure-continental-pool-extension", async (_req, res) => {
  try {
    const report: Array<{ stableId: string; teamName: string; status: "inserted" | "exists" }> = [];

    for (const teamDef of POOL_EXTENSION_TEAMS) {
      const [existing] = await db
        .select({ id: continentalPoolTeamsTable.id })
        .from(continentalPoolTeamsTable)
        .where(eq(continentalPoolTeamsTable.stableId, teamDef.stableId))
        .limit(1);

      if (existing) {
        report.push({ stableId: teamDef.stableId, teamName: teamDef.teamName, status: "exists" });
        continue;
      }

      const [inserted] = await db
        .insert(continentalPoolTeamsTable)
        .values({
          continent: teamDef.continent, stableId: teamDef.stableId, teamName: teamDef.teamName,
          rating: teamDef.rating, form: teamDef.form, fitness: 100, fatigue: 0,
          poolRanking: teamDef.poolRanking, promotionCount: 0, relegationCount: 0,
          isActiveInLeague: false,
        })
        .returning({ id: continentalPoolTeamsTable.id });

      if (inserted) {
        for (const p of teamDef.players) {
          const [ep] = await db
            .select({ id: continentalPoolPlayersTable.id })
            .from(continentalPoolPlayersTable)
            .where(eq(continentalPoolPlayersTable.stableId, p.stableId))
            .limit(1);
          if (!ep) {
            await db.insert(continentalPoolPlayersTable).values({
              poolTeamId: inserted.id, stableId: p.stableId, name: p.name,
              nationality: p.nationality, age: p.age, speed: p.speed, power: p.power,
              defense: p.defense, serve: p.serve, block: p.block, stamina: p.stamina,
              imageUrl: p.imageUrl,
            });
          }
        }
        report.push({ stableId: teamDef.stableId, teamName: teamDef.teamName, status: "inserted" });
      }
    }

    const inserted = report.filter(r => r.status === "inserted").length;
    const existing = report.filter(r => r.status === "exists").length;

    res.json({ ok: true, inserted, existing, total: report.length, report });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

export default router;
