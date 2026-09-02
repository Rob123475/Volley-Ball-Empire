import { Router } from "express";
import { generateStaffMember, type StaffRole } from "../utils/staff-generator.js";
import { generateMedicalStaffMember, type MedicalRole, MEDICAL_ROLES } from "../utils/medical-staff-generator.js";
import { db } from "@workspace/db";
import { CONTINENT_KEYS, type ContinentKey } from "@workspace/db";
import {
  matchesTable, seasonsTable, calendarStateTable, teamsTable,
  continentalPoolTeamsTable, continentalPoolPlayersTable,
  playersTable,
} from "@workspace/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import { WORLD_TOUR } from "../data/worldTour.js";

const WEATHER_CONDITIONS = ["sunny", "clear", "cloudy", "windy", "hot", "overcast", "perfect"];
function quickWeather() {
  const w = WEATHER_CONDITIONS[Math.floor(Math.random() * WEATHER_CONDITIONS.length)]!;
  const wind = Number((Math.random() * 20).toFixed(1));
  const temp = Number((22 + Math.random() * 15).toFixed(1));
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

const POSITIONS = ["setter", "spiker", "defender", "blocker", "all_rounder"] as const;

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
  "Switzerland", "Greece", "Portugal", "Austria", "Belgium", "Russia", "Czech Republic",
  "Finland", "Croatia", "Serbia", "Ukraine", "Hungary", "England", "Ireland", "Malta", "Monaco",
  "Ghana", "Nigeria", "Kenya", "South Africa", "Senegal", "Egypt", "Morocco",
  "Tunisia", "Tanzania", "Zimbabwe", "Mozambique", "Madagascar", "Cameroon", "Algeria",
  "Burkina Faso", "Ivory Coast", "Guinea",
  "USA", "Canada", "Mexico", "Cuba", "Jamaica", "Dominican Republic",
  "Puerto Rico", "Panama", "Costa Rica", "Bahamas",
  "Brazil", "Colombia", "Argentina", "Chile", "Peru", "Venezuela",
  "Ecuador", "Bolivia", "Uruguay", "Guyana",
  "Japan", "South Korea", "China", "India", "Thailand", "Indonesia",
  "Philippines", "Vietnam", "Malaysia", "Taiwan", "Laos", "Maldives",
  "Australia", "New Zealand", "Fiji", "Samoa", "Tahiti",
  "Papua New Guinea", "Tonga", "Vanuatu",
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
          prizeAmount:   event.prize,
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
          poolRanking: teamDef.poolRanking,
          // promotionCount/relegationCount are career state and default to 0
          // there; startsInLeague is the reference seed for league membership.
          startsInLeague: false,
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
              nationality: p.nationality, baseAge: p.age, speed: p.speed, power: p.power,
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

// ── Adjective nationality → DB continent mapping ───────────────────────────
// Used to back-fill the continent column for legacy youth players seeded
// from the JSON file (which used adjective-form nationalities like "German").
const ADJECTIVE_NATIONALITY_CONTINENT: Record<string, string> = {
  // Europe
  German: "Europe", French: "Europe", Italian: "Europe", Spanish: "Europe",
  Norwegian: "Europe", Swedish: "Europe", Danish: "Europe", Dutch: "Europe",
  Swiss: "Europe", Polish: "Europe", Greek: "Europe", Portuguese: "Europe",
  Austrian: "Europe", Belgian: "Europe", Russian: "Europe", Czech: "Europe",
  Finnish: "Europe", Croatian: "Europe", Serbian: "Europe", Ukrainian: "Europe",
  Hungarian: "Europe", English: "Europe", Irish: "Europe", Maltese: "Europe",
  Icelandic: "Europe", Bulgarian: "Europe", Romanian: "Europe", Slovak: "Europe",
  Slovenian: "Europe", Bosnian: "Europe", Monégasque: "Europe",
  // North America
  American: "North America", Canadian: "North America", Mexican: "North America",
  Cuban: "North America", Jamaican: "North America", Dominican: "North America",
  "Puerto Rican": "North America", Panamanian: "North America",
  "Costa Rican": "North America", Bahamian: "North America",
  // South America
  Brazilian: "South America", Argentine: "South America", Colombian: "South America",
  Chilean: "South America", Peruvian: "South America", Venezuelan: "South America",
  Ecuadorian: "South America", Bolivian: "South America", Uruguayan: "South America",
  Guyanese: "South America", Paraguayan: "South America",
  // Asia
  Japanese: "Asia", Chinese: "Asia", "South Korean": "Asia", Indian: "Asia",
  Thai: "Asia", Indonesian: "Asia", Filipino: "Asia", Vietnamese: "Asia",
  Malaysian: "Asia", Taiwanese: "Asia", Laotian: "Asia", Maldivian: "Asia",
  Mongolian: "Asia", Kazakhstani: "Asia",
  // Africa & Middle East
  Nigerian: "Africa & Middle East", Egyptian: "Africa & Middle East",
  Kenyan: "Africa & Middle East", Moroccan: "Africa & Middle East",
  Tunisian: "Africa & Middle East", "South African": "Africa & Middle East",
  Tanzanian: "Africa & Middle East", Zimbabwean: "Africa & Middle East",
  Mozambican: "Africa & Middle East", Malagasy: "Africa & Middle East",
  Ghanaian: "Africa & Middle East", Senegalese: "Africa & Middle East",
  Cameroonian: "Africa & Middle East", Algerian: "Africa & Middle East",
  Burkinabe: "Africa & Middle East", Ivorian: "Africa & Middle East",
  Guinean: "Africa & Middle East", Jordanian: "Africa & Middle East", Omani: "Africa & Middle East",
  Ugandan: "Africa & Middle East", Rwandan: "Africa & Middle East",
  Ethiopian: "Africa & Middle East", Malian: "Africa & Middle East",
  Congolese: "Africa & Middle East", Liberian: "Africa & Middle East",
  Malawian: "Africa & Middle East",
  // Oceania
  Australian: "Oceania", "New Zealander": "Oceania", Fijian: "Oceania",
  Samoan: "Oceania", Tahitian: "Oceania", "Papua New Guinean": "Oceania",
  Tongan: "Oceania", Vanuatuan: "Oceania",
};

// ── POST /api/dev/fix-youth-data ─────────────────────────────────────────────
// Idempotent maintenance: for every youth player in the DB —
//   1. Sets continent where it is NULL, using ADJECTIVE_NATIONALITY_CONTINENT
//   2. Caps age at 18 for any player exceeding the 14–18 youth age range

router.post("/dev/fix-youth-data", async (_req, res) => {
  try {
    const youth = await db.select().from(playersTable)
      // Retirement is career state and cannot filter a reference-row query.
      // These routes repair reference data on the athletes themselves, where
      // retirement in any one career is irrelevant.
      .where(eq(playersTable.playerType, "youth"));

    let continentFixed = 0;
    let ageFixed = 0;
    const unmapped: string[] = [];

    for (const p of youth) {
      const updates: Record<string, unknown> = {};

      // Fix missing continent
      if (!p.continent) {
        const resolved = ADJECTIVE_NATIONALITY_CONTINENT[p.nationality]
          ?? null;
        if (resolved) {
          updates.continent = resolved;
        } else {
          unmapped.push(`${p.name} (${p.nationality})`);
        }
      }

      // Cap the STARTING age at 18. The living age is career state; this
      // route repairs the reference row an academy prospect begins from.
      if (p.baseAge > 18) {
        updates.baseAge = 18;
        ageFixed++;
      }

      if (Object.keys(updates).length > 0) {
        await db.update(playersTable)
          .set(updates as Parameters<typeof db.update>[0] extends never ? never : Record<string, unknown>)
          .where(eq(playersTable.id, p.id));
        if (updates.continent) continentFixed++;
      }
    }

    res.json({
      ok: true,
      total: youth.length,
      continentFixed,
      ageFixed,
      unmappedNationalities: unmapped,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// ── Country-name nationality pools by DB continent (for new youth generation) ─
// Drawn from the canonical NATIONALITY_CONTINENT registry in olympics.ts.
const YOUTH_POOL_BY_CONTINENT: Record<ContinentKey, string[]> = {
  europe: [
    "Germany", "France", "Italy", "Spain", "Norway", "Sweden", "Denmark",
    "Netherlands", "Switzerland", "Poland", "Greece", "Portugal", "Austria",
    "Belgium", "Russia", "Czech Republic", "Finland", "Croatia", "Serbia",
    "Ukraine", "Hungary", "England", "Ireland", "Malta", "Monaco",
  ],
  north_america: [
    "USA", "Canada", "Mexico", "Cuba", "Jamaica", "Dominican Republic",
    "Puerto Rico", "Panama", "Costa Rica", "Bahamas",
  ],
  south_america: [
    "Brazil", "Argentina", "Colombia", "Chile", "Peru", "Venezuela",
    "Ecuador", "Bolivia", "Uruguay", "Guyana",
  ],
  asia: [
    "Japan", "China", "South Korea", "India", "Thailand", "Indonesia",
    "Philippines", "Vietnam", "Malaysia", "Taiwan", "Laos", "Maldives",
  ],
  africa_middle_east: [
    "Nigeria", "Egypt", "Kenya", "Morocco", "Tunisia", "South Africa",
    "Tanzania", "Zimbabwe", "Mozambique", "Madagascar", "Ghana", "Senegal",
    "Cameroon", "Algeria", "Burkina Faso", "Ivory Coast", "Guinea",
  ],
  oceania: [
    "Australia", "New Zealand", "Fiji", "Samoa", "Tahiti",
    "Papua New Guinea", "Tonga", "Vanuatu",
  ],
};

const GLOBAL_YOUTH_TARGET = 60;
const YOUTH_POOL_IMAGE = "/objects/youth-cards/youth-card.webp";
const YOUTH_POSITIONS = ["setter", "spiker", "defender", "blocker", "all_rounder"] as const;
const YOUTH_POTENTIALS = ["Below Average", "Average", "Average", "High", "High", "Elite"] as const;

const YOUTH_REPLENISH_NAMES: Record<ContinentKey, string[]> = {
  europe: [
    "Emma Müller", "Sofia Rossi", "Lena Andersen", "Maja Karlsson", "Klara Novak",
    "Ingrid Berg", "Elena Petrova", "Marta Kowalski", "Anna Horváth", "Laura Becker",
    "Julia Braun", "Marie Dupont", "Chiara Ferrari", "Astrid Larsen", "Petra Kováč",
    "Hanna Schulz", "Saoirse Murphy", "Sofia Alves", "Valentina Gruber", "Nia Žanić",
  ],
  north_america: [
    "Avery Thompson", "Riley Anderson", "Taylor Mitchell", "Morgan Wilson",
    "Jordan Davis", "Brooke Sullivan", "Paige Harris", "Sydney Clark",
    "Kayla Lewis", "Alexis Walker", "Maya Torres", "Isabella Reyes",
  ],
  south_america: [
    "Valentina García", "Camila Rodríguez", "Isabela Costa", "Lucía Fernández",
    "Sofía López", "Mariana Santos", "Gabriela Moreno", "Ana Lima",
    "Daniela Ruiz", "Paula Herrera", "Natalia Castro", "Andrea Vargas",
  ],
  asia: [
    "Yuki Tanaka", "Mei Lin", "Sakura Ito", "Ji-Young Park", "Priya Sharma",
    "Ananya Patel", "Nguyen Thi Mai", "Siti Rahma", "Yuna Kim", "Rin Sato",
    "Divya Nair", "Hana Suzuki", "Miku Yamamoto", "Aisyah Binti Ahmad",
  ],
  africa_middle_east: [
    "Amina Diallo", "Fatou Koné", "Aisha Okafor", "Nkechi Eze", "Abena Asante",
    "Nadia Hassan", "Layla Omar", "Zainab Musa", "Chiamaka Obi", "Efua Mensah",
    "Sara Ben Ammar", "Yasmin Traoré", "Fatoumata Bah", "Miriam Wanjiru",
  ],
  oceania: [
    "Zoe Harrison", "Chloe Martin", "Emma Wilson", "Lily Thompson",
    "Grace Anderson", "Mia Cooper", "Ella Davis", "Sophie Evans",
    "Aroha Tane", "Kezia Ratu",
  ],
};

// ── POST /api/dev/ensure-global-youth-pool ───────────────────────────────────
// Idempotent: counts all non-retired youth players and fills vacancies up to
// GLOBAL_YOUTH_TARGET (60). Distributes evenly across 6 continents.
// Only adds players — never removes existing youth.

router.post("/dev/ensure-global-youth-pool", async (_req, res) => {
  try {
    const allYouth = await db.select().from(playersTable)
      // Retirement is career state and cannot filter a reference-row query.
      // These routes repair reference data on the athletes themselves, where
      // retirement in any one career is irrelevant.
      .where(eq(playersTable.playerType, "youth"));

    const currentCount = allYouth.length;
    const vacancies = Math.max(0, GLOBAL_YOUTH_TARGET - currentCount);

    if (vacancies === 0) {
      res.json({ ok: true, added: 0, currentCount, message: "Pool already at or above target" });
      return;
    }

    // Count existing youth per continent to distribute vacancies fairly
    const continents = [...CONTINENT_KEYS];
    const countByCont: Record<string, number> = Object.fromEntries(
      continents.map(c => [c, allYouth.filter(p => p.continent === c).length])
    );

    const toAdd: Array<{ nationality: string; continent: ContinentKey }> = [];

    // Fill each continent up to its fair share (target / 6) first
    const perContinent = Math.floor(GLOBAL_YOUTH_TARGET / continents.length);
    for (const c of continents) {
      const needed = Math.max(0, perContinent - countByCont[c]!);
      const pool = YOUTH_POOL_BY_CONTINENT[c]!;
      for (let i = 0; i < needed && toAdd.length < vacancies; i++) {
        const nationality = pool[Math.floor(Math.random() * pool.length)]!;
        toAdd.push({ nationality, continent: c });
      }
    }

    // If still room, fill from continents with most deficit
    if (toAdd.length < vacancies) {
      let ci = 0;
      while (toAdd.length < vacancies) {
        const c = continents[ci % continents.length]!;
        const pool = YOUTH_POOL_BY_CONTINENT[c]!;
        const nationality = pool[Math.floor(Math.random() * pool.length)]!;
        toAdd.push({ nationality, continent: c });
        ci++;
      }
    }

    // Insert players
    const rand = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
    for (const { nationality, continent } of toAdd) {
      const namePool = YOUTH_REPLENISH_NAMES[continent];
      const name = namePool[Math.floor(Math.random() * namePool.length)]!;
      const age = rand(14, 18);
      const position = YOUTH_POSITIONS[Math.floor(Math.random() * YOUTH_POSITIONS.length)]!;
      const potential = YOUTH_POTENTIALS[Math.floor(Math.random() * YOUTH_POTENTIALS.length)]!;
      const stat = () => rand(30, 62);

      await db.insert(playersTable).values({
        name,
        nationality,
        baseAge: age,
        continent,
        position,
        potential,
        playerType: "youth",
        imageUrl: YOUTH_POOL_IMAGE,
        speed: stat(), power: stat(), defense: stat(),
        serve: stat(), block: stat(), stamina: stat(),
        height: Number((1.58 + Math.random() * 0.20).toFixed(1)),
      });
    }

    res.json({
      ok: true,
      added: toAdd.length,
      currentCount,
      newTotal: currentCount + toAdd.length,
      distribution: toAdd.reduce((acc, { continent }) => {
        acc[continent] = (acc[continent] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

export default router;
