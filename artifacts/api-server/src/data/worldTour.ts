export type Tier = "Bronze" | "Silver" | "Gold" | "Elite" | "Continental Final" | "Grand Final";

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

// Season structure (67 rounds total):
//   Asia (10 + CF) → Australia & Pacific (10 + CF) → Europe (10 + CF)
//   → Africa & Middle East (10 + CF) → North America (10 + CF) → South America (10 + CF)
//   → World Grand Final
// Regular events use a 4-day cadence; 5-day gap precedes each Continental Final.
export const WORLD_TOUR: WorldTourEvent[] = [

  // ── Asia Tour  (Rounds 1–10) ───────────────────────────────────────────────
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
    round: 5,  continent: "Asia",  country: "Indonesia",
    city: "Lombok",  beachName: "Selong Belanak Beach",
    displayName: "Lombok Shore Silver",  date: "2026-01-24",
    locId: 9,  locName: "Selong Belanak, Lombok",
    opponent: "Greek Fire GRE",  prize: 12000,  tier: "Silver",
  },
  {
    round: 6,  continent: "Asia",  country: "South Korea",
    city: "Jeju",  beachName: "Hyeopjae Beach",
    displayName: "Jeju Island Silver Open",  date: "2026-01-28",
    locId: 7,  locName: "Hyeopjae Beach, Jeju",
    opponent: "French Riviera FRA",  prize: 14000,  tier: "Silver",
  },
  {
    round: 7,  continent: "Asia",  country: "Japan",
    city: "Okinawa",  beachName: "Emerald Beach",
    displayName: "Okinawa Gold Series",  date: "2026-02-01",
    locId: 7,  locName: "Emerald Beach, Okinawa",
    opponent: "Island Aces THA",  prize: 22000,  tier: "Gold",
  },
  {
    round: 8,  continent: "Asia",  country: "Thailand",
    city: "Koh Samui",  beachName: "Chaweng Beach",
    displayName: "Samui Gold Masters",  date: "2026-02-05",
    locId: 7,  locName: "Chaweng Beach, Koh Samui",
    opponent: "Bali Tigers IDN",  prize: 25000,  tier: "Gold",
  },
  {
    round: 9,  continent: "Asia",  country: "India",
    city: "Goa",  beachName: "Vagator Beach",
    displayName: "Goa Gold Open",  date: "2026-02-09",
    locId: 9,  locName: "Vagator Beach, Goa",
    opponent: "Storm Queens USA",  prize: 28000,  tier: "Gold",
  },
  {
    round: 10,  continent: "Asia",  country: "Philippines",
    city: "La Union",  beachName: "Urbiztondo Beach",
    displayName: "La Union Elite Open",  date: "2026-02-13",
    locId: 9,  locName: "Urbiztondo Beach, La Union",
    opponent: "Sydney Sharks AU",  prize: 47000,  tier: "Elite",
  },
  // ── Asia Continental Final  (Round 11) ────────────────────────────────────
  {
    round: 11,  continent: "Asia",  country: "Thailand",
    city: "Phuket",  beachName: "Kata Beach",
    displayName: "Asia Continental Final",  date: "2026-02-18",
    locId: 7,  locName: "Kata Beach, Phuket",
    opponent: "Asia All-Stars",  prize: 80000,  tier: "Continental Final",
  },

  // ── Australia & Pacific Tour  (Rounds 12–21) ──────────────────────────────
  {
    round: 12,  continent: "Australia & Pacific",  country: "Fiji",
    city: "Nadi",  beachName: "Natadola Beach",
    displayName: "Fiji Natadola Open",  date: "2026-02-23",
    locId: 2,  locName: "Natadola Beach, Nadi",
    opponent: "Pacific Storm USA",  prize: 6500,  tier: "Bronze",
  },
  {
    round: 13,  continent: "Australia & Pacific",  country: "Samoa",
    city: "Apia",  beachName: "Return to Paradise Beach",
    displayName: "Samoa Paradise Cup",  date: "2026-02-27",
    locId: 2,  locName: "Return to Paradise Beach, Apia",
    opponent: "Rio Serpents BRA",  prize: 7000,  tier: "Bronze",
  },
  {
    round: 14,  continent: "Australia & Pacific",  country: "Vanuatu",
    city: "Port Vila",  beachName: "Pango Beach",
    displayName: "Vanuatu Pacific Open",  date: "2026-03-03",
    locId: 2,  locName: "Pango Beach, Port Vila",
    opponent: "Sand Queens AU",  prize: 7500,  tier: "Bronze",
  },
  {
    round: 15,  continent: "Australia & Pacific",  country: "Australia",
    city: "Brisbane",  beachName: "Surfers Paradise",
    displayName: "Surfers Paradise Bronze",  date: "2026-03-07",
    locId: 2,  locName: "Surfers Paradise, Brisbane",
    opponent: "Tropical Blaze CUB",  prize: 8000,  tier: "Bronze",
  },
  {
    round: 16,  continent: "Australia & Pacific",  country: "New Zealand",
    city: "Auckland",  beachName: "Piha Beach",
    displayName: "Piha Silver Classic",  date: "2026-03-11",
    locId: 2,  locName: "Piha Beach, Auckland",
    opponent: "Greek Fire GRE",  prize: 13000,  tier: "Silver",
  },
  {
    round: 17,  continent: "Australia & Pacific",  country: "New Caledonia",
    city: "Noumea",  beachName: "Anse Vata Beach",
    displayName: "Noumea Pacific Silver",  date: "2026-03-15",
    locId: 2,  locName: "Anse Vata Beach, Noumea",
    opponent: "French Riviera FRA",  prize: 14000,  tier: "Silver",
  },
  {
    round: 18,  continent: "Australia & Pacific",  country: "Fiji",
    city: "Pacific Harbour",  beachName: "Pacific Harbour Beach",
    displayName: "Fiji Gold Series",  date: "2026-03-19",
    locId: 2,  locName: "Pacific Harbour Beach, Fiji",
    opponent: "Island Aces THA",  prize: 15000,  tier: "Silver",
  },
  {
    round: 19,  continent: "Australia & Pacific",  country: "Australia",
    city: "Cairns",  beachName: "Mission Beach",
    displayName: "Cairns Tropics Gold",  date: "2026-03-23",
    locId: 2,  locName: "Mission Beach, Cairns",
    opponent: "Bali Tigers IDN",  prize: 24000,  tier: "Gold",
  },
  {
    round: 20,  continent: "Australia & Pacific",  country: "Australia",
    city: "Sydney",  beachName: "Bondi Beach",
    displayName: "Bondi Gold Masters",  date: "2026-03-27",
    locId: 2,  locName: "Bondi Beach, Sydney",
    opponent: "Storm Queens USA",  prize: 28000,  tier: "Gold",
  },
  {
    round: 21,  continent: "Australia & Pacific",  country: "New Zealand",
    city: "Christchurch",  beachName: "Sumner Beach",
    displayName: "Sumner Elite Final",  date: "2026-03-31",
    locId: 2,  locName: "Sumner Beach, Christchurch",
    opponent: "Sydney Sharks AU",  prize: 48000,  tier: "Elite",
  },
  // ── Australia & Pacific Continental Final  (Round 22) ─────────────────────
  {
    round: 22,  continent: "Australia & Pacific",  country: "Australia",
    city: "Sydney",  beachName: "Bondi Beach",
    displayName: "Australia & Pacific Continental Final",  date: "2026-04-05",
    locId: 2,  locName: "Bondi Beach, Sydney",
    opponent: "Pacific All-Stars",  prize: 80000,  tier: "Continental Final",
  },

  // ── Europe Tour  (Rounds 23–32) ───────────────────────────────────────────
  {
    round: 23,  continent: "Europe",  country: "Portugal",
    city: "Cascais",  beachName: "Guincho Beach",
    displayName: "Cascais Atlantic Open",  date: "2026-04-10",
    locId: 10,  locName: "Guincho Beach, Cascais",
    opponent: "Pacific Storm USA",  prize: 6000,  tier: "Bronze",
  },
  {
    round: 24,  continent: "Europe",  country: "Italy",
    city: "Rimini",  beachName: "Rimini Beach",
    displayName: "Rimini Riviera Cup",  date: "2026-04-14",
    locId: 8,  locName: "Rimini Beach, Italy",
    opponent: "Rio Serpents BRA",  prize: 7000,  tier: "Bronze",
  },
  {
    round: 25,  continent: "Europe",  country: "Croatia",
    city: "Poreč",  beachName: "Plava Laguna Beach",
    displayName: "Poreč Adriatic Open",  date: "2026-04-18",
    locId: 8,  locName: "Plava Laguna Beach, Poreč",
    opponent: "Sand Queens AU",  prize: 7500,  tier: "Bronze",
  },
  {
    round: 26,  continent: "Europe",  country: "Turkey",
    city: "Antalya",  beachName: "Konyaaltı Beach",
    displayName: "Antalya Beach Pro",  date: "2026-04-22",
    locId: 11,  locName: "Konyaaltı Beach, Antalya",
    opponent: "Tropical Blaze CUB",  prize: 11000,  tier: "Silver",
  },
  {
    round: 27,  continent: "Europe",  country: "Spain",
    city: "Barcelona",  beachName: "Barceloneta Beach",
    displayName: "Barcelona City Open",  date: "2026-04-26",
    locId: 10,  locName: "Barceloneta Beach, Barcelona",
    opponent: "Greek Fire GRE",  prize: 13000,  tier: "Silver",
  },
  {
    round: 28,  continent: "Europe",  country: "France",
    city: "Nice",  beachName: "Côte d'Azur Beach",
    displayName: "Nice Riviera Classic",  date: "2026-04-30",
    locId: 10,  locName: "Côte d'Azur Beach, Nice",
    opponent: "French Riviera FRA",  prize: 14000,  tier: "Silver",
  },
  {
    round: 29,  continent: "Europe",  country: "Germany",
    city: "Hamburg",  beachName: "Timmendorfer Strand",
    displayName: "Hamburg North Open",  date: "2026-05-04",
    locId: 10,  locName: "Timmendorfer Strand, Hamburg",
    opponent: "Island Aces THA",  prize: 23000,  tier: "Gold",
  },
  {
    round: 30,  continent: "Europe",  country: "Greece",
    city: "Mykonos",  beachName: "Super Paradise Beach",
    displayName: "Mykonos Gold Masters",  date: "2026-05-08",
    locId: 8,  locName: "Super Paradise Beach, Mykonos",
    opponent: "Bali Tigers IDN",  prize: 26000,  tier: "Gold",
  },
  {
    round: 31,  continent: "Europe",  country: "Spain",
    city: "Valencia",  beachName: "Playa de la Malvarrosa",
    displayName: "Valencia Gold Open",  date: "2026-05-12",
    locId: 10,  locName: "Playa Malvarrosa, Valencia",
    opponent: "Storm Queens USA",  prize: 29000,  tier: "Gold",
  },
  {
    round: 32,  continent: "Europe",  country: "Croatia",
    city: "Split",  beachName: "Bačvice Beach",
    displayName: "Split Elite Cup",  date: "2026-05-16",
    locId: 8,  locName: "Bačvice Beach, Split",
    opponent: "Sydney Sharks AU",  prize: 46000,  tier: "Elite",
  },
  // ── Europe Continental Final  (Round 33) ──────────────────────────────────
  {
    round: 33,  continent: "Europe",  country: "Spain",
    city: "Barcelona",  beachName: "Barceloneta Beach",
    displayName: "Europe Continental Final",  date: "2026-05-21",
    locId: 10,  locName: "Barceloneta Beach, Barcelona",
    opponent: "Europe All-Stars",  prize: 80000,  tier: "Continental Final",
  },

  // ── Africa & Middle East Tour  (Rounds 34–43) ─────────────────────────────
  {
    round: 34,  continent: "Africa & Middle East",  country: "Egypt",
    city: "Hurghada",  beachName: "Red Sea Beach",
    displayName: "Hurghada Red Sea Open",  date: "2026-05-26",
    locId: 11,  locName: "Red Sea Beach, Hurghada",
    opponent: "Pacific Storm USA",  prize: 5500,  tier: "Bronze",
  },
  {
    round: 35,  continent: "Africa & Middle East",  country: "Morocco",
    city: "Agadir",  beachName: "Agadir Beach",
    displayName: "Agadir Atlantic Open",  date: "2026-05-30",
    locId: 10,  locName: "Agadir Beach, Morocco",
    opponent: "Rio Serpents BRA",  prize: 6500,  tier: "Bronze",
  },
  {
    round: 36,  continent: "Africa & Middle East",  country: "Kenya",
    city: "Diani",  beachName: "Diani Beach",
    displayName: "Diani Indian Ocean Open",  date: "2026-06-03",
    locId: 11,  locName: "Diani Beach, Kenya",
    opponent: "Sand Queens AU",  prize: 7000,  tier: "Bronze",
  },
  {
    round: 37,  continent: "Africa & Middle East",  country: "Senegal",
    city: "Dakar",  beachName: "Plage de Yoff",
    displayName: "Dakar Atlantic Cup",  date: "2026-06-07",
    locId: 11,  locName: "Plage de Yoff, Dakar",
    opponent: "Tropical Blaze CUB",  prize: 7500,  tier: "Bronze",
  },
  {
    round: 38,  continent: "Africa & Middle East",  country: "South Africa",
    city: "Cape Town",  beachName: "Clifton Beach",
    displayName: "Cape Town Silver Open",  date: "2026-06-11",
    locId: 2,  locName: "Clifton Beach, Cape Town",
    opponent: "Greek Fire GRE",  prize: 12000,  tier: "Silver",
  },
  {
    round: 39,  continent: "Africa & Middle East",  country: "Morocco",
    city: "Essaouira",  beachName: "Mogador Beach",
    displayName: "Essaouira Wind Classic",  date: "2026-06-15",
    locId: 10,  locName: "Mogador Beach, Essaouira",
    opponent: "French Riviera FRA",  prize: 13000,  tier: "Silver",
  },
  {
    round: 40,  continent: "Africa & Middle East",  country: "UAE",
    city: "Dubai",  beachName: "Jumeirah Beach",
    displayName: "Dubai Desert Pro",  date: "2026-06-19",
    locId: 11,  locName: "Jumeirah Beach, Dubai",
    opponent: "Island Aces THA",  prize: 15000,  tier: "Silver",
  },
  {
    round: 41,  continent: "Africa & Middle East",  country: "Israel",
    city: "Tel Aviv",  beachName: "Gordon Beach",
    displayName: "Tel Aviv Gold Open",  date: "2026-06-23",
    locId: 11,  locName: "Gordon Beach, Tel Aviv",
    opponent: "Bali Tigers IDN",  prize: 23000,  tier: "Gold",
  },
  {
    round: 42,  continent: "Africa & Middle East",  country: "Oman",
    city: "Muscat",  beachName: "Qurum Beach",
    displayName: "Muscat Gulf Masters",  date: "2026-06-27",
    locId: 11,  locName: "Qurum Beach, Muscat",
    opponent: "Storm Queens USA",  prize: 26000,  tier: "Gold",
  },
  {
    round: 43,  continent: "Africa & Middle East",  country: "Egypt",
    city: "Alexandria",  beachName: "Montazah Beach",
    displayName: "Alexandria Elite Open",  date: "2026-07-01",
    locId: 11,  locName: "Montazah Beach, Alexandria",
    opponent: "Sydney Sharks AU",  prize: 44000,  tier: "Elite",
  },
  // ── Africa & Middle East Continental Final  (Round 44) ────────────────────
  {
    round: 44,  continent: "Africa & Middle East",  country: "UAE",
    city: "Dubai",  beachName: "Jumeirah Beach",
    displayName: "Africa & Middle East Continental Final",  date: "2026-07-06",
    locId: 11,  locName: "Jumeirah Beach, Dubai",
    opponent: "African All-Stars",  prize: 80000,  tier: "Continental Final",
  },

  // ── North America Tour  (Rounds 45–54) ────────────────────────────────────
  {
    round: 45,  continent: "North America",  country: "Mexico",
    city: "Cancún",  beachName: "Playa Delfines",
    displayName: "Cancún Open",  date: "2026-07-11",
    locId: 5,  locName: "Playa Delfines, Cancún",
    opponent: "Pacific Storm USA",  prize: 5000,  tier: "Bronze",
  },
  {
    round: 46,  continent: "North America",  country: "USA",
    city: "Miami",  beachName: "South Beach",
    displayName: "Miami Beach Open",  date: "2026-07-15",
    locId: 4,  locName: "South Beach, Miami",
    opponent: "Rio Serpents BRA",  prize: 6000,  tier: "Bronze",
  },
  {
    round: 47,  continent: "North America",  country: "Mexico",
    city: "Tulum",  beachName: "Playa Paraíso",
    displayName: "Tulum Jungle Cup",  date: "2026-07-19",
    locId: 5,  locName: "Playa Paraíso, Tulum",
    opponent: "Sand Queens AU",  prize: 7500,  tier: "Bronze",
  },
  {
    round: 48,  continent: "North America",  country: "Puerto Rico",
    city: "San Juan",  beachName: "Condado Beach",
    displayName: "San Juan Caribbean Open",  date: "2026-07-23",
    locId: 5,  locName: "Condado Beach, San Juan",
    opponent: "Tropical Blaze CUB",  prize: 8000,  tier: "Bronze",
  },
  {
    round: 49,  continent: "North America",  country: "USA",
    city: "Los Angeles",  beachName: "Manhattan Beach",
    displayName: "LA Beach Pro",  date: "2026-07-27",
    locId: 4,  locName: "Manhattan Beach, Los Angeles",
    opponent: "Greek Fire GRE",  prize: 11000,  tier: "Silver",
  },
  {
    round: 50,  continent: "North America",  country: "Bahamas",
    city: "Nassau",  beachName: "Cable Beach",
    displayName: "Nassau Shore Classic",  date: "2026-07-31",
    locId: 5,  locName: "Cable Beach, Nassau",
    opponent: "French Riviera FRA",  prize: 13000,  tier: "Silver",
  },
  {
    round: 51,  continent: "North America",  country: "Costa Rica",
    city: "Jacó",  beachName: "Playa Jacó",
    displayName: "Jacó Pacific Wave",  date: "2026-08-04",
    locId: 5,  locName: "Playa Jacó, Costa Rica",
    opponent: "Island Aces THA",  prize: 14000,  tier: "Silver",
  },
  {
    round: 52,  continent: "North America",  country: "USA",
    city: "Honolulu",  beachName: "Waikiki Beach",
    displayName: "Waikiki Masters",  date: "2026-08-08",
    locId: 3,  locName: "Waikiki Beach, Honolulu",
    opponent: "Bali Tigers IDN",  prize: 22000,  tier: "Gold",
  },
  {
    round: 53,  continent: "North America",  country: "Canada",
    city: "Vancouver",  beachName: "English Bay Beach",
    displayName: "Vancouver Bay Open",  date: "2026-08-12",
    locId: 4,  locName: "English Bay Beach, Vancouver",
    opponent: "Storm Queens USA",  prize: 25000,  tier: "Gold",
  },
  {
    round: 54,  continent: "North America",  country: "Mexico",
    city: "Cabo San Lucas",  beachName: "El Médano Beach",
    displayName: "Cabo Elite Series",  date: "2026-08-16",
    locId: 5,  locName: "El Médano Beach, Cabo San Lucas",
    opponent: "Sydney Sharks AU",  prize: 38000,  tier: "Elite",
  },
  // ── North America Continental Final  (Round 55) ───────────────────────────
  {
    round: 55,  continent: "North America",  country: "USA",
    city: "Honolulu",  beachName: "Waikiki Beach",
    displayName: "North America Continental Final",  date: "2026-08-21",
    locId: 3,  locName: "Waikiki Beach, Honolulu",
    opponent: "Americas All-Stars",  prize: 80000,  tier: "Continental Final",
  },

  // ── South America Tour  (Rounds 56–65) ────────────────────────────────────
  {
    round: 56,  continent: "South America",  country: "Colombia",
    city: "Cartagena",  beachName: "Playa Blanca",
    displayName: "Cartagena Beach Cup",  date: "2026-08-26",
    locId: 1,  locName: "Playa Blanca, Cartagena",
    opponent: "Pacific Storm USA",  prize: 5500,  tier: "Bronze",
  },
  {
    round: 57,  continent: "South America",  country: "Peru",
    city: "Lima",  beachName: "Costa Verde Beach",
    displayName: "Lima Pacific Open",  date: "2026-08-30",
    locId: 6,  locName: "Costa Verde Beach, Lima",
    opponent: "Rio Serpents BRA",  prize: 6500,  tier: "Bronze",
  },
  {
    round: 58,  continent: "South America",  country: "Ecuador",
    city: "Salinas",  beachName: "Playa de Chipipe",
    displayName: "Salinas Shore Open",  date: "2026-09-03",
    locId: 5,  locName: "Playa de Chipipe, Salinas",
    opponent: "Sand Queens AU",  prize: 7500,  tier: "Bronze",
  },
  {
    round: 59,  continent: "South America",  country: "Brazil",
    city: "Florianópolis",  beachName: "Joaquina Beach",
    displayName: "Florianópolis Open",  date: "2026-09-07",
    locId: 6,  locName: "Joaquina Beach, Florianópolis",
    opponent: "Tropical Blaze CUB",  prize: 8000,  tier: "Bronze",
  },
  {
    round: 60,  continent: "South America",  country: "Argentina",
    city: "Mar del Plata",  beachName: "Playa Bristol",
    displayName: "Plata Silver Classic",  date: "2026-09-11",
    locId: 6,  locName: "Playa Bristol, Mar del Plata",
    opponent: "French Riviera FRA",  prize: 12000,  tier: "Silver",
  },
  {
    round: 61,  continent: "South America",  country: "Uruguay",
    city: "Punta del Este",  beachName: "Playa Brava",
    displayName: "Punta del Este Pro",  date: "2026-09-15",
    locId: 6,  locName: "Playa Brava, Punta del Este",
    opponent: "Greek Fire GRE",  prize: 13000,  tier: "Silver",
  },
  {
    round: 62,  continent: "South America",  country: "Chile",
    city: "Iquique",  beachName: "Cavancha Beach",
    displayName: "Iquique Desert Classic",  date: "2026-09-19",
    locId: 6,  locName: "Cavancha Beach, Iquique",
    opponent: "Island Aces THA",  prize: 14000,  tier: "Silver",
  },
  {
    round: 63,  continent: "South America",  country: "Brazil",
    city: "Fortaleza",  beachName: "Iracema Beach",
    displayName: "Fortaleza Gold Cup",  date: "2026-09-23",
    locId: 6,  locName: "Iracema Beach, Fortaleza",
    opponent: "Storm Queens USA",  prize: 22000,  tier: "Gold",
  },
  {
    round: 64,  continent: "South America",  country: "Colombia",
    city: "Barranquilla",  beachName: "Salgar Beach",
    displayName: "Barranquilla Gold Open",  date: "2026-09-27",
    locId: 1,  locName: "Salgar Beach, Barranquilla",
    opponent: "Bali Tigers IDN",  prize: 25000,  tier: "Gold",
  },
  {
    round: 65,  continent: "South America",  country: "Brazil",
    city: "Rio de Janeiro",  beachName: "Copacabana Beach",
    displayName: "Copa Rio Elite",  date: "2026-10-01",
    locId: 1,  locName: "Copacabana Beach, Rio de Janeiro",
    opponent: "Sydney Sharks AU",  prize: 45000,  tier: "Elite",
  },
  // ── South America Continental Final  (Round 66) ───────────────────────────
  {
    round: 66,  continent: "South America",  country: "Brazil",
    city: "Rio de Janeiro",  beachName: "Copacabana Beach",
    displayName: "South America Continental Final",  date: "2026-10-06",
    locId: 1,  locName: "Copacabana Beach, Rio de Janeiro",
    opponent: "South American All-Stars",  prize: 80000,  tier: "Continental Final",
  },

  // ── World Grand Final  (Round 67) ─────────────────────────────────────────
  // Location is randomised each season in the fixture route.
  {
    round: 67,  continent: "World",  country: "Brazil",
    city: "Rio de Janeiro",  beachName: "Copacabana Beach",
    displayName: "World Beach Pro Series Grand Final",  date: "2026-12-10",
    locId: 1,  locName: "Copacabana Beach, Rio de Janeiro",
    opponent: "World All-Stars",  prize: 500000,  tier: "Grand Final",
  },
];

export const WORLD_TOUR_FINAL_ROUND = 67;
