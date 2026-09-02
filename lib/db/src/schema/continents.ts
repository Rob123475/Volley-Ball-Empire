/**
 * The canonical six continents — the single source of truth for the whole
 * repo, server and client.
 *
 * ── Why keys, not display strings ──────────────────────────────────────────
 * Everything used to match on the LABEL, and seven vocabularies grew up
 * independently:
 *
 *   lib/db (previous canonical)  "Africa and Middle East"  "Australia and Pacific Islands"
 *   routes/regional-league.ts    "Africa and Middle East"  "Australia and Pacific Islands"
 *   routes/players.ts            "Africa & Middle East"    "Oceania"
 *   routes/youth-scouting.ts     "Africa"                  "Oceania"
 *   data/worldTour.ts            "Africa & Middle East"    "Australia & Pacific"
 *   client/career-management     "Africa"                  "Oceania"
 *   client/player-portrait       "Africa"                  "Oceania"
 *
 * Any group-by continent therefore split one region across several buckets, and
 * a screen that grouped by a label it did not recognise dropped those rows on
 * the floor without a word. That is what hid three Oceania clubs from the club
 * picker.
 *
 * A display string is the wrong join key. It gets re-punctuated ("&" vs "and"),
 * HTML-escaped, translated or title-cased, and every one of those silently
 * breaks equality. So the stored value is now an opaque snake_case KEY that is
 * never shown to anyone, and the label is looked up from here at render time.
 * Labels can change freely; the data does not move.
 *
 * Anything that reads or writes a continent goes through this module.
 */

// ── The canonical six, in display order ─────────────────────────────────────
export const CONTINENT_KEYS = [
  "north_america",
  "south_america",
  "europe",
  "asia",
  "africa_middle_east",
  "oceania",
] as const;

export type ContinentKey = (typeof CONTINENT_KEYS)[number];

/**
 * The only place a continent's human-readable name is written down.
 * `Record<ContinentKey, string>` on purpose: adding a key to CONTINENT_KEYS
 * without giving it a label is a compile error, not a runtime `undefined`.
 */
export const CONTINENT_LABEL: Record<ContinentKey, string> = {
  north_america:      "North America",
  south_america:      "South America",
  europe:             "Europe",
  asia:               "Asia",
  africa_middle_east: "Africa & Middle East",
  oceania:            "Oceania",
};

/** Key + label pairs in display order — what a UI usually wants to map over. */
export const CONTINENTS: ReadonlyArray<{ key: ContinentKey; label: string }> =
  CONTINENT_KEYS.map((key) => ({ key, label: CONTINENT_LABEL[key] }));

export const CONTINENT_COUNT = CONTINENT_KEYS.length;

export const CONTINENT_KEY_SET: ReadonlySet<string> = new Set(CONTINENT_KEYS);

export function isContinentKey(value: unknown): value is ContinentKey {
  return typeof value === "string" && CONTINENT_KEY_SET.has(value);
}

/** Label for a key. Falls back to the raw value so a bad one is VISIBLE, not blank. */
export function continentLabel(key: string | null | undefined): string {
  if (!key) return "Unknown region";
  return isContinentKey(key) ? CONTINENT_LABEL[key] : key;
}

// ── Coercion from any spelling that has ever been in the data ───────────────

/**
 * Collapse a value so punctuation drift cannot cause a miss: case, surrounding
 * space, "&" vs "and", and underscores/hyphens vs spaces all fold together.
 */
function fold(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[\s_-]+/g, " ")
    .trim();
}

/**
 * Every spelling this project has stored, folded, mapped to its key. Both
 * "africa and middle east" and "africa middle east" appear because the fold of
 * the old LABEL and the fold of the new KEY differ by the word "and".
 */
const KEY_ALIASES: Record<string, ContinentKey> = {
  // north_america
  "north america": "north_america",
  "northam": "north_america",
  // south_america
  "south america": "south_america",
  "southam": "south_america",
  // europe
  "europe": "europe",
  "european": "europe",
  // asia
  "asia": "asia",
  "asian": "asia",
  // africa_middle_east — "Africa", "Africa & Middle East", "Africa and Middle East", key form
  "africa": "africa_middle_east",
  "middle east": "africa_middle_east",
  "africa and middle east": "africa_middle_east",
  "africa middle east": "africa_middle_east",
  // oceania — "Oceania", "Australia and Pacific Islands", "Australia & Pacific", key form
  "oceania": "oceania",
  "australia": "oceania",
  "australia and pacific islands": "oceania",
  "australia pacific islands": "oceania",
  "australia and pacific": "oceania",
  "australia pacific": "oceania",
  "pacific": "oceania",
};

