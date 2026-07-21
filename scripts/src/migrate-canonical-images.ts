/**
 * migrate-canonical-images.ts
 *
 * SENIOR PLAYER MASTER MIGRATION — target: 208 unique senior players
 *
 * Stages:
 *  0. Safety gate: DB must have exactly 192 or 208 active senior players.
 *  1. Insert 16 new player records (idempotent by name+nationality).
 *  2. Re-load all 208 players; build canonical slug+number assignment
 *     (sorted by player ID within each nationality, zero-padded to 2 digits).
 *  3. Image file operations:
 *     - /objects/ players → download from GCS via Replit sidecar auth
 *     - existing webp players → copy to canonical filename (fixing slug typos)
 *     - new players (null imageUrl) → copy pre-uploaded file to canonical name
 *  4. Update every DB image_url to the canonical path (only if file confirmed on disk).
 *  5. Verify: 208 players, all with canonical /images/players/seniors/player_senior_*.webp
 *
 * Run: pnpm --filter @workspace/scripts run migrate-canonical-images
 * Safe to re-run (idempotent).
 */

import { Storage } from "@google-cloud/storage";
import { db } from "@workspace/db";
import { playersTable } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ── Constants ──────────────────────────────────────────────────────────────────

const SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
const BUCKET_NAME      = "replit-objstore-3c52c78e-ce4f-47c1-b52c-13136f0d8203";
const GCS_PRIVATE_PFX  = ".private"; // prefix inside bucket for /objects/ entity files

// Resolve CANONICAL_DIR relative to this script file so it works regardless of CWD.
// Script lives at scripts/src/migrate-canonical-images.ts
// Workspace root is 2 levels up: scripts/src → scripts → workspace root
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, "../..");
const CANONICAL_DIR  = path.join(
  WORKSPACE_ROOT,
  "artifacts/beach-volleyball/public/images/players/seniors"
);
const CANONICAL_DB_PFX = "/images/players/seniors";

// Sanity-check the path at startup
if (!fs.existsSync(path.join(WORKSPACE_ROOT, "package.json"))) {
  throw new Error(
    `WORKSPACE_ROOT resolved incorrectly: "${WORKSPACE_ROOT}" (expected the monorepo root)`
  );
}

// ── GCS client (Replit sidecar auth, mirrors api-server/lib/objectStorage.ts) ─

const gcsClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${SIDECAR_ENDPOINT}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  } as any,
  projectId: "",
});

// ── Nationality → canonical slug ───────────────────────────────────────────────
// Includes typo fixes: on-disk "chiile" → "chile", etc.

const NATIONALITY_SLUG: Record<string, string> = {
  Argentina:          "argentina",
  Australia:          "australia",
  Bahamas:            "bahamas",
  Bolivia:            "bolivia",
  Brazil:             "brazil",
  Canada:             "canada",
  Chile:              "chile",
  China:              "china",
  Colombia:           "colombia",
  "Cook Islands":     "cook_islands",
  "Costa Rica":       "costa_rica",
  Cuba:               "cuba",
  "Dominican Republic": "dominican_republic",
  Ecuador:            "ecuador",
  Egypt:              "egypt",
  England:            "england",
  Fiji:               "fiji",
  France:             "france",
  Germany:            "germany",
  Greece:             "greece",
  Guyana:             "guyana",
  India:              "india",
  Indonesia:          "indonesia",
  Ireland:            "ireland",
  Italy:              "italy",
  Jamaica:            "jamaica",
  Japan:              "japan",
  Kenya:              "kenya",
  Laos:               "laos",
  Madagascar:         "madagascar",
  Malaysia:           "malaysia",
  Maldives:           "maldives",
  Malta:              "malta",
  Mexico:             "mexico",
  Monaco:             "monaco",
  Morocco:            "morocco",
  Mozambique:         "mozambique",
  Netherlands:        "netherlands",
  "New Zealand":      "new_zealand",
  Nigeria:            "nigeria",
  "Papua New Guinea": "papua_new_guinea",
  Panama:             "panama",
  Peru:               "peru",
  Philippines:        "philippines",
  Portugal:           "portugal",
  "Puerto Rico":      "puerto_rico",
  Russia:             "russia",
  Samoa:              "samoa",
  "Solomon Islands":  "solomon_islands",
  "South Africa":     "south_africa",
  Spain:              "spain",
  Sweden:             "sweden",
  Switzerland:        "switzerland",
  Tahiti:             "tahiti",
  Taiwan:             "taiwan",
  Tanzania:           "tanzania",
  Thailand:           "thailand",
  Tonga:              "tonga",
  Tunisia:            "tunisia",
  Uruguay:            "uruguay",
  USA:                "usa",
  Vanuatu:            "vanuatu",
  Venezuela:          "venezuela",
  Vietnam:            "vietnam",
  Zimbabwe:           "zimbabwe",
};

