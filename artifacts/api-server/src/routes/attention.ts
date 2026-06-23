import { Router } from "express";
import { db } from "@workspace/db";
import {
  teamsTable,
  playersTable,
  youthProspectsTable,
  facilitiesTable,
  continentalScoutingMissionsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

type Priority = "red" | "orange" | "blue";

interface AttentionItem {
  id: string;
  priority: Priority;
  category: string;
  title: string;
  description: string;
  navigateTo: string;
}

const PRIORITY_ORDER: Record<Priority, number> = { red: 0, orange: 1, blue: 2 };

const FACILITY_LABELS: Record<string, string> = {
  training_complex:      "Training Complex",
  medical_centre:        "Medical Centre",
  gymnasium:             "Gymnasium",
  nutrition_centre:      "Nutrition Centre",
  youth_academy:         "Youth Academy",
  scouting_department:   "Scouting Dept",
  sports_science_lab:    "Performance Centre",
  commercial_department: "Commercial Dept",
  beach_resort:          "Beach Resort",
};

router.get("/attention-items", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const team = await db.query.teamsTable.findFirst({ where: eq(teamsTable.userId, req.user.id) });
  if (!team) { res.status(404).json({ error: "No team" }); return; }

  const budget = Number(team.budget);
  const now = new Date();

  const [players, prospects, completedMissions, allFacilities] = await Promise.all([
    db.select().from(playersTable).where(
      and(eq(playersTable.teamId, team.id), eq(playersTable.isActive, true))
    ),
    db.select().from(youthProspectsTable).where(
      and(eq(youthProspectsTable.teamId, team.id), eq(youthProspectsTable.status, "pending"))
    ),
    db.select().from(continentalScoutingMissionsTable).where(
      and(
        eq(continentalScoutingMissionsTable.teamId, team.id),
        eq(continentalScoutingMissionsTable.status, "completed")
      )
    ),
    db.select().from(facilitiesTable).where(eq(facilitiesTable.teamId, team.id)),
  ]);

  const items: AttentionItem[] = [];

  // ── Injured players (red) ────────────────────────────────────────────────────
  for (const p of players.filter(p => p.isInjured)) {
    const weeks = p.injuryWeeksRemaining ?? 0;
    items.push({
      id: `injured-${p.id}`,
      priority: "red",
      category: "Medical",
      title: `${p.name} Injured`,
      description: `${p.injuryStatus} — ${weeks} week${weeks !== 1 ? "s" : ""} until return`,
      navigateTo: "/medical",
    });
  }

  // ── Player contracts expiring (red ≤14 days, orange ≤30 days) ───────────────
  for (const p of players) {
    if (!p.contractEndDate) continue;
    const end = new Date(p.contractEndDate);
    if (isNaN(end.getTime())) continue;
    const daysLeft = Math.round((end.getTime() - now.getTime()) / 86_400_000);
    if (daysLeft < 0 || daysLeft > 30) continue;

    items.push({
      id: `contract-${p.id}`,
      priority: daysLeft <= 14 ? "red" : "orange",
      category: "Contract",
      title: `Contract Expiring: ${p.name}`,
      description: daysLeft <= 14
        ? `Only ${daysLeft} day${daysLeft !== 1 ? "s" : ""} left — renew immediately`
        : `${daysLeft} days remaining — review contract`,
      navigateTo: "/contracts",
    });
  }

  // ── Budget warning (red <$50k, orange <$150k) ────────────────────────────────
  if (budget < 50_000) {
    items.push({
      id: "budget-critical",
      priority: "red",
      category: "Finances",
      title: "Critical: Budget Almost Empty",
      description: `$${Math.round(budget).toLocaleString()} remaining — secure new sponsorships urgently`,
      navigateTo: "/finances",
    });
  } else if (budget < 150_000) {
    items.push({
      id: "budget-low",
      priority: "orange",
      category: "Finances",
      title: "Budget Running Low",
      description: `$${Math.round(budget).toLocaleString()} remaining — review income and expenses`,
      navigateTo: "/finances",
    });
  }

  // ── Player morale concerns (orange) ──────────────────────────────────────────
  for (const p of players.filter(p => p.morale < 50 && !p.isInjured)) {
    items.push({
      id: `morale-${p.id}`,
      priority: "orange",
      category: "Morale",
      title: `Low Morale: ${p.name}`,
      description: `Morale at ${p.morale}% — consider a wellbeing camp or retreat`,
      navigateTo: "/wellbeing",
    });
  }

  // ── Youth prospects waiting to be signed (blue) ───────────────────────────
  if (prospects.length > 0) {
    const names = prospects.slice(0, 2).map(p => p.name).join(", ");
    const extra  = prospects.length > 2 ? ` +${prospects.length - 2} more` : "";
    items.push({
      id: "prospects-available",
      priority: "blue",
      category: "Youth Academy",
      title: `${prospects.length} Youth Prospect${prospects.length > 1 ? "s" : ""} Available`,
      description: `${names}${extra} — ready to sign`,
      navigateTo: "/youth-academy",
    });
  }

  // ── Continental scouting mission completed (blue) ────────────────────────────
  for (const m of completedMissions) {
    items.push({
      id: `scouting-complete-${m.id}`,
      priority: "blue",
      category: "Scouting",
      title: `Scout Report: ${m.region} Region`,
      description: `Mission complete — ${m.prospectsFound} prospect${m.prospectsFound !== 1 ? "s" : ""} found`,
      navigateTo: "/continental-scouting",
    });
  }

  // ── Youth Academy idle with upgraded facility (blue) ────────────────────────
  const youthFacility = allFacilities.find(f => f.type === "youth_academy");
  if (
    youthFacility &&
    youthFacility.level >= 2 &&
    team.youthScoutingStatus === "idle" &&
    prospects.length === 0 &&
    completedMissions.length === 0
  ) {
    items.push({
      id: "youth-academy-idle",
      priority: "blue",
      category: "Youth Academy",
      title: "Youth Academy — No Scouts Active",
      description: `Academy at level ${youthFacility.level} — send scouts to discover young talent`,
      navigateTo: "/youth-academy",
    });
  }

  // ── Facility upgrades affordable (blue, top 3 by upgrade impact) ─────────────
  const upgradeable = allFacilities
    .filter(f => f.level < 10 && budget >= f.level * 20_000)
    .sort((a, b) => a.level - b.level)
    .slice(0, 3);

  for (const f of upgradeable) {
    const cost = f.level * 20_000;
    items.push({
      id: `upgrade-${f.type}`,
      priority: "blue",
      category: "Facilities",
      title: `Upgrade Ready: ${FACILITY_LABELS[f.type] ?? f.type}`,
      description: `Level ${f.level} → ${f.level + 1} for $${cost.toLocaleString()}`,
      navigateTo: "/facilities",
    });
  }

  items.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  res.json({ items, total: items.length });
});

export default router;
