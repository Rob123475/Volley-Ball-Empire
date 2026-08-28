import { db } from "@workspace/db";
import {
  locationsTable,
  clubTemplatesTable,
  playersTable,
  staffTable,
  outfitsTable,
} from "@workspace/db";

// ── Locations ────────────────────────────────────────────────────────────────

const locations = [
  { name: "Copacabana Beach",  country: "Brazil",       city: "Rio de Janeiro", courtType: "sand", description: "Iconic sun-soaked sand, home of world-class beach volleyball." },
  { name: "Bondi Beach",       country: "Australia",    city: "Sydney",         courtType: "sand", description: "Golden sand and rolling surf on Sydney's most famous coastline." },
  { name: "Cancún Shores",     country: "Mexico",       city: "Cancún",         courtType: "sand", description: "Turquoise Caribbean water meets pristine white sand." },
  { name: "Barceloneta",       country: "Spain",        city: "Barcelona",      courtType: "sand", description: "Mediterranean beach courts steps from the city." },
  { name: "South Beach",       country: "USA",          city: "Miami",         courtType: "sand", description: "Art deco skyline backdrop, high-energy beach scene." },
  { name: "Waikiki Sands",     country: "USA",          city: "Honolulu",      courtType: "sand", description: "Volcanic-sand courts under Diamond Head." },
  { name: "Phuket Cove",       country: "Thailand",     city: "Phuket",        courtType: "sand", description: "Tropical island courts with warm, humid conditions." },
  { name: "Gold Coast Strand", country: "Australia",    city: "Gold Coast",    courtType: "sand", description: "Wide, wind-swept beaches favored by power servers." },
  // World Tour venues referenced by locId 9/10/11 in worldTour.ts (Asia, Europe,
  // and Africa & Middle East legs) — ids must stay 9/10/11, so keep this
  // block last and never reorder the array above it.
  { name: "Kuta Beach",           country: "Indonesia", city: "Bali",     courtType: "sand", description: "Tropical Balinese sand courts with warm afternoon squalls." },
  { name: "Côte d'Azur Beach",    country: "France",    city: "Nice",     courtType: "sand", description: "Mediterranean courts along the French Riviera, variable winds." },
  { name: "Red Sea Beach",        country: "Egypt",     city: "Hurghada", courtType: "sand", description: "Desert heat meets Red Sea coral reefs." },
];

// ── Club templates ──────────────────────────────────────────────────────────

const clubTemplates = [
  { name: "Rio Storm Volleyball",      continent: "South America", town: "Rio de Janeiro", rating: 68, startingBudget: 450000, reputation: 55, primaryColor: "#00A651", secondaryColor: "#FFDF00" },
  { name: "Sydney Riptide",            continent: "Oceania",       town: "Sydney",          rating: 62, startingBudget: 400000, reputation: 48, primaryColor: "#0072CE", secondaryColor: "#FFFFFF" },
  { name: "Cancún Marlins",            continent: "North America", town: "Cancún",          rating: 58, startingBudget: 380000, reputation: 42, primaryColor: "#00B4D8", secondaryColor: "#F4A261" },
  { name: "Barcelona Onada",           continent: "Europe",        town: "Barcelona",       rating: 71, startingBudget: 520000, reputation: 60, primaryColor: "#A6192E", secondaryColor: "#FFC72C" },
  { name: "Miami SandStorm",           continent: "North America", town: "Miami",           rating: 65, startingBudget: 430000, reputation: 50, primaryColor: "#FF6EC7", secondaryColor: "#00D9C0" },
  { name: "Honolulu Wave Riders",      continent: "Oceania",       town: "Honolulu",        rating: 55, startingBudget: 350000, reputation: 38, primaryColor: "#FF8C42", secondaryColor: "#2A9D8F" },
  { name: "Phuket Monsoon",            continent: "Asia",          town: "Phuket",          rating: 52, startingBudget: 320000, reputation: 35, primaryColor: "#5C2A9D", secondaryColor: "#F4E04D" },
  { name: "Gold Coast Breakers",       continent: "Oceania",       town: "Gold Coast",      rating: 60, startingBudget: 400000, reputation: 45, primaryColor: "#003366", secondaryColor: "#FFD700" },
  { name: "Ibiza Sunset FC",           continent: "Europe",        town: "Ibiza",           rating: 66, startingBudget: 460000, reputation: 52, primaryColor: "#FF4500", secondaryColor: "#4B0082" },
  { name: "Maldives Coral Kings",      continent: "Asia",          town: "Malé",            rating: 50, startingBudget: 300000, reputation: 30, primaryColor: "#00CED1", secondaryColor: "#FFFFFF" },
];

// ── Free-agent players (unassigned, teamId null) ────────────────────────────

