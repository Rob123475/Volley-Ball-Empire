/**
 * Seeds continental pool teams and players for the regional league system.
 * 6 active + 2 bench teams per continent = 48 teams, 96 players total.
 *
 * Run: pnpm --filter @workspace/scripts run seed-regional-leagues
 */
import { db } from "@workspace/db";
import {
  continentalPoolTeamsTable,
  continentalPoolPlayersTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

type TeamDef = {
  stableId: string;
  name: string;
  tier: "active" | "bench";
  seededIndex: number;
  strength: number;
  logoColor: string;
  players: [{ name: string; position: string; overall: number }, { name: string; position: string; overall: number }];
};

const POOL: Record<string, TeamDef[]> = {
  "Europe": [
    { stableId: "EUR_01", name: "Berlin Sand Queens",      tier: "active", seededIndex: 1,  strength: 88, logoColor: "#1a1a2e", players: [{ name: "Annika Bauer",       position: "blocker",     overall: 89 }, { name: "Sophie Müller",     position: "defender",    overall: 86 }] },
    { stableId: "EUR_02", name: "Barcelona Playa Elites",  tier: "active", seededIndex: 2,  strength: 85, logoColor: "#c0392b", players: [{ name: "María Alonso",       position: "all_rounder", overall: 86 }, { name: "Carmen Ruiz",       position: "blocker",     overall: 83 }] },
    { stableId: "EUR_03", name: "Paris Sables Royales",    tier: "active", seededIndex: 3,  strength: 82, logoColor: "#2c3e50", players: [{ name: "Élise Fontaine",     position: "defender",    overall: 83 }, { name: "Céline Moreau",     position: "blocker",     overall: 80 }] },
    { stableId: "EUR_04", name: "Rome Beach Gladiators",   tier: "active", seededIndex: 4,  strength: 79, logoColor: "#8e44ad", players: [{ name: "Giulia Ricci",       position: "blocker",     overall: 80 }, { name: "Valentina Bianchi", position: "defender",    overall: 77 }] },
    { stableId: "EUR_05", name: "Amsterdam Dune Riders",   tier: "active", seededIndex: 5,  strength: 76, logoColor: "#e67e22", players: [{ name: "Emma van Dijk",      position: "all_rounder", overall: 77 }, { name: "Lisa de Boer",      position: "defender",    overall: 74 }] },
    { stableId: "EUR_06", name: "Athens Aegean Stars",     tier: "active", seededIndex: 6,  strength: 73, logoColor: "#27ae60", players: [{ name: "Eleni Papadaki",     position: "blocker",     overall: 74 }, { name: "Niki Stavros",      position: "all_rounder", overall: 71 }] },
    { stableId: "EUR_07", name: "Warsaw Vistula Waves",    tier: "bench",  seededIndex: 7,  strength: 70, logoColor: "#e74c3c", players: [{ name: "Agnieszka Kowal",    position: "defender",    overall: 71 }, { name: "Marta Wiśniewska",  position: "blocker",     overall: 68 }] },
    { stableId: "EUR_08", name: "Stockholm Northern Lights",tier:"bench",  seededIndex: 8,  strength: 67, logoColor: "#2980b9", players: [{ name: "Ingrid Larsson",     position: "blocker",     overall: 68 }, { name: "Astrid Eriksson",   position: "defender",    overall: 65 }] },
  ],
  "Asia": [
    { stableId: "ASI_01", name: "Tokyo Surf Samurai",       tier: "active", seededIndex: 1,  strength: 87, logoColor: "#c0392b", players: [{ name: "Yuki Tanaka",        position: "defender",    overall: 88 }, { name: "Aoi Yamamoto",      position: "blocker",     overall: 85 }] },
    { stableId: "ASI_02", name: "Shanghai Yangtze Elites",  tier: "active", seededIndex: 2,  strength: 84, logoColor: "#e74c3c", players: [{ name: "Wei Lin",            position: "blocker",     overall: 85 }, { name: "Jing Chen",         position: "all_rounder", overall: 82 }] },
    { stableId: "ASI_03", name: "Seoul Han River Queens",   tier: "active", seededIndex: 3,  strength: 81, logoColor: "#2c3e50", players: [{ name: "Ji-Yeon Park",       position: "all_rounder", overall: 82 }, { name: "Min-Seo Kim",       position: "defender",    overall: 79 }] },
    { stableId: "ASI_04", name: "Bangkok Palm Beach Stars", tier: "active", seededIndex: 4,  strength: 78, logoColor: "#27ae60", players: [{ name: "Nisa Suwannaphat",   position: "blocker",     overall: 79 }, { name: "Pimchanok Meesuk",  position: "defender",    overall: 76 }] },
    { stableId: "ASI_05", name: "Mumbai Coastal Warriors",  tier: "active", seededIndex: 5,  strength: 75, logoColor: "#f39c12", players: [{ name: "Priya Sharma",       position: "defender",    overall: 76 }, { name: "Ananya Nair",       position: "all_rounder", overall: 73 }] },
    { stableId: "ASI_06", name: "Bali Island Legends",      tier: "active", seededIndex: 6,  strength: 72, logoColor: "#e67e22", players: [{ name: "Dewi Santoso",       position: "blocker",     overall: 73 }, { name: "Sari Wulandari",    position: "defender",    overall: 70 }] },
    { stableId: "ASI_07", name: "Manila Bay Pearls",        tier: "bench",  seededIndex: 7,  strength: 69, logoColor: "#8e44ad", players: [{ name: "Maria Santos",       position: "all_rounder", overall: 70 }, { name: "Ana Reyes",         position: "blocker",     overall: 67 }] },
    { stableId: "ASI_08", name: "Kuala Lumpur Monsoon FC",  tier: "bench",  seededIndex: 8,  strength: 66, logoColor: "#1abc9c", players: [{ name: "Nur Aisyah",         position: "defender",    overall: 67 }, { name: "Siti Rahimah",      position: "all_rounder", overall: 64 }] },
  ],
  "North America": [
    { stableId: "NAM_01", name: "LA Beach Legends",          tier: "active", seededIndex: 1,  strength: 90, logoColor: "#f39c12", players: [{ name: "Ashley Carter",      position: "blocker",     overall: 91 }, { name: "Taylor Brooks",     position: "defender",    overall: 88 }] },
    { stableId: "NAM_02", name: "Miami Shoreline Queens",    tier: "active", seededIndex: 2,  strength: 87, logoColor: "#e74c3c", players: [{ name: "Destiny Rivera",     position: "all_rounder", overall: 88 }, { name: "Jasmine Washington",position: "blocker",     overall: 85 }] },
    { stableId: "NAM_03", name: "Cancún Coral Storm",        tier: "active", seededIndex: 3,  strength: 84, logoColor: "#27ae60", players: [{ name: "Valentina Torres",   position: "defender",    overall: 85 }, { name: "Sofía Herrera",     position: "blocker",     overall: 82 }] },
    { stableId: "NAM_04", name: "Havana Salsa Spikers",      tier: "active", seededIndex: 4,  strength: 81, logoColor: "#c0392b", players: [{ name: "Lisandra Pérez",     position: "blocker",     overall: 82 }, { name: "Yoanna Fuentes",    position: "defender",    overall: 79 }] },
    { stableId: "NAM_05", name: "Honolulu Aloha Warriors",   tier: "active", seededIndex: 5,  strength: 78, logoColor: "#2980b9", players: [{ name: "Kalani Akana",       position: "all_rounder", overall: 79 }, { name: "Lani Kealoha",      position: "defender",    overall: 76 }] },
    { stableId: "NAM_06", name: "Vancouver Pacific Orcas",   tier: "active", seededIndex: 6,  strength: 75, logoColor: "#1a1a2e", players: [{ name: "Brittany MacLeod",   position: "blocker",     overall: 76 }, { name: "Cassandra Tremblay",position: "all_rounder", overall: 73 }] },
    { stableId: "NAM_07", name: "Myrtle Beach Sunblazers",   tier: "bench",  seededIndex: 7,  strength: 72, logoColor: "#e67e22", players: [{ name: "Madison Hughes",     position: "defender",    overall: 73 }, { name: "Brooke Simmons",    position: "blocker",     overall: 70 }] },
    { stableId: "NAM_08", name: "San Juan Caribbean Pearls", tier: "bench",  seededIndex: 8,  strength: 69, logoColor: "#8e44ad", players: [{ name: "Mariela Colon",      position: "all_rounder", overall: 70 }, { name: "Xiomara Cruz",      position: "defender",    overall: 67 }] },
  ],
  "South America": [
    { stableId: "SAM_01", name: "Rio Copacabana Queens",     tier: "active", seededIndex: 1,  strength: 92, logoColor: "#27ae60", players: [{ name: "Fernanda Silva",     position: "blocker",     overall: 93 }, { name: "Beatriz Costa",     position: "defender",    overall: 90 }] },
    { stableId: "SAM_02", name: "São Paulo Beach Warriors",  tier: "active", seededIndex: 2,  strength: 89, logoColor: "#e74c3c", players: [{ name: "Carolina Souza",     position: "all_rounder", overall: 90 }, { name: "Amanda Lima",       position: "blocker",     overall: 87 }] },
    { stableId: "SAM_03", name: "Buenos Aires Pampas Storm", tier: "active", seededIndex: 3,  strength: 86, logoColor: "#2c3e50", players: [{ name: "Valentina Rodríguez",position: "defender",    overall: 87 }, { name: "Camila Gómez",      position: "blocker",     overall: 84 }] },
    { stableId: "SAM_04", name: "Lima Pacific Soarers",      tier: "active", seededIndex: 4,  strength: 83, logoColor: "#f39c12", players: [{ name: "Lucía Quispe",       position: "blocker",     overall: 84 }, { name: "Andrea Huanca",     position: "all_rounder", overall: 81 }] },
    { stableId: "SAM_05", name: "Bogotá Altitude Queens",    tier: "active", seededIndex: 5,  strength: 80, logoColor: "#e67e22", players: [{ name: "Isabella Vargas",    position: "defender",    overall: 81 }, { name: "Sara Moreno",       position: "blocker",     overall: 78 }] },
    { stableId: "SAM_06", name: "Santiago Atacama Aces",     tier: "active", seededIndex: 6,  strength: 77, logoColor: "#c0392b", players: [{ name: "Daniela Rojas",      position: "all_rounder", overall: 78 }, { name: "Catalina Fuentes",  position: "defender",    overall: 75 }] },
    { stableId: "SAM_07", name: "Montevideo Río Elites",     tier: "bench",  seededIndex: 7,  strength: 74, logoColor: "#1abc9c", players: [{ name: "Verónica Martínez",  position: "blocker",     overall: 75 }, { name: "Paula Álvarez",     position: "all_rounder", overall: 72 }] },
    { stableId: "SAM_08", name: "Caracas Caribbean Coast",   tier: "bench",  seededIndex: 8,  strength: 71, logoColor: "#9b59b6", players: [{ name: "Gabriela Herrera",   position: "defender",    overall: 72 }, { name: "Andreína Colmenares",position:"blocker",     overall: 69 }] },
  ],
  "Africa and Middle East": [
    { stableId: "AFM_01", name: "Lagos Surf Queens",          tier: "active", seededIndex: 1,  strength: 83, logoColor: "#27ae60", players: [{ name: "Amara Okafor",       position: "blocker",     overall: 84 }, { name: "Chisom Nwosu",      position: "defender",    overall: 81 }] },
    { stableId: "AFM_02", name: "Cairo Desert Eagles",        tier: "active", seededIndex: 2,  strength: 80, logoColor: "#f39c12", players: [{ name: "Fatima Al-Rashid",   position: "all_rounder", overall: 81 }, { name: "Nour Ibrahim",      position: "blocker",     overall: 78 }] },
    { stableId: "AFM_03", name: "Durban Indian Ocean Tides",  tier: "active", seededIndex: 3,  strength: 77, logoColor: "#2980b9", players: [{ name: "Lindiwe Dlamini",    position: "defender",    overall: 78 }, { name: "Thandi Nkosi",      position: "blocker",     overall: 75 }] },
    { stableId: "AFM_04", name: "Dubai Sand Aces",            tier: "active", seededIndex: 4,  strength: 74, logoColor: "#c0392b", players: [{ name: "Rania Al-Mansouri",  position: "blocker",     overall: 75 }, { name: "Sara Al-Hashimi",   position: "all_rounder", overall: 72 }] },
    { stableId: "AFM_05", name: "Nairobi Savannah Stars",     tier: "active", seededIndex: 5,  strength: 71, logoColor: "#e67e22", players: [{ name: "Wanjiru Kamau",      position: "defender",    overall: 72 }, { name: "Aisha Mwangi",      position: "blocker",     overall: 69 }] },
    { stableId: "AFM_06", name: "Casablanca Atlantic Spikers",tier: "active", seededIndex: 6,  strength: 68, logoColor: "#8e44ad", players: [{ name: "Nadia Benali",        position: "all_rounder", overall: 69 }, { name: "Samira El-Fassi",   position: "defender",    overall: 66 }] },
    { stableId: "AFM_07", name: "Accra Goldcoast Waves",      tier: "bench",  seededIndex: 7,  strength: 65, logoColor: "#e74c3c", players: [{ name: "Abena Asante",        position: "blocker",     overall: 66 }, { name: "Efua Mensah",       position: "all_rounder", overall: 63 }] },
    { stableId: "AFM_08", name: "Riyadh Dune Dominators",     tier: "bench",  seededIndex: 8,  strength: 62, logoColor: "#2c3e50", players: [{ name: "Hessa Al-Mutairi",   position: "defender",    overall: 63 }, { name: "Dalal Al-Saud",     position: "blocker",     overall: 60 }] },
  ],
  "Australia and Pacific Islands": [
    { stableId: "AUS_01", name: "Bondi Beach Legends",        tier: "active", seededIndex: 1,  strength: 86, logoColor: "#27ae60", players: [{ name: "Scarlett Thompson",  position: "blocker",     overall: 87 }, { name: "Ruby Walker",       position: "defender",    overall: 84 }] },
    { stableId: "AUS_02", name: "Gold Coast Thunderbirds",    tier: "active", seededIndex: 2,  strength: 83, logoColor: "#f39c12", players: [{ name: "Chloe Harrison",      position: "all_rounder", overall: 84 }, { name: "Lily Mitchell",     position: "blocker",     overall: 81 }] },
    { stableId: "AUS_03", name: "Auckland Pacific Diamonds",  tier: "active", seededIndex: 3,  strength: 80, logoColor: "#2980b9", players: [{ name: "Aroha Tane",         position: "defender",    overall: 81 }, { name: "Mia Patel",         position: "blocker",     overall: 78 }] },
    { stableId: "AUS_04", name: "Honolulu Hula Warriors",     tier: "active", seededIndex: 4,  strength: 77, logoColor: "#c0392b", players: [{ name: "Leilani Kahananui",  position: "blocker",     overall: 78 }, { name: "Kaimana Akana",     position: "all_rounder", overall: 75 }] },
    { stableId: "AUS_05", name: "Fiji Island Breakers",       tier: "active", seededIndex: 5,  strength: 74, logoColor: "#e67e22", players: [{ name: "Mere Volavola",       position: "defender",    overall: 75 }, { name: "Adi Cakobau",       position: "blocker",     overall: 72 }] },
    { stableId: "AUS_06", name: "Samoa Southern Swells",      tier: "active", seededIndex: 6,  strength: 71, logoColor: "#8e44ad", players: [{ name: "Sina Faleolo",        position: "all_rounder", overall: 72 }, { name: "Losa Tuilagi",      position: "defender",    overall: 69 }] },
    { stableId: "AUS_07", name: "Vanuatu Coral Crushers",     tier: "bench",  seededIndex: 7,  strength: 68, logoColor: "#1abc9c", players: [{ name: "Mandy Tari",          position: "blocker",     overall: 69 }, { name: "Lisa Natuman",      position: "all_rounder", overall: 66 }] },
    { stableId: "AUS_08", name: "Tonga Polynesian Power",     tier: "bench",  seededIndex: 8,  strength: 65, logoColor: "#e74c3c", players: [{ name: "Mele Taufa",          position: "defender",    overall: 66 }, { name: "Siosaia Taufa",     position: "blocker",     overall: 63 }] },
  ],
};

async function main() {
  console.log("Seeding continental pool teams and players...");

  for (const [continent, teams] of Object.entries(POOL)) {
    for (const teamDef of teams) {
      // Upsert: skip if stableId already exists
      const [existing] = await db
        .select()
        .from(continentalPoolTeamsTable)
        .where(eq(continentalPoolTeamsTable.stableId, teamDef.stableId));

      let teamId: number;

      if (existing) {
        console.log(`  Skipping ${teamDef.stableId} (already exists)`);
        teamId = existing.id;
      } else {
        const [inserted] = await db
          .insert(continentalPoolTeamsTable)
          .values({
            continent,
            stableId: teamDef.stableId,
            name: teamDef.name,
            tier: teamDef.tier,
            seededIndex: teamDef.seededIndex,
            strength: teamDef.strength,
            logoColor: teamDef.logoColor,
          })
          .returning();
        teamId = inserted!.id;
        console.log(`  Inserted ${teamDef.stableId}: ${teamDef.name}`);
      }

      // Seed players if not already present
      for (let i = 0; i < teamDef.players.length; i++) {
        const p = teamDef.players[i]!;
        const playerStableId = `${teamDef.stableId}_P${i + 1}`;
        const [existingP] = await db
          .select()
          .from(continentalPoolPlayersTable)
          .where(eq(continentalPoolPlayersTable.stableId, playerStableId));

        if (!existingP) {
          await db.insert(continentalPoolPlayersTable).values({
            poolTeamId: teamId,
            stableId: playerStableId,
            name: p.name,
            position: p.position,
            overall: p.overall,
          });
          console.log(`    Inserted player ${playerStableId}: ${p.name}`);
        }
      }
    }
  }

  console.log("Done!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
