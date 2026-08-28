/**
 * Seeds continental pool teams, players, initial seasons, and 180 fixtures.
 * Run: pnpm --filter @workspace/scripts run seed-regional-leagues
 *
 * Idempotent: skips any stableId that already exists.
 */
import { db, sqlite } from "@workspace/db";
import {
  continentalPoolTeamsTable,
  continentalPoolPlayersTable,
  regionalLeagueSeasonsTable,
  regionalLeagueFixturesTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";

type PlayerDef = {
  name: string;
  nationality: string;
  age: number;
  speed: number;
  power: number;
  defense: number;
  serve: number;
  block: number;
  stamina: number;
};

type TeamDef = {
  stableId: string;
  teamName: string;
  isActiveInLeague: boolean;
  poolRanking: number;
  rating: number;
  form: number;
  players: [PlayerDef, PlayerDef];
};

const POOL: Record<string, TeamDef[]> = {
  "Europe": [
    { stableId: "EUR_01", teamName: "Berlin Sand Queens",       isActiveInLeague: true,  poolRanking: 1,  rating: 88, form: 72, players: [{ name: "Annika Bauer",        nationality: "German",      age: 27, speed: 84, power: 80, defense: 88, serve: 86, block: 85, stamina: 82 }, { name: "Sophie Müller",      nationality: "German",      age: 25, speed: 88, power: 74, defense: 90, serve: 82, block: 76, stamina: 86 }] },
    { stableId: "EUR_02", teamName: "Barcelona Playa Elites",   isActiveInLeague: true,  poolRanking: 2,  rating: 85, form: 68, players: [{ name: "María Alonso",         nationality: "Spanish",     age: 28, speed: 82, power: 78, defense: 84, serve: 84, block: 80, stamina: 80 }, { name: "Carmen Ruiz",        nationality: "Spanish",     age: 26, speed: 86, power: 76, defense: 86, serve: 80, block: 78, stamina: 84 }] },
    { stableId: "EUR_03", teamName: "Paris Sables Royales",     isActiveInLeague: true,  poolRanking: 3,  rating: 82, form: 64, players: [{ name: "Élise Fontaine",       nationality: "French",      age: 26, speed: 80, power: 72, defense: 84, serve: 80, block: 76, stamina: 78 }, { name: "Céline Moreau",      nationality: "French",      age: 24, speed: 84, power: 70, defense: 82, serve: 78, block: 74, stamina: 80 }] },
    { stableId: "EUR_04", teamName: "Rome Beach Gladiators",    isActiveInLeague: true,  poolRanking: 4,  rating: 79, form: 60, players: [{ name: "Giulia Ricci",         nationality: "Italian",     age: 29, speed: 78, power: 76, defense: 80, serve: 78, block: 80, stamina: 76 }, { name: "Valentina Bianchi",  nationality: "Italian",     age: 27, speed: 80, power: 74, defense: 78, serve: 76, block: 78, stamina: 78 }] },
    { stableId: "EUR_05", teamName: "Amsterdam Dune Riders",    isActiveInLeague: true,  poolRanking: 5,  rating: 76, form: 56, players: [{ name: "Emma van Dijk",        nationality: "Dutch",       age: 25, speed: 82, power: 68, defense: 76, serve: 74, block: 72, stamina: 80 }, { name: "Lisa de Boer",       nationality: "Dutch",       age: 23, speed: 80, power: 66, defense: 74, serve: 72, block: 70, stamina: 76 }] },
    { stableId: "EUR_06", teamName: "Athens Aegean Stars",      isActiveInLeague: true,  poolRanking: 6,  rating: 73, form: 52, players: [{ name: "Eleni Papadaki",       nationality: "Greek",       age: 28, speed: 76, power: 70, defense: 74, serve: 72, block: 74, stamina: 74 }, { name: "Niki Stavros",       nationality: "Greek",       age: 26, speed: 74, power: 68, defense: 72, serve: 70, block: 72, stamina: 72 }] },
    { stableId: "EUR_07", teamName: "Warsaw Vistula Waves",     isActiveInLeague: false, poolRanking: 7,  rating: 70, form: 48, players: [{ name: "Agnieszka Kowal",       nationality: "Polish",      age: 27, speed: 74, power: 66, defense: 72, serve: 70, block: 70, stamina: 72 }, { name: "Marta Wiśniewska",   nationality: "Polish",      age: 25, speed: 72, power: 64, defense: 70, serve: 68, block: 68, stamina: 70 }] },
    { stableId: "EUR_08", teamName: "Stockholm Northern Lights",isActiveInLeague: false, poolRanking: 8,  rating: 67, form: 44, players: [{ name: "Ingrid Larsson",        nationality: "Swedish",     age: 26, speed: 72, power: 62, defense: 70, serve: 66, block: 66, stamina: 70 }, { name: "Astrid Eriksson",    nationality: "Swedish",     age: 24, speed: 70, power: 60, defense: 68, serve: 64, block: 64, stamina: 68 }] },
  ],
  "Asia": [
    { stableId: "ASI_01", teamName: "Tokyo Surf Samurai",        isActiveInLeague: true,  poolRanking: 1,  rating: 87, form: 70, players: [{ name: "Yuki Tanaka",          nationality: "Japanese",    age: 26, speed: 90, power: 72, defense: 86, serve: 84, block: 78, stamina: 84 }, { name: "Aoi Yamamoto",       nationality: "Japanese",    age: 24, speed: 88, power: 70, defense: 84, serve: 82, block: 76, stamina: 82 }] },
    { stableId: "ASI_02", teamName: "Shanghai Yangtze Elites",   isActiveInLeague: true,  poolRanking: 2,  rating: 84, form: 66, players: [{ name: "Wei Lin",              nationality: "Chinese",     age: 28, speed: 82, power: 80, defense: 82, serve: 82, block: 84, stamina: 80 }, { name: "Jing Chen",          nationality: "Chinese",     age: 26, speed: 84, power: 78, defense: 80, serve: 80, block: 82, stamina: 78 }] },
    { stableId: "ASI_03", teamName: "Seoul Han River Queens",    isActiveInLeague: true,  poolRanking: 3,  rating: 81, form: 62, players: [{ name: "Ji-Yeon Park",         nationality: "South Korean",age: 27, speed: 86, power: 74, defense: 80, serve: 80, block: 76, stamina: 82 }, { name: "Min-Seo Kim",        nationality: "South Korean",age: 25, speed: 84, power: 72, defense: 78, serve: 78, block: 74, stamina: 80 }] },
    { stableId: "ASI_04", teamName: "Bangkok Palm Beach Stars",  isActiveInLeague: true,  poolRanking: 4,  rating: 78, form: 58, players: [{ name: "Nisa Suwannaphat",     nationality: "Thai",        age: 26, speed: 82, power: 70, defense: 76, serve: 76, block: 74, stamina: 78 }, { name: "Pimchanok Meesuk",   nationality: "Thai",        age: 24, speed: 80, power: 68, defense: 74, serve: 74, block: 72, stamina: 76 }] },
    { stableId: "ASI_05", teamName: "Mumbai Coastal Warriors",   isActiveInLeague: true,  poolRanking: 5,  rating: 75, form: 54, players: [{ name: "Priya Sharma",         nationality: "Indian",      age: 27, speed: 78, power: 66, defense: 74, serve: 72, block: 70, stamina: 76 }, { name: "Ananya Nair",        nationality: "Indian",      age: 25, speed: 76, power: 64, defense: 72, serve: 70, block: 68, stamina: 74 }] },
    { stableId: "ASI_06", teamName: "Bali Island Legends",       isActiveInLeague: true,  poolRanking: 6,  rating: 72, form: 50, players: [{ name: "Dewi Santoso",         nationality: "Indonesian",  age: 28, speed: 76, power: 68, defense: 72, serve: 70, block: 72, stamina: 72 }, { name: "Sari Wulandari",     nationality: "Indonesian",  age: 26, speed: 74, power: 66, defense: 70, serve: 68, block: 70, stamina: 70 }] },
    { stableId: "ASI_07", teamName: "Manila Bay Pearls",         isActiveInLeague: false, poolRanking: 7,  rating: 69, form: 46, players: [{ name: "Maria Santos",         nationality: "Filipino",    age: 27, speed: 74, power: 64, defense: 70, serve: 68, block: 68, stamina: 70 }, { name: "Ana Reyes",          nationality: "Filipino",    age: 25, speed: 72, power: 62, defense: 68, serve: 66, block: 66, stamina: 68 }] },
    { stableId: "ASI_08", teamName: "Kuala Lumpur Monsoon FC",   isActiveInLeague: false, poolRanking: 8,  rating: 66, form: 42, players: [{ name: "Nur Aisyah",           nationality: "Malaysian",   age: 26, speed: 72, power: 60, defense: 68, serve: 64, block: 64, stamina: 68 }, { name: "Siti Rahimah",       nationality: "Malaysian",   age: 24, speed: 70, power: 58, defense: 66, serve: 62, block: 62, stamina: 66 }] },
  ],
  "North America": [
    { stableId: "NAM_01", teamName: "LA Beach Legends",           isActiveInLeague: true,  poolRanking: 1,  rating: 90, form: 74, players: [{ name: "Ashley Carter",       nationality: "American",    age: 28, speed: 88, power: 84, defense: 88, serve: 88, block: 86, stamina: 84 }, { name: "Taylor Brooks",      nationality: "American",    age: 26, speed: 90, power: 80, defense: 86, serve: 86, block: 82, stamina: 86 }] },
    { stableId: "NAM_02", teamName: "Miami Shoreline Queens",     isActiveInLeague: true,  poolRanking: 2,  rating: 87, form: 70, players: [{ name: "Destiny Rivera",      nationality: "American",    age: 27, speed: 86, power: 82, defense: 84, serve: 86, block: 84, stamina: 82 }, { name: "Jasmine Washington", nationality: "American",    age: 25, speed: 88, power: 80, defense: 82, serve: 84, block: 82, stamina: 84 }] },
    { stableId: "NAM_03", teamName: "Cancún Coral Storm",         isActiveInLeague: true,  poolRanking: 3,  rating: 84, form: 66, players: [{ name: "Valentina Torres",    nationality: "Mexican",     age: 27, speed: 84, power: 78, defense: 82, serve: 82, block: 80, stamina: 80 }, { name: "Sofía Herrera",      nationality: "Mexican",     age: 25, speed: 82, power: 76, defense: 80, serve: 80, block: 78, stamina: 78 }] },
    { stableId: "NAM_04", teamName: "Havana Salsa Spikers",       isActiveInLeague: true,  poolRanking: 4,  rating: 81, form: 62, players: [{ name: "Lisandra Pérez",      nationality: "Cuban",       age: 28, speed: 82, power: 76, defense: 80, serve: 80, block: 82, stamina: 78 }, { name: "Yoanna Fuentes",     nationality: "Cuban",       age: 26, speed: 80, power: 74, defense: 78, serve: 78, block: 80, stamina: 76 }] },
    { stableId: "NAM_05", teamName: "Honolulu Aloha Warriors",    isActiveInLeague: true,  poolRanking: 5,  rating: 78, form: 58, players: [{ name: "Kalani Akana",        nationality: "American",    age: 26, speed: 84, power: 70, defense: 76, serve: 76, block: 74, stamina: 80 }, { name: "Lani Kealoha",       nationality: "American",    age: 24, speed: 82, power: 68, defense: 74, serve: 74, block: 72, stamina: 78 }] },
    { stableId: "NAM_06", teamName: "Vancouver Pacific Orcas",    isActiveInLeague: true,  poolRanking: 6,  rating: 75, form: 54, players: [{ name: "Brittany MacLeod",    nationality: "Canadian",    age: 27, speed: 80, power: 70, defense: 74, serve: 74, block: 72, stamina: 76 }, { name: "Cassandra Tremblay", nationality: "Canadian",    age: 25, speed: 78, power: 68, defense: 72, serve: 72, block: 70, stamina: 74 }] },
    { stableId: "NAM_07", teamName: "Myrtle Beach Sunblazers",    isActiveInLeague: false, poolRanking: 7,  rating: 72, form: 50, players: [{ name: "Madison Hughes",      nationality: "American",    age: 26, speed: 78, power: 66, defense: 72, serve: 70, block: 70, stamina: 74 }, { name: "Brooke Simmons",     nationality: "American",    age: 24, speed: 76, power: 64, defense: 70, serve: 68, block: 68, stamina: 72 }] },
    { stableId: "NAM_08", teamName: "San Juan Caribbean Pearls",  isActiveInLeague: false, poolRanking: 8,  rating: 69, form: 46, players: [{ name: "Mariela Colon",       nationality: "Puerto Rican",age: 27, speed: 76, power: 62, defense: 70, serve: 68, block: 66, stamina: 72 }, { name: "Xiomara Cruz",       nationality: "Puerto Rican",age: 25, speed: 74, power: 60, defense: 68, serve: 66, block: 64, stamina: 70 }] },
  ],
  "South America": [
    { stableId: "SAM_01", teamName: "Rio Copacabana Queens",      isActiveInLeague: true,  poolRanking: 1,  rating: 92, form: 76, players: [{ name: "Fernanda Silva",       nationality: "Brazilian",   age: 28, speed: 90, power: 88, defense: 90, serve: 92, block: 88, stamina: 86 }, { name: "Beatriz Costa",      nationality: "Brazilian",   age: 26, speed: 92, power: 84, defense: 88, serve: 90, block: 86, stamina: 88 }] },
    { stableId: "SAM_02", teamName: "São Paulo Beach Warriors",   isActiveInLeague: true,  poolRanking: 2,  rating: 89, form: 72, players: [{ name: "Carolina Souza",       nationality: "Brazilian",   age: 27, speed: 88, power: 86, defense: 86, serve: 88, block: 86, stamina: 84 }, { name: "Amanda Lima",        nationality: "Brazilian",   age: 25, speed: 86, power: 84, defense: 84, serve: 86, block: 84, stamina: 82 }] },
    { stableId: "SAM_03", teamName: "Buenos Aires Pampas Storm",  isActiveInLeague: true,  poolRanking: 3,  rating: 86, form: 68, players: [{ name: "Valentina Rodríguez",  nationality: "Argentine",   age: 28, speed: 84, power: 82, defense: 84, serve: 84, block: 84, stamina: 82 }, { name: "Camila Gómez",       nationality: "Argentine",   age: 26, speed: 86, power: 80, defense: 82, serve: 82, block: 82, stamina: 80 }] },
    { stableId: "SAM_04", teamName: "Lima Pacific Soarers",       isActiveInLeague: true,  poolRanking: 4,  rating: 83, form: 64, players: [{ name: "Lucía Quispe",         nationality: "Peruvian",    age: 27, speed: 82, power: 78, defense: 82, serve: 82, block: 80, stamina: 80 }, { name: "Andrea Huanca",      nationality: "Peruvian",    age: 25, speed: 80, power: 76, defense: 80, serve: 80, block: 78, stamina: 78 }] },
    { stableId: "SAM_05", teamName: "Bogotá Altitude Queens",     isActiveInLeague: true,  poolRanking: 5,  rating: 80, form: 60, players: [{ name: "Isabella Vargas",      nationality: "Colombian",   age: 26, speed: 80, power: 74, defense: 78, serve: 78, block: 76, stamina: 78 }, { name: "Sara Moreno",        nationality: "Colombian",   age: 24, speed: 78, power: 72, defense: 76, serve: 76, block: 74, stamina: 76 }] },
    { stableId: "SAM_06", teamName: "Santiago Atacama Aces",      isActiveInLeague: true,  poolRanking: 6,  rating: 77, form: 56, players: [{ name: "Daniela Rojas",        nationality: "Chilean",     age: 27, speed: 78, power: 72, defense: 76, serve: 76, block: 76, stamina: 76 }, { name: "Catalina Fuentes",   nationality: "Chilean",     age: 25, speed: 76, power: 70, defense: 74, serve: 74, block: 74, stamina: 74 }] },
    { stableId: "SAM_07", teamName: "Montevideo Río Elites",      isActiveInLeague: false, poolRanking: 7,  rating: 74, form: 52, players: [{ name: "Verónica Martínez",    nationality: "Uruguayan",   age: 27, speed: 76, power: 68, defense: 74, serve: 74, block: 72, stamina: 74 }, { name: "Paula Álvarez",      nationality: "Uruguayan",   age: 25, speed: 74, power: 66, defense: 72, serve: 72, block: 70, stamina: 72 }] },
    { stableId: "SAM_08", teamName: "Caracas Caribbean Coast",    isActiveInLeague: false, poolRanking: 8,  rating: 71, form: 48, players: [{ name: "Gabriela Herrera",     nationality: "Venezuelan",  age: 26, speed: 74, power: 64, defense: 72, serve: 70, block: 70, stamina: 72 }, { name: "Andreína Colmenares",nationality: "Venezuelan",  age: 24, speed: 72, power: 62, defense: 70, serve: 68, block: 68, stamina: 70 }] },
  ],
  "Africa and Middle East": [
    { stableId: "AFM_01", teamName: "Lagos Surf Queens",           isActiveInLeague: true,  poolRanking: 1,  rating: 83, form: 66, players: [{ name: "Amara Okafor",        nationality: "Nigerian",    age: 27, speed: 84, power: 78, defense: 80, serve: 80, block: 80, stamina: 82 }, { name: "Chisom Nwosu",       nationality: "Nigerian",    age: 25, speed: 86, power: 74, defense: 78, serve: 78, block: 76, stamina: 84 }] },
    { stableId: "AFM_02", teamName: "Cairo Desert Eagles",         isActiveInLeague: true,  poolRanking: 2,  rating: 80, form: 62, players: [{ name: "Fatima Al-Rashid",    nationality: "Egyptian",    age: 28, speed: 80, power: 76, defense: 78, serve: 78, block: 76, stamina: 78 }, { name: "Nour Ibrahim",       nationality: "Egyptian",    age: 26, speed: 82, power: 72, defense: 76, serve: 76, block: 74, stamina: 80 }] },
    { stableId: "AFM_03", teamName: "Durban Indian Ocean Tides",   isActiveInLeague: true,  poolRanking: 3,  rating: 77, form: 58, players: [{ name: "Lindiwe Dlamini",     nationality: "South African",age:27, speed: 80, power: 72, defense: 76, serve: 74, block: 76, stamina: 78 }, { name: "Thandi Nkosi",       nationality: "South African",age:25, speed: 78, power: 70, defense: 74, serve: 72, block: 74, stamina: 76 }] },
    { stableId: "AFM_04", teamName: "Dubai Sand Aces",             isActiveInLeague: true,  poolRanking: 4,  rating: 74, form: 54, players: [{ name: "Rania Al-Mansouri",   nationality: "Emirati",     age: 26, speed: 78, power: 72, defense: 74, serve: 72, block: 74, stamina: 76 }, { name: "Sara Al-Hashimi",    nationality: "Emirati",     age: 24, speed: 76, power: 70, defense: 72, serve: 70, block: 72, stamina: 74 }] },
    { stableId: "AFM_05", teamName: "Nairobi Savannah Stars",      isActiveInLeague: true,  poolRanking: 5,  rating: 71, form: 50, players: [{ name: "Wanjiru Kamau",       nationality: "Kenyan",      age: 27, speed: 82, power: 66, defense: 70, serve: 68, block: 68, stamina: 80 }, { name: "Aisha Mwangi",       nationality: "Kenyan",      age: 25, speed: 80, power: 64, defense: 68, serve: 66, block: 66, stamina: 78 }] },
    { stableId: "AFM_06", teamName: "Casablanca Atlantic Spikers", isActiveInLeague: true,  poolRanking: 6,  rating: 68, form: 46, players: [{ name: "Nadia Benali",         nationality: "Moroccan",    age: 28, speed: 76, power: 66, defense: 68, serve: 66, block: 68, stamina: 74 }, { name: "Samira El-Fassi",    nationality: "Moroccan",    age: 26, speed: 74, power: 64, defense: 66, serve: 64, block: 66, stamina: 72 }] },
    { stableId: "AFM_07", teamName: "Accra Goldcoast Waves",       isActiveInLeague: false, poolRanking: 7,  rating: 65, form: 42, players: [{ name: "Abena Asante",         nationality: "Ghanaian",    age: 27, speed: 76, power: 62, defense: 66, serve: 64, block: 64, stamina: 72 }, { name: "Efua Mensah",        nationality: "Ghanaian",    age: 25, speed: 74, power: 60, defense: 64, serve: 62, block: 62, stamina: 70 }] },
    { stableId: "AFM_08", teamName: "Riyadh Dune Dominators",      isActiveInLeague: false, poolRanking: 8,  rating: 62, form: 38, players: [{ name: "Hessa Al-Mutairi",    nationality: "Saudi",       age: 26, speed: 72, power: 60, defense: 64, serve: 62, block: 62, stamina: 70 }, { name: "Dalal Al-Saud",      nationality: "Saudi",       age: 24, speed: 70, power: 58, defense: 62, serve: 60, block: 60, stamina: 68 }] },
  ],
  "Australia and Pacific Islands": [
    { stableId: "AUS_01", teamName: "Bondi Beach Legends",         isActiveInLeague: true,  poolRanking: 1,  rating: 86, form: 70, players: [{ name: "Scarlett Thompson",   nationality: "Australian",  age: 27, speed: 86, power: 82, defense: 84, serve: 84, block: 84, stamina: 82 }, { name: "Ruby Walker",        nationality: "Australian",  age: 25, speed: 84, power: 78, defense: 82, serve: 82, block: 80, stamina: 84 }] },
    { stableId: "AUS_02", teamName: "Gold Coast Thunderbirds",     isActiveInLeague: true,  poolRanking: 2,  rating: 83, form: 66, players: [{ name: "Chloe Harrison",       nationality: "Australian",  age: 28, speed: 84, power: 80, defense: 80, serve: 82, block: 80, stamina: 80 }, { name: "Lily Mitchell",      nationality: "Australian",  age: 26, speed: 82, power: 76, defense: 78, serve: 80, block: 78, stamina: 82 }] },
    { stableId: "AUS_03", teamName: "Auckland Pacific Diamonds",   isActiveInLeague: true,  poolRanking: 3,  rating: 80, form: 62, players: [{ name: "Aroha Tane",           nationality: "New Zealander",age:27, speed: 82, power: 74, defense: 78, serve: 78, block: 76, stamina: 80 }, { name: "Mia Patel",          nationality: "New Zealander",age:25, speed: 80, power: 72, defense: 76, serve: 76, block: 74, stamina: 78 }] },
    { stableId: "AUS_04", teamName: "Honolulu Hula Warriors",      isActiveInLeague: true,  poolRanking: 4,  rating: 77, form: 58, players: [{ name: "Leilani Kahananui",   nationality: "Hawaiian",    age: 26, speed: 82, power: 70, defense: 74, serve: 76, block: 72, stamina: 78 }, { name: "Kaimana Akana",      nationality: "Hawaiian",    age: 24, speed: 80, power: 68, defense: 72, serve: 74, block: 70, stamina: 76 }] },
    { stableId: "AUS_05", teamName: "Fiji Island Breakers",        isActiveInLeague: true,  poolRanking: 5,  rating: 74, form: 54, players: [{ name: "Mere Volavola",        nationality: "Fijian",      age: 27, speed: 78, power: 68, defense: 72, serve: 72, block: 72, stamina: 76 }, { name: "Adi Cakobau",        nationality: "Fijian",      age: 25, speed: 76, power: 66, defense: 70, serve: 70, block: 70, stamina: 74 }] },
    { stableId: "AUS_06", teamName: "Samoa Southern Swells",       isActiveInLeague: true,  poolRanking: 6,  rating: 71, form: 50, players: [{ name: "Sina Faleolo",         nationality: "Samoan",      age: 28, speed: 76, power: 68, defense: 70, serve: 70, block: 70, stamina: 74 }, { name: "Losa Tuilagi",       nationality: "Samoan",      age: 26, speed: 74, power: 66, defense: 68, serve: 68, block: 68, stamina: 72 }] },
    { stableId: "AUS_07", teamName: "Vanuatu Coral Crushers",      isActiveInLeague: false, poolRanking: 7,  rating: 68, form: 46, players: [{ name: "Mandy Tari",           nationality: "Vanuatuan",   age: 27, speed: 74, power: 62, defense: 68, serve: 66, block: 66, stamina: 72 }, { name: "Lisa Natuman",       nationality: "Vanuatuan",   age: 25, speed: 72, power: 60, defense: 66, serve: 64, block: 64, stamina: 70 }] },
    { stableId: "AUS_08", teamName: "Tonga Polynesian Power",      isActiveInLeague: false, poolRanking: 8,  rating: 65, form: 42, players: [{ name: "Mele Taufa",           nationality: "Tongan",      age: 26, speed: 72, power: 62, defense: 66, serve: 64, block: 64, stamina: 70 }, { name: "Siosaia Taufa",      nationality: "Tongan",      age: 24, speed: 70, power: 60, defense: 64, serve: 62, block: 62, stamina: 68 }] },
  ],
};

// Use a relative import — the scripts package is compiled with tsx which handles .ts
// eslint-disable-next-line @typescript-eslint/no-require-imports
// We need the fixture generator — import directly from the shared util
// Since this script lives in scripts/src/ and the util is in api-server/src/utils/,
// we duplicate the minimal generator here to avoid cross-artifact imports.
function generateDoubleRoundRobinLocal(teamIds: number[]): { round: number; home: number; away: number }[] {
  if (teamIds.length !== 6) throw new Error(`Expected 6 teams, got ${teamIds.length}`);
  const slots: { round: number; home: number; away: number }[] = [];
  const n = 6;
  const rotating = [1, 2, 3, 4, 5];
  for (let round = 1; round <= 5; round++) {
    const indices = [0, ...rotating];
    for (let i = 0; i < n / 2; i++) {
      slots.push({ round, home: teamIds[indices[i]!]!, away: teamIds[indices[n - 1 - i]!]! });
    }
    rotating.unshift(rotating.pop()!);
  }
  const firstLeg = slots.slice();
  for (const s of firstLeg) slots.push({ round: s.round + 5, home: s.away, away: s.home });
  return slots;
}

async function main() {
  console.log("=== Seeding continental pool teams, players, seasons, and fixtures ===\n");

  const CURRENT_SEASON_YEAR = 1;

  for (const [continent, teams] of Object.entries(POOL)) {
    console.log(`\n── ${continent} ──`);
    const activeTeamIds: number[] = [];

    for (const teamDef of teams) {
      // Upsert pool team
      const [existing] = await db
        .select()
        .from(continentalPoolTeamsTable)
        .where(eq(continentalPoolTeamsTable.stableId, teamDef.stableId));

      let teamId: number;
      if (existing) {
        console.log(`  Skipping team ${teamDef.stableId} (already exists)`);
        teamId = existing.id;
      } else {
        const [inserted] = await db
          .insert(continentalPoolTeamsTable)
          .values({
            continent,
            stableId:         teamDef.stableId,
            teamName:         teamDef.teamName,
            rating:           teamDef.rating,
            form:             teamDef.form,
            fitness:          80,
            fatigue:          0,
            poolRanking:      teamDef.poolRanking,
            // promotion/relegation are career state; startsInLeague is the
            // reference seed for who begins in the league.
            startsInLeague:   teamDef.isActiveInLeague,
          })
          .returning();
        teamId = inserted!.id;
        console.log(`  Inserted team ${teamDef.stableId}: ${teamDef.teamName}`);
      }

      // Seed players
      for (let i = 0; i < teamDef.players.length; i++) {
        const p = teamDef.players[i]!;
        const playerStableId = `${teamDef.stableId}_P${i + 1}`;
        const [existingP] = await db
          .select()
          .from(continentalPoolPlayersTable)
          .where(eq(continentalPoolPlayersTable.stableId, playerStableId));

        if (!existingP) {
          await db.insert(continentalPoolPlayersTable).values({
            poolTeamId:  teamId,
            stableId:    playerStableId,
            name:        p.name,
            nationality: p.nationality,
            baseAge:     p.age,
            speed:       p.speed,
            power:       p.power,
            defense:     p.defense,
            serve:       p.serve,
            block:       p.block,
            stamina:     p.stamina,
          });
          console.log(`    Inserted player ${playerStableId}: ${p.name}`);
        }
      }

      if (teamDef.isActiveInLeague) activeTeamIds.push(teamId);
    }

    if (activeTeamIds.length !== 6) {
      console.warn(`  WARNING: ${continent} has ${activeTeamIds.length} active teams (expected 6)`);
      continue;
    }

    // Seed initial season (idempotent)
    const [existingSeason] = await db
      .select()
      .from(regionalLeagueSeasonsTable)
      .where(
        and(
          eq(regionalLeagueSeasonsTable.continent, continent),
          eq(regionalLeagueSeasonsTable.seasonYear, CURRENT_SEASON_YEAR),
        ),
      );

    if (existingSeason) {
      console.log(`  Season ${CURRENT_SEASON_YEAR} already exists (id=${existingSeason.id}), skipping fixtures`);
      continue;
    }

    const [season] = await db
      .insert(regionalLeagueSeasonsTable)
      .values({
        seasonYear: CURRENT_SEASON_YEAR,
        continent,
        teamIds:    activeTeamIds,
        status:     "active",
      })
      .returning();

    if (!season) continue;
    console.log(`  Created season ${CURRENT_SEASON_YEAR} (id=${season.id})`);

    // Generate 30 fixtures
    const slots = generateDoubleRoundRobinLocal(activeTeamIds);
    await db.insert(regionalLeagueFixturesTable).values(
      slots.map(s => ({
        regionalLeagueSeasonId: season.id,
        round:          s.round,
        homePoolTeamId: s.home,
        awayPoolTeamId: s.away,
        status:         "scheduled" as const,
      })),
    );
    console.log(`  Inserted ${slots.length} fixtures`);
  }

  // Checkpoint so a raw file copy of the .sqlite (e.g. ensureUserDb, or
  // packaging the starter DB) never has to depend on the -wal sidecar too.
  sqlite.pragma("wal_checkpoint(TRUNCATE)");

  console.log("\n=== Done! ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