const positions = ["universal", "blocker", "defender"] as const;
const nationalities = ["Brazil", "USA", "Australia", "Poland", "Italy", "Germany", "Netherlands", "Norway", "Argentina", "Japan"];

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeFreeAgentPlayer(name: string, i: number) {
  const base = randomInt(55, 78);
  return {
    name,
    nationality: nationalities[i % nationalities.length],
    baseAge: randomInt(18, 33),
    height: Number((170 + randomInt(0, 25)).toFixed(1)),
    position: positions[i % positions.length],
    speed:   base + randomInt(-8, 8),
    power:   base + randomInt(-8, 8),
    defense: base + randomInt(-8, 8),
    serve:   base + randomInt(-8, 8),
    block:   base + randomInt(-8, 8),
    stamina: base + randomInt(-8, 8),
    salary:  Number((3000 + base * 40).toFixed(2)),
    potential: base > 72 ? "High" : base > 62 ? "Average" : "Low",
  };
}

const freeAgentNames = [
  "Lucas Ferreira", "Jake Sullivan", "Marco Rossi", "Kenji Watanabe", "Erik Johansson",
  "Diego Alvarez", "Tomasz Nowak", "Ryan Cooper", "Felipe Santos", "Anders Berg",
  "Bruno Costa", "Sam Whitfield", "Nikolai Petrov", "Rafael Gomez", "Owen Clarke",
  "Mateus Silva", "Jack Harrington", "Pedro Almeida", "Ollie Baxter", "Thiago Lima",
  "Carlos Mendez", "Liam Foster", "Andre Souza", "Noah Bennett", "Gustavo Reyes",
  "Ethan Marsh", "Rodrigo Pinto", "Callum Reid", "Vitor Araujo", "Harry Nolan",
];

const freeAgentPlayers = freeAgentNames.map((name, i) => makeFreeAgentPlayer(name, i));

// ── Free-agent staff (unassigned, teamId null) ──────────────────────────────

const staffRoles = ["head_coach", "assistant_coach", "physio", "scout", "fitness_trainer"] as const;
const staffNames = [
  "Roberto Alves", "Karen Whitman", "Fabio Bianchi", "Sandra Mueller", "Peter Larsson",
  "Isabel Marquez", "Tom Bradley", "Yuki Tanaka", "Klaus Weber", "Nadia Kowalski",
  "Simon Clarke", "Priya Sharma", "Henrik Olsen", "Claudia Ferrari", "David Okafor",
];

function makeFreeAgentStaff(name: string, i: number) {
  const skill = randomInt(45, 85);
  return {
    name,
    role: staffRoles[i % staffRoles.length],
    specialty: "General",
    salary: Number((2000 + skill * 30).toFixed(2)),
    skillLevel: skill,
    age: randomInt(28, 60),
    overallRating: skill,
    coachSpeciality: "General",
    personality: ["Motivator", "Tactician", "Disciplinarian", "Calm"][i % 4],
  };
}

const freeAgentStaff = staffNames.map((name, i) => makeFreeAgentStaff(name, i));

// ── Outfits ──────────────────────────────────────────────────────────────────

const outfits = [
  { name: "Classic Whites", primaryColor: "#FFFFFF", secondaryColor: "#000000", description: "Clean, timeless kit.", price: 0 },
  { name: "Sunset Stripe",  primaryColor: "#FF6B35", secondaryColor: "#F7C59F", description: "Warm gradient kit.", price: 500 },
  { name: "Ocean Fade",     primaryColor: "#00B4D8", secondaryColor: "#0077B6", description: "Cool blue tones.", price: 500 },
  { name: "Neon Rush",      primaryColor: "#39FF14", secondaryColor: "#000000", description: "Bold high-visibility kit.", price: 1200 },
  { name: "Championship Gold", primaryColor: "#FFD700", secondaryColor: "#8B0000", description: "Premium kit for title contenders.", price: 2500 },
];

// ── Run ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Seeding initial world data...");

  const existingLocations = await db.select().from(locationsTable);
  if (existingLocations.length === 0) {
    await db.insert(locationsTable).values(locations);
    console.log(`Inserted ${locations.length} locations`);
  } else {
    console.log(`Skipped locations — ${existingLocations.length} already exist`);
  }

  const existingClubs = await db.select().from(clubTemplatesTable);
  if (existingClubs.length === 0) {
     await db.insert(clubTemplatesTable).values(clubTemplates as any);
    console.log(`Inserted ${clubTemplates.length} club templates`);
  } else {
    console.log(`Skipped club templates — ${existingClubs.length} already exist`);
  }

  const existingPlayers = await db.select().from(playersTable);
  if (existingPlayers.length === 0) {
    await db.insert(playersTable).values(freeAgentPlayers);
    console.log(`Inserted ${freeAgentPlayers.length} free-agent players`);
  } else {
    console.log(`Skipped players — ${existingPlayers.length} already exist`);
  }

  const existingStaff = await db.select().from(staffTable);
  if (existingStaff.length === 0) {
    await db.insert(staffTable).values(freeAgentStaff);
    console.log(`Inserted ${freeAgentStaff.length} free-agent staff`);
  } else {
    console.log(`Skipped staff — ${existingStaff.length} already exist`);
  }

  const existingOutfits = await db.select().from(outfitsTable);
  if (existingOutfits.length === 0) {
   await db.insert(outfitsTable).values(outfits as any);
    console.log(`Inserted ${outfits.length} outfits`);
  } else {
    console.log(`Skipped outfits — ${existingOutfits.length} already exist`);
  }

  console.log("Seed complete!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
