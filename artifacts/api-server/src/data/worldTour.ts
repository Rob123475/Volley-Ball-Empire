import type { ContinentKey } from "@workspace/db";

/**
 * World Tour schedule — 78-slot season structure.
 *
 * Layout:
 *   Slots  1–10  Regional Period       (no entries here — handled by regional league tables)
 *   Slots 11–70  World Tour Period     (60 events, 10 per continent, rounds = slot numbers)
 *   Slots 71–72  Finals Period         (Semifinals day + World Final day)
 *   Slots 73–78  Holiday Period        (no entries — rest days)
 *
 * Dates are aligned with the linear-interpolation formula used by roundToDate():
 *   offset = floor((round - 1) * 364 / 77) days after season startDate (2026-01-01).
 *
 * Each continent keeps its 5 Bronze + varying Silver/Gold events (10 total).
 * Continental Final and Elite rounds have been removed from the WT schedule —
 * continental qualification is now decided by the regional league system.
 */

export type Tier =
  | "Bronze"
  | "Silver"
  | "Gold"
  | "Elite"
  | "Continental Final"
  | "World Semi Final"
  | "All-Star Match"
  | "World Final";

export interface WorldTourEvent {
  round:       number;
  /**
   * Canonical continent KEY, or "world" for the two events that belong to no
   * region (the All-Star match and the World Final). Typed rather than `string`
   * so a stray label cannot creep back in — this file used to say
   * "Australia & Pacific", an eighth spelling nothing else recognised.
   */
  continent:   ContinentKey | "world";
  country:     string;
  city:        string;
  beachName:   string;
  displayName: string;
  date:        string;
  locId:       number;
  locName:     string;
  opponent:    string;
  prize:       number;
  tier:        Tier;
}

export const TEAMS_PER_COMPETITION = 6;

