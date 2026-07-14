/**
 * Migrates the active season to the 78-slot schedule.
 * Run: pnpm --filter @workspace/scripts run migrate-season-78
 */
import { db, matchesTable, seasonsTable, calendarStateTable, teamsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const WEATHER_CONDITIONS = ["sunny", "clear", "cloudy", "windy", "hot", "overcast", "perfect"];
function quickWeather() {
  const w = WEATHER_CONDITIONS[Math.floor(Math.random() * WEATHER_CONDITIONS.length)]!;
  const wind = String((Math.random() * 20).toFixed(1));
  const temp = String((22 + Math.random() * 15).toFixed(1));
  return { weather: w, windSpeed: wind, temperature: temp };
}

// Inline WT data — same 62-entry structure as worldTour.ts
type Tier = "Bronze" | "Silver" | "Gold" | "Elite" | "Continental Final" | "World Semi Final" | "All-Star Match" | "World Final";
interface WTEvent {
  round: number; continent: string; country: string; city: string;
  beachName: string; displayName: string; date: string; locId: number;
  locName: string; opponent: string; prize: number; tier: Tier;
}

const WORLD_TOUR: WTEvent[] = [
  // Asia (slots 11–20)
  { round: 11, continent: "Asia", country: "Thailand", city: "Phuket", beachName: "Kata Beach", displayName: "Phuket Beach Classic", date: "2026-02-17", locId: 7, locName: "Kata Beach, Phuket", opponent: "Pacific Storm USA", prize: 6000, tier: "Bronze" },
  { round: 12, continent: "Asia", country: "Indonesia", city: "Bali", beachName: "Kuta Beach", displayName: "Bali Kuta Open", date: "2026-02-22", locId: 9, locName: "Kuta Beach, Bali", opponent: "Rio Serpents BRA", prize: 7000, tier: "Bronze" },
  { round: 13, continent: "Asia", country: "Vietnam", city: "Da Nang", beachName: "My Khe Beach", displayName: "Da Nang My Khe Open", date: "2026-02-26", locId: 7, locName: "My Khe Beach, Da Nang", opponent: "Sand Queens AU", prize: 7500, tier: "Bronze" },
  { round: 14, continent: "Asia", country: "Thailand", city: "Pattaya", beachName: "Jomtien Beach", displayName: "Pattaya Gulf Classic", date: "2026-03-03", locId: 7, locName: "Jomtien Beach, Pattaya", opponent: "Tropical Blaze CUB", prize: 8000, tier: "Bronze" },
  { round: 15, continent: "Asia", country: "Malaysia", city: "Penang", beachName: "Batu Ferringhi Beach", displayName: "Penang Shore Bronze", date: "2026-03-08", locId: 9, locName: "Batu Ferringhi Beach, Penang", opponent: "Iron Wave CHI", prize: 8500, tier: "Bronze" },
  { round: 16, continent: "Asia", country: "Indonesia", city: "Lombok", beachName: "Selong Belanak Beach", displayName: "Lombok Shore Silver", date: "2026-03-12", locId: 9, locName: "Selong Belanak, Lombok", opponent: "Greek Fire GRE", prize: 12000, tier: "Silver" },
  { round: 17, continent: "Asia", country: "South Korea", city: "Jeju", beachName: "Hyeopjae Beach", displayName: "Jeju Island Silver Open", date: "2026-03-17", locId: 7, locName: "Hyeopjae Beach, Jeju", opponent: "French Riviera FRA", prize: 14000, tier: "Silver" },
  { round: 18, continent: "Asia", country: "Japan", city: "Okinawa", beachName: "Emerald Beach", displayName: "Okinawa Gold Series", date: "2026-03-22", locId: 7, locName: "Emerald Beach, Okinawa", opponent: "Island Aces THA", prize: 22000, tier: "Gold" },
  { round: 19, continent: "Asia", country: "Thailand", city: "Koh Samui", beachName: "Chaweng Beach", displayName: "Samui Gold Masters", date: "2026-03-27", locId: 7, locName: "Chaweng Beach, Koh Samui", opponent: "Bali Tigers IDN", prize: 25000, tier: "Gold" },
  { round: 20, continent: "Asia", country: "India", city: "Goa", beachName: "Vagator Beach", displayName: "Goa Gold Open", date: "2026-03-31", locId: 9, locName: "Vagator Beach, Goa", opponent: "Storm Queens USA", prize: 28000, tier: "Gold" },
  // Australia & Pacific (slots 21–30)
  { round: 21, continent: "Australia & Pacific", country: "Fiji", city: "Nadi", beachName: "Natadola Beach", displayName: "Fiji Natadola Open", date: "2026-04-05", locId: 2, locName: "Natadola Beach, Nadi", opponent: "Pacific Storm USA", prize: 6500, tier: "Bronze" },
  { round: 22, continent: "Australia & Pacific", country: "Samoa", city: "Apia", beachName: "Return to Paradise Beach", displayName: "Samoa Paradise Cup", date: "2026-04-10", locId: 2, locName: "Return to Paradise Beach, Apia", opponent: "Rio Serpents BRA", prize: 7000, tier: "Bronze" },
  { round: 23, continent: "Australia & Pacific", country: "Vanuatu", city: "Port Vila", beachName: "Pango Beach", displayName: "Vanuatu Pacific Open", date: "2026-04-15", locId: 2, locName: "Pango Beach, Port Vila", opponent: "Sand Queens AU", prize: 7500, tier: "Bronze" },
  { round: 24, continent: "Australia & Pacific", country: "Australia", city: "Brisbane", beachName: "Surfers Paradise", displayName: "Surfers Paradise Bronze", date: "2026-04-19", locId: 2, locName: "Surfers Paradise, Brisbane", opponent: "Tropical Blaze CUB", prize: 8000, tier: "Bronze" },
  { round: 25, continent: "Australia & Pacific", country: "French Polynesia", city: "Bora Bora", beachName: "Matira Beach", displayName: "Bora Bora Bronze Classic", date: "2026-04-24", locId: 2, locName: "Matira Beach, Bora Bora", opponent: "Iron Wave CHI", prize: 8500, tier: "Bronze" },
  { round: 26, continent: "Australia & Pacific", country: "New Zealand", city: "Auckland", beachName: "Piha Beach", displayName: "Piha Silver Classic", date: "2026-04-29", locId: 2, locName: "Piha Beach, Auckland", opponent: "Greek Fire GRE", prize: 13000, tier: "Silver" },
  { round: 27, continent: "Australia & Pacific", country: "New Caledonia", city: "Noumea", beachName: "Anse Vata Beach", displayName: "Noumea Pacific Silver", date: "2026-05-03", locId: 2, locName: "Anse Vata Beach, Noumea", opponent: "French Riviera FRA", prize: 14000, tier: "Silver" },
  { round: 28, continent: "Australia & Pacific", country: "Fiji", city: "Pacific Harbour", beachName: "Pacific Harbour Beach", displayName: "Fiji Gold Series", date: "2026-05-08", locId: 2, locName: "Pacific Harbour Beach, Fiji", opponent: "Island Aces THA", prize: 18000, tier: "Silver" },
  { round: 29, continent: "Australia & Pacific", country: "Australia", city: "Cairns", beachName: "Mission Beach", displayName: "Cairns Tropics Gold", date: "2026-05-13", locId: 2, locName: "Mission Beach, Cairns", opponent: "Bali Tigers IDN", prize: 24000, tier: "Gold" },
  { round: 30, continent: "Australia & Pacific", country: "Australia", city: "Sydney", beachName: "Bondi Beach", displayName: "Bondi Gold Masters", date: "2026-05-18", locId: 2, locName: "Bondi Beach, Sydney", opponent: "Storm Queens USA", prize: 28000, tier: "Gold" },
  // Europe (slots 31–40)
  { round: 31, continent: "Europe", country: "Portugal", city: "Cascais", beachName: "Guincho Beach", displayName: "Cascais Atlantic Open", date: "2026-05-22", locId: 10, locName: "Guincho Beach, Cascais", opponent: "Pacific Storm USA", prize: 6000, tier: "Bronze" },
  { round: 32, continent: "Europe", country: "Italy", city: "Rimini", beachName: "Rimini Beach", displayName: "Rimini Riviera Cup", date: "2026-05-27", locId: 8, locName: "Rimini Beach, Italy", opponent: "Rio Serpents BRA", prize: 7000, tier: "Bronze" },
  { round: 33, continent: "Europe", country: "Croatia", city: "Poreč", beachName: "Plava Laguna Beach", displayName: "Poreč Adriatic Open", date: "2026-06-01", locId: 8, locName: "Plava Laguna Beach, Poreč", opponent: "Sand Queens AU", prize: 7500, tier: "Bronze" },
  { round: 34, continent: "Europe", country: "Turkey", city: "Antalya", beachName: "Konyaaltı Beach", displayName: "Antalya Beach Pro", date: "2026-06-06", locId: 11, locName: "Konyaaltı Beach, Antalya", opponent: "Tropical Blaze CUB", prize: 8000, tier: "Bronze" },
  { round: 35, continent: "Europe", country: "Netherlands", city: "The Hague", beachName: "Scheveningen Beach", displayName: "Scheveningen Bronze Cup", date: "2026-06-10", locId: 10, locName: "Scheveningen Beach, The Hague", opponent: "Iron Wave CHI", prize: 8500, tier: "Bronze" },
  { round: 36, continent: "Europe", country: "Spain", city: "Barcelona", beachName: "Barceloneta Beach", displayName: "Barcelona City Open", date: "2026-06-15", locId: 10, locName: "Barceloneta Beach, Barcelona", opponent: "Greek Fire GRE", prize: 13000, tier: "Silver" },
  { round: 37, continent: "Europe", country: "France", city: "Nice", beachName: "Côte d'Azur Beach", displayName: "Nice Riviera Classic", date: "2026-06-20", locId: 10, locName: "Côte d'Azur Beach, Nice", opponent: "French Riviera FRA", prize: 14000, tier: "Silver" },
  { round: 38, continent: "Europe", country: "Germany", city: "Hamburg", beachName: "Timmendorfer Strand", displayName: "Hamburg North Open", date: "2026-06-24", locId: 10, locName: "Timmendorfer Strand, Hamburg", opponent: "Island Aces THA", prize: 23000, tier: "Gold" },
  { round: 39, continent: "Europe", country: "Greece", city: "Mykonos", beachName: "Super Paradise Beach", displayName: "Mykonos Gold Masters", date: "2026-06-29", locId: 8, locName: "Super Paradise Beach, Mykonos", opponent: "Bali Tigers IDN", prize: 26000, tier: "Gold" },
  { round: 40, continent: "Europe", country: "Spain", city: "Valencia", beachName: "Playa de la Malvarrosa", displayName: "Valencia Gold Open", date: "2026-07-04", locId: 10, locName: "Playa Malvarrosa, Valencia", opponent: "Storm Queens USA", prize: 29000, tier: "Gold" },
  // Africa & Middle East (slots 41–50)
  { round: 41, continent: "Africa & Middle East", country: "Egypt", city: "Hurghada", beachName: "Red Sea Beach", displayName: "Hurghada Red Sea Open", date: "2026-07-09", locId: 11, locName: "Red Sea Beach, Hurghada", opponent: "Pacific Storm USA", prize: 5500, tier: "Bronze" },
  { round: 42, continent: "Africa & Middle East", country: "Morocco", city: "Agadir", beachName: "Agadir Beach", displayName: "Agadir Atlantic Open", date: "2026-07-13", locId: 10, locName: "Agadir Beach, Morocco", opponent: "Rio Serpents BRA", prize: 6500, tier: "Bronze" },
  { round: 43, continent: "Africa & Middle East", country: "Kenya", city: "Diani", beachName: "Diani Beach", displayName: "Diani Indian Ocean Open", date: "2026-07-18", locId: 11, locName: "Diani Beach, Kenya", opponent: "Sand Queens AU", prize: 7000, tier: "Bronze" },
  { round: 44, continent: "Africa & Middle East", country: "Senegal", city: "Dakar", beachName: "Plage de Yoff", displayName: "Dakar Atlantic Cup", date: "2026-07-23", locId: 11, locName: "Plage de Yoff, Dakar", opponent: "Tropical Blaze CUB", prize: 7500, tier: "Bronze" },
  { round: 45, continent: "Africa & Middle East", country: "Tanzania", city: "Zanzibar", beachName: "Nungwi Beach", displayName: "Zanzibar Bronze Open", date: "2026-07-28", locId: 11, locName: "Nungwi Beach, Zanzibar", opponent: "Iron Wave CHI", prize: 8000, tier: "Bronze" },
  { round: 46, continent: "Africa & Middle East", country: "South Africa", city: "Cape Town", beachName: "Clifton Beach", displayName: "Cape Town Silver Open", date: "2026-08-01", locId: 2, locName: "Clifton Beach, Cape Town", opponent: "Greek Fire GRE", prize: 12000, tier: "Silver" },
  { round: 47, continent: "Africa & Middle East", country: "Morocco", city: "Essaouira", beachName: "Mogador Beach", displayName: "Essaouira Wind Classic", date: "2026-08-06", locId: 10, locName: "Mogador Beach, Essaouira", opponent: "French Riviera FRA", prize: 13000, tier: "Silver" },
  { round: 48, continent: "Africa & Middle East", country: "UAE", city: "Dubai", beachName: "Jumeirah Beach", displayName: "Dubai Desert Pro", date: "2026-08-11", locId: 11, locName: "Jumeirah Beach, Dubai", opponent: "Island Aces THA", prize: 15000, tier: "Silver" },
  { round: 49, continent: "Africa & Middle East", country: "Israel", city: "Tel Aviv", beachName: "Gordon Beach", displayName: "Tel Aviv Gold Open", date: "2026-08-15", locId: 11, locName: "Gordon Beach, Tel Aviv", opponent: "Bali Tigers IDN", prize: 23000, tier: "Gold" },
  { round: 50, continent: "Africa & Middle East", country: "Oman", city: "Muscat", beachName: "Qurum Beach", displayName: "Muscat Gulf Masters", date: "2026-08-20", locId: 11, locName: "Qurum Beach, Muscat", opponent: "Storm Queens USA", prize: 26000, tier: "Gold" },
  // North America (slots 51–60)
  { round: 51, continent: "North America", country: "Mexico", city: "Cancún", beachName: "Playa Delfines", displayName: "Cancún Open", date: "2026-08-25", locId: 5, locName: "Playa Delfines, Cancún", opponent: "Pacific Storm USA", prize: 5000, tier: "Bronze" },
  { round: 52, continent: "North America", country: "USA", city: "Miami", beachName: "South Beach", displayName: "Miami Beach Open", date: "2026-08-30", locId: 4, locName: "South Beach, Miami", opponent: "Rio Serpents BRA", prize: 6000, tier: "Bronze" },
  { round: 53, continent: "North America", country: "Mexico", city: "Tulum", beachName: "Playa Paraíso", displayName: "Tulum Jungle Cup", date: "2026-09-03", locId: 5, locName: "Playa Paraíso, Tulum", opponent: "Sand Queens AU", prize: 7500, tier: "Bronze" },
  { round: 54, continent: "North America", country: "Puerto Rico", city: "San Juan", beachName: "Condado Beach", displayName: "San Juan Caribbean Open", date: "2026-09-08", locId: 5, locName: "Condado Beach, San Juan", opponent: "Tropical Blaze CUB", prize: 8000, tier: "Bronze" },
  { round: 55, continent: "North America", country: "Dominican Republic", city: "Punta Cana", beachName: "Bávaro Beach", displayName: "Bávaro Bronze Classic", date: "2026-09-13", locId: 5, locName: "Bávaro Beach, Punta Cana", opponent: "Iron Wave CHI", prize: 8500, tier: "Bronze" },
  { round: 56, continent: "North America", country: "USA", city: "Los Angeles", beachName: "Manhattan Beach", displayName: "LA Beach Pro", date: "2026-09-18", locId: 4, locName: "Manhattan Beach, Los Angeles", opponent: "Greek Fire GRE", prize: 11000, tier: "Silver" },
  { round: 57, continent: "North America", country: "Bahamas", city: "Nassau", beachName: "Cable Beach", displayName: "Nassau Shore Classic", date: "2026-09-22", locId: 5, locName: "Cable Beach, Nassau", opponent: "French Riviera FRA", prize: 13000, tier: "Silver" },
  { round: 58, continent: "North America", country: "Costa Rica", city: "Jacó", beachName: "Playa Jacó", displayName: "Jacó Pacific Wave", date: "2026-09-27", locId: 5, locName: "Playa Jacó, Costa Rica", opponent: "Island Aces THA", prize: 14000, tier: "Silver" },
  { round: 59, continent: "North America", country: "USA", city: "Honolulu", beachName: "Waikiki Beach", displayName: "Waikiki Masters", date: "2026-10-02", locId: 3, locName: "Waikiki Beach, Honolulu", opponent: "Bali Tigers IDN", prize: 22000, tier: "Gold" },
  { round: 60, continent: "North America", country: "Canada", city: "Vancouver", beachName: "English Bay Beach", displayName: "Vancouver Bay Open", date: "2026-10-06", locId: 4, locName: "English Bay Beach, Vancouver", opponent: "Storm Queens USA", prize: 25000, tier: "Gold" },
  // South America (slots 61–70)
  { round: 61, continent: "South America", country: "Colombia", city: "Cartagena", beachName: "Playa Blanca", displayName: "Cartagena Beach Cup", date: "2026-10-11", locId: 1, locName: "Playa Blanca, Cartagena", opponent: "Pacific Storm USA", prize: 5500, tier: "Bronze" },
  { round: 62, continent: "South America", country: "Peru", city: "Lima", beachName: "Costa Verde Beach", displayName: "Lima Pacific Open", date: "2026-10-16", locId: 6, locName: "Costa Verde Beach, Lima", opponent: "Rio Serpents BRA", prize: 6500, tier: "Bronze" },
  { round: 63, continent: "South America", country: "Ecuador", city: "Salinas", beachName: "Playa de Chipipe", displayName: "Salinas Shore Open", date: "2026-10-21", locId: 5, locName: "Playa de Chipipe, Salinas", opponent: "Sand Queens AU", prize: 7500, tier: "Bronze" },
  { round: 64, continent: "South America", country: "Brazil", city: "Florianópolis", beachName: "Joaquina Beach", displayName: "Florianópolis Open", date: "2026-10-25", locId: 6, locName: "Joaquina Beach, Florianópolis", opponent: "Tropical Blaze CUB", prize: 8000, tier: "Bronze" },
  { round: 65, continent: "South America", country: "Chile", city: "Viña del Mar", beachName: "Playa de Viña", displayName: "Viña del Mar Bronze Cup", date: "2026-10-30", locId: 6, locName: "Playa de Viña, Viña del Mar", opponent: "Iron Wave CHI", prize: 8500, tier: "Bronze" },
  { round: 66, continent: "South America", country: "Argentina", city: "Mar del Plata", beachName: "Playa Bristol", displayName: "Plata Silver Classic", date: "2026-11-04", locId: 6, locName: "Playa Bristol, Mar del Plata", opponent: "French Riviera FRA", prize: 12000, tier: "Silver" },
  { round: 67, continent: "South America", country: "Uruguay", city: "Punta del Este", beachName: "Playa Brava", displayName: "Punta del Este Pro", date: "2026-11-09", locId: 6, locName: "Playa Brava, Punta del Este", opponent: "Greek Fire GRE", prize: 13000, tier: "Silver" },
  { round: 68, continent: "South America", country: "Chile", city: "Iquique", beachName: "Cavancha Beach", displayName: "Iquique Desert Classic", date: "2026-11-13", locId: 6, locName: "Cavancha Beach, Iquique", opponent: "Island Aces THA", prize: 14000, tier: "Silver" },
  { round: 69, continent: "South America", country: "Brazil", city: "Fortaleza", beachName: "Iracema Beach", displayName: "Fortaleza Gold Cup", date: "2026-11-18", locId: 6, locName: "Iracema Beach, Fortaleza", opponent: "Bali Tigers IDN", prize: 22000, tier: "Gold" },
  { round: 70, continent: "South America", country: "Colombia", city: "Barranquilla", beachName: "Salgar Beach", displayName: "Barranquilla Gold Open", date: "2026-11-23", locId: 1, locName: "Salgar Beach, Barranquilla", opponent: "Storm Queens USA", prize: 25000, tier: "Gold" },
  // Finals (slots 71–72)
  { round: 71, continent: "World", country: "Brazil", city: "Rio de Janeiro", beachName: "Copacabana Beach", displayName: "World Finals — Semifinals", date: "2026-11-27", locId: 1, locName: "Copacabana Beach, Rio de Janeiro", opponent: "TBD", prize: 150000, tier: "World Semi Final" },
  { round: 72, continent: "World", country: "Brazil", city: "Rio de Janeiro", beachName: "Copacabana Beach", displayName: "World Beach Pro Series Final", date: "2026-12-02", locId: 1, locName: "Copacabana Beach, Rio de Janeiro", opponent: "TBD", prize: 500000, tier: "World Final" },
];

async function main() {
  console.log("=== migrate-season-78 ===");

  // 1. Active season
  const seasons = await db.select().from(seasonsTable).where(eq(seasonsTable.status, "active")).limit(1);
  const season = seasons[0];
  if (!season) { console.error("No active season"); process.exit(1); }
  console.log(`Season: ${season.name} (year ${season.year}, id ${season.id})`);

  // 2. Teams
  const teams = await db.select({ id: teamsTable.id, name: teamsTable.name }).from(teamsTable);
  console.log(`Teams: ${teams.map(t => `${t.name}(${t.id})`).join(", ")}`);

  // 3. Delete all existing matches for the season
  await db.delete(matchesTable).where(eq(matchesTable.season, season.year));
  console.log(`Deleted all matches for season ${season.year}`);

  // 4. Update season to 78 rounds
  await db.update(seasonsTable)
    .set({ totalRounds: 78, currentRound: 1, regionalRoundsProcessed: 0 })
    .where(eq(seasonsTable.id, season.id));
  console.log("Season updated: totalRounds=78, currentRound=1, regionalRoundsProcessed=0");

  // 5. Seed matches: one per team per WT event (62 events × N teams)
  const matchRows: Array<typeof matchesTable.$inferInsert> = [];
  for (const team of teams) {
    for (const event of WORLD_TOUR) {
      const { weather, windSpeed, temperature } = quickWeather();
      matchRows.push({
        homeTeamId:   team.id,
        awayTeamId:   team.id,
        homeTeamName: team.name,
        awayTeamName: event.opponent,
        locationId:   event.locId,
        locationName: event.locName,
        season:       season.year,
        round:        event.round,
        tier:         event.tier,
        continent:    event.continent,
        scheduledAt:  event.date,
        prizeAmount:  String(event.prize),
        status:       "scheduled",
        teamSize:     2,
        weather,
        windSpeed,
        temperature,
      });
    }
  }

  const BATCH = 100;
  let inserted = 0;
  for (let i = 0; i < matchRows.length; i += BATCH) {
    await db.insert(matchesTable).values(matchRows.slice(i, i + BATCH));
    inserted += Math.min(BATCH, matchRows.length - i);
  }
  console.log(`Inserted ${inserted} matches (${WORLD_TOUR.length} events × ${teams.length} teams)`);

  // 6. Reset calendar state
  await db.update(calendarStateTable).set({
    currentDate:    season.startDate,
    pendingMatchId: null,
    lastSalaryDate: season.startDate,
    calendarSpeed:  "pause",
  });
  console.log("Calendar state reset to season start");

  console.log("=== Done ===");
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