/**
 * Coerce any known spelling — old label, new key, or punctuation variant — to
 * the canonical key. Returns null for anything unrecognised, so callers must
 * decide to reject, backfill or surface it rather than silently inventing an
 * eighth spelling.
 */
export function continentKeyFrom(value: string | null | undefined): ContinentKey | null {
  if (!value) return null;
  return KEY_ALIASES[fold(value)] ?? null;
}

// ── Nationality backfill ────────────────────────────────────────────────────

/**
 * Nationality to continent key.
 *
 * players.nationality holds a MIX of country names ("Australia", "Brazil") and
 * demonyms ("Australian", "Brazilian") — both are live in the shipped database
 * — so both are listed. Lookup is folded, so case and spacing do not matter.
 */
const NATIONALITY_TO_KEY: Record<string, ContinentKey> = {};

function nat(key: ContinentKey, names: string[]): void {
  for (const n of names) NATIONALITY_TO_KEY[fold(n)] = key;
}

nat("europe", [
  "Austria", "Austrian", "Belgium", "Belgian", "Britain", "British", "Bulgaria", "Bulgarian",
  "Croatia", "Croatian", "Czech", "Czech Republic", "Denmark", "Danish", "England", "English",
  "Estonia", "Estonian", "Finland", "Finnish", "France", "French", "Germany", "German",
  "Greece", "Greek", "Hungary", "Hungarian", "Iceland", "Icelandic", "Ireland", "Irish",
  "Italy", "Italian", "Latvia", "Latvian", "Lithuania", "Lithuanian", "Malta", "Maltese",
  "Monaco", "Netherlands", "Dutch", "Norway", "Norwegian", "Poland", "Polish", "Portugal",
  "Portuguese", "Romania", "Romanian", "Russia", "Russian", "Scotland", "Scottish", "Serbia",
  "Serbian", "Slovakia", "Slovak", "Slovenia", "Slovenian", "Spain", "Spanish", "Sweden",
  "Swedish", "Switzerland", "Swiss", "Ukraine", "Ukrainian", "Wales", "Welsh",
]);

nat("asia", [
  "China", "Chinese", "India", "Indian", "Indonesia", "Indonesian", "Japan", "Japanese",
  "Kazakhstan", "Kazakh", "Laos", "Laotian", "Malaysia", "Malaysian", "Maldives", "Maldivian",
  "Mongolia", "Mongolian", "Nepal", "Nepali", "Pakistan", "Pakistani", "Philippines", "Filipino",
  "Singapore", "Singaporean", "South Korea", "South Korean", "Sri Lanka", "Sri Lankan",
  "Taiwan", "Taiwanese", "Thailand", "Thai", "Uzbekistan", "Uzbek", "Vietnam", "Vietnamese",
]);

nat("north_america", [
  "USA", "United States", "American", "Bahamas", "Bahamian", "Barbados", "Barbadian",
  "Canada", "Canadian", "Costa Rica", "Costa Rican", "Cuba", "Cuban", "Dominica",
  "Dominican", "Dominican Republic", "El Salvador", "Salvadoran", "Guatemala", "Guatemalan",
  "Haiti", "Haitian", "Honduras", "Honduran", "Jamaica", "Jamaican", "Mexico", "Mexican",
  "Nicaragua", "Nicaraguan", "Panama", "Panamanian", "Puerto Rico", "Puerto Rican",
  "Trinidad and Tobago", "Trinidadian",
]);

nat("south_america", [
  "Argentina", "Argentine", "Argentinian", "Bolivia", "Bolivian", "Brazil", "Brazilian",
  "Chile", "Chilean", "Colombia", "Colombian", "Ecuador", "Ecuadorian", "Guyana", "Guyanese",
  "Paraguay", "Paraguayan", "Peru", "Peruvian", "Suriname", "Surinamese", "Uruguay",
  "Uruguayan", "Venezuela", "Venezuelan",
]);

