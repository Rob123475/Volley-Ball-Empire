import { Router } from "express";
import { db } from "@workspace/db";
import { aiManagersTable, aiManagerEventsTable } from "@workspace/db";
import { eq, desc, inArray, isNull, or } from "drizzle-orm";

const router = Router();

// ── World club pool ────────────────────────────────────────────────────────────

const CLUBS = [
  { name: "Rio Praia SC",        reputation: 88 },
  { name: "Barcelona Sand FC",   reputation: 84 },
  { name: "Paris Sablé FC",      reputation: 82 },
  { name: "Miami Blazers",       reputation: 78 },
  { name: "Sao Paulo Waves",     reputation: 76 },
  { name: "Dubai Falcons BC",    reputation: 74 },
  { name: "Shanghai Stormers",   reputation: 72 },
  { name: "Sydney Surf FC",      reputation: 68 },
  { name: "Toronto Shoreline",   reputation: 62 },
  { name: "Athens Aegean BC",    reputation: 58 },
  { name: "Hokkaido Snow Birds", reputation: 56 },
  { name: "Cape Town Swells",    reputation: 54 },
];

const MANAGER_NAMES = [
  "Paulo Ribeiro",  "Yuki Tanaka",    "Marta Kovač",    "Diego Santos",
  "Amelia Osei",    "Luca Ferrari",   "Priya Sharma",   "Ahmed El-Sayed",
  "Camille Dupont", "Ryo Nakamura",   "Sofia Andersen", "Kwame Asante",
  "Elena Volkov",   "Tomás García",   "Fatima Al-Rashid", "Jonas Weber",
  "Isabela Costa",  "Park Ji-won",    "Chiara Bianchi", "Olusegun Adeyemi",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function chance(pct: number): boolean {
  return Math.random() < pct;
}

// ── Seeder: initialise world if empty ─────────────────────────────────────────

async function seedIfEmpty() {
  const existing = await db.select({ id: aiManagersTable.id }).from(aiManagersTable).limit(1);
  if (existing.length > 0) return;

  const shuffledNames = [...MANAGER_NAMES].sort(() => Math.random() - 0.5);
  const values = CLUBS.map((club, i) => ({
    name:                  shuffledNames[i] ?? `Manager ${i + 1}`,
    reputation:            Math.max(30, club.reputation - 10 + Math.floor(Math.random() * 20)),
    currentClub:           club.name,
    currentClubReputation: club.reputation,
    status:                "active" as const,
    hiredAt:               new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 24 * 365),
  }));

  await db.insert(aiManagersTable).values(values);
}

// ── Tick: simulate world manager movements ────────────────────────────────────

const TICK_COOLDOWN_MS = 20 * 60 * 1000; // 20 minutes between ticks
const MAX_EVENTS_PER_TICK = 5;

