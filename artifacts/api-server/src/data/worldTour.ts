export type Tier = "Bronze" | "Silver" | "Gold" | "Elite" | "Continental Final" | "World Semi Final" | "All-Star Match" | "World Final";

export interface WorldTourEvent {
  round:       number;
  continent:   string;
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

// Season structure (76 rounds total):
//   Asia (11 + CF) → Australia & Pacific (11 + CF) → Europe (11 + CF)
//   → Africa & Middle East (11 + CF) → North America (11 + CF) → South America (11 + CF)
//   → World Grand Final (rounds 73–76)
// Each continental tour has 5 Bronze opponents (player + 5 = 6 teams per competition).
// Regular events use a 4-day cadence; 5-day gap precedes each Continental Final.
export const WORLD_TOUR: WorldTourEvent[] = [

  // ── Asia Tour  (Rounds 1–12) ──────────────────────────────────────────────
  {
    round: 1,  continent: "Asia",  country: "Thailand",
    city: "Phuket",  beachName: "Kata Beach",
    displayName: "Phuket Beach Classic",  date: "2026-01-08",
    locId: 7,  locName: "Kata Beach, Phuket",
    opponent: "Pacific Storm USA",  prize: 6000,  tier: "Bronze",
  },
  {
    round: 2,  continent: "Asia",  country: "Indonesia",
    city: "Bali",  beachName: "Kuta Beach",
    displayName: "Bali Kuta Open",  date: "2026-01-12",
    locId: 9,  locName: "Kuta Beach, Bali",
    opponent: "Rio Serpents BRA",  prize: 7000,  tier: "Bronze",
  },
  {
    round: 3,  continent: "Asia",  country: "Vietnam",
    city: "Da Nang",  beachName: "My Khe Beach",
    displayName: "Da Nang My Khe Open",  date: "2026-01-16",
    locId: 7,  locName: "My Khe Beach, Da Nang",
    opponent: "Sand Queens AU",  prize: 7500,  tier: "Bronze",
  },
  {
    round: 4,  continent: "Asia",  country: "Thailand",
    city: "Pattaya",  beachName: "Jomtien Beach",
    displayName: "Pattaya Gulf Classic",  date: "2026-01-20",
    locId: 7,  locName: "Jomtien Beach, Pattaya",
    opponent: "Tropical Blaze CUB",  prize: 8000,  tier: "Bronze",
  },
  {
    round: 5,  continent: "Asia",  country: "Malaysia",
    city: "Penang",  beachName: "Batu Ferringhi Beach",
    displayName: "Penang Shore Bronze",  date: "2026-01-24",
    locId: 9,  locName: "Batu Ferringhi Beach, Penang",
    opponent: "Iron Wave CHI",  prize: 8500,  tier: "Bronze",
  },
  {
    round: 6,  continent: "Asia",  country: "Indonesia",
    city: "Lombok",  beachName: "Selong Belanak Beach",
    displayName: "Lombok Shore Silver",  date: "2026-01-28",
    locId: 9,  locName: "Selong Belanak, Lombok",
    opponent: "Greek Fire GRE",  prize: 12000,  tier: "Silver",
  },
  {
    round: 7,  continent: "Asia",  country: "South Korea",
    city: "Jeju",  beachName: "Hyeopjae Beach",
    displayName: "Jeju Island Silver Open",  date: "2026-02-01",
    locId: 7,  locName: "Hyeopjae Beach, Jeju",
    opponent: "French Riviera FRA",  prize: 14000,  tier: "Silver",
  },
  {
    round: 8,  continent: "Asia",  country: "Japan",
    city: "Okinawa",  beachName: "Emerald Beach",
    displayName: "Okinawa Gold Series",  date: "2026-02-05",
    locId: 7,  locName: "Emerald Beach, Okinawa",
    opponent: "Island Aces THA",  prize: 22000,  tier: "Gold",
  },
  {
    round: 9,  continent: "Asia",  country: "Thailand",
    city: "Koh Samui",  beachName: "Chaweng Beach",
    displayName: "Samui Gold Masters",  date: "2026-02-09",
    locId: 7,  locName: "Chaweng Beach, Koh Samui",
    opponent: "Bali Tigers IDN",  prize: 25000,  tier: "Gold",
  },
  {
    round: 10,  continent: "Asia",  country: "India",
    city: "Goa",  beachName: "Vagator Beach",
    displayName: "Goa Gold Open",  date: "2026-02-13",
    locId: 9,  locName: "Vagator Beach, Goa",
    opponent: "Storm Queens USA",  prize: 28000,  tier: "Gold",
  },
  {
    round: 11,  continent: "Asia",  country: "Philippines",
    city: "La Union",  beachName: "Urbiztondo Beach",
    displayName: "La Union Elite Open",  date: "2026-02-17",
    locId: 9,  locName: "Urbiztondo Beach, La Union",
    opponent: "Sydney Sharks AU",  prize: 47000,  tier: "Elite",
  },
  // ── Asia Continental Final  (Round 12) ───────────────────────────────────
  {
    round: 12,  continent: "Asia",  country: "Thailand",
    city: "Phuket",  beachName: "Kata Beach",
    displayName: "Asia Continental Final",  date: "2026-02-22",
    locId: 7,  locName: "Kata Beach, Phuket",
    opponent: "Asia All-Stars",  prize: 80000,  tier: "Continental Final",
  },

  // ── Australia & Pacific Tour  (Rounds 13–24) ──────────────────────────────
  {
    round: 13,  continent: "Australia & Pacific",  country: "Fiji",
    city: "Nadi",  beachName: "Natadola Beach",
    displayName: "Fiji Natadola Open",  date: "2026-02-27",
    locId: 2,  locName: "Natadola Beach, Nadi",
    opponent: "Pacific Storm USA",  prize: 6500,  tier: "Bronze",
  },
  {
    round: 14,  continent: "Australia & Pacific",  country: "Samoa",
    city: "Apia",  beachName: "Return to Paradise Beach",
    displayName: "Samoa Paradise Cup",  date: "2026-03-03",
    locId: 2,  locName: "Return to Paradise Beach, Apia",
    opponent: "Rio Serpents BRA",  prize: 7000,  tier: "Bronze",
  },
  {
    round: 15,  continent: "Australia & Pacific",  country: "Vanuatu",
    city: "Port Vila",  beachName: "Pango Beach",
    displayName: "Vanuatu Pacific Open",  date: "2026-03-07",
    locId: 2,  locName: "Pango Beach, Port Vila",
    opponent: "Sand Queens AU",  prize: 7500,  tier: "Bronze",
  },
  {
    round: 16,  continent: "Australia & Pacific",  country: "Australia",
    city: "Brisbane",  beachName: "Surfers Paradise",
    displayName: "Surfers Paradise Bronze",  date: "2026-03-11",
    locId: 2,  locName: "Surfers Paradise, Brisbane",
    opponent: "Tropical Blaze CUB",  prize: 8000,  tier: "Bronze",
  },
  {
    round: 17,  continent: "Australia & Pacific",  country: "French Polynesia",
    city: "Bora Bora",  beachName: "Matira Beach",
    displayName: "Bora Bora Bronze Classic",  date: "2026-03-15",
    locId: 2,  locName: "Matira Beach, Bora Bora",
    opponent: "Iron Wave CHI",  prize: 8500,  tier: "Bronze",
  },
  {
    round: 18,  continent: "Australia & Pacific",  country: "New Zealand",
    city: "Auckland",  beachName: "Piha Beach",
    displayName: "Piha Silver Classic",  date: "2026-03-19",
    locId: 2,  locName: "Piha Beach, Auckland",
    opponent: "Greek Fire GRE",  prize: 13000,  tier: "Silver",
  },
  {
    round: 19,  continent: "Australia & Pacific",  country: "New Caledonia",
    city: "Noumea",  beachName: "Anse Vata Beach",
    displayName: "Noumea Pacific Silver",  date: "2026-03-23",
    locId: 2,  locName: "Anse Vata Beach, Noumea",
    opponent: "French Riviera FRA",  prize: 14000,  tier: "Silver",
  },
  {
    round: 20,  continent: "Australia & Pacific",  country: "Fiji",
    city: "Pacific Harbour",  beachName: "Pacific Harbour Beach",
    displayName: "Fiji Gold Series",  date: "2026-03-27",
    locId: 2,  locName: "Pacific Harbour Beach, Fiji",
    opponent: "Island Aces THA",  prize: 15000,  tier: "Silver",
  },
  {
    round: 21,  continent: "Australia & Pacific",  country: "Australia",
    city: "Cairns",  beachName: "Mission Beach",
    displayName: "Cairns Tropics Gold",  date: "2026-03-31",
    locId: 2,  locName: "Mission Beach, Cairns",
    opponent: "Bali Tigers IDN",  prize: 24000,  tier: "Gold",
  },
  {
    round: 22,  continent: "Australia & Pacific",  country: "Australia",
    city: "Sydney",  beachName: "Bondi Beach",
    displayName: "Bondi Gold Masters",  date: "2026-04-04",
    locId: 2,  locName: "Bondi Beach, Sydney",
    opponent: "Storm Queens USA",  prize: 28000,  tier: "Gold",
  },
  {
    round: 23,  continent: "Australia & Pacific",  country: "New Zealand",
    city: "Christchurch",  beachName: "Sumner Beach",
    displayName: "Sumner Elite Final",  date: "2026-04-08",
    locId: 2,  locName: "Sumner Beach, Christchurch",
    opponent: "Sydney Sharks AU",  prize: 48000,  tier: "Elite",
  },
  // ── Australia & Pacific Continental Final  (Round 24) ─────────────────────
  {
    round: 24,  continent: "Australia & Pacific",  country: "Australia",
    city: "Sydney",  beachName: "Bondi Beach",
    displayName: "Australia & Pacific Continental Final",  date: "2026-04-13",
    locId: 2,  locName: "Bondi Beach, Sydney",
    opponent: "Pacific All-Stars",  prize: 80000,  tier: "Continental Final",
  },

  // ── Europe Tour  (Rounds 25–36) ───────────────────────────────────────────
  {
    round: 25,  continent: "Europe",  country: "Portugal",
    city: "Cascais",  beachName: "Guincho Beach",
    displayName: "Cascais Atlantic Open",  date: "2026-04-18",
    locId: 10,  locName: "Guincho Beach, Cascais",
    opponent: "Pacific Storm USA",  prize: 6000,  tier: "Bronze",
  },
  {
    round: 26,  continent: "Europe",  country: "Italy",
    city: "Rimini",  beachName: "Rimini Beach",
    displayName: "Rimini Riviera Cup",  date: "2026-04-22",
    locId: 8,  locName: "Rimini Beach, Italy",
    opponent: "Rio Serpents BRA",  prize: 7000,  tier: "Bronze",
  },
  {
    round: 27,  continent: "Europe",  country: "Croatia",
    city: "Poreč",  beachName: "Plava Laguna Beach",
    displayName: "Poreč Adriatic Open",  date: "2026-04-26",
    locId: 8,  locName: "Plava Laguna Beach, Poreč",
    opponent: "Sand Queens AU",  prize: 7500,  tier: "Bronze",
  },
  {
    round: 28,  continent: "Europe",  country: "Turkey",
    city: "Antalya",  beachName: "Konyaaltı Beach",
    displayName: "Antalya Beach Pro",  date: "2026-04-30",
    locId: 11,  locName: "Konyaaltı Beach, Antalya",
    opponent: "Tropical Blaze CUB",  prize: 8000,  tier: "Bronze",
  },
  {
    round: 29,  continent: "Europe",  country: "Netherlands",
    city: "The Hague",  beachName: "Scheveningen Beach",
    displayName: "Scheveningen Bronze Cup",  date: "2026-05-04",
    locId: 10,  locName: "Scheveningen Beach, The Hague",
    opponent: "Iron Wave CHI",  prize: 8500,  tier: "Bronze",
  },
  {
    round: 30,  continent: "Europe",  country: "Spain",
    city: "Barcelona",  beachName: "Barceloneta Beach",
    displayName: "Barcelona City Open",  date: "2026-05-08",
    locId: 10,  locName: "Barceloneta Beach, Barcelona",
    opponent: "Greek Fire GRE",  prize: 13000,  tier: "Silver",
  },
  {
    round: 31,  continent: "Europe",  country: "France",
    city: "Nice",  beachName: "Côte d'Azur Beach",
    displayName: "Nice Riviera Classic",  date: "2026-05-12",
    locId: 10,  locName: "Côte d'Azur Beach, Nice",
    opponent: "French Riviera FRA",  prize: 14000,  tier: "Silver",
  },
  {
    round: 32,  continent: "Europe",  country: "Germany",
    city: "Hamburg",  beachName: "Timmendorfer Strand",
    displayName: "Hamburg North Open",  date: "2026-05-16",
    locId: 10,  locName: "Timmendorfer Strand, Hamburg",
    opponent: "Island Aces THA",  prize: 23000,  tier: "Gold",
  },
  {
    round: 33,  continent: "Europe",  country: "Greece",
    city: "Mykonos",  beachName: "Super Paradise Beach",
    displayName: "Mykonos Gold Masters",  date: "2026-05-20",
    locId: 8,  locName: "Super Paradise Beach, Mykonos",
    opponent: "Bali Tigers IDN",  prize: 26000,  tier: "Gold",
  },
  {
    round: 34,  continent: "Europe",  country: "Spain",
    city: "Valencia",  beachName: "Playa de la Malvarrosa",
    displayName: "Valencia Gold Open",  date: "2026-05-24",
    locId: 10,  locName: "Playa Malvarrosa, Valencia",
    opponent: "Storm Queens USA",  prize: 29000,  tier: "Gold",
  },
  {
    round: 35,  continent: "Europe",  country: "Croatia",
    city: "Split",  beachName: "Bačvice Beach",
    displayName: "Split Elite Cup",  date: "2026-05-28",
    locId: 8,  locName: "Bačvice Beach, Split",
    opponent: "Sydney Sharks AU",  prize: 46000,  tier: "Elite",
  },
  // ── Europe Continental Final  (Round 36) ──────────────────────────────────
  {
    round: 36,  continent: "Europe",  country: "Spain",
    city: "Barcelona",  beachName: "Barceloneta Beach",
    displayName: "Europe Continental Final",  date: "2026-06-02",
    locId: 10,  locName: "Barceloneta Beach, Barcelona",
    opponent: "Europe All-Stars",  prize: 80000,  tier: "Continental Final",
  },

  // ── Africa & Middle East Tour  (Rounds 37–48) ─────────────────────────────
  {
    round: 37,  continent: "Africa & Middle East",  country: "Egypt",
    city: "Hurghada",  beachName: "Red Sea Beach",
    displayName: "Hurghada Red Sea Open",  date: "2026-06-07",
    locId: 11,  locName: "Red Sea Beach, Hurghada",
    opponent: "Pacific Storm USA",  prize: 5500,  tier: "Bronze",
  },
  {
    round: 38,  continent: "Africa & Middle East",  country: "Morocco",
    city: "Agadir",  beachName: "Agadir Beach",
    displayName: "Agadir Atlantic Open",  date: "2026-06-11",
    locId: 10,  locName: "Agadir Beach, Morocco",
    opponent: "Rio Serpents BRA",  prize: 6500,  tier: "Bronze",
  },
  {
    round: 39,  continent: "Africa & Middle East",  country: "Kenya",
    city: "Diani",  beachName: "Diani Beach",
    displayName: "Diani Indian Ocean Open",  date: "2026-06-15",
    locId: 11,  locName: "Diani Beach, Kenya",
    opponent: "Sand Queens AU",  prize: 7000,  tier: "Bronze",
  },
  {
    round: 40,  continent: "Africa & Middle East",  country: "Senegal",
    city: "Dakar",  beachName: "Plage de Yoff",
    displayName: "Dakar Atlantic Cup",  date: "2026-06-19",
    locId: 11,  locName: "Plage de Yoff, Dakar",
    opponent: "Tropical Blaze CUB",  prize: 7500,  tier: "Bronze",
  },
  {
    round: 41,  continent: "Africa & Middle East",  country: "Tanzania",
    city: "Zanzibar",  beachName: "Nungwi Beach",
    displayName: "Zanzibar Bronze Open",  date: "2026-06-23",
    locId: 11,  locName: "Nungwi Beach, Zanzibar",
    opponent: "Iron Wave CHI",  prize: 8000,  tier: "Bronze",
  },
  {
    round: 42,  continent: "Africa & Middle East",  country: "South Africa",
    city: "Cape Town",  beachName: "Clifton Beach",
    displayName: "Cape Town Silver Open",  date: "2026-06-27",
    locId: 2,  locName: "Clifton Beach, Cape Town",
    opponent: "Greek Fire GRE",  prize: 12000,  tier: "Silver",
  },
  {
    round: 43,  continent: "Africa & Middle East",  country: "Morocco",
    city: "Essaouira",  beachName: "Mogador Beach",
    displayName: "Essaouira Wind Classic",  date: "2026-07-01",
    locId: 10,  locName: "Mogador Beach, Essaouira",
    opponent: "French Riviera FRA",  prize: 13000,  tier: "Silver",
  },
  {
    round: 44,  continent: "Africa & Middle East",  country: "UAE",
    city: "Dubai",  beachName: "Jumeirah Beach",
    displayName: "Dubai Desert Pro",  date: "2026-07-05",
    locId: 11,  locName: "Jumeirah Beach, Dubai",
    opponent: "Island Aces THA",  prize: 15000,  tier: "Silver",
  },
  {
    round: 45,  continent: "Africa & Middle East",  country: "Israel",
    city: "Tel Aviv",  beachName: "Gordon Beach",
    displayName: "Tel Aviv Gold Open",  date: "2026-07-09",
    locId: 11,  locName: "Gordon Beach, Tel Aviv",
    opponent: "Bali Tigers IDN",  prize: 23000,  tier: "Gold",
  },
  {
    round: 46,  continent: "Africa & Middle East",  country: "Oman",
    city: "Muscat",  beachName: "Qurum Beach",
    displayName: "Muscat Gulf Masters",  date: "2026-07-13",
    locId: 11,  locName: "Qurum Beach, Muscat",
    opponent: "Storm Queens USA",  prize: 26000,  tier: "Gold",
  },
  {
    round: 47,  continent: "Africa & Middle East",  country: "Egypt",
    city: "Alexandria",  beachName: "Montazah Beach",
    displayName: "Alexandria Elite Open",  date: "2026-07-17",
    locId: 11,  locName: "Montazah Beach, Alexandria",
    opponent: "Sydney Sharks AU",  prize: 44000,  tier: "Elite",
  },
  // ── Africa & Middle East Continental Final  (Round 48) ────────────────────
  {
    round: 48,  continent: "Africa & Middle East",  country: "UAE",
    city: "Dubai",  beachName: "Jumeirah Beach",
    displayName: "Africa & Middle East Continental Final",  date: "2026-07-22",
    locId: 11,  locName: "Jumeirah Beach, Dubai",
    opponent: "African All-Stars",  prize: 80000,  tier: "Continental Final",
  },

  // ── North America Tour  (Rounds 49–60) ────────────────────────────────────
  {
    round: 49,  continent: "North America",  country: "Mexico",
    city: "Cancún",  beachName: "Playa Delfines",
    displayName: "Cancún Open",  date: "2026-07-27",
    locId: 5,  locName: "Playa Delfines, Cancún",
    opponent: "Pacific Storm USA",  prize: 5000,  tier: "Bronze",
  },
  {
    round: 50,  continent: "North America",  country: "USA",
    city: "Miami",  beachName: "South Beach",
    displayName: "Miami Beach Open",  date: "2026-07-31",
    locId: 4,  locName: "South Beach, Miami",
    opponent: "Rio Serpents BRA",  prize: 6000,  tier: "Bronze",
  },
  {
    round: 51,  continent: "North America",  country: "Mexico",
    city: "Tulum",  beachName: "Playa Paraíso",
    displayName: "Tulum Jungle Cup",  date: "2026-08-04",
    locId: 5,  locName: "Playa Paraíso, Tulum",
    opponent: "Sand Queens AU",  prize: 7500,  tier: "Bronze",
  },
  {
    round: 52,  continent: "North America",  country: "Puerto Rico",
    city: "San Juan",  beachName: "Condado Beach",
    displayName: "San Juan Caribbean Open",  date: "2026-08-08",
    locId: 5,  locName: "Condado Beach, San Juan",
    opponent: "Tropical Blaze CUB",  prize: 8000,  tier: "Bronze",
  },
  {
    round: 53,  continent: "North America",  country: "Dominican Republic",
    city: "Punta Cana",  beachName: "Bávaro Beach",
    displayName: "Bávaro Bronze Classic",  date: "2026-08-12",
    locId: 5,  locName: "Bávaro Beach, Punta Cana",
    opponent: "Iron Wave CHI",  prize: 8500,  tier: "Bronze",
  },
  {
    round: 54,  continent: "North America",  country: "USA",
    city: "Los Angeles",  beachName: "Manhattan Beach",
    displayName: "LA Beach Pro",  date: "2026-08-16",
    locId: 4,  locName: "Manhattan Beach, Los Angeles",
    opponent: "Greek Fire GRE",  prize: 11000,  tier: "Silver",
  },
  {
    round: 55,  continent: "North America",  country: "Bahamas",
    city: "Nassau",  beachName: "Cable Beach",
    displayName: "Nassau Shore Classic",  date: "2026-08-20",
    locId: 5,  locName: "Cable Beach, Nassau",
    opponent: "French Riviera FRA",  prize: 13000,  tier: "Silver",
  },
  {
    round: 56,  continent: "North America",  country: "Costa Rica",
    city: "Jacó",  beachName: "Playa Jacó",
    displayName: "Jacó Pacific Wave",  date: "2026-08-24",
    locId: 5,  locName: "Playa Jacó, Costa Rica",
    opponent: "Island Aces THA",  prize: 14000,  tier: "Silver",
  },
  {
    round: 57,  continent: "North America",  country: "USA",
    city: "Honolulu",  beachName: "Waikiki Beach",
    displayName: "Waikiki Masters",  date: "2026-08-28",
    locId: 3,  locName: "Waikiki Beach, Honolulu",
    opponent: "Bali Tigers IDN",  prize: 22000,  tier: "Gold",
  },
  {
    round: 58,  continent: "North America",  country: "Canada",
    city: "Vancouver",  beachName: "English Bay Beach",
    displayName: "Vancouver Bay Open",  date: "2026-09-01",
    locId: 4,  locName: "English Bay Beach, Vancouver",
    opponent: "Storm Queens USA",  prize: 25000,  tier: "Gold",
  },
  {
    round: 59,  continent: "North America",  country: "Mexico",
    city: "Cabo San Lucas",  beachName: "El Médano Beach",
    displayName: "Cabo Elite Series",  date: "2026-09-05",
    locId: 5,  locName: "El Médano Beach, Cabo San Lucas",
    opponent: "Sydney Sharks AU",  prize: 38000,  tier: "Elite",
  },
  // ── North America Continental Final  (Round 60) ───────────────────────────
  {
    round: 60,  continent: "North America",  country: "USA",
    city: "Honolulu",  beachName: "Waikiki Beach",
    displayName: "North America Continental Final",  date: "2026-09-10",
    locId: 3,  locName: "Waikiki Beach, Honolulu",
    opponent: "Americas All-Stars",  prize: 80000,  tier: "Continental Final",
  },

  // ── South America Tour  (Rounds 61–72) ────────────────────────────────────
  {
    round: 61,  continent: "South America",  country: "Colombia",
    city: "Cartagena",  beachName: "Playa Blanca",
    displayName: "Cartagena Beach Cup",  date: "2026-09-15",
    locId: 1,  locName: "Playa Blanca, Cartagena",
    opponent: "Pacific Storm USA",  prize: 5500,  tier: "Bronze",
  },
  {
    round: 62,  continent: "South America",  country: "Peru",
    city: "Lima",  beachName: "Costa Verde Beach",
    displayName: "Lima Pacific Open",  date: "2026-09-19",
    locId: 6,  locName: "Costa Verde Beach, Lima",
    opponent: "Rio Serpents BRA",  prize: 6500,  tier: "Bronze",
  },
  {
    round: 63,  continent: "South America",  country: "Ecuador",
    city: "Salinas",  beachName: "Playa de Chipipe",
    displayName: "Salinas Shore Open",  date: "2026-09-23",
    locId: 5,  locName: "Playa de Chipipe, Salinas",
    opponent: "Sand Queens AU",  prize: 7500,  tier: "Bronze",
  },
  {
    round: 64,  continent: "South America",  country: "Brazil",
    city: "Florianópolis",  beachName: "Joaquina Beach",
    displayName: "Florianópolis Open",  date: "2026-09-27",
    locId: 6,  locName: "Joaquina Beach, Florianópolis",
    opponent: "Tropical Blaze CUB",  prize: 8000,  tier: "Bronze",
  },
  {
    round: 65,  continent: "South America",  country: "Chile",
    city: "Viña del Mar",  beachName: "Playa de Viña",
    displayName: "Viña del Mar Bronze Cup",  date: "2026-10-01",
    locId: 6,  locName: "Playa de Viña, Viña del Mar",
    opponent: "Iron Wave CHI",  prize: 8500,  tier: "Bronze",
  },
  {
    round: 66,  continent: "South America",  country: "Argentina",
    city: "Mar del Plata",  beachName: "Playa Bristol",
    displayName: "Plata Silver Classic",  date: "2026-10-05",
    locId: 6,  locName: "Playa Bristol, Mar del Plata",
    opponent: "French Riviera FRA",  prize: 12000,  tier: "Silver",
  },
  {
    round: 67,  continent: "South America",  country: "Uruguay",
    city: "Punta del Este",  beachName: "Playa Brava",
    displayName: "Punta del Este Pro",  date: "2026-10-09",
    locId: 6,  locName: "Playa Brava, Punta del Este",
    opponent: "Greek Fire GRE",  prize: 13000,  tier: "Silver",
  },
  {
    round: 68,  continent: "South America",  country: "Chile",
    city: "Iquique",  beachName: "Cavancha Beach",
    displayName: "Iquique Desert Classic",  date: "2026-10-13",
    locId: 6,  locName: "Cavancha Beach, Iquique",
    opponent: "Island Aces THA",  prize: 14000,  tier: "Silver",
  },
  {
    round: 69,  continent: "South America",  country: "Brazil",
    city: "Fortaleza",  beachName: "Iracema Beach",
    displayName: "Fortaleza Gold Cup",  date: "2026-10-17",
    locId: 6,  locName: "Iracema Beach, Fortaleza",
    opponent: "Storm Queens USA",  prize: 22000,  tier: "Gold",
  },
  {
    round: 70,  continent: "South America",  country: "Colombia",
    city: "Barranquilla",  beachName: "Salgar Beach",
    displayName: "Barranquilla Gold Open",  date: "2026-10-21",
    locId: 1,  locName: "Salgar Beach, Barranquilla",
    opponent: "Bali Tigers IDN",  prize: 25000,  tier: "Gold",
  },
  {
    round: 71,  continent: "South America",  country: "Brazil",
    city: "Rio de Janeiro",  beachName: "Copacabana Beach",
    displayName: "Copa Rio Elite",  date: "2026-10-25",
    locId: 1,  locName: "Copacabana Beach, Rio de Janeiro",
    opponent: "Sydney Sharks AU",  prize: 45000,  tier: "Elite",
  },
  // ── South America Continental Final  (Round 72) ───────────────────────────
  {
    round: 72,  continent: "South America",  country: "Brazil",
    city: "Rio de Janeiro",  beachName: "Copacabana Beach",
    displayName: "South America Continental Final",  date: "2026-10-30",
    locId: 1,  locName: "Copacabana Beach, Rio de Janeiro",
    opponent: "South American All-Stars",  prize: 80000,  tier: "Continental Final",
  },

  // ── World Beach Pro Series Finals  (Rounds 73–76) ─────────────────────────
  // Location is randomised each season in the fixture route.
  // awayTeamName / homeTeamName for these are resolved at fixture-fetch time
  // once all 6 continental finals are complete.
  {
    round: 73,  continent: "World",  country: "Brazil",
    city: "Rio de Janeiro",  beachName: "Copacabana Beach",
    displayName: "World Finals — Semi Final 1",  date: "2026-12-15",
    locId: 1,  locName: "Copacabana Beach, Rio de Janeiro",
    opponent: "TBD",  prize: 150000,  tier: "World Semi Final",
  },
  {
    round: 74,  continent: "World",  country: "Brazil",
    city: "Rio de Janeiro",  beachName: "Copacabana Beach",
    displayName: "World Finals — Semi Final 2",  date: "2026-12-16",
    locId: 1,  locName: "Copacabana Beach, Rio de Janeiro",
    opponent: "TBD",  prize: 150000,  tier: "World Semi Final",
  },
  {
    round: 75,  continent: "World",  country: "Brazil",
    city: "Rio de Janeiro",  beachName: "Copacabana Beach",
    displayName: "World Finals — All-Star Match",  date: "2026-12-17",
    locId: 1,  locName: "Copacabana Beach, Rio de Janeiro",
    opponent: "World All-Stars",  prize: 50000,  tier: "All-Star Match",
  },
  {
    round: 76,  continent: "World",  country: "Brazil",
    city: "Rio de Janeiro",  beachName: "Copacabana Beach",
    displayName: "World Beach Pro Series Final",  date: "2026-12-18",
    locId: 1,  locName: "Copacabana Beach, Rio de Janeiro",
    opponent: "TBD",  prize: 500000,  tier: "World Final",
  },
];