export const WORLD_TOUR: WorldTourEvent[] = [

  // ── Asia Tour  (Slots 11–20) ──────────────────────────────────────────────
  {
    round: 11,  continent: "asia",  country: "Thailand",
    city: "Phuket",  beachName: "Kata Beach",
    displayName: "Phuket Beach Classic",  date: "2026-02-17",
    locId: 7,  locName: "Kata Beach, Phuket",
    opponent: "Pacific Storm USA",  prize: 6500,  tier: "Bronze",
  },
  {
    round: 12,  continent: "asia",  country: "Indonesia",
    city: "Bali",  beachName: "Kuta Beach",
    displayName: "Bali Kuta Open",  date: "2026-02-22",
    locId: 9,  locName: "Kuta Beach, Bali",
    opponent: "Rio Serpents BRA",  prize: 7500,  tier: "Bronze",
  },
  {
    round: 13,  continent: "asia",  country: "Vietnam",
    city: "Da Nang",  beachName: "My Khe Beach",
    displayName: "Da Nang My Khe Open",  date: "2026-02-26",
    locId: 7,  locName: "My Khe Beach, Da Nang",
    opponent: "Sand Queens AU",  prize: 8000,  tier: "Bronze",
  },
  {
    round: 14,  continent: "asia",  country: "Thailand",
    city: "Pattaya",  beachName: "Jomtien Beach",
    displayName: "Pattaya Gulf Classic",  date: "2026-03-03",
    locId: 7,  locName: "Jomtien Beach, Pattaya",
    opponent: "Tropical Blaze CUB",  prize: 8500,  tier: "Bronze",
  },
  {
    round: 15,  continent: "asia",  country: "Malaysia",
    city: "Penang",  beachName: "Batu Ferringhi Beach",
    displayName: "Penang Shore Bronze",  date: "2026-03-08",
    locId: 9,  locName: "Batu Ferringhi Beach, Penang",
    opponent: "Iron Wave CHI",  prize: 9000,  tier: "Bronze",
  },
  {
    round: 16,  continent: "asia",  country: "Indonesia",
    city: "Lombok",  beachName: "Selong Belanak Beach",
    displayName: "Lombok Shore Silver",  date: "2026-03-12",
    locId: 9,  locName: "Selong Belanak, Lombok",
    opponent: "Greek Fire GRE",  prize: 20500,  tier: "Silver",
  },
  {
    round: 17,  continent: "asia",  country: "South Korea",
    city: "Jeju",  beachName: "Hyeopjae Beach",
    displayName: "Jeju Island Silver Open",  date: "2026-03-17",
    locId: 7,  locName: "Hyeopjae Beach, Jeju",
    opponent: "French Riviera FRA",  prize: 24000,  tier: "Silver",
  },
  {
    round: 18,  continent: "asia",  country: "Japan",
    city: "Okinawa",  beachName: "Emerald Beach",
    displayName: "Okinawa Gold Series",  date: "2026-03-22",
    locId: 7,  locName: "Emerald Beach, Okinawa",
    opponent: "Island Aces THA",  prize: 45000,  tier: "Gold",
  },
  {
    round: 19,  continent: "asia",  country: "Thailand",
    city: "Koh Samui",  beachName: "Chaweng Beach",
    displayName: "Samui Gold Masters",  date: "2026-03-27",
    locId: 7,  locName: "Chaweng Beach, Koh Samui",
    opponent: "Bali Tigers IDN",  prize: 51000,  tier: "Gold",
  },
  {
    round: 20,  continent: "asia",  country: "India",
    city: "Goa",  beachName: "Vagator Beach",
    displayName: "Goa Gold Open",  date: "2026-03-31",
    locId: 9,  locName: "Vagator Beach, Goa",
    opponent: "Storm Queens USA",  prize: 57500,  tier: "Gold",
  },

  // ── Australia & Pacific Tour  (Slots 21–30) ───────────────────────────────
  {
    round: 21,  continent: "oceania",  country: "Fiji",
    city: "Nadi",  beachName: "Natadola Beach",
    displayName: "Fiji Natadola Open",  date: "2026-04-05",
    locId: 2,  locName: "Natadola Beach, Nadi",
    opponent: "Pacific Storm USA",  prize: 7000,  tier: "Bronze",
  },
  {
    round: 22,  continent: "oceania",  country: "Samoa",
    city: "Apia",  beachName: "Return to Paradise Beach",
    displayName: "Samoa Paradise Cup",  date: "2026-04-10",
    locId: 2,  locName: "Return to Paradise Beach, Apia",
    opponent: "Rio Serpents BRA",  prize: 7500,  tier: "Bronze",
  },
  {
    round: 23,  continent: "oceania",  country: "Vanuatu",
    city: "Port Vila",  beachName: "Pango Beach",
    displayName: "Vanuatu Pacific Open",  date: "2026-04-15",
    locId: 2,  locName: "Pango Beach, Port Vila",
    opponent: "Sand Queens AU",  prize: 8000,  tier: "Bronze",
  },
  {
    round: 24,  continent: "oceania",  country: "Australia",
    city: "Brisbane",  beachName: "Surfers Paradise",
    displayName: "Surfers Paradise Bronze",  date: "2026-04-19",
    locId: 2,  locName: "Surfers Paradise, Brisbane",
    opponent: "Tropical Blaze CUB",  prize: 8500,  tier: "Bronze",
  },
  {
    round: 25,  continent: "oceania",  country: "French Polynesia",
    city: "Bora Bora",  beachName: "Matira Beach",
    displayName: "Bora Bora Bronze Classic",  date: "2026-04-24",
    locId: 2,  locName: "Matira Beach, Bora Bora",
    opponent: "Iron Wave CHI",  prize: 9000,  tier: "Bronze",
  },
  {
    round: 26,  continent: "oceania",  country: "New Zealand",
    city: "Auckland",  beachName: "Piha Beach",
    displayName: "Piha Silver Classic",  date: "2026-04-29",
    locId: 2,  locName: "Piha Beach, Auckland",
    opponent: "Greek Fire GRE",  prize: 22000,  tier: "Silver",
  },
  {
    round: 27,  continent: "oceania",  country: "New Caledonia",
    city: "Noumea",  beachName: "Anse Vata Beach",
    displayName: "Noumea Pacific Silver",  date: "2026-05-03",
    locId: 2,  locName: "Anse Vata Beach, Noumea",
    opponent: "French Riviera FRA",  prize: 24000,  tier: "Silver",
  },
  {
    round: 28,  continent: "oceania",  country: "Fiji",
    city: "Pacific Harbour",  beachName: "Pacific Harbour Beach",
    displayName: "Fiji Gold Series",  date: "2026-05-08",
    locId: 2,  locName: "Pacific Harbour Beach, Fiji",
    opponent: "Island Aces THA",  prize: 30500,  tier: "Silver",
  },
  {
    round: 29,  continent: "oceania",  country: "Australia",
    city: "Cairns",  beachName: "Mission Beach",
    displayName: "Cairns Tropics Gold",  date: "2026-05-13",
    locId: 2,  locName: "Mission Beach, Cairns",
    opponent: "Bali Tigers IDN",  prize: 49000,  tier: "Gold",
  },
  {
    round: 30,  continent: "oceania",  country: "Australia",
    city: "Sydney",  beachName: "Bondi Beach",
    displayName: "Bondi Gold Masters",  date: "2026-05-18",
    locId: 2,  locName: "Bondi Beach, Sydney",
    opponent: "Storm Queens USA",  prize: 57500,  tier: "Gold",
  },

  // ── Europe Tour  (Slots 31–40) ────────────────────────────────────────────
  {
    round: 31,  continent: "europe",  country: "Portugal",
    city: "Cascais",  beachName: "Guincho Beach",
    displayName: "Cascais Atlantic Open",  date: "2026-05-22",
    locId: 10,  locName: "Guincho Beach, Cascais",
    opponent: "Pacific Storm USA",  prize: 6500,  tier: "Bronze",
  },
  {
    round: 32,  continent: "europe",  country: "Italy",
    city: "Rimini",  beachName: "Rimini Beach",
    displayName: "Rimini Riviera Cup",  date: "2026-05-27",
    locId: 8,  locName: "Rimini Beach, Italy",
    opponent: "Rio Serpents BRA",  prize: 7500,  tier: "Bronze",
  },
  {
    round: 33,  continent: "europe",  country: "Croatia",
    city: "Poreč",  beachName: "Plava Laguna Beach",
    displayName: "Poreč Adriatic Open",  date: "2026-06-01",
    locId: 8,  locName: "Plava Laguna Beach, Poreč",
    opponent: "Sand Queens AU",  prize: 8000,  tier: "Bronze",
  },
  {
    round: 34,  continent: "europe",  country: "Turkey",
    city: "Antalya",  beachName: "Konyaaltı Beach",
    displayName: "Antalya Beach Pro",  date: "2026-06-06",
    locId: 11,  locName: "Konyaaltı Beach, Antalya",
    opponent: "Tropical Blaze CUB",  prize: 8500,  tier: "Bronze",
  },
  {
    round: 35,  continent: "europe",  country: "Netherlands",
    city: "The Hague",  beachName: "Scheveningen Beach",
    displayName: "Scheveningen Bronze Cup",  date: "2026-06-10",
    locId: 10,  locName: "Scheveningen Beach, The Hague",
    opponent: "Iron Wave CHI",  prize: 9000,  tier: "Bronze",
  },
  {
    round: 36,  continent: "europe",  country: "Spain",
    city: "Barcelona",  beachName: "Barceloneta Beach",
    displayName: "Barcelona City Open",  date: "2026-06-15",
    locId: 10,  locName: "Barceloneta Beach, Barcelona",
    opponent: "Greek Fire GRE",  prize: 22000,  tier: "Silver",
  },
  {
    round: 37,  continent: "europe",  country: "France",
    city: "Nice",  beachName: "Côte d'Azur Beach",
    displayName: "Nice Riviera Classic",  date: "2026-06-20",
    locId: 10,  locName: "Côte d'Azur Beach, Nice",
    opponent: "French Riviera FRA",  prize: 24000,  tier: "Silver",
  },
  {
    round: 38,  continent: "europe",  country: "Germany",
    city: "Hamburg",  beachName: "Timmendorfer Strand",
    displayName: "Hamburg North Open",  date: "2026-06-24",
    locId: 10,  locName: "Timmendorfer Strand, Hamburg",
    opponent: "Island Aces THA",  prize: 47000,  tier: "Gold",
  },
  {
    round: 39,  continent: "europe",  country: "Greece",
    city: "Mykonos",  beachName: "Super Paradise Beach",
    displayName: "Mykonos Gold Masters",  date: "2026-06-29",
    locId: 8,  locName: "Super Paradise Beach, Mykonos",
    opponent: "Bali Tigers IDN",  prize: 53500,  tier: "Gold",
  },
  {
    round: 40,  continent: "europe",  country: "Spain",
    city: "Valencia",  beachName: "Playa de la Malvarrosa",
    displayName: "Valencia Gold Open",  date: "2026-07-04",
    locId: 10,  locName: "Playa Malvarrosa, Valencia",
    opponent: "Storm Queens USA",  prize: 59500,  tier: "Gold",
  },

  // ── Africa & Middle East Tour  (Slots 41–50) ──────────────────────────────
  {
    round: 41,  continent: "africa_middle_east",  country: "Egypt",
    city: "Hurghada",  beachName: "Red Sea Beach",
    displayName: "Hurghada Red Sea Open",  date: "2026-07-09",
    locId: 11,  locName: "Red Sea Beach, Hurghada",
    opponent: "Pacific Storm USA",  prize: 6000,  tier: "Bronze",
  },
  {
    round: 42,  continent: "africa_middle_east",  country: "Morocco",
    city: "Agadir",  beachName: "Agadir Beach",
    displayName: "Agadir Atlantic Open",  date: "2026-07-13",
    locId: 10,  locName: "Agadir Beach, Morocco",
    opponent: "Rio Serpents BRA",  prize: 7000,  tier: "Bronze",
  },
  {
    round: 43,  continent: "africa_middle_east",  country: "Kenya",
    city: "Diani",  beachName: "Diani Beach",
    displayName: "Diani Indian Ocean Open",  date: "2026-07-18",
    locId: 11,  locName: "Diani Beach, Kenya",
    opponent: "Sand Queens AU",  prize: 7500,  tier: "Bronze",
  },
  {
    round: 44,  continent: "africa_middle_east",  country: "Senegal",
    city: "Dakar",  beachName: "Plage de Yoff",
    displayName: "Dakar Atlantic Cup",  date: "2026-07-23",
    locId: 11,  locName: "Plage de Yoff, Dakar",
    opponent: "Tropical Blaze CUB",  prize: 8000,  tier: "Bronze",
  },
  {
    round: 45,  continent: "africa_middle_east",  country: "Tanzania",
    city: "Zanzibar",  beachName: "Nungwi Beach",
    displayName: "Zanzibar Bronze Open",  date: "2026-07-28",
    locId: 11,  locName: "Nungwi Beach, Zanzibar",
    opponent: "Iron Wave CHI",  prize: 8500,  tier: "Bronze",
  },
  {
    round: 46,  continent: "africa_middle_east",  country: "South Africa",
    city: "Cape Town",  beachName: "Clifton Beach",
    displayName: "Cape Town Silver Open",  date: "2026-08-01",
    locId: 2,  locName: "Clifton Beach, Cape Town",
    opponent: "Greek Fire GRE",  prize: 20500,  tier: "Silver",
  },
  {
    round: 47,  continent: "africa_middle_east",  country: "Morocco",
    city: "Essaouira",  beachName: "Mogador Beach",
    displayName: "Essaouira Wind Classic",  date: "2026-08-06",
    locId: 10,  locName: "Mogador Beach, Essaouira",
    opponent: "French Riviera FRA",  prize: 22000,  tier: "Silver",
  },
  {
    round: 48,  continent: "africa_middle_east",  country: "UAE",
    city: "Dubai",  beachName: "Jumeirah Beach",
    displayName: "Dubai Desert Pro",  date: "2026-08-11",
    locId: 11,  locName: "Jumeirah Beach, Dubai",
    opponent: "Island Aces THA",  prize: 25500,  tier: "Silver",
  },
  {
    round: 49,  continent: "africa_middle_east",  country: "Israel",
    city: "Tel Aviv",  beachName: "Gordon Beach",
    displayName: "Tel Aviv Gold Open",  date: "2026-08-15",
    locId: 11,  locName: "Gordon Beach, Tel Aviv",
    opponent: "Bali Tigers IDN",  prize: 47000,  tier: "Gold",
  },
  {
    round: 50,  continent: "africa_middle_east",  country: "Oman",
    city: "Muscat",  beachName: "Qurum Beach",
    displayName: "Muscat Gulf Masters",  date: "2026-08-20",
    locId: 11,  locName: "Qurum Beach, Muscat",
    opponent: "Storm Queens USA",  prize: 53500,  tier: "Gold",
  },

  // ── North America Tour  (Slots 51–60) ────────────────────────────────────
  {
    round: 51,  continent: "north_america",  country: "Mexico",
    city: "Cancún",  beachName: "Playa Delfines",
    displayName: "Cancún Open",  date: "2026-08-25",
    locId: 5,  locName: "Playa Delfines, Cancún",
    opponent: "Pacific Storm USA",  prize: 5000,  tier: "Bronze",
  },
  {
    round: 52,  continent: "north_america",  country: "USA",
    city: "Miami",  beachName: "South Beach",
    displayName: "Miami Beach Open",  date: "2026-08-30",
    locId: 4,  locName: "South Beach, Miami",
    opponent: "Rio Serpents BRA",  prize: 6500,  tier: "Bronze",
  },
  {
    round: 53,  continent: "north_america",  country: "Mexico",
    city: "Tulum",  beachName: "Playa Paraíso",
    displayName: "Tulum Jungle Cup",  date: "2026-09-03",
    locId: 5,  locName: "Playa Paraíso, Tulum",
    opponent: "Sand Queens AU",  prize: 8000,  tier: "Bronze",
  },
  {
    round: 54,  continent: "north_america",  country: "Puerto Rico",
    city: "San Juan",  beachName: "Condado Beach",
    displayName: "San Juan Caribbean Open",  date: "2026-09-08",
    locId: 5,  locName: "Condado Beach, San Juan",
    opponent: "Tropical Blaze CUB",  prize: 8500,  tier: "Bronze",
  },
  {
    round: 55,  continent: "north_america",  country: "Dominican Republic",
    city: "Punta Cana",  beachName: "Bávaro Beach",
    displayName: "Bávaro Bronze Classic",  date: "2026-09-13",
    locId: 5,  locName: "Bávaro Beach, Punta Cana",
    opponent: "Iron Wave CHI",  prize: 9000,  tier: "Bronze",
  },
  {
    round: 56,  continent: "north_america",  country: "USA",
    city: "Los Angeles",  beachName: "Manhattan Beach",
    displayName: "LA Beach Pro",  date: "2026-09-18",
    locId: 4,  locName: "Manhattan Beach, Los Angeles",
    opponent: "Greek Fire GRE",  prize: 18500,  tier: "Silver",
  },
  {
    round: 57,  continent: "north_america",  country: "Bahamas",
    city: "Nassau",  beachName: "Cable Beach",
    displayName: "Nassau Shore Classic",  date: "2026-09-22",
    locId: 5,  locName: "Cable Beach, Nassau",
    opponent: "French Riviera FRA",  prize: 22000,  tier: "Silver",
  },
  {
    round: 58,  continent: "north_america",  country: "Costa Rica",
    city: "Jacó",  beachName: "Playa Jacó",
    displayName: "Jacó Pacific Wave",  date: "2026-09-27",
    locId: 5,  locName: "Playa Jacó, Costa Rica",
    opponent: "Island Aces THA",  prize: 24000,  tier: "Silver",
  },
  {
    round: 59,  continent: "north_america",  country: "USA",
    city: "Honolulu",  beachName: "Waikiki Beach",
    displayName: "Waikiki Masters",  date: "2026-10-02",
    locId: 3,  locName: "Waikiki Beach, Honolulu",
    opponent: "Bali Tigers IDN",  prize: 45000,  tier: "Gold",
  },
  {
    round: 60,  continent: "north_america",  country: "Canada",
    city: "Vancouver",  beachName: "English Bay Beach",
    displayName: "Vancouver Bay Open",  date: "2026-10-06",
    locId: 4,  locName: "English Bay Beach, Vancouver",
    opponent: "Storm Queens USA",  prize: 51000,  tier: "Gold",
  },

  // ── South America Tour  (Slots 61–70) ────────────────────────────────────
  {
    round: 61,  continent: "south_america",  country: "Colombia",
    city: "Cartagena",  beachName: "Playa Blanca",
    displayName: "Cartagena Beach Cup",  date: "2026-10-11",
    locId: 1,  locName: "Playa Blanca, Cartagena",
    opponent: "Pacific Storm USA",  prize: 6000,  tier: "Bronze",
  },
  {
    round: 62,  continent: "south_america",  country: "Peru",
    city: "Lima",  beachName: "Costa Verde Beach",
    displayName: "Lima Pacific Open",  date: "2026-10-16",
    locId: 6,  locName: "Costa Verde Beach, Lima",
    opponent: "Rio Serpents BRA",  prize: 7000,  tier: "Bronze",
  },
  {
    round: 63,  continent: "south_america",  country: "Ecuador",
    city: "Salinas",  beachName: "Playa de Chipipe",
    displayName: "Salinas Shore Open",  date: "2026-10-21",
    locId: 5,  locName: "Playa de Chipipe, Salinas",
    opponent: "Sand Queens AU",  prize: 8000,  tier: "Bronze",
  },
  {
    round: 64,  continent: "south_america",  country: "Brazil",
    city: "Florianópolis",  beachName: "Joaquina Beach",
    displayName: "Florianópolis Open",  date: "2026-10-25",
    locId: 6,  locName: "Joaquina Beach, Florianópolis",
    opponent: "Tropical Blaze CUB",  prize: 8500,  tier: "Bronze",
  },
  {
    round: 65,  continent: "south_america",  country: "Chile",
    city: "Viña del Mar",  beachName: "Playa de Viña",
    displayName: "Viña del Mar Bronze Cup",  date: "2026-10-30",
    locId: 6,  locName: "Playa de Viña, Viña del Mar",
    opponent: "Iron Wave CHI",  prize: 9000,  tier: "Bronze",
  },
  {
    round: 66,  continent: "south_america",  country: "Argentina",
    city: "Mar del Plata",  beachName: "Playa Bristol",
    displayName: "Plata Silver Classic",  date: "2026-11-04",
    locId: 6,  locName: "Playa Bristol, Mar del Plata",
    opponent: "French Riviera FRA",  prize: 20500,  tier: "Silver",
  },
  {
    round: 67,  continent: "south_america",  country: "Uruguay",
    city: "Punta del Este",  beachName: "Playa Brava",
    displayName: "Punta del Este Pro",  date: "2026-11-09",
    locId: 6,  locName: "Playa Brava, Punta del Este",
    opponent: "Greek Fire GRE",  prize: 22000,  tier: "Silver",
  },
  {
    round: 68,  continent: "south_america",  country: "Chile",
    city: "Iquique",  beachName: "Cavancha Beach",
    displayName: "Iquique Desert Classic",  date: "2026-11-13",
    locId: 6,  locName: "Cavancha Beach, Iquique",
    opponent: "Island Aces THA",  prize: 24000,  tier: "Silver",
  },
  {
    round: 69,  continent: "south_america",  country: "Brazil",
    city: "Fortaleza",  beachName: "Iracema Beach",
    displayName: "Fortaleza Gold Cup",  date: "2026-11-18",
    locId: 6,  locName: "Iracema Beach, Fortaleza",
    opponent: "Bali Tigers IDN",  prize: 45000,  tier: "Gold",
  },
  {
    round: 70,  continent: "south_america",  country: "Colombia",
    city: "Barranquilla",  beachName: "Salgar Beach",
    displayName: "Barranquilla Gold Open",  date: "2026-11-23",
    locId: 1,  locName: "Salgar Beach, Barranquilla",
    opponent: "Storm Queens USA",  prize: 51000,  tier: "Gold",
  },

  // ── World Beach Pro Series Finals  (Slots 71–72) ─────────────────────────
  // Slot 71 = Semifinals Day — both SF matches played on the same schedule date.
  // Slot 72 = World Final Day — Grand Final between SF winners.
  // Location rotates each season; opponents resolved after regional qualification.
  {
    round: 71,  continent: "world",  country: "Brazil",
    city: "Rio de Janeiro",  beachName: "Copacabana Beach",
    displayName: "World Finals — Semifinals",  date: "2026-11-27",
    locId: 1,  locName: "Copacabana Beach, Rio de Janeiro",
    opponent: "TBD",  prize: 115000,  tier: "World Semi Final",
  },
  {
    round: 72,  continent: "world",  country: "Brazil",
    city: "Rio de Janeiro",  beachName: "Copacabana Beach",
    displayName: "World Beach Pro Series Final",  date: "2026-12-02",
    locId: 1,  locName: "Copacabana Beach, Rio de Janeiro",
    opponent: "TBD",  prize: 190000,  tier: "World Final",
  },
];