async function tick() {
  // Cooldown check
  const [latest] = await db
    .select({ occurredAt: aiManagerEventsTable.occurredAt })
    .from(aiManagerEventsTable)
    .orderBy(desc(aiManagerEventsTable.occurredAt))
    .limit(1);

  if (latest && Date.now() - new Date(latest.occurredAt).getTime() < TICK_COOLDOWN_MS) {
    return; // Still cooling down
  }

  await seedIfEmpty();

  const managers = await db.select().from(aiManagersTable);
  const events: (typeof aiManagerEventsTable.$inferInsert)[] = [];

  // Which clubs already have an active manager
  const occupiedClubs = new Set(
    managers.filter(m => m.status === "active" && m.currentClub).map(m => m.currentClub!)
  );

  // ── Phase 1: process active managers ──────────────────────────────────────
  for (const mgr of managers) {
    if (events.length >= MAX_EVENTS_PER_TICK) break;
    if (mgr.status !== "active" || !mgr.currentClub) continue;

    // Retire (higher chance for high-rep veterans)
    if (chance(mgr.reputation >= 70 ? 0.06 : 0.03)) {
      events.push({
        managerName: mgr.name,
        eventType:   "retired",
        fromClub:    mgr.currentClub,
        description: `${mgr.name} has retired from management after a successful career at ${mgr.currentClub}.`,
      });
      occupiedClubs.delete(mgr.currentClub);
      await db.update(aiManagersTable)
        .set({ status: "retired", currentClub: undefined, currentClubReputation: undefined })
        .where(eq(aiManagersTable.id, mgr.id));
      continue;
    }

    // Fired
    if (chance(0.08)) {
      events.push({
        managerName: mgr.name,
        eventType:   "fired",
        fromClub:    mgr.currentClub,
        description: `${mgr.name} has been sacked by ${mgr.currentClub} following a poor run of results.`,
      });
      occupiedClubs.delete(mgr.currentClub);
      await db.update(aiManagersTable)
        .set({ status: "unemployed", currentClub: undefined, currentClubReputation: undefined })
        .where(eq(aiManagersTable.id, mgr.id));
      continue;
    }

    // Resigned / moved (ambitious move to a better club)
    if (chance(0.10)) {
      const freeClub = CLUBS.find(c => !occupiedClubs.has(c.name) && c.name !== mgr.currentClub);
      if (freeClub) {
        const isPromotion = freeClub.reputation > (mgr.currentClubReputation ?? 0);
        events.push({
          managerName: mgr.name,
          eventType:   isPromotion ? "promoted" : "moved",
          fromClub:    mgr.currentClub,
          toClub:      freeClub.name,
          description: isPromotion
            ? `${mgr.name} has been appointed head coach at ${freeClub.name}, leaving ${mgr.currentClub}.`
            : `${mgr.name} departs ${mgr.currentClub} to take charge of ${freeClub.name}.`,
        });
        occupiedClubs.delete(mgr.currentClub);
        occupiedClubs.add(freeClub.name);
        await db.update(aiManagersTable)
          .set({
            currentClub:           freeClub.name,
            currentClubReputation: freeClub.reputation,
            reputation:            Math.min(100, mgr.reputation + (isPromotion ? 2 : 0)),
            hiredAt:               new Date(),
          })
          .where(eq(aiManagersTable.id, mgr.id));
      }
    }
  }

  // ── Phase 2: rehire unemployed managers ───────────────────────────────────
  const unemployed = managers.filter(m => m.status === "unemployed");
  for (const mgr of unemployed) {
    if (events.length >= MAX_EVENTS_PER_TICK) break;
    if (!chance(0.40)) continue;

    const freeClub = CLUBS.find(c => !occupiedClubs.has(c.name));
    if (!freeClub) continue;

    events.push({
      managerName: mgr.name,
      eventType:   "hired",
      toClub:      freeClub.name,
      description: `${mgr.name} ends their spell as a free agent, signing on as head coach at ${freeClub.name}.`,
    });
    occupiedClubs.add(freeClub.name);
    await db.update(aiManagersTable)
      .set({
        status:                "active",
        currentClub:           freeClub.name,
        currentClubReputation: freeClub.reputation,
        hiredAt:               new Date(),
      })
      .where(eq(aiManagersTable.id, mgr.id));
  }

  // ── Phase 3: clubs without managers get a new appointment ─────────────────
  const freeClubs = CLUBS.filter(c => !occupiedClubs.has(c.name));
  const retiredManagers = managers.filter(m => m.status === "retired").map(m => m.name);
  const usedNames = new Set(managers.map(m => m.name));

  for (const club of freeClubs) {
    if (events.length >= MAX_EVENTS_PER_TICK) break;
    if (!chance(0.55)) continue;

    const freshName = MANAGER_NAMES.find(n => !usedNames.has(n));
    if (!freshName) continue;

    usedNames.add(freshName);
    const rep = Math.max(30, club.reputation - 15 + Math.floor(Math.random() * 20));

    const [newMgr] = await db.insert(aiManagersTable).values({
      name:                  freshName,
      reputation:            rep,
      currentClub:           club.name,
      currentClubReputation: club.reputation,
      status:                "active",
      hiredAt:               new Date(),
    }).returning();

    events.push({
      managerName: newMgr.name,
      eventType:   "hired",
      toClub:      club.name,
      description: `${newMgr.name} has been appointed as the new head coach of ${club.name}.`,
    });
    occupiedClubs.add(club.name);
  }

  // ── Persist events ─────────────────────────────────────────────────────────
  if (events.length > 0) {
    await db.insert(aiManagerEventsTable).values(events);
  }
}

// ── GET /ai-managers/feed ─────────────────────────────────────────────────────

router.get("/ai-managers/feed", async (_req, res) => {
  // Auto-tick (non-blocking — fire and forget, do not await so the response is fast)
  tick().catch(() => {});

  const events = await db
    .select()
    .from(aiManagerEventsTable)
    .orderBy(desc(aiManagerEventsTable.occurredAt))
    .limit(20);

  res.json({
    events: events.map(e => ({
      id:          e.id,
      managerName: e.managerName,
      eventType:   e.eventType,
      fromClub:    e.fromClub ?? null,
      toClub:      e.toClub   ?? null,
      description: e.description,
      occurredAt:  e.occurredAt.toISOString(),
    })),
  });
});

export default router;
