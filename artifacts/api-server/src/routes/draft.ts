import { Router } from "express";
import { db } from "@workspace/db";
import { playersTable, teamsTable, contractsTable } from "@workspace/db";
import { eq, isNull } from "drizzle-orm";

const router = Router();

const serializePlayer = (p: any) => ({
  ...p,
  height: Number(p.height),
  salary: Number(p.salary),
  askingPrice: p.askingPrice ? Number(p.askingPrice) : null,
});

const getTeamForUser = async (userId: string) => {
  return db.query.teamsTable.findFirst({ where: eq(teamsTable.userId, userId) });
};

router.get("/draft", async (req, res) => {
  const draftPlayers = await db.select().from(playersTable)
    .where(eq(playersTable.isDraftPlayer, true));
  res.json(draftPlayers.filter(p => !p.teamId).map(p => ({
    ...serializePlayer(p),
    available: !p.teamId,
  })));
});

router.post("/draft/pick", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.status(404).json({ error: "No team" }); return; }
  const { draftPlayerId } = req.body;

  const player = await db.query.playersTable.findFirst({ where: eq(playersTable.id, Number(draftPlayerId)) });
  if (!player || player.teamId) { res.status(400).json({ error: "Player not available" }); return; }

  const today = new Date().toISOString().split("T")[0];
  const sixMonths = new Date();
  sixMonths.setMonth(sixMonths.getMonth() + 6);
  const endDate = sixMonths.toISOString().split("T")[0];

  const [updated] = await db.update(playersTable).set({
    teamId: team.id,
    isActive: true,
    contractEndDate: endDate,
    isDraftPlayer: false,
  }).where(eq(playersTable.id, Number(draftPlayerId))).returning();

  await db.insert(contractsTable).values({
    playerId: Number(draftPlayerId),
    teamId: team.id,
    salary: player.salary || "5000",
    startDate: today,
    endDate,
    bonusPerWin: "500",
  });

  res.status(201).json(serializePlayer(updated));
});

export default router;