nat("africa_middle_east", [
  "Algeria", "Algerian", "Angola", "Angolan", "Bahrain", "Bahraini", "Burkina Faso", "Burkinabe",
  "Cameroon", "Cameroonian", "Congo", "Congolese", "Egypt", "Egyptian", "Ethiopia", "Ethiopian",
  "Gabon", "Gabonese", "Ghana", "Ghanaian", "Guinea", "Guinean", "Iran", "Iranian", "Iraq", "Iraqi",
  "Israel", "Israeli", "Ivory Coast", "Ivorian", "Jordan", "Jordanian", "Kenya", "Kenyan",
  "Kuwait", "Kuwaiti", "Lebanon", "Lebanese", "Libya", "Libyan", "Madagascar", "Malagasy",
  "Mali", "Malian", "Morocco", "Moroccan", "Mozambique", "Mozambican", "Namibia", "Namibian",
  "Nigeria", "Nigerian", "Oman", "Omani", "Qatar", "Qatari", "Rwanda", "Rwandan",
  "Saudi Arabia", "Saudi", "Senegal", "Senegalese", "South Africa", "South African",
  "Sudan", "Sudanese", "Syria", "Syrian", "Tanzania", "Tanzanian", "Tunisia", "Tunisian",
  "UAE", "United Arab Emirates", "Emirati", "Uganda", "Ugandan", "Zambia", "Zambian",
  "Zimbabwe", "Zimbabwean",
]);

nat("oceania", [
  "Australia", "Australian", "Cook Islands", "Cook Islander", "Fiji", "Fijian",
  "New Zealand", "New Zealander", "Papua New Guinea", "Papua New Guinean",
  "Samoa", "Samoan", "Solomon Islands", "Solomon Islander", "Tahiti", "Tahitian",
  "Tonga", "Tongan", "Vanuatu", "Ni-Vanuatu",
]);

/** Best-effort continent key for a nationality. Null when unknown. */
export function continentKeyForNationality(
  nationality: string | null | undefined,
): ContinentKey | null {
  if (!nationality) return null;
  return NATIONALITY_TO_KEY[fold(nationality)] ?? null;
}

// ── Country flags ───────────────────────────────────────────────────────────

/**
 * Nationality to ISO 3166-1 alpha-2, folded the same way as the continent
 * lookup so "Australia" and "Australian" both resolve. Staff rows still store a
 * mix of country names and demonyms, so both forms have to work.
 *
 * The flag itself is DERIVED from the code rather than typed out: an emoji flag
 * is just the two letters as regional-indicator symbols. That means no table of
 * 100 pasted emoji to get subtly wrong, and adding a country is one line.
 */
const ISO2: Record<string, string> = {};

function iso(code: string, names: string[]): void {
  for (const n of names) ISO2[fold(n)] = code;
}

