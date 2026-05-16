import { Router } from "express";
import { db } from "@workspace/db";
import { trainingSessionsTable, playersTable, teamsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

const serializeSession = (s: any) => ({ ...s, durationHours: Number(s.durationHours) });

const serializePlayer = (p: any) => ({ ...p, height: Number(p.height), salary: Number(p.salary) });

const getTeamForUser = async (userId: string) => {
  return db.query.teamsTable.findFirst({ where: eq(teamsTable.userId, userId) });
};

const typeToStat: Record<string, string> = {
  strength: "power", agility: "speed", serving: "serve",
  blocking: "block", defense: "defense", teamplay: "stamina", recovery: "stamina"
};

const applyFatigueAndStats = async (playerId: number, type: string) => {
  const player = await db.query.playersTable.findFirst({ where: eq(playersTable.id, playerId) });
  if (!player) return null;

  const statGain = Math.floor(Math.random() * 3) + 1;
  const stat = typeToStat[type] || "stamina";
  const statGains: Record<string, number> = { [stat]: statGain };

  const updates: Record<string, number> = {};
  if (stat === "power") updates.power = Math.min(99, player.power + statGain);
  if (stat === "speed") updates.speed = Math.min(99, player.speed + statGain);
  if (stat === "serve") updates.serve = Math.min(99, player.serve + statGain);
  if (stat === "block") updates.block = Math.min(99, player.block + statGain);
  if (stat === "defense") updates.defense = Math.min(99, player.defense + statGain);
  if (stat === "stamina") updates.stamina = Math.min(99, player.stamina + statGain);

  if (type === "recovery") {
    updates.fatigue = Math.max(0, player.fatigue - 25);
  } else {
    updates.fatigue = Math.min(100, player.fatigue + 18);
  }

  const [newPlayer] = await db.update(playersTable).set(updates).where(eq(playersTable.id, playerId)).returning();
  return { newPlayer: serializePlayer(newPlayer), statGains };
};

router.get("/training", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.json([]); return; }
  const sessions = await db.select().from(trainingSessionsTable)
    .where(eq(trainingSessionsTable.teamId, team.id));
  const withPlayers = await Promise.all(sessions.map(async (s) => {
    const player = await db.query.playersTable.findFirst({ where: eq(playersTable.id, s.playerId) });
    return { ...serializeSession(s), player: player ? serializePlayer(player) : null };
  }));
  res.json(withPlayers);
});

router.post("/training", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.status(404).json({ error: "No team" }); return; }
  const { playerId, type, focus, durationHours, scheduledAt, coachId } = req.body;
  const [session] = await db.insert(trainingSessionsTable).values({
    teamId: team.id,
    playerId: Number(playerId),
    type,
    focus,
    durationHours: String(durationHours),
    scheduledAt,
    coachId: coachId ? Number(coachId) : null,
  }).returning();
  res.status(201).json(serializeSession(session));
});

router.post("/training/team", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.status(404).json({ error: "No team" }); return; }
  const { type, focus, durationHours, scheduledAt, coachId } = req.body;

  const activePlayers = await db.select().from(playersTable)
    .where(and(eq(playersTable.teamId, team.id), eq(playersTable.isActive, true)));

  if (activePlayers.length === 0) { res.status(400).json({ error: "No active players" }); return; }

  const sessions = await Promise.all(activePlayers.map(player =>
    db.insert(trainingSessionsTable).values({
      teamId: team.id,
      playerId: player.id,
      type,
      focus: focus || "Team Training",
      durationHours: String(durationHours || 2),
      scheduledAt,
      coachId: coachId ? Number(coachId) : null,
    }).returning()
  ));

  res.status(201).json(sessions.flat().map(serializeSession));
});

router.post("/training/:id/complete", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);
  const session = await db.query.trainingSessionsTable.findFirst({ where: eq(trainingSessionsTable.id, id) });
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  const [updatedSession] = await db.update(trainingSessionsTable).set({ status: "completed" })
    .where(eq(trainingSessionsTable.id, id)).returning();

  const result = await applyFatigueAndStats(session.playerId, session.type);
  if (result) {
    const { newPlayer, statGains } = result;
    res.json({
      session: { ...serializeSession(updatedSession), player: newPlayer },
      statGains,
      newStats: newPlayer,
    });
    return;
  }
  res.json({ session: serializeSession(updatedSession), statGains: {}, newStats: null });
});

router.get("/training/plan", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.json({ weeklyLoad: "light", averageFitness: 80, averageMorale: 80, scheduledSessions: [], completedThisWeek: 0 }); return; }

  const sessions = await db.select().from(trainingSessionsTable).where(eq(trainingSessionsTable.teamId, team.id));
  const scheduled = sessions.filter(s => s.status === "scheduled");
  const completedThisWeek = sessions.filter(s => s.status === "completed").length;

  const load = scheduled.length > 6 ? "peak" : scheduled.length > 4 ? "intense" : scheduled.length > 2 ? "moderate" : "light";

  const players = await db.select().from(playersTable).where(eq(playersTable.teamId, team.id));
  const avgFitness = players.length > 0 ? players.reduce((acc, p) => acc + p.stamina, 0) / players.length : 80;
  const avgMorale = players.length > 0 ? players.reduce((acc, p) => acc + p.morale, 0) / players.length : 80;
  const avgFatigue = players.length > 0 ? players.reduce((acc, p) => acc + p.fatigue, 0) / players.length : 0;

  res.json({
    weeklyLoad: load,
    averageFitness: Math.round(avgFitness),
    averageMorale: Math.round(avgMorale),
    averageFatigue: Math.round(avgFatigue),
    scheduledSessions: scheduled.map(s => ({ ...s, durationHours: Number(s.durationHours), player: null })),
    completedThisWeek,
  });
});

export default router;
