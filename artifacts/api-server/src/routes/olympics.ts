import { Router } from "express";
import { db } from "@workspace/db";
import { playersTable, olympicSelectionsTable } from "@workspace/db";
import type { OlympicPlayerData } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// ── Country flags ─────────────────────────────────────────────────────────────

const COUNTRY_FLAGS: Record<string, string> = {
  // Asia
  "Japan":          "🇯🇵",
  "China":          "🇨🇳",
  "South Korea":    "🇰🇷",
  "India":          "🇮🇳",
  "Thailand":       "🇹🇭",
  "Indonesia":      "🇮🇩",
  "Philippines":    "🇵🇭",
  "Vietnam":        "🇻🇳",
  "Malaysia":       "🇲🇾",
  "Taiwan":         "🇹🇼",
  "Laos":           "🇱🇦",
  "Maldives":       "🇲🇻",
  // Europe
  "Germany":        "🇩🇪",
  "France":         "🇫🇷",
  "Italy":          "🇮🇹",
  "Spain":          "🇪🇸",
  "Norway":         "🇳🇴",
  "Sweden":         "🇸🇪",
  "Denmark":        "🇩🇰",
  "Netherlands":    "🇳🇱",
  "Switzerland":    "🇨🇭",
  "Austria":        "🇦🇹",
  "Poland":         "🇵🇱",
  "Czech Republic": "🇨🇿",
  "Hungary":        "🇭🇺",
  "Ukraine":        "🇺🇦",
  "Russia":         "🇷🇺",
  "Greece":         "🇬🇷",
  "Portugal":       "🇵🇹",
  "Finland":        "🇫🇮",
  "Croatia":        "🇭🇷",
  "Serbia":         "🇷🇸",
  "Belgium":        "🇧🇪",
  "England":        "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  "Ireland":        "🇮🇪",
  "Malta":          "🇲🇹",
  "Monaco":         "🇲🇨",
  // North America
  "USA":            "🇺🇸",
  "Canada":         "🇨🇦",
  "Mexico":         "🇲🇽",
  "Cuba":           "🇨🇺",
  "Jamaica":        "🇯🇲",
  "Costa Rica":     "🇨🇷",
  "Dominican Republic": "🇩🇴",
  "Puerto Rico":    "🇵🇷",
  "Panama":         "🇵🇦",
  "Bahamas":        "🇧🇸",
  // South America
  "Brazil":         "🇧🇷",
  "Argentina":      "🇦🇷",
  "Colombia":       "🇨🇴",
  "Chile":          "🇨🇱",
  "Peru":           "🇵🇪",
  "Venezuela":      "🇻🇪",
  "Ecuador":        "🇪🇨",
  "Bolivia":        "🇧🇴",
  "Uruguay":        "🇺🇾",
  "Guyana":         "🇬🇾",
  // Africa and Middle East
  "Nigeria":        "🇳🇬",
  "Egypt":          "🇪🇬",
  "Kenya":          "🇰🇪",
  "Morocco":        "🇲🇦",
  "Tunisia":        "🇹🇳",
  "South Africa":   "🇿🇦",
  "Tanzania":       "🇹🇿",
  "Zimbabwe":       "🇿🇼",
  "Mozambique":     "🇲🇿",
  "Madagascar":     "🇲🇬",
  "Ghana":          "🇬🇭",
  "Senegal":        "🇸🇳",
  "Cameroon":       "🇨🇲",
  "Algeria":        "🇩🇿",
  // Oceania
  "Australia":      "🇦🇺",
  "New Zealand":    "🇳🇿",
  "Fiji":           "🇫🇯",
  "Samoa":          "🇼🇸",
  "Tahiti":         "🇵🇫",
  "Papua New Guinea": "🇵🇬",
  "Tonga":          "🇹🇴",
  "Vanuatu":        "🇻🇺",
  "Cook Islands":   "🇨🇰",
  "Solomon Islands":"🇸🇧",
};

// ── Continent mapping ─────────────────────────────────────────────────────────
// Keyed by nationality (same values that live in playersTable.nationality).