// On-disk slug typos → canonical slug (used when scanning existing files)
const SLUG_FIX: Record<string, string> = {
  chiile:         "chile",
  columbia:       "colombia",
  cook_island:    "cook_islands",
  costa_rico:     "costa_rica",
  indonesian:     "indonesia",
  phillipines:    "philippines",
  png:            "papua_new_guinea",
  swiss:          "switzerland",
  solomon_island: "solomon_islands",
  peurto_rico:    "puerto_rico",
};

// ── 16 new players (data extracted from uploaded card images) ──────────────────

interface NewPlayer {
  name:        string;
  nationality: string;
  continent:   string;
  age:         number;
  heightCm:    number;
  position:    string;
  stars:       3 | 4 | 5;
  /** Expected canonical number slot (01/02/03) — matches pre-uploaded filename. */
  imageSlot:   string;
}

const NEW_PLAYERS: NewPlayer[] = [
  // Dominican Republic (North America)
  { name: "Valentina Reyes", nationality: "Dominican Republic", continent: "North America",       age: 25, heightCm: 184, position: "spiker",      stars: 4, imageSlot: "01" },
  { name: "Gabriela Santos", nationality: "Dominican Republic", continent: "North America",       age: 22, heightCm: 180, position: "defender",    stars: 3, imageSlot: "02" },
  { name: "Yaritza Mendez",  nationality: "Dominican Republic", continent: "North America",       age: 28, heightCm: 190, position: "blocker",     stars: 5, imageSlot: "03" },
  // Guyana (South America)
  { name: "Amara James",     nationality: "Guyana",             continent: "South America",       age: 26, heightCm: 185, position: "spiker",      stars: 4, imageSlot: "01" },
  { name: "Priya Persaud",   nationality: "Guyana",             continent: "South America",       age: 23, heightCm: 179, position: "defender",    stars: 3, imageSlot: "02" },
  { name: "Nia Campbell",    nationality: "Guyana",             continent: "South America",       age: 28, heightCm: 190, position: "blocker",     stars: 4, imageSlot: "03" },
  // Kenya (Africa & Middle East) — slot 03 (01/02 are existing /objects/ players)
  { name: "Amara Odhiambo", nationality: "Kenya",              continent: "Africa & Middle East", age: 27, heightCm: 187, position: "spiker",      stars: 4, imageSlot: "03" },
  // Puerto Rico (North America)
  { name: "Sofia Rivera",    nationality: "Puerto Rico",        continent: "North America",       age: 24, heightCm: 183, position: "spiker",      stars: 4, imageSlot: "01" },
  { name: "Isabela Cruz",    nationality: "Puerto Rico",        continent: "North America",       age: 21, heightCm: 178, position: "defender",    stars: 3, imageSlot: "02" },
  { name: "Camila Santiago", nationality: "Puerto Rico",        continent: "North America",       age: 28, heightCm: 189, position: "blocker",     stars: 4, imageSlot: "03" },
  // Vanuatu (Oceania)
  { name: "Leilani Tari",    nationality: "Vanuatu",            continent: "Oceania",             age: 24, heightCm: 184, position: "all_rounder", stars: 3, imageSlot: "01" },
  { name: "Malia Kalotiti",  nationality: "Vanuatu",            continent: "Oceania",             age: 22, heightCm: 181, position: "defender",    stars: 4, imageSlot: "02" },
  { name: "Selina Nalo",     nationality: "Vanuatu",            continent: "Oceania",             age: 29, heightCm: 188, position: "blocker",     stars: 3, imageSlot: "03" },
  // Zimbabwe (Africa & Middle East)
  { name: "Tariro Moyo",    nationality: "Zimbabwe",            continent: "Africa & Middle East", age: 25, heightCm: 186, position: "all_rounder", stars: 4, imageSlot: "01" },
  { name: "Ruvimbo Dube",   nationality: "Zimbabwe",            continent: "Africa & Middle East", age: 22, heightCm: 181, position: "defender",    stars: 3, imageSlot: "02" },
  { name: "Nyasha Ncube",   nationality: "Zimbabwe",            continent: "Africa & Middle East", age: 27, heightCm: 191, position: "blocker",     stars: 5, imageSlot: "03" },
];

