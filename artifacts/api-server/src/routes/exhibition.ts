/**
 * 1.2 D6 (Rob, 23 Nov): the Exhibition Game. Up to four people on one PC, any mix with the AI; two
 * teams (any of the game's 60 continental clubs, or a custom team), their players, names changed at
 * will, the venue, time of day, weather and difficulty. Everything is open and free: every venue,
 * item, cut and print.
 *
 * It touches nothing in a career: no money, no ranking, no injuries. The game is kept in memory
 * only (no database row), the court reads it as it reads a career match (GET /unity/exhibition-state,
 * the same shape as /unity/match-state, with "exhibition": true and the seats), and the court
 * reports no result for it.
 *
 * Ready for online play later: the whole set-up is one small block of data (ExhibitionSetup) that
 * could be sent to another PC; each player is a seat (a person here, the AI, later a person there).
 */
import { Router } from "express";
import { randomUUID } from "node:crypto";
import { db, continentalPoolTeamsTable, continentalPoolPlayersTable, CONTINENTS, isContinentKey } from "@workspace/db";
import { pointProbability, sideRating } from "../utils/matchEngine.js";
import { STORE_ITEMS, storeOpen, wornFor } from "../utils/store.js";

const router = Router();

const TIMES = ["morning", "midday", "sunset", "night"] as const;
const WEATHERS = ["sunny", "windy", "cloudy", "rain"] as const;
const DIFFICULTIES = ["easy", "medium", "hard"] as const;
const CUTS = ["bikini-1", "bikini-2", "bikini-3", "swimsuit-1", "swimsuit-2", "swimsuit-3"] as const;
const PRINTS = ["leopard", "hibiscus", "stripes", "polkadots", "palmleaves", "camouflage", "tiedye", "zebra"] as const;
const HEX = /^#[0-9a-fA-F]{6}$/;

type SetupPlayer = {
  poolPlayerId: number; name: string;
  /** A custom team's swimwear: the cut, a print or none ("plain"), and the two colours. */
  swimwear?: { cut: string; print: string; colourA: string; colourB: string };
  /** Accessories: store items (all free here) in the colour chosen. */
  wear?: { itemId: string; colour: string }[];
};
type SetupTeam = { poolTeamId: number | null; name: string; primary: string; secondary: string; players: [SetupPlayer, SetupPlayer] };
/** The whole game, as one block of data (it could be sent to another PC as it is). */
export type ExhibitionSetup = {
  home: SetupTeam; away: SetupTeam;
  venue: string; timeOfDay: string; weather: string; difficulty: string;
  /** A1, A2, B1, B2: the person (0-3) at this PC playing each, or -1 for the AI. */
  seats: [number, number, number, number];
};

const games = new Map<string, ExhibitionSetup>();

function poolPlayers() {
  return db.select().from(continentalPoolPlayersTable).all();
}

router.get("/exhibition/options", (req, res) => {
  const teams = db.select().from(continentalPoolTeamsTable).all();
  const players = poolPlayers();
  res.json({
    teams: teams.map((t) => ({
      id: t.id, name: t.teamName, continent: t.continent, primary: t.primaryColor, secondary: t.secondaryColor,
      players: players.filter((p) => p.poolTeamId === t.id).map((p) => p.id),
    })),
    players: players.map((p) => ({
      id: p.id, name: p.name, nationality: p.nationality, skinTone: p.skinTone, imageUrl: p.imageUrl, age: p.baseAge,
      speed: p.speed, power: p.power, defense: p.defense, serve: p.serve, block: p.block, stamina: p.stamina,
      overall: Math.round((p.speed + p.power + p.defense + p.serve + p.block + p.stamina) / 6),
    })),
    venues: CONTINENTS.map((c) => ({ key: c.key, label: c.label })),
    times: TIMES, weathers: WEATHERS, difficulties: DIFFICULTIES, cuts: CUTS, prints: PRINTS,
    items: STORE_ITEMS.filter((i) => i.slot !== "print").map((i) => ({ id: i.id, name: i.name, slot: i.slot, picture: i.picture, colour: i.colour })),
    // D4: what the profile bought and wears goes on its first player (when the store is open).
    worn: req.isAuthenticated() && storeOpen()
      ? wornFor(req.user.id).filter((w) => w.slot !== "print").map((w) => ({ itemId: STORE_ITEMS.find((i) => i.unity === w.unity)?.id, colour: w.colour }))
      : [],
  });
});

