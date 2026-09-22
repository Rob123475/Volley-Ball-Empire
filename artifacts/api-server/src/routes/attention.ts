import { Router } from "express";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { loadPlayers, loadStaff, requireCareerSaveId } from "../lib/playerDto.js";
import { MAX_STARTERS, MAX_SENIORS } from "../utils/squadRules.js";
import { isAvailable } from "../utils/condition.js";
import { db } from "@workspace/db";
import {
  teamsTable,
  playersTable,
  youthProspectsTable,
  facilitiesTable,
  continentalScoutingMissionsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getGameDate } from "../utils/gameDate.js";
import { CONTRACT_WARNING_DAYS } from "../utils/contractTerms.js";
import { MEDICAL_ROLE_NAMES } from "../utils/medical-staff-generator.js";

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

  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }

  const budget = Number(team.budget);
  const now = new Date();

  const [players, staff, prospects, completedMissions, allFacilities] = await Promise.all([
    loadPlayers(requireCareerSaveId(req.activeCareerSaveId), { teamId: team.id, isActive: true }),
    loadStaff(requireCareerSaveId(req.activeCareerSaveId), { teamId: team.id }),
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

  // ── No legal match-day squad yet (red) — the first thing a new career needs ──
  // A new club can't play a match with fewer than MAX_STARTERS players signed.
  // This is what a brand-new career sees before its first visit to the market.
  const startersSigned = players.filter(p => p.squadRole === "starter").length;
  if (startersSigned < MAX_STARTERS) {
    items.push({
      id: "squad-incomplete",
      priority: "red",
      category: "Squad",
      title: startersSigned === 0 ? "Build Your Squad" : "Squad Incomplete",
      // R-48: with fewer than MAX_STARTERS active players every match is forfeited.
      description: (startersSigned === 0
        ? "You have no players signed — visit the Player Market to sign your first starters."
        : `Only ${startersSigned}/${MAX_STARTERS} starters signed — visit the Player Market to fill your squad.`)
        + (players.length < MAX_STARTERS ? " Until two players can take the sand, every match is forfeited." : ""),
      navigateTo: "/players",
    });
  }

  // ── Still at the auto-seeded starting squad (blue) ───────────────────────────
  // A new career is seeded with just enough to field a match (R-04) — that's a
  // startup club, not a finished one. This nudges a first session toward the
  // market rather than the red item above, which is reserved for a squad that
  // literally cannot play.
  else if (players.length <= MAX_SENIORS) {
    items.push({
      id: "grow-your-squad",
      priority: "blue",
      category: "Squad",
      title: "Grow Your Squad",
      description: "You're starting with the bare minimum to compete — visit the Player Market to sign more players.",
      navigateTo: "/players",
    });
  }

  // ── Injuries leave fewer than two fit players (red) ──────────────────────────
  // R-50: an injured player cannot be selected, so a squad with its starters
  // signed can still be unable to play. Say so before the match is forfeited.
  const fitToPlay = players.filter((p) => isAvailable(p)).length;
  if (startersSigned >= MAX_STARTERS && fitToPlay < MAX_STARTERS) {
    items.push({
      id: "squad-unfit",
      priority: "red",
      category: "Squad",
      title: "Not Enough Fit Players",
      description: `Only ${fitToPlay} of your players can play. Injured players cannot be selected, so every match is forfeited until someone recovers or you sign cover.`,
      navigateTo: "/players",
    });
  }

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
  // R-51: counted on the GAME clock. This compared an in-game end date with the
  // computer's clock, so the warning appeared, or never did, regardless of where
  // the season actually was — and a squad could lapse with no notice at all.
  const gameToday = new Date(`${await getGameDate(team.id)}T00:00:00Z`);
  for (const p of players) {
    if (!p.contractEndDate) continue;
    const end = new Date(`${p.contractEndDate}T00:00:00Z`);
    if (isNaN(end.getTime())) continue;
    const daysLeft = Math.round((end.getTime() - gameToday.getTime()) / 86_400_000);
    if (daysLeft < 0 || daysLeft > 30) continue;

    items.push({
      id: `contract-${p.id}`,
      priority: daysLeft <= 14 ? "red" : "orange",
      category: "Contract",
      title: `Contract Expiring: ${p.name}`,
      description: daysLeft <= 14
        ? `Only ${daysLeft} day${daysLeft !== 1 ? "s" : ""} left — renew on the Contracts page before the player leaves`
        : `${daysLeft} days remaining — renew on the Contracts page`,
      navigateTo: "/contracts",
    });
  }

  // ── Staff and medical contracts expiring (L-02a) ─────────────────────────────
  // Rob's rule: a coach's deal ends like a player's, with four weeks' notice on
  // the GAME clock and automatic release to the pool if nothing is done. Before
  // this, staff contracts had no end date at all: a coach hired in season one
  // was still on the payroll in season thirty. The release itself is the
  // calendar tick's (routes/calendar.ts); this is the warning before it.
  for (const m of staff) {
    if (!m.contractEndDate) continue;
    const end = new Date(`${m.contractEndDate}T00:00:00Z`);
    if (isNaN(end.getTime())) continue;
    const daysLeft = Math.round((end.getTime() - gameToday.getTime()) / 86_400_000);
    if (daysLeft < 0 || daysLeft > CONTRACT_WARNING_DAYS) continue;

    const isMedical = MEDICAL_ROLE_NAMES.has(m.role);
    items.push({
      id: `staff-contract-${m.id}`,
      priority: daysLeft <= 14 ? "red" : "orange",
      category: isMedical ? "Medical" : "Staff",
      title: `Contract Expiring: ${m.name}`,
      description: daysLeft <= 14
        ? `${m.role} — only ${daysLeft} day${daysLeft !== 1 ? "s" : ""} left, and an unrenewed contract releases them to the pool`
        : `${m.role} — ${daysLeft} days remaining, renew or they leave`,
      navigateTo: isMedical ? "/medical" : "/staff",
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