const NATIONALITY_CONTINENT: Record<string, string> = {
  // Asia
  Japan: "Asia", China: "Asia", "South Korea": "Asia", India: "Asia",
  Thailand: "Asia", Indonesia: "Asia", Philippines: "Asia", Vietnam: "Asia",
  Malaysia: "Asia", Taiwan: "Asia", Laos: "Asia", Maldives: "Asia",
  // Europe
  Germany: "Europe", France: "Europe", Italy: "Europe", Spain: "Europe",
  Norway: "Europe", Sweden: "Europe", Denmark: "Europe", Netherlands: "Europe",
  Switzerland: "Europe", Poland: "Europe", Greece: "Europe", Portugal: "Europe",
  Austria: "Europe", Belgium: "Europe", Russia: "Europe", "Czech Republic": "Europe",
  Finland: "Europe", Croatia: "Europe", Serbia: "Europe", Ukraine: "Europe",
  Hungary: "Europe", England: "Europe", Ireland: "Europe", Malta: "Europe",
  Monaco: "Europe",
  // North America
  USA: "North America", Canada: "North America", Mexico: "North America",
  Cuba: "North America", Jamaica: "North America", "Costa Rica": "North America",
  "Dominican Republic": "North America", "Puerto Rico": "North America",
  Panama: "North America", Bahamas: "North America",
  // South America
  Brazil: "South America", Argentina: "South America", Colombia: "South America",
  Chile: "South America", Peru: "South America", Venezuela: "South America",
  Ecuador: "South America", Bolivia: "South America", Uruguay: "South America",
  Guyana: "South America",
  // Africa and Middle East
  Nigeria: "Africa and Middle East", Egypt: "Africa and Middle East",
  Kenya: "Africa and Middle East", Morocco: "Africa and Middle East",
  Tunisia: "Africa and Middle East", "South Africa": "Africa and Middle East",
  Tanzania: "Africa and Middle East", Zimbabwe: "Africa and Middle East",
  Mozambique: "Africa and Middle East", Madagascar: "Africa and Middle East",
  Ghana: "Africa and Middle East", Senegal: "Africa and Middle East",
  Cameroon: "Africa and Middle East", Algeria: "Africa and Middle East",
  // Australia and Pacific Islands
  Australia: "Australia and Pacific Islands",
  "New Zealand": "Australia and Pacific Islands",
  Fiji: "Australia and Pacific Islands",
  Samoa: "Australia and Pacific Islands",
  Tahiti: "Australia and Pacific Islands",
  "Papua New Guinea": "Australia and Pacific Islands",
  Tonga: "Australia and Pacific Islands",
  Vanuatu: "Australia and Pacific Islands",
  "Cook Islands": "Australia and Pacific Islands",
  "Solomon Islands": "Australia and Pacific Islands",
};

// ── Eligibility constants ─────────────────────────────────────────────────────

/** Minimum number of real eligible players a country must have. */
const MIN_PLAYERS = 3;

// ── Route: GET /olympics/countries ────────────────────────────────────────────
// Returns all nationalities that have at least one active senior player,
// labelled ELIGIBLE (≥ MIN_PLAYERS real players) or INELIGIBLE (< MIN_PLAYERS).
// No wildcard or generated players are ever included.

