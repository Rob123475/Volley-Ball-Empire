export type Tier = "Bronze" | "Silver" | "Gold" | "Elite" | "Grand Final";

export interface WorldTourEvent {
  round:      number;
  continent:  string;
  country:    string;
  city:       string;
  beachName:  string;
  displayName: string;
  date:       string;
  locId:      number; // References existing locationsTable FK (1–11)
  locName:    string; // Displayed in UI
  opponent:   string;
  prize:      number;
  tier:       Tier;
}

// 5-day cadence: Round 1 = 2026-01-08, Grand Final = 2026-12-10
export const WORLD_TOUR: WorldTourEvent[] = [

  // ── North America (Rounds 1–10) ─────────────────────────────────────────────
  {
    round: 1,  continent: "North America",        country: "Mexico",
    city: "Cancún",          beachName: "Playa Delfines",
    displayName: "Cancún Open",             date: "2026-01-08",
    locId: 5,  locName: "Playa Delfines, Cancún",
    opponent: "Pacific Storm USA",   prize: 5000,  tier: "Bronze",
  },
  {
    round: 2,  continent: "North America",        country: "USA",
    city: "Miami",            beachName: "South Beach",
    displayName: "Miami Beach Open",         date: "2026-01-13",
    locId: 4,  locName: "South Beach, Miami",
    opponent: "Rio Serpents BRA",    prize: 6000,  tier: "Bronze",
  },
  {
    round: 3,  continent: "North America",        country: "Mexico",
    city: "Tulum",            beachName: "Playa Paraíso",
    displayName: "Tulum Jungle Cup",         date: "2026-01-18",
    locId: 5,  locName: "Playa Paraíso, Tulum",
    opponent: "Sand Queens AU",      prize: 7500,  tier: "Bronze",
  },
  {
    round: 4,  continent: "North America",        country: "Puerto Rico",
    city: "San Juan",         beachName: "Condado Beach",
    displayName: "San Juan Caribbean Open",  date: "2026-01-23",
    locId: 5,  locName: "Condado Beach, San Juan",
    opponent: "Tropical Blaze CUB", prize: 8000,  tier: "Bronze",
  },
  {
    round: 5,  continent: "North America",        country: "USA",
    city: "Los Angeles",      beachName: "Manhattan Beach",
    displayName: "LA Beach Pro",             date: "2026-01-28",
    locId: 4,  locName: "Manhattan Beach, Los Angeles",
    opponent: "Greek Fire GRE",      prize: 11000, tier: "Silver",
  },
  {
    round: 6,  continent: "North America",        country: "Bahamas",
    city: "Nassau",           beachName: "Cable Beach",
    displayName: "Nassau Shore Classic",     date: "2026-02-02",
    locId: 5,  locName: "Cable Beach, Nassau",
    opponent: "French Riviera FRA",  prize: 13000, tier: "Silver",
  },
  {
    round: 7,  continent: "North America",        country: "Costa Rica",
    city: "Jacó",             beachName: "Playa Jacó",
    displayName: "Jacó Pacific Wave",        date: "2026-02-07",
    locId: 5,  locName: "Playa Jacó, Costa Rica",
    opponent: "Island Aces THA",     prize: 14000, tier: "Silver",
  },
  {
    round: 8,  continent: "North America",        country: "USA",
    city: "Honolulu",         beachName: "Waikiki Beach",
    displayName: "Waikiki Masters",          date: "2026-02-12",
    locId: 3,  locName: "Waikiki Beach, Honolulu",
    opponent: "Bali Tigers IDN",     prize: 22000, tier: "Gold",
  },
  {
    round: 9,  continent: "North America",        country: "Canada",
    city: "Vancouver",        beachName: "English Bay Beach",
    displayName: "Vancouver Bay Open",       date: "2026-02-17",
    locId: 4,  locName: "English Bay Beach, Vancouver",
    opponent: "Storm Queens USA",    prize: 25000, tier: "Gold",
  },
  {
    round: 10, continent: "North America",        country: "Mexico",
    city: "Cabo San Lucas",   beachName: "El Médano Beach",
    displayName: "Cabo Elite Series",        date: "2026-02-22",
    locId: 5,  locName: "El Médano Beach, Cabo San Lucas",
    opponent: "Sydney Sharks AU",    prize: 38000, tier: "Elite",
  },

  // ── South America (Rounds 11–20) ────────────────────────────────────────────
  {
    round: 11, continent: "South America",        country: "Colombia",
    city: "Cartagena",        beachName: "Playa Blanca",
    displayName: "Cartagena Beach Cup",      date: "2026-02-27",
    locId: 1,  locName: "Playa Blanca, Cartagena",
    opponent: "Pacific Storm USA",   prize: 5500,  tier: "Bronze",
  },
  {
    round: 12, continent: "South America",        country: "Peru",
    city: "Lima",             beachName: "Costa Verde Beach",
    displayName: "Lima Pacific Open",        date: "2026-03-04",
    locId: 6,  locName: "Costa Verde Beach, Lima",
    opponent: "Rio Serpents BRA",    prize: 6500,  tier: "Bronze",
  },
  {
    round: 13, continent: "South America",        country: "Ecuador",
    city: "Salinas",          beachName: "Playa de Chipipe",
    displayName: "Salinas Shore Open",       date: "2026-03-09",
    locId: 5,  locName: "Playa de Chipipe, Salinas",
    opponent: "Sand Queens AU",      prize: 7500,  tier: "Bronze",
  },
  {
    round: 14, continent: "South America",        country: "Brazil",
    city: "Florianópolis",    beachName: "Joaquina Beach",
    displayName: "Florianópolis Open",       date: "2026-03-14",
    locId: 6,  locName: "Joaquina Beach, Florianópolis",
    opponent: "Tropical Blaze CUB", prize: 8000,  tier: "Bronze",
  },
  {
    round: 15, continent: "South America",        country: "Argentina",
    city: "Mar del Plata",    beachName: "Playa Bristol",
    displayName: "Plata Silver Classic",     date: "2026-03-19",
    locId: 6,  locName: "Playa Bristol, Mar del Plata",
    opponent: "French Riviera FRA",  prize: 12000, tier: "Silver",
  },
  {
    round: 16, continent: "South America",        country: "Uruguay",
    city: "Punta del Este",   beachName: "Playa Brava",
    displayName: "Punta del Este Pro",       date: "2026-03-24",
    locId: 6,  locName: "Playa Brava, Punta del Este",
    opponent: "Greek Fire GRE",      prize: 13000, tier: "Silver",
  },
  {
    round: 17, continent: "South America",        country: "Chile",
    city: "Iquique",          beachName: "Cavancha Beach",
    displayName: "Iquique Desert Classic",   date: "2026-03-29",
    locId: 6,  locName: "Cavancha Beach, Iquique",
    opponent: "Island Aces THA",     prize: 14000, tier: "Silver",
  },
  {
    round: 18, continent: "South America",        country: "Brazil",
    city: "Fortaleza",        beachName: "Iracema Beach",
    displayName: "Fortaleza Gold Cup",       date: "2026-04-03",
    locId: 6,  locName: "Iracema Beach, Fortaleza",
    opponent: "Storm Queens USA",    prize: 22000, tier: "Gold",
  },
  {
    round: 19, continent: "South America",        country: "Colombia",
    city: "Barranquilla",     beachName: "Salgar Beach",
    displayName: "Barranquilla Gold Open",   date: "2026-04-08",
    locId: 1,  locName: "Salgar Beach, Barranquilla",
    opponent: "Bali Tigers IDN",     prize: 25000, tier: "Gold",
  },
  {
    round: 20, continent: "South America",        country: "Brazil",
    city: "Rio de Janeiro",   beachName: "Copacabana Beach",
    displayName: "Copa Rio Elite",           date: "2026-04-13",
    locId: 1,  locName: "Copacabana Beach, Rio de Janeiro",
    opponent: "World All-Stars",     prize: 45000, tier: "Elite",
  },

  // ── Europe (Rounds 21–30) ────────────────────────────────────────────────────
  {
    round: 21, continent: "Europe",               country: "Portugal",
    city: "Cascais",          beachName: "Guincho Beach",
    displayName: "Cascais Atlantic Open",    date: "2026-04-18",
    locId: 10, locName: "Guincho Beach, Cascais",
    opponent: "Pacific Storm USA",   prize: 6000,  tier: "Bronze",
  },
  {
    round: 22, continent: "Europe",               country: "Italy",
    city: "Rimini",           beachName: "Rimini Beach",
    displayName: "Rimini Riviera Cup",       date: "2026-04-23",
    locId: 8,  locName: "Rimini Beach, Italy",
    opponent: "Rio Serpents BRA",    prize: 7000,  tier: "Bronze",
  },
  {
    round: 23, continent: "Europe",               country: "Croatia",
    city: "Poreč",            beachName: "Plava Laguna Beach",
    displayName: "Poreč Adriatic Open",      date: "2026-04-28",
    locId: 8,  locName: "Plava Laguna Beach, Poreč",
    opponent: "Sand Queens AU",      prize: 7500,  tier: "Bronze",
  },
  {
    round: 24, continent: "Europe",               country: "Turkey",
    city: "Antalya",          beachName: "Konyaaltı Beach",
    displayName: "Antalya Beach Pro",        date: "2026-05-03",
    locId: 11, locName: "Konyaaltı Beach, Antalya",
    opponent: "Tropical Blaze CUB", prize: 11000, tier: "Silver",
  },
  {
    round: 25, continent: "Europe",               country: "Spain",
    city: "Barcelona",        beachName: "Barceloneta Beach",
    displayName: "Barcelona City Open",      date: "2026-05-08",
    locId: 10, locName: "Barceloneta Beach, Barcelona",
    opponent: "Greek Fire GRE",      prize: 13000, tier: "Silver",
  },
  {
    round: 26, continent: "Europe",               country: "France",
    city: "Nice",             beachName: "Côte d'Azur Beach",
    displayName: "Nice Riviera Classic",     date: "2026-05-13",
    locId: 10, locName: "Côte d'Azur Beach, Nice",
    opponent: "French Riviera FRA",  prize: 14000, tier: "Silver",
  },
  {
    round: 27, continent: "Europe",               country: "Germany",
    city: "Hamburg",          beachName: "Timmendorfer Strand",
    displayName: "Hamburg North Open",       date: "2026-05-18",
    locId: 10, locName: "Timmendorfer Strand, Hamburg",
    opponent: "Island Aces THA",     prize: 23000, tier: "Gold",
  },
  {
    round: 28, continent: "Europe",               country: "Greece",
    city: "Mykonos",          beachName: "Super Paradise Beach",
    displayName: "Mykonos Gold Masters",     date: "2026-05-23",
    locId: 8,  locName: "Super Paradise Beach, Mykonos",
    opponent: "Bali Tigers IDN",     prize: 26000, tier: "Gold",
  },
  {
    round: 29, continent: "Europe",               country: "Spain",
    city: "Valencia",         beachName: "Playa de la Malvarrosa",
    displayName: "Valencia Gold Open",       date: "2026-05-28",
    locId: 10, locName: "Playa Malvarrosa, Valencia",
    opponent: "Storm Queens USA",    prize: 29000, tier: "Gold",
  },
  {
    round: 30, continent: "Europe",               country: "Croatia",
    city: "Split",            beachName: "Bačvice Beach",
    displayName: "Split Elite Cup",          date: "2026-06-02",
    locId: 8,  locName: "Bačvice Beach, Split",
    opponent: "Sydney Sharks AU",    prize: 46000, tier: "Elite",
  },

  // ── Africa & Middle East (Rounds 31–40) ─────────────────────────────────────
  {
    round: 31, continent: "Africa & Middle East", country: "Egypt",
    city: "Hurghada",         beachName: "Red Sea Beach",
    displayName: "Hurghada Red Sea Open",    date: "2026-06-07",
    locId: 11, locName: "Red Sea Beach, Hurghada",
    opponent: "Pacific Storm USA",   prize: 5500,  tier: "Bronze",
  },
  {
    round: 32, continent: "Africa & Middle East", country: "Morocco",
    city: "Agadir",           beachName: "Agadir Beach",
    displayName: "Agadir Atlantic Open",     date: "2026-06-12",
    locId: 10, locName: "Agadir Beach, Morocco",
    opponent: "Rio Serpents BRA",    prize: 6500,  tier: "Bronze",
  },
  {
    round: 33, continent: "Africa & Middle East", country: "Kenya",
    city: "Diani",            beachName: "Diani Beach",
    displayName: "Diani Indian Ocean Open",  date: "2026-06-17",
    locId: 11, locName: "Diani Beach, Kenya",
    opponent: "Sand Queens AU",      prize: 7000,  tier: "Bronze",
  },
  {
    round: 34, continent: "Africa & Middle East", country: "Senegal",
    city: "Dakar",            beachName: "Plage de Yoff",
    displayName: "Dakar Atlantic Cup",       date: "2026-06-22",
    locId: 11, locName: "Plage de Yoff, Dakar",
    opponent: "Tropical Blaze CUB", prize: 7500,  tier: "Bronze",
  },
  {
    round: 35, continent: "Africa & Middle East", country: "South Africa",
    city: "Cape Town",        beachName: "Clifton Beach",
    displayName: "Cape Town Silver Open",    date: "2026-06-27",
    locId: 2,  locName: "Clifton Beach, Cape Town",
    opponent: "Greek Fire GRE",      prize: 12000, tier: "Silver",
  },
  {
    round: 36, continent: "Africa & Middle East", country: "Morocco",
    city: "Essaouira",        beachName: "Mogador Beach",
    displayName: "Essaouira Wind Classic",   date: "2026-07-02",
    locId: 10, locName: "Mogador Beach, Essaouira",
    opponent: "French Riviera FRA",  prize: 13000, tier: "Silver",
  },
  {
    round: 37, continent: "Africa & Middle East", country: "UAE",
    city: "Dubai",            beachName: "Jumeirah Beach",
    displayName: "Dubai Desert Pro",         date: "2026-07-07",
    locId: 11, locName: "Jumeirah Beach, Dubai",
    opponent: "Island Aces THA",     prize: 15000, tier: "Silver",
  },
  {
    round: 38, continent: "Africa & Middle East", country: "Israel",
    city: "Tel Aviv",         beachName: "Gordon Beach",
    displayName: "Tel Aviv Gold Open",       date: "2026-07-12",
    locId: 11, locName: "Gordon Beach, Tel Aviv",
    opponent: "Bali Tigers IDN",     prize: 23000, tier: "Gold",
  },
  {
    round: 39, continent: "Africa & Middle East", country: "Oman",
    city: "Muscat",           beachName: "Qurum Beach",
    displayName: "Muscat Gulf Masters",      date: "2026-07-17",
    locId: 11, locName: "Qurum Beach, Muscat",
    opponent: "Storm Queens USA",    prize: 26000, tier: "Gold",
  },
  {
    round: 40, continent: "Africa & Middle East", country: "Egypt",
    city: "Alexandria",       beachName: "Montazah Beach",
    displayName: "Alexandria Elite Open",    date: "2026-07-22",
    locId: 11, locName: "Montazah Beach, Alexandria",
    opponent: "World All-Stars",     prize: 44000, tier: "Elite",
  },

  // ── Asia (Rounds 41–50) ──────────────────────────────────────────────────────
  {
    round: 41, continent: "Asia",                 country: "Thailand",
    city: "Phuket",           beachName: "Kata Beach",
    displayName: "Phuket Beach Classic",     date: "2026-07-27",
    locId: 7,  locName: "Kata Beach, Phuket",
    opponent: "Pacific Storm USA",   prize: 6000,  tier: "Bronze",
  },
  {
    round: 42, continent: "Asia",                 country: "Indonesia",
    city: "Bali",             beachName: "Kuta Beach",
    displayName: "Bali Kuta Open",           date: "2026-08-01",
    locId: 9,  locName: "Kuta Beach, Bali",
    opponent: "Rio Serpents BRA",    prize: 7000,  tier: "Bronze",
  },
  {
    round: 43, continent: "Asia",                 country: "Vietnam",
    city: "Da Nang",          beachName: "My Khe Beach",
    displayName: "Da Nang My Khe Open",      date: "2026-08-06",
    locId: 7,  locName: "My Khe Beach, Da Nang",
    opponent: "Sand Queens AU",      prize: 7500,  tier: "Bronze",
  },
  {
    round: 44, continent: "Asia",                 country: "Thailand",
    city: "Pattaya",          beachName: "Jomtien Beach",
    displayName: "Pattaya Gulf Classic",     date: "2026-08-11",
    locId: 7,  locName: "Jomtien Beach, Pattaya",
    opponent: "Tropical Blaze CUB", prize: 8000,  tier: "Bronze",
  },
  {
    round: 45, continent: "Asia",                 country: "Indonesia",
    city: "Lombok",           beachName: "Selong Belanak Beach",
    displayName: "Lombok Shore Silver",      date: "2026-08-16",
    locId: 9,  locName: "Selong Belanak, Lombok",
    opponent: "Greek Fire GRE",      prize: 12000, tier: "Silver",
  },
  {
    round: 46, continent: "Asia",                 country: "South Korea",
    city: "Jeju",             beachName: "Hyeopjae Beach",
    displayName: "Jeju Island Silver Open",  date: "2026-08-21",
    locId: 7,  locName: "Hyeopjae Beach, Jeju",
    opponent: "French Riviera FRA",  prize: 14000, tier: "Silver",
  },
  {
    round: 47, continent: "Asia",                 country: "Japan",
    city: "Okinawa",          beachName: "Emerald Beach",
    displayName: "Okinawa Gold Series",      date: "2026-08-26",
    locId: 7,  locName: "Emerald Beach, Okinawa",
    opponent: "Island Aces THA",     prize: 22000, tier: "Gold",
  },
  {
    round: 48, continent: "Asia",                 country: "Thailand",
    city: "Koh Samui",        beachName: "Chaweng Beach",
    displayName: "Samui Gold Masters",       date: "2026-08-31",
    locId: 7,  locName: "Chaweng Beach, Koh Samui",
    opponent: "Bali Tigers IDN",     prize: 25000, tier: "Gold",
  },
  {
    round: 49, continent: "Asia",                 country: "India",
    city: "Goa",              beachName: "Vagator Beach",
    displayName: "Goa Gold Open",            date: "2026-09-05",
    locId: 9,  locName: "Vagator Beach, Goa",
    opponent: "Storm Queens USA",    prize: 28000, tier: "Gold",
  },
  {
    round: 50, continent: "Asia",                 country: "Philippines",
    city: "La Union",         beachName: "Urbiztondo Beach",
    displayName: "La Union Elite Open",      date: "2026-09-10",
    locId: 9,  locName: "Urbiztondo Beach, La Union",
    opponent: "Sydney Sharks AU",    prize: 47000, tier: "Elite",
  },

  // ── Australia & Pacific Islands (Rounds 51–60) ──────────────────────────────
  {
    round: 51, continent: "Australia & Pacific",  country: "Fiji",
    city: "Nadi",             beachName: "Natadola Beach",
    displayName: "Fiji Natadola Open",       date: "2026-09-15",
    locId: 2,  locName: "Natadola Beach, Nadi",
    opponent: "Pacific Storm USA",   prize: 6500,  tier: "Bronze",
  },
  {
    round: 52, continent: "Australia & Pacific",  country: "Samoa",
    city: "Apia",             beachName: "Return to Paradise Beach",
    displayName: "Samoa Paradise Cup",       date: "2026-09-20",
    locId: 2,  locName: "Return to Paradise Beach, Apia",
    opponent: "Rio Serpents BRA",    prize: 7000,  tier: "Bronze",
  },
  {
    round: 53, continent: "Australia & Pacific",  country: "Vanuatu",
    city: "Port Vila",        beachName: "Pango Beach",
    displayName: "Vanuatu Pacific Open",     date: "2026-09-25",
    locId: 2,  locName: "Pango Beach, Port Vila",
    opponent: "Sand Queens AU",      prize: 7500,  tier: "Bronze",
  },
  {
    round: 54, continent: "Australia & Pacific",  country: "Australia",
    city: "Brisbane",         beachName: "Surfers Paradise",
    displayName: "Surfers Paradise Bronze",  date: "2026-09-30",
    locId: 2,  locName: "Surfers Paradise, Brisbane",
    opponent: "Tropical Blaze CUB", prize: 8000,  tier: "Bronze",
  },
  {
    round: 55, continent: "Australia & Pacific",  country: "New Zealand",
    city: "Auckland",         beachName: "Piha Beach",
    displayName: "Piha Silver Classic",      date: "2026-10-05",
    locId: 2,  locName: "Piha Beach, Auckland",
    opponent: "Greek Fire GRE",      prize: 13000, tier: "Silver",
  },
  {
    round: 56, continent: "Australia & Pacific",  country: "New Caledonia",
    city: "Noumea",           beachName: "Anse Vata Beach",
    displayName: "Noumea Pacific Silver",    date: "2026-10-10",
    locId: 2,  locName: "Anse Vata Beach, Noumea",
    opponent: "French Riviera FRA",  prize: 14000, tier: "Silver",
  },
  {
    round: 57, continent: "Australia & Pacific",  country: "Fiji",
    city: "Pacific Harbour",  beachName: "Pacific Harbour Beach",
    displayName: "Fiji Gold Series",         date: "2026-10-15",
    locId: 2,  locName: "Pacific Harbour Beach, Fiji",
    opponent: "Island Aces THA",     prize: 15000, tier: "Silver",
  },
  {
    round: 58, continent: "Australia & Pacific",  country: "Australia",
    city: "Cairns",           beachName: "Mission Beach",
    displayName: "Cairns Tropics Gold",      date: "2026-10-20",
    locId: 2,  locName: "Mission Beach, Cairns",
    opponent: "Bali Tigers IDN",     prize: 24000, tier: "Gold",
  },
  {
    round: 59, continent: "Australia & Pacific",  country: "Australia",
    city: "Sydney",           beachName: "Bondi Beach",
    displayName: "Bondi Gold Masters",       date: "2026-10-25",
    locId: 2,  locName: "Bondi Beach, Sydney",
    opponent: "Storm Queens USA",    prize: 28000, tier: "Gold",
  },
  {
    round: 60, continent: "Australia & Pacific",  country: "New Zealand",
    city: "Christchurch",     beachName: "Sumner Beach",
    displayName: "Sumner Elite Final",       date: "2026-10-30",
    locId: 2,  locName: "Sumner Beach, Christchurch",
    opponent: "Sydney Sharks AU",    prize: 48000, tier: "Elite",
  },

  // ── Grand Final (Round 61) ───────────────────────────────────────────────────
  {
    round: 61, continent: "South America",        country: "Brazil",
    city: "Rio de Janeiro",   beachName: "Copacabana Beach",
    displayName: "World Tour Grand Final",   date: "2026-12-10",
    locId: 1,  locName: "Copacabana Beach, Rio de Janeiro",
    opponent: "World All-Stars",     prize: 100000, tier: "Grand Final",
  },
];

export const WORLD_TOUR_FINAL_ROUND = 61;