iso("AR", ["Argentina", "Argentine", "Argentinian"]);
iso("AU", ["Australia", "Australian"]);
iso("BS", ["Bahamas", "Bahamian"]);
iso("BE", ["Belgium", "Belgian"]);
iso("BO", ["Bolivia", "Bolivian"]);
iso("BR", ["Brazil", "Brazilian"]);
iso("BG", ["Bulgaria", "Bulgarian"]);
iso("BF", ["Burkina Faso", "Burkinabe"]);
iso("CA", ["Canada", "Canadian"]);
iso("CL", ["Chile", "Chilean"]);
iso("CN", ["China", "Chinese"]);
iso("CO", ["Colombia", "Colombian"]);
iso("CK", ["Cook Islands", "Cook Islander"]);
iso("CR", ["Costa Rica", "Costa Rican"]);
iso("HR", ["Croatia", "Croatian"]);
iso("CU", ["Cuba", "Cuban"]);
iso("CZ", ["Czech", "Czech Republic"]);
iso("DK", ["Denmark", "Danish"]);
iso("DO", ["Dominican Republic", "Dominican"]);
iso("EC", ["Ecuador", "Ecuadorian"]);
iso("EG", ["Egypt", "Egyptian"]);
iso("FJ", ["Fiji", "Fijian"]);
iso("FI", ["Finland", "Finnish"]);
iso("FR", ["France", "French"]);
iso("DE", ["Germany", "German"]);
iso("GH", ["Ghana", "Ghanaian"]);
iso("GR", ["Greece", "Greek"]);
iso("GN", ["Guinea", "Guinean"]);
iso("GY", ["Guyana", "Guyanese"]);
iso("IS", ["Iceland", "Icelandic"]);
iso("IN", ["India", "Indian"]);
iso("ID", ["Indonesia", "Indonesian"]);
iso("IE", ["Ireland", "Irish"]);
iso("IT", ["Italy", "Italian"]);
iso("CI", ["Ivory Coast", "Ivorian"]);
iso("JM", ["Jamaica", "Jamaican"]);
iso("JP", ["Japan", "Japanese"]);
iso("JO", ["Jordan", "Jordanian"]);
iso("KE", ["Kenya", "Kenyan"]);
iso("LA", ["Laos", "Laotian"]);
iso("LB", ["Lebanon", "Lebanese"]);
iso("MG", ["Madagascar", "Malagasy"]);
iso("MY", ["Malaysia", "Malaysian"]);
iso("MV", ["Maldives", "Maldivian"]);
iso("MT", ["Malta", "Maltese"]);
iso("MX", ["Mexico", "Mexican"]);
iso("MC", ["Monaco", "Monegasque"]);
iso("MA", ["Morocco", "Moroccan"]);
iso("MZ", ["Mozambique", "Mozambican"]);
iso("NL", ["Netherlands", "Dutch"]);
iso("NZ", ["New Zealand", "New Zealander"]);
iso("NG", ["Nigeria", "Nigerian"]);
iso("NO", ["Norway", "Norwegian"]);
iso("OM", ["Oman", "Omani"]);
iso("PA", ["Panama", "Panamanian"]);
iso("PG", ["Papua New Guinea", "Papua New Guinean"]);
iso("PE", ["Peru", "Peruvian"]);
iso("PH", ["Philippines", "Filipino"]);
iso("PL", ["Poland", "Polish"]);
iso("PT", ["Portugal", "Portuguese"]);
iso("PR", ["Puerto Rico", "Puerto Rican"]);
iso("QA", ["Qatar", "Qatari"]);
iso("RU", ["Russia", "Russian"]);
iso("WS", ["Samoa", "Samoan"]);
iso("SN", ["Senegal", "Senegalese"]);
iso("SG", ["Singapore", "Singaporean"]);
iso("SB", ["Solomon Islands", "Solomon Islander"]);
iso("ZA", ["South Africa", "South African"]);
iso("KR", ["South Korea", "South Korean"]);
iso("ES", ["Spain", "Spanish"]);
iso("SD", ["Sudan", "Sudanese"]);
iso("SE", ["Sweden", "Swedish"]);
iso("CH", ["Switzerland", "Swiss"]);
iso("PF", ["Tahiti", "Tahitian"]);           // French Polynesia
iso("TW", ["Taiwan", "Taiwanese"]);
iso("TZ", ["Tanzania", "Tanzanian"]);
iso("TH", ["Thailand", "Thai"]);
iso("TO", ["Tonga", "Tongan"]);
iso("TN", ["Tunisia", "Tunisian"]);
iso("UA", ["Ukraine", "Ukrainian"]);
iso("UY", ["Uruguay", "Uruguayan"]);
iso("US", ["USA", "United States", "American"]);
iso("VU", ["Vanuatu", "Ni-Vanuatu", "Vanuatuan"]);
iso("VE", ["Venezuela", "Venezuelan"]);
iso("VN", ["Vietnam", "Vietnamese"]);
iso("GB", ["United Kingdom", "Britain", "British"]);
iso("ZW", ["Zimbabwe", "Zimbabwean"]);

/** England, Scotland and Wales are subdivisions — they have their own flags. */
const SUBDIVISION_FLAG: Record<string, string> = {
  england:  "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
  scotland: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}",
  wales:    "\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}",
  english:  "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
  scottish: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}",
  welsh:    "\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}",
};

/** ISO 3166-1 alpha-2 for a nationality, or null when unknown. */
export function countryCode(nationality: string | null | undefined): string | null {
  if (!nationality) return null;
  return ISO2[fold(nationality)] ?? null;
}

/**
 * Flag emoji for a nationality. Falls back to a globe rather than empty space,
 * so an unrecognised value is visible instead of silently blank.
 */
export function countryFlag(nationality: string | null | undefined): string {
  if (!nationality) return "\u{1F30D}";
  const sub = SUBDIVISION_FLAG[fold(nationality)];
  if (sub) return sub;
  const code = countryCode(nationality);
  if (!code) return "\u{1F30D}";
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