router.get("/olympics/countries", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  // All active senior players (isDraftPlayer = false to exclude draft pool)
  const allPlayers = await db.select().from(playersTable)
    .where(eq(playersTable.isActive, true));

  const byNationality = new Map<string, typeof allPlayers>();
  for (const p of allPlayers) {
    if (!p.nationality) continue;
    const group = byNationality.get(p.nationality) ?? [];
    group.push(p);
    byNationality.set(p.nationality, group);
  }

  const countries: Array<{
    country: string;
    flag: string;
    continent: string;
    playerCount: number;
    eligibilityStatus: "eligible" | "ineligible";
    eligibilityReason?: string;
    squad: OlympicPlayerData[];
  }> = [];

  for (const [nationality, players] of byNationality.entries()) {
    const eligible = players.length >= MIN_PLAYERS;
    const continent = NATIONALITY_CONTINENT[nationality] ?? "Other";

    // Sort best players first by average rating
    const scored = [...players].sort((a, b) => {
      const avg = (p: typeof players[number]) =>
        (p.speed + p.power + p.defense + p.serve + p.block + p.stamina) / 6;
      return avg(b) - avg(a);
    });

    // Squad: top 2 starters + 1 reserve — only built for eligible countries.
    // All three are real players from the permanent DB (no generated players).
    const squad: OlympicPlayerData[] = eligible
      ? scored.slice(0, MIN_PLAYERS).map((p, i) => ({
          id: p.id,
          name: p.name,
          nationality: p.nationality,
          age: p.age,
          speed: p.speed,
          power: p.power,
          defense: p.defense,
          serve: p.serve,
          block: p.block,
          stamina: p.stamina,
          isReserve: i === 2,   // third player is the reserve
          imageUrl: p.imageUrl ?? null,
        }))
      : [];

    countries.push({
      country: nationality,
      flag: COUNTRY_FLAGS[nationality] ?? "🌍",
      continent,
      playerCount: players.length,
      eligibilityStatus: eligible ? "eligible" : "ineligible",
      ...(eligible ? {} : {
        eligibilityReason: `Requires ${MIN_PLAYERS} eligible players of national origin (has ${players.length}).`,
      }),
      squad,
    });
  }

  // Eligible countries first, then ineligible; alphabetical within each group
  countries.sort((a, b) => {
    if (a.eligibilityStatus !== b.eligibilityStatus) {
      return a.eligibilityStatus === "eligible" ? -1 : 1;
    }
    return b.playerCount - a.playerCount || a.country.localeCompare(b.country);
  });

  res.json(countries);
});

// ── Route: GET /olympics/selection ────────────────────────────────────────────

router.get("/olympics/selection", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const selection = await db.query.olympicSelectionsTable.findFirst({
    where: eq(olympicSelectionsTable.userId, req.user.id),
  });

  if (!selection) { res.status(404).json({ error: "No selection made" }); return; }

  res.json({
    country: selection.selectedCountry,
    flag: selection.selectedFlag,
    squad: selection.squad,
  });
});

// ── Route: POST /olympics/selection ───────────────────────────────────────────
// Saves the user's chosen country + squad.
// All three squad members must be real players (id must not be null).

router.post("/olympics/selection", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { country, flag, squad } = req.body as {
    country: string;
    flag: string;
    squad: OlympicPlayerData[];
  };

  if (!country || !flag || !Array.isArray(squad) || squad.length !== 3) {
    res.status(400).json({ error: "country, flag, and a squad of exactly 3 players are required" });
    return;
  }

  // Reject any squad that contains a generated (id: null) player
  const hasGeneratedPlayer = squad.some((p) => p.id === null);
  if (hasGeneratedPlayer) {
    res.status(400).json({ error: "All squad members must be real players with a permanent player ID." });
    return;
  }

  const existing = await db.query.olympicSelectionsTable.findFirst({
    where: eq(olympicSelectionsTable.userId, req.user.id),
  });

  if (existing) {
    await db.update(olympicSelectionsTable)
      .set({ selectedCountry: country, selectedFlag: flag, squad })
      .where(eq(olympicSelectionsTable.userId, req.user.id));
  } else {
    await db.insert(olympicSelectionsTable).values({
      userId: req.user.id,
      selectedCountry: country,
      selectedFlag: flag,
      squad,
    });
  }

  res.json({ country, flag, squad });
});

// ── Route: DELETE /olympics/selection ─────────────────────────────────────────
// Called when the Olympic tournament concludes.
// Removes the row; real players in the squad are unaffected (they remain in playersTable).

router.delete("/olympics/selection", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const existing = await db.query.olympicSelectionsTable.findFirst({
    where: eq(olympicSelectionsTable.userId, req.user.id),
  });

  if (!existing) { res.status(404).json({ error: "No selection to clear" }); return; }

  await db.delete(olympicSelectionsTable)
    .where(eq(olympicSelectionsTable.userId, req.user.id));

  res.status(204).send();
});

export default router;