// ── Stat + contract helpers ────────────────────────────────────────────────────

function generateStats(position: string, stars: number) {
  const base = stars === 5 ? 88 : stars === 4 ? 78 : 68;
  const hi = base + 5;
  const lo = base - 9;
  const r  = (a: number, b: number) => Math.round(a + Math.random() * (b - a));

  switch (position) {
    case "spiker":
      return { speed: r(hi-2,hi+2), power: r(hi+1,hi+5), defense: r(lo,lo+4), serve: r(base-2,base+2), block: r(lo+2,lo+6), stamina: r(base-2,base+2) };
    case "defender":
      return { speed: r(hi,hi+4),   power: r(lo,lo+4),   defense: r(hi+1,hi+5), serve: r(base-4,base), block: r(lo-4,lo),   stamina: r(hi-2,hi+2) };
    case "blocker":
      return { speed: r(lo,lo+4),   power: r(hi+1,hi+5), defense: r(base-2,base+2), serve: r(base-4,base), block: r(hi+2,hi+6), stamina: r(base-2,base+2) };
    case "setter":
      return { speed: r(base-2,base+2), power: r(lo,lo+4), defense: r(base-2,base+2), serve: r(hi+1,hi+5), block: r(lo,lo+4), stamina: r(base-2,base+2) };
    default: // all_rounder
      return { speed: r(base-2,base+2), power: r(base-2,base+2), defense: r(base-2,base+2), serve: r(base-2,base+2), block: r(base-2,base+2), stamina: r(base-2,base+2) };
  }
}

function starSalary(stars: number)      { return stars === 5 ? 14500 : stars === 4 ? 9500 : 7000; }
function starAskingPrice(stars: number) { return starSalary(stars) * 12; }
function starPotential(stars: number)   { return stars === 5 ? "Elite" : stars === 4 ? "High" : "Average"; }

function contractEnd(age: number): string {
  const years = age <= 22 ? 4 : age <= 26 ? 3 : age <= 29 ? 2 : 1;
  return `${2026 + years}-06-30`;
}

// ── GCS download ───────────────────────────────────────────────────────────────

/**
 * Download a GCS object (stored under PRIVATE_OBJECT_DIR) to a local file.
 * @param objectsRelPath  path after "/objects/" — e.g. "player-cards/s-america/player-03.webp"
 * @param destPath        absolute destination path on disk
 */
async function downloadFromGcs(objectsRelPath: string, destPath: string): Promise<void> {
  const gcsObjectName = `${GCS_PRIVATE_PFX}/${objectsRelPath}`;
  const bucket = gcsClient.bucket(BUCKET_NAME);
  const file   = bucket.file(gcsObjectName);
  await file.download({ destination: destPath });
}

// ── Filename parsing ───────────────────────────────────────────────────────────

/** Parse "player_senior_<slug>_<NN>_<timestamp>.webp" → { slug, num } or null. */
function parseDiskFilename(filename: string): { slug: string; num: string } | null {
  const m = filename.match(/^player_senior_([a-z_]+)_(\d{2})_\d+\.webp$/);
  return m ? { slug: m[1]!, num: m[2]! } : null;
}

/** Parse "player_senior_<slug>_<NN>.webp" (canonical, no timestamp). */
function parseCanonicalFilename(filename: string): { slug: string; num: string } | null {
  const m = filename.match(/^player_senior_([a-z_]+)_(\d{2})\.webp$/);
  return m ? { slug: m[1]!, num: m[2]! } : null;
}

function canonicalFilename(slug: string, num: string): string {
  return `player_senior_${slug}_${num}.webp`;
}

