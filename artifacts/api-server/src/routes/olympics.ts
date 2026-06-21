import { Router } from "express";
import { db } from "@workspace/db";
import { playersTable, olympicSelectionsTable } from "@workspace/db";
import type { OlympicPlayerData } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

const COUNTRY_FLAGS: Record<string, string> = {
  "Japan":          "🇯🇵",
  "Germany":        "🇩🇪",
  "Brazil":         "🇧🇷",
  "France":         "🇫🇷",
  "USA":            "🇺🇸",
  "Italy":          "🇮🇹",
  "Ghana":          "🇬🇭",
  "Australia":      "🇦🇺",
  "Canada":         "🇨🇦",
  "China":          "🇨🇳",
  "South Korea":    "🇰🇷",
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
  "Argentina":      "🇦🇷",
  "Mexico":         "🇲🇽",
  "Cuba":           "🇨🇺",
  "Greece":         "🇬🇷",
  "Egypt":          "🇪🇬",
  "Morocco":        "🇲🇦",
  "Tunisia":        "🇹🇳",
  "South Africa":   "🇿🇦",
  "Nigeria":        "🇳🇬",
  "Jordan":         "🇯🇴",
  "India":          "🇮🇳",
  "New Zealand":    "🇳🇿",
};

const RESERVE_NAME_POOL: Record<string, string[]> = {
  "Germany":  ["Leonie Braun",    "Johanna Becker"],
  "Brazil":   ["Mariana Santos",  "Isabela Costa"],
  "France":   ["Amélie Blanc",    "Chloé Martin"],
  "USA":      ["Ashley Morgan",   "Taylor Brooks"],
  "Italy":    ["Alessia Rinaldi", "Giulia Ferrari"],
  "Ghana":    ["Efua Mensah",     "Abena Asante"],
};

function clamp(n: number, min = 45, max = 95) {
  return Math.max(min, Math.min(max, n));
}

function generateReserve(nationality: string, existingPlayers: typeof playersTable.$inferSelect[]): OlympicPlayerData {
  const existingNames = new Set(existingPlayers.map((p) => p.name));
  const pool = RESERVE_NAME_POOL[nationality] ?? [`${nationality} Reserve`, `${nationality} Wildcard`];
  const name = pool.find((n) => !existingNames.has(n)) ?? `${nationality} Reserve`;

  const avg = (fn: (p: typeof playersTable.$inferSelect) => number) =>
    Math.round(existingPlayers.reduce((s, p) => s + fn(p), 0) / existingPlayers.length);

  return {
    id: null,
    name,
    nationality,
    age: 24,
    speed:   clamp(avg((p) => p.speed)   - 8),
    power:   clamp(avg((p) => p.power)   - 6),
    defense: clamp(avg((p) => p.defense) - 7),
    serve:   clamp(avg((p) => p.serve)   - 8),
    block:   clamp(avg((p) => p.block)   - 6),
    stamina: clamp(avg((p) => p.stamina) - 5),
    isReserve: true,
    imageUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name + "_olympic")}&backgroundColor=b6e3f4,c0aede,d1d4f9&backgroundType=gradientLinear`,
  };
}

router.get("/olympics/countries", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

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
    playerCount: number;
    squad: OlympicPlayerData[];
  }> = [];

  for (const [nationality, players] of byNationality.entries()) {
    if (players.length < 2) continue;

    const scored = [...players].sort((a, b) => {
      const scoreA = (a.speed + a.power + a.defense + a.serve + a.block + a.stamina) / 6;
      const scoreB = (b.speed + b.power + b.defense + b.serve + b.block + b.stamina) / 6;
      return scoreB - scoreA;
    });

    const top = scored.slice(0, 3);
    const squad: OlympicPlayerData[] = top.map((p) => ({
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
      isReserve: false,
      imageUrl: p.imageUrl ?? null,
    }));

    if (players.length === 2) {
      squad.push(generateReserve(nationality, scored.slice(0, 2)));
    }

    countries.push({
      country: nationality,
      flag: COUNTRY_FLAGS[nationality] ?? "🌍",
      playerCount: players.length,
      squad,
    });
  }

  countries.sort((a, b) => b.playerCount - a.playerCount || a.country.localeCompare(b.country));

  res.json(countries);
});

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

router.post("/olympics/selection", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { country, flag, squad } = req.body as { country: string; flag: string; squad: OlympicPlayerData[] };

  if (!country || !flag || !Array.isArray(squad) || squad.length !== 3) {
    res.status(400).json({ error: "country, flag, and a squad of exactly 3 players are required" });
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

export default router;