function invalid(s: ExhibitionSetup, ids: Set<number>): string | null {
  if (!s?.home || !s?.away) return "Two teams are needed.";
  for (const t of [s.home, s.away]) {
    if (typeof t.name !== "string" || !t.name.trim() || t.name.length > 30) return "A team needs a name (up to 30 letters).";
    if (!HEX.test(t.primary ?? "") || !HEX.test(t.secondary ?? "")) return "A team's colours are #rrggbb.";
    if (!Array.isArray(t.players) || t.players.length !== 2) return "A team has two players.";
    for (const p of t.players) {
      if (!ids.has(p.poolPlayerId)) return "No such player.";
      if (typeof p.name !== "string" || !p.name.trim() || p.name.length > 30) return "A player needs a name (up to 30 letters).";
      if (p.swimwear && (!CUTS.includes(p.swimwear.cut as never) || !(p.swimwear.print === "plain" || PRINTS.includes(p.swimwear.print as never)) || !HEX.test(p.swimwear.colourA) || !HEX.test(p.swimwear.colourB))) return "Swimwear is a cut, plain or a print, and two colours.";
      for (const w of p.wear ?? []) if (!STORE_ITEMS.some((i) => i.id === w.itemId && i.slot !== "print") || !HEX.test(w.colour)) return "An accessory is an item and a colour.";
    }
  }
  const all = [...s.home.players, ...s.away.players].map((p) => p.poolPlayerId);
  if (new Set(all).size !== 4) return "Four different players.";
  if (!isContinentKey(s.venue)) return "No such venue.";
  if (!TIMES.includes(s.timeOfDay as never) || !WEATHERS.includes(s.weather as never) || !DIFFICULTIES.includes(s.difficulty as never)) return "Pick a time, a weather and a difficulty.";
  if (!Array.isArray(s.seats) || s.seats.length !== 4 || !s.seats.every((x) => Number.isInteger(x) && x >= -1 && x <= 3)) return "Each player is a person (1-4) or the AI.";
  const people = [...new Set(s.seats.filter((x) => x >= 0))].sort();
  if (people.some((p, i) => p !== i)) return "People are numbered from 1 with none missed.";
  return null;
}

router.post("/exhibition", (req, res) => {
  const setup = req.body as ExhibitionSetup;
  const err = invalid(setup, new Set(poolPlayers().map((p) => p.id)));
  if (err) { res.status(400).json({ error: err }); return; }
  const id = randomUUID();
  games.set(id, setup);
  while (games.size > 20) games.delete(games.keys().next().value!);   // only the latest few are kept
  res.json({ id });
});

/** The court's view of an exhibition: /unity/match-state's shape, with the seats and what each player wears. */
router.get("/unity/exhibition-state", (req, res) => {
  const s = games.get(String(req.query.id ?? ""));
  if (!s) { res.status(404).json({ error: "No such exhibition game." }); return; }
  const pool = new Map(poolPlayers().map((p) => [p.id, p]));
  const player = (t: SetupTeam, sp: SetupPlayer) => {
    const p = pool.get(sp.poolPlayerId)!;
    return {
      id: p.id, name: sp.name.trim(), nationality: p.nationality, team: t.name.trim(), position: "",
      speed: p.speed, power: p.power, defense: p.defense, serve: p.serve, block: p.block, stamina: p.stamina,
      overall: Math.round((p.speed + p.power + p.defense + p.serve + p.block + p.stamina) / 6),
      morale: 75, fatigue: 0, fitness: 100, injured: false, injuryStatus: null, age: p.baseAge, height: 0,
      primaryColor: t.primary, secondaryColor: t.secondary, skinTone: p.skinTone,
      swimwear: sp.swimwear && t.poolTeamId == null ? sp.swimwear : null,
      wear: (sp.wear ?? []).map((w) => ({ part: STORE_ITEMS.find((i) => i.id === w.itemId)!.unity, colour: w.colour })),
    };
  };
  const rated = (t: SetupTeam) => t.players.map((sp) => pool.get(sp.poolPlayerId)!);
  res.json({
    matchId: 0, exhibition: true,
    venue: `Exhibition · ${CONTINENTS.find((c) => c.key === s.venue)?.label ?? s.venue}`,
    continent: s.venue, timeOfDay: s.timeOfDay, weather: s.weather,
    homeTeam: s.home.name.trim(), awayTeam: s.away.name.trim(), homeScore: 0, awayScore: 0,
    pointChanceHome: pointProbability(sideRating(rated(s.home)), sideRating(rated(s.away))),
    players: [...s.home.players.map((p) => player(s.home, p)), ...s.away.players.map((p) => player(s.away, p))],
    gameDifficulty: s.difficulty,
    exhibitionSeats: s.seats,
    manualAllowed: s.seats.some((x) => x >= 0),
  });
});

export default router;