function canonicalDbPath(slug: string, num: string): string {
  return `${CANONICAL_DB_PFX}/player_senior_${slug}_${num}.webp`;
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== SENIOR PLAYER MASTER MIGRATION ===\n");

  // ── Stage 0: Safety gate ───────────────────────────────────────────────────
  console.log("Stage 0: Safety gate…");

  const existing = await db
    .select({ id: playersTable.id, imageUrl: playersTable.imageUrl })
    .from(playersTable)
    .where(and(eq(playersTable.playerType, "senior"), eq(playersTable.isRetired, false)));

  const count = existing.length;
  if (count !== 192 && count !== 208) {
    throw new Error(`ABORT: Expected 192 or 208 senior players, found ${count}.`);
  }

  // Check if already fully migrated (208 + all canonical)
  if (count === 208) {
    const bad = existing.filter(
      (p) => !/^\/images\/players\/seniors\/player_senior_[a-z_]+_\d{2}\.webp$/.test(p.imageUrl ?? "")
    );
    if (bad.length === 0) {
      console.log("✅ Already fully migrated (208 players, all canonical). Nothing to do.\n");
      process.exit(0);
    }
    console.log(`  208 players found but ${bad.length} still non-canonical. Continuing…`);
  } else {
    console.log(`  Found ${count} existing senior players. Will add 16.\n`);
  }

  // ── Stage 1: Insert 16 new players (idempotent) ────────────────────────────
  console.log("Stage 1: Inserting 16 new players (idempotent by name+nationality)…");
  let newInserted = 0;

  for (const np of NEW_PLAYERS) {
    const found = await db
      .select({ id: playersTable.id })
      .from(playersTable)
      .where(and(
        eq(playersTable.name,        np.name),
        eq(playersTable.nationality, np.nationality),
        eq(playersTable.playerType,  "senior")
      ))
      .limit(1);

    if (found.length > 0) {
      console.log(`  SKIP (exists id=${found[0]!.id}): ${np.name} [${np.nationality}]`);
      continue;
    }

    const stats = generateStats(np.position, np.stars);

    await db.insert(playersTable).values({
      name:            np.name,
      nationality:     np.nationality,
      continent:       np.continent,
      age:             np.age,
      height:          String(np.heightCm),
      position:        np.position,
      speed:           stats.speed,
      power:           stats.power,
      defense:         stats.defense,
      serve:           stats.serve,
      block:           stats.block,
      stamina:         stats.stamina,
      morale:          80,
      potential:       starPotential(np.stars),
      salary:          String(starSalary(np.stars)),
      askingPrice:     String(starAskingPrice(np.stars)),
      imageUrl:        null,
      teamId:          null,
      isDraftPlayer:   false,
      isRetired:       false,
      playerType:      "senior",
      contractEndDate: contractEnd(np.age),
      squadRole:       "reserve",
      fitness:         100,
      fatigue:         0,
      isInjured:       false,
      injuryStatus:    "Healthy",
      injuryWeeksRemaining: 0,
      consecutiveMatchesPlayed: 0,
      doctorQuality:   3,
    });

    console.log(`  INSERTED: ${np.name} [${np.nationality}] (${np.position}, ${np.stars}★)`);
    newInserted++;
  }
  console.log(`  Stage 1 done — inserted ${newInserted} new players.\n`);

  // ── Stage 2: Load all 208, build canonical assignment ─────────────────────
  console.log("Stage 2: Building canonical number assignment for all 208 players…");

  const allPlayers = await db
    .select()
    .from(playersTable)
    .where(and(eq(playersTable.playerType, "senior"), eq(playersTable.isRetired, false)))
    .orderBy(playersTable.id);

  if (allPlayers.length !== 208) {
    throw new Error(`Expected 208 after insertion, got ${allPlayers.length}.`);
  }

  // Group by nationality → sort by id → assign 01, 02, …
  const byNat: Record<string, typeof allPlayers> = {};
  for (const p of allPlayers) {
    const nat = p.nationality ?? "Unknown";
    (byNat[nat] ??= []).push(p);
  }

  type Assignment = { slug: string; num: string; canonicalFile: string; canonicalDb: string };
  const assign = new Map<number, Assignment>();

  for (const [nat, group] of Object.entries(byNat)) {
    const slug = NATIONALITY_SLUG[nat];
    if (!slug) {
      console.warn(`  ⚠️  No slug for nationality "${nat}" — ${group.length} player(s) skipped`);
      continue;
    }
    group.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
    group.forEach((p, i) => {
      const num = String(i + 1).padStart(2, "0");
      assign.set(p.id!, { slug, num,
        canonicalFile: canonicalFilename(slug, num),
        canonicalDb:   canonicalDbPath(slug, num),
      });
    });
  }

  console.log(`  Assigned canonical names to ${assign.size} players.`);

  // Report any number changes for existing webp players
  let numChanges = 0;
  for (const p of allPlayers) {
    const a = assign.get(p.id!);
    if (!a || !p.imageUrl?.startsWith(CANONICAL_DB_PFX)) continue;
    if (p.imageUrl !== a.canonicalDb) {
      console.log(`  NUMBER CHANGE id=${p.id}: ${p.name} → ${p.imageUrl} ⟶ ${a.canonicalDb}`);
      numChanges++;
    }
  }
  if (numChanges === 0) console.log("  No number changes for existing players.");
  console.log(`  Stage 2 done.\n`);

  // ── Stage 3: Image file operations ────────────────────────────────────────
  console.log("Stage 3: Image file operations (GCS download + copy/rename webp)…");

  fs.mkdirSync(CANONICAL_DIR, { recursive: true });

  // Build index of all existing files on disk keyed by (fixedSlug, num)
  const diskFiles = fs.readdirSync(CANONICAL_DIR);
  const diskIndex = new Map<string, string>(); // "slug:num" → filename
  for (const f of diskFiles) {
    const pd = parseDiskFilename(f);
    if (pd) {
      const fixedSlug = SLUG_FIX[pd.slug] ?? pd.slug;
      diskIndex.set(`${fixedSlug}:${pd.num}`, f);
    }
    const pc = parseCanonicalFilename(f);
    if (pc) {
      diskIndex.set(`${pc.slug}:${pc.num}`, f);
    }
  }

  let downloaded = 0;
  let copied     = 0;
  let alreadyOk  = 0;

  for (const p of allPlayers) {
    const a = assign.get(p.id!);
    if (!a) continue;

    const destPath    = path.join(CANONICAL_DIR, a.canonicalFile);
    const destExists  = fs.existsSync(destPath);

    if (destExists) {
      alreadyOk++;
      continue; // canonical file already present — skip
    }

    const url = p.imageUrl ?? "";

    if (url.startsWith("/objects/player-cards/")) {
      // ── Download from GCS ──────────────────────────────────────────────────
      const relPath = url.slice("/objects/".length); // "player-cards/s-america/player-03.webp"
      console.log(`  GCS  → ${a.canonicalFile} (id=${p.id} ${p.name})`);
      await downloadFromGcs(relPath, destPath);
      downloaded++;

    } else if (url.startsWith(CANONICAL_DB_PFX)) {
      // ── Copy existing on-disk file (slug fix or number change) ────────────
      const existingFilename = path.basename(url);

      // First try exact match
      let srcPath = path.join(CANONICAL_DIR, existingFilename);
      if (!fs.existsSync(srcPath)) {
        // Try to find by slug+num in disk index
        const pd = parseDiskFilename(existingFilename) ?? parseCanonicalFilename(existingFilename);
        if (pd) {
          const fixedSlug = SLUG_FIX[pd.slug] ?? pd.slug;
          const candidate = diskIndex.get(`${fixedSlug}:${pd.num}`);
          if (candidate) srcPath = path.join(CANONICAL_DIR, candidate);
        }
      }

      if (fs.existsSync(srcPath)) {
        console.log(`  COPY → ${a.canonicalFile} (from ${path.basename(srcPath)})`);
        fs.copyFileSync(srcPath, destPath);
        // Update disk index
        diskIndex.set(`${a.slug}:${a.num}`, a.canonicalFile);
        copied++;
      } else {
        console.warn(`  ⚠️  Source file not found for id=${p.id} ${p.name}: "${url}"`);
      }

    } else if (!url) {
      // ── New player — match pre-uploaded file via slug + imageSlot ─────────
      const np = NEW_PLAYERS.find((x) => x.name === p.name && x.nationality === p.nationality);
      if (!np) {
        console.warn(`  ⚠️  No NewPlayer config for id=${p.id} ${p.name} — imageUrl is null`);
        continue;
      }
      const candidate = diskIndex.get(`${a.slug}:${np.imageSlot}`);
      if (candidate) {
        const srcPath = path.join(CANONICAL_DIR, candidate);
        console.log(`  COPY (new) → ${a.canonicalFile} (from ${candidate}, id=${p.id} ${p.name})`);
        fs.copyFileSync(srcPath, destPath);
        diskIndex.set(`${a.slug}:${a.num}`, a.canonicalFile);
        copied++;
      } else {
        console.warn(`  ⚠️  No pre-uploaded file for new player id=${p.id} ${p.name} (${a.slug} slot ${np.imageSlot})`);
        console.warn(`       Available for this slug: ${[...diskIndex.entries()].filter(([k]) => k.startsWith(a.slug + ":")).map(([k, v]) => v).join(", ") || "none"}`);
      }

    } else {
      console.warn(`  ⚠️  Unrecognised imageUrl for id=${p.id} ${p.name}: "${url}"`);
    }
  }

  console.log(`  Stage 3 done — GCS downloads: ${downloaded}, copies: ${copied}, already present: ${alreadyOk}.\n`);

  // ── Stage 4: Update DB image_urls ─────────────────────────────────────────
  console.log("Stage 4: Updating DB image_urls…");

  let updated = 0;
  let skipped = 0;
  let missing = 0;

  for (const p of allPlayers) {
    const a = assign.get(p.id!);
    if (!a) continue;

    // Only update if canonical file confirmed on disk
    if (!fs.existsSync(path.join(CANONICAL_DIR, a.canonicalFile))) {
      console.warn(`  ⚠️  Canonical file missing for id=${p.id} ${p.name} — skipping DB update`);
      missing++;
      continue;
    }

    if (p.imageUrl === a.canonicalDb) {
      skipped++;
      continue;
    }

    await db
      .update(playersTable)
      .set({ imageUrl: a.canonicalDb })
      .where(eq(playersTable.id, p.id!));

    updated++;
  }

  console.log(`  Updated: ${updated} | Skipped (already correct): ${skipped} | Missing file: ${missing}`);
  if (missing > 0) console.warn(`  ⚠️  ${missing} players still have no canonical file!`);
  console.log(`  Stage 4 done.\n`);

  // ── Stage 5: Verification ──────────────────────────────────────────────────
  console.log("Stage 5: Final verification…");

  const finalPlayers = await db
    .select({ id: playersTable.id, name: playersTable.name, nationality: playersTable.nationality, imageUrl: playersTable.imageUrl })
    .from(playersTable)
    .where(and(eq(playersTable.playerType, "senior"), eq(playersTable.isRetired, false)))
    .orderBy(playersTable.id);

  const totalCount = finalPlayers.length;
  const badUrl = finalPlayers.filter(
    (p) => !/^\/images\/players\/seniors\/player_senior_[a-z_]+_\d{2}\.webp$/.test(p.imageUrl ?? "")
  );

  // Count canonical files on disk
  const canonicalOnDisk = fs
    .readdirSync(CANONICAL_DIR)
    .filter((f) => /^player_senior_[a-z_]+_\d{2}\.webp$/.test(f));

  // Old timestamp-stamped files still present
  const oldTimestamped = fs
    .readdirSync(CANONICAL_DIR)
    .filter((f) => /^player_senior_[a-z_]+_\d{2}_\d{9,}\.webp$/.test(f));

  console.log(`  Total senior players in DB: ${totalCount} (target: 208)`);
  console.log(`  Canonical files on disk:    ${canonicalOnDisk.length} (target: 208)`);
  console.log(`  Old timestamp files on disk: ${oldTimestamped.length} (safe to delete)`);

  if (badUrl.length > 0) {
    console.warn(`\n  ⚠️  ${badUrl.length} players still have non-canonical imageUrl:`);
    badUrl.slice(0, 20).forEach((p) =>
      console.warn(`    id=${p.id} ${p.name} [${p.nationality}] → "${p.imageUrl ?? "null"}"`)
    );
  }

  const success = totalCount === 208 && badUrl.length === 0 && missing === 0;
  if (success) {
    console.log(`\n✅ MIGRATION COMPLETE. 208 senior players, all with canonical image paths.\n`);
  } else {
    console.log(`\n⚠️  Migration finished with issues. Review warnings above.\n`);
    if (missing > 0) process.exit(1);
  }
}

main().catch((err) => {
  console.error("\nFATAL:", err);
  process.exit(1);
});
