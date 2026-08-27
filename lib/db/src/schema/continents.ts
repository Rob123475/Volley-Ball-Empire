/**
 * The canonical six continents.
 *
 * These exact strings are what the competition structure already uses —
 * `regional_league_seasons.continent` and `continental_pool_teams.continent`
 * — and `simulateRegionalRound` / `resolveRegionalSeason` match on them. They
 * are therefore the set everything else must conform to, not the other way
 * around.
 *
 * Before this was pinned down, three spellings were live at once:
 *   players.continent          "Africa & Middle East", "Oceania"
 *   club_templates.continent   "Oceania"  (and no Africa row at all)
 *   regional/pool              "Africa and Middle East", "Australia and Pacific Islands"
 * so any group-by continent split the same region across two buckets.
 */
export const CONTINENTS = [
  "Europe",
  "Asia",
  "North America",
  "South America",
  "Africa and Middle East",
  "Australia and Pacific Islands",
] as const;

export type Continent = (typeof CONTINENTS)[number];

export const CONTINENT_SET: ReadonlySet<string> = new Set(CONTINENTS);

export function isContinent(value: unknown): value is Continent {
  return typeof value === "string" && CONTINENT_SET.has(value);
}

/** Spellings that have appeared in the data, mapped to the canonical form. */
const CONTINENT_ALIASES: Record<string, Continent> = {
  "africa & middle east":          "Africa and Middle East",
  "africa and middle east":        "Africa and Middle East",
  "africa":                        "Africa and Middle East",
  "middle east":                   "Africa and Middle East",
  "oceania":                       "Australia and Pacific Islands",
  "australia and pacific islands": "Australia and Pacific Islands",
  "australia & pacific islands":   "Australia and Pacific Islands",
  "australia":                     "Australia and Pacific Islands",
  "europe":                        "Europe",
  "asia":                          "Asia",
  "north america":                 "North America",
  "south america":                 "South America",
};

/**
 * Coerce any known spelling to the canonical one. Returns null for values that
 * are not recognised, so callers can decide whether to reject or backfill
 * rather than silently writing a fourth spelling.
 */
export function normaliseContinent(value: string | null | undefined): Continent | null {
  if (!value) return null;
  return CONTINENT_ALIASES[value.trim().toLowerCase()] ?? null;
}

/**
 * Nationality (a demonym, as stored in players.nationality) to continent.
 * Used to backfill rows whose continent was never set.
 */
const NATIONALITY_TO_CONTINENT: Record<string, Continent> = {
  // Europe
  Austrian:"Europe", Belgian:"Europe", British:"Europe", Bulgarian:"Europe", Croatian:"Europe",
  Czech:"Europe", Danish:"Europe", Dutch:"Europe", English:"Europe", Estonian:"Europe",
  Finnish:"Europe", French:"Europe", German:"Europe", Greek:"Europe", Hungarian:"Europe",
  Icelandic:"Europe", Irish:"Europe", Italian:"Europe", Latvian:"Europe", Lithuanian:"Europe",
  Norwegian:"Europe", Polish:"Europe", Portuguese:"Europe", Romanian:"Europe", Russian:"Europe",
  Scottish:"Europe", Serbian:"Europe", Slovak:"Europe", Slovenian:"Europe", Spanish:"Europe",
  Swedish:"Europe", Swiss:"Europe", Ukrainian:"Europe", Welsh:"Europe",

  // Asia
  Chinese:"Asia", Filipino:"Asia", Indian:"Asia", Indonesian:"Asia", Japanese:"Asia",
  Kazakh:"Asia", Malaysian:"Asia", Mongolian:"Asia", Nepali:"Asia", Pakistani:"Asia",
  Singaporean:"Asia", "South Korean":"Asia", "Sri Lankan":"Asia", Taiwanese:"Asia",
  Thai:"Asia", Uzbek:"Asia", Vietnamese:"Asia",

  // North America (incl. Central America and the Caribbean)
  American:"North America", Bahamian:"North America", Barbadian:"North America",
  Canadian:"North America", "Costa Rican":"North America", Cuban:"North America",
  Dominican:"North America", Guatemalan:"North America", Haitian:"North America",
  Honduran:"North America", Jamaican:"North America", Mexican:"North America",
  Nicaraguan:"North America", Panamanian:"North America", "Puerto Rican":"North America",
  Salvadoran:"North America", "Trinidadian":"North America",

  // South America
  Argentine:"South America", Argentinian:"South America", Bolivian:"South America",
  Brazilian:"South America", Chilean:"South America", Colombian:"South America",
  Ecuadorian:"South America", Guyanese:"South America", Paraguayan:"South America",
  Peruvian:"South America", Surinamese:"South America", Uruguayan:"South America",
  Venezuelan:"South America",

  // Africa and Middle East
  Algerian:"Africa and Middle East", Angolan:"Africa and Middle East",
  Bahraini:"Africa and Middle East", Burkinabe:"Africa and Middle East",
  Cameroonian:"Africa and Middle East", Congolese:"Africa and Middle East",
  Egyptian:"Africa and Middle East", Emirati:"Africa and Middle East",
  Ethiopian:"Africa and Middle East", Gabonese:"Africa and Middle East",
  Ghanaian:"Africa and Middle East", Guinean:"Africa and Middle East",
  Iranian:"Africa and Middle East", Iraqi:"Africa and Middle East",
  Israeli:"Africa and Middle East", Ivorian:"Africa and Middle East",
  Jordanian:"Africa and Middle East", Kenyan:"Africa and Middle East",
  Kuwaiti:"Africa and Middle East", Lebanese:"Africa and Middle East",
  Libyan:"Africa and Middle East", Malian:"Africa and Middle East",
  Moroccan:"Africa and Middle East", Mozambican:"Africa and Middle East",
  Namibian:"Africa and Middle East", Nigerian:"Africa and Middle East",
  Omani:"Africa and Middle East", Qatari:"Africa and Middle East",
  Rwandan:"Africa and Middle East", Saudi:"Africa and Middle East",
  Senegalese:"Africa and Middle East", "South African":"Africa and Middle East",
  Sudanese:"Africa and Middle East", Syrian:"Africa and Middle East",
  Tanzanian:"Africa and Middle East", Tunisian:"Africa and Middle East",
  Ugandan:"Africa and Middle East", Zambian:"Africa and Middle East",
  Zimbabwean:"Africa and Middle East",

  // Australia and Pacific Islands
  Australian:"Australia and Pacific Islands", Fijian:"Australia and Pacific Islands",
  "Cook Islander":"Australia and Pacific Islands", "New Zealander":"Australia and Pacific Islands",
  "Papua New Guinean":"Australia and Pacific Islands", Samoan:"Australia and Pacific Islands",
  Tahitian:"Australia and Pacific Islands", Tongan:"Australia and Pacific Islands",
  "Ni-Vanuatu":"Australia and Pacific Islands", "Solomon Islander":"Australia and Pacific Islands",
};

/** Best-effort continent for a nationality demonym. Null when unknown. */
export function continentForNationality(nationality: string | null | undefined): Continent | null {
  if (!nationality) return null;
  const key = nationality.trim();
  if (NATIONALITY_TO_CONTINENT[key]) return NATIONALITY_TO_CONTINENT[key];
  const ci = Object.keys(NATIONALITY_TO_CONTINENT)
    .find(k => k.toLowerCase() === key.toLowerCase());
  return ci ? NATIONALITY_TO_CONTINENT[ci]! : null;
}
