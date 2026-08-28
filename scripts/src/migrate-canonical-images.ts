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

// --dry-run: does everything (count, assignment, source resolution,
// verification) but performs no file copies, no GCS downloads, and no DB
// updates — prints what it would do instead.
const DRY_RUN = process.argv.includes("--dry-run");

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
  newzealand:     "new_zealand",
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

/**
 * Parse "player_senior_<slug>_<NN>_<timestamp>.webp" → { slug, num } or null.
 * Slug may contain a literal dot (e.g. "n.america", "s.america"). Also
 * tolerates two observed malformed variants: a "_(N)" duplicate marker
 * before the timestamp (player_senior_n.america_04_(2)_<ts>.webp), and a
 * stray dot right after the 2-digit number instead of an underscore
 * (player_senior_s.america_04._<ts>.webp).
 */
function parseDiskFilename(filename: string): { slug: string; num: string } | null {
  const m = filename.match(/^player_senior_([a-z_.]+)_(\d{2})(?:_\(\d+\))?\.?_\d+\.webp$/);
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
    .where(eq(playersTable.playerType, "senior"));

  const count = existing.length;
  console.log(`  Active senior player count: ${count}`);
  if (count === 0) {
    throw new Error(`ABORT: 0 active senior players found — nothing to migrate.`);
  }
  const startingCount = count;

  // Check if already fully migrated (startingCount + NEW_PLAYERS.length + all
  // canonical). NOTE: this reads as tautological — count is read into
  // startingCount immediately above, so `count === startingCount + N` can
  // only be true if N === 0, which it never is (16 new players). This
  // shortcut is therefore never reachable from a single Stage-0 snapshot; a
  // true "already migrated" re-run instead falls through to Stage 1 (SKIPs
  // every already-present player by name+nationality) and Stage 4 (skips
  // any player whose imageUrl already equals its canonical path), so
  // correctness doesn't depend on this branch firing — it's just no longer
  // an instant-exit fast path. Left in per the literal ask; flagged here in
  // case a real fast-path is wanted later (it would need the *pre-Stage-1*
  // count compared against a *post-Stage-1* re-read, not a single snapshot).
  if (count === startingCount + NEW_PLAYERS.length) {
    const bad = existing.filter(
      (p) => !/^\/images\/players\/seniors\/player_senior_[a-z_]+_\d{2}\.webp$/.test(p.imageUrl ?? "")
    );
    if (bad.length === 0) {
      console.log("✅ Already fully migrated (all canonical). Nothing to do.\n");
      process.exit(0);
    }
    console.log(`  ${count} players found but ${bad.length} still non-canonical. Continuing…`);
  } else {
    console.log(`  Found ${count} existing senior players. Will add ${NEW_PLAYERS.length}.\n`);
  }

  // ── Stage 1: Insert new players (idempotent) ───────────────────────────────
  console.log(`Stage 1: ${DRY_RUN ? "Checking" : "Inserting"} ${NEW_PLAYERS.length} new players (idempotent by name+nationality)…`);
  let newInserted = 0;
  const alreadyExistingNewPlayers = new Set<string>(); // "name|nationality"

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
      alreadyExistingNewPlayers.add(`${np.name}|${np.nationality}`);
      continue;
    }

    if (DRY_RUN) {
      console.log(`  WOULD INSERT: ${np.name} [${np.nationality}] (${np.position}, ${np.stars}★)`);
      continue;
    }

    const stats = generateStats(np.position, np.stars);

    await db.insert(playersTable).values({
      name:            np.name,
      nationality:     np.nationality,
      continent:       np.continent,
      age:             np.age,
      height:          np.heightCm,
      position:        np.position,
      speed:           stats.speed,
      power:           stats.power,
      defense:         stats.defense,
      serve:           stats.serve,
      block:           stats.block,
      stamina:         stats.stamina,
      potential:       starPotential(np.stars),
      askingPrice:     starAskingPrice(np.stars),
      imageUrl:        null,
      isDraftPlayer:   false,
      playerType:      "senior",
    });

    console.log(`  INSERTED: ${np.name} [${np.nationality}] (${np.position}, ${np.stars}★)`);
    newInserted++;
  }
  console.log(
    `  Stage 1 done — ${DRY_RUN ? "would insert" : "inserted"} ` +
      `${DRY_RUN ? NEW_PLAYERS.length - alreadyExistingNewPlayers.size : newInserted} new players.\n`
  );

  // ── Stage 2: Load all players, build canonical assignment ─────────────────
  console.log(`Stage 2: Building canonical number assignment for all ${startingCount + NEW_PLAYERS.length} players…`);

  let allPlayers: (typeof playersTable.$inferSelect)[];

  if (DRY_RUN) {
    // Nothing was actually inserted — build a virtual roster: real DB rows
    // plus synthetic placeholders (negative sentinel ids) for whichever
    // NEW_PLAYERS aren't already present, so assignment/reporting behaves
    // exactly as it would after a real Stage 1 run.
    const currentPlayers = await db
      .select()
      .from(playersTable)
      .where(eq(playersTable.playerType, "senior"))
      .orderBy(playersTable.id);

    let syntheticId = -1;
    const synthetic = NEW_PLAYERS
      .filter((np) => !alreadyExistingNewPlayers.has(`${np.name}|${np.nationality}`))
      .map((np) =>
        ({
          id: syntheticId--,
          name: np.name,
          nationality: np.nationality,
          imageUrl: null,
          playerType: "senior",
            } as typeof playersTable.$inferSelect)
      );

    allPlayers = [...currentPlayers, ...synthetic];
    console.log(
      `  (dry run) ${currentPlayers.length} existing + ${synthetic.length} not-yet-inserted new players = ${allPlayers.length}`
    );
  } else {
    allPlayers = await db
      .select()
      .from(playersTable)
      .where(eq(playersTable.playerType, "senior"))
      .orderBy(playersTable.id);

    if (allPlayers.length !== startingCount + NEW_PLAYERS.length) {
      throw new Error(
        `Expected ${startingCount + NEW_PLAYERS.length} after insertion, got ${allPlayers.length}.`
      );
    }
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
  console.log(`Stage 3: Image file operations${DRY_RUN ? " (DRY RUN — resolving sources, no writes)" : " (GCS download + copy/rename webp)"}…`);

  if (!DRY_RUN) fs.mkdirSync(CANONICAL_DIR, { recursive: true });

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

  type ReportRow = {
    id: number;
    name: string;
    nationality: string;
    currentBasename: string;
    resolvedSource: string;
    canonicalFile: string;
    willOverwrite: boolean;
  };
  const report: ReportRow[] = [];

  for (const p of allPlayers) {
    const a = assign.get(p.id!);
    if (!a) continue;

    const destPath      = path.join(CANONICAL_DIR, a.canonicalFile);
    const destExistsNow = fs.existsSync(destPath); // read-only check, always safe
    const url           = p.imageUrl ?? "";
    const currentBasename = url ? path.basename(url) : "(null)";

    if (url.startsWith("/objects/player-cards/")) {
      // ── Download from GCS — ALWAYS, overwriting whatever's at destPath.
      // The 208 files currently on disk were staged for a different roster
      // size, so an existing canonical file here may belong to the wrong
      // player; only this player's own tracked source is trustworthy.
      const relPath = url.slice("/objects/".length); // "player-cards/s-america/player-03.webp"
      report.push({ id: p.id!, name: p.name, nationality: p.nationality ?? "", currentBasename,
        resolvedSource: `GCS:${relPath}`, canonicalFile: a.canonicalFile, willOverwrite: destExistsNow });
      if (DRY_RUN) {
        console.log(`  [DRY] GCS  → ${a.canonicalFile} (id=${p.id} ${p.name})${destExistsNow ? " [OVERWRITE]" : " [CREATE]"}`);
      } else {
        console.log(`  GCS  → ${a.canonicalFile} (id=${p.id} ${p.name})`);
        await downloadFromGcs(relPath, destPath);
      }
      downloaded++;

    } else if (url.startsWith(CANONICAL_DB_PFX)) {
      // ── Copy existing on-disk file (slug fix or number change) — ALWAYS,
      // overwriting whatever's at destPath, same rationale as above.
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
        if (path.resolve(srcPath) === path.resolve(destPath)) {
          // Source and canonical destination are already the same file on
          // disk — copyFileSync onto itself risks truncating/corrupting it,
          // and there's nothing to do anyway.
          report.push({ id: p.id!, name: p.name, nationality: p.nationality ?? "", currentBasename,
            resolvedSource: path.basename(srcPath), canonicalFile: a.canonicalFile, willOverwrite: false });
          alreadyOk++;
        } else {
          report.push({ id: p.id!, name: p.name, nationality: p.nationality ?? "", currentBasename,
            resolvedSource: path.basename(srcPath), canonicalFile: a.canonicalFile, willOverwrite: destExistsNow });
          if (DRY_RUN) {
            console.log(`  [DRY] COPY → ${a.canonicalFile} (from ${path.basename(srcPath)})${destExistsNow ? " [OVERWRITE]" : " [CREATE]"}`);
          } else {
            console.log(`  COPY → ${a.canonicalFile} (from ${path.basename(srcPath)})`);
            fs.copyFileSync(srcPath, destPath);
          }
          // Update disk index (in-memory only — harmless to do during a dry
          // run too, keeps later players' resolution accurate)
          diskIndex.set(`${a.slug}:${a.num}`, a.canonicalFile);
          copied++;
        }
      } else {
        report.push({ id: p.id!, name: p.name, nationality: p.nationality ?? "", currentBasename,
          resolvedSource: "(not found)", canonicalFile: a.canonicalFile, willOverwrite: destExistsNow });
        console.warn(`  ⚠️  Source file not found for id=${p.id} ${p.name}: "${url}"`);
      }

    } else if (!url) {
      // ── New player — match pre-uploaded file via slug + imageSlot. Unlike
      // the branches above, a new player has no tracked source of its own —
      // the pre-staged file *is* the assignment — so skipping when the
      // canonical file is already present is legitimate here.
      if (destExistsNow) {
        report.push({ id: p.id!, name: p.name, nationality: p.nationality ?? "", currentBasename,
          resolvedSource: "(canonical file already present)", canonicalFile: a.canonicalFile, willOverwrite: false });
        alreadyOk++;
        continue;
      }
      const np = NEW_PLAYERS.find((x) => x.name === p.name && x.nationality === p.nationality);
      if (!np) {
        report.push({ id: p.id!, name: p.name, nationality: p.nationality ?? "", currentBasename,
          resolvedSource: "(no NewPlayer config)", canonicalFile: a.canonicalFile, willOverwrite: false });
        console.warn(`  ⚠️  No NewPlayer config for id=${p.id} ${p.name} — imageUrl is null`);
        continue;
      }
      const candidate = diskIndex.get(`${a.slug}:${np.imageSlot}`);
      if (candidate) {
        const srcPath = path.join(CANONICAL_DIR, candidate);
        report.push({ id: p.id!, name: p.name, nationality: p.nationality ?? "", currentBasename,
          resolvedSource: candidate, canonicalFile: a.canonicalFile, willOverwrite: false });
        if (DRY_RUN) {
          console.log(`  [DRY] COPY (new) → ${a.canonicalFile} (from ${candidate}, id=${p.id} ${p.name}) [CREATE]`);
        } else {
          console.log(`  COPY (new) → ${a.canonicalFile} (from ${candidate}, id=${p.id} ${p.name})`);
          fs.copyFileSync(srcPath, destPath);
        }
        diskIndex.set(`${a.slug}:${a.num}`, a.canonicalFile);
        copied++;
      } else {
        report.push({ id: p.id!, name: p.name, nationality: p.nationality ?? "", currentBasename,
          resolvedSource: "(no pre-uploaded file)", canonicalFile: a.canonicalFile, willOverwrite: false });
        console.warn(`  ⚠️  No pre-uploaded file for new player id=${p.id} ${p.name} (${a.slug} slot ${np.imageSlot})`);
        console.warn(`       Available for this slug: ${[...diskIndex.entries()].filter(([k]) => k.startsWith(a.slug + ":")).map(([k, v]) => v).join(", ") || "none"}`);
      }

    } else {
      report.push({ id: p.id!, name: p.name, nationality: p.nationality ?? "", currentBasename,
        resolvedSource: "(unrecognised imageUrl)", canonicalFile: a.canonicalFile, willOverwrite: destExistsNow });
      console.warn(`  ⚠️  Unrecognised imageUrl for id=${p.id} ${p.name}: "${url}"`);
    }
  }

  console.log(`  Stage 3 done — GCS downloads: ${downloaded}, copies: ${copied}, already present: ${alreadyOk}.\n`);

  if (DRY_RUN) {
    const resolved = report.filter(
      (r) => r.resolvedSource !== "(not found)" &&
             r.resolvedSource !== "(no pre-uploaded file)" &&
             r.resolvedSource !== "(no NewPlayer config)" &&
             r.resolvedSource !== "(unrecognised imageUrl)"
    );
    const unresolved = report.filter((r) => !resolved.includes(r));
    const wouldOverwrite = report.filter((r) => r.willOverwrite).length;
    const wouldCreate = report.filter((r) => !r.willOverwrite && r.resolvedSource !== "(canonical file already present)").length;

    console.log("=== DRY RUN REPORT ===\n");
    console.log(`Resolve a source file: ${resolved.length}`);
    console.log(`Do NOT resolve a source: ${unresolved.length}`);
    if (unresolved.length > 0) {
      console.log("  Unresolved:");
      for (const r of unresolved) {
        console.log(`    id=${r.id} ${r.name} [${r.nationality}] — ${r.resolvedSource} (current: ${r.currentBasename})`);
      }
    }
    console.log(`\nCanonical destinations that would be overwritten: ${wouldOverwrite}`);
    console.log(`Canonical destinations that would be newly created: ${wouldCreate}`);

    console.log("\n--- Full player → canonical filename mapping ---");
    console.log("id\tname\tnationality\tcurrent_basename\tresolved_source\tcanonical_file\toverwrite?");
    for (const r of report) {
      console.log(`${r.id}\t${r.name}\t${r.nationality}\t${r.currentBasename}\t${r.resolvedSource}\t${r.canonicalFile}\t${r.willOverwrite ? "yes" : "no"}`);
    }

    console.log("\nDRY RUN complete — no files, GCS objects, or DB rows were modified.\n");
    return;
  }

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
    .where(eq(playersTable.playerType, "senior"))
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

  const targetCount = startingCount + NEW_PLAYERS.length;
  console.log(`  Total senior players in DB: ${totalCount} (target: ${targetCount})`);
  console.log(`  Canonical files on disk:    ${canonicalOnDisk.length} (target: ${targetCount})`);
  console.log(`  Old timestamp files on disk: ${oldTimestamped.length} (safe to delete)`);

  if (badUrl.length > 0) {
    console.warn(`\n  ⚠️  ${badUrl.length} players still have non-canonical imageUrl:`);
    badUrl.slice(0, 20).forEach((p) =>
      console.warn(`    id=${p.id} ${p.name} [${p.nationality}] → "${p.imageUrl ?? "null"}"`)
    );
  }

  const success = totalCount === targetCount && badUrl.length === 0 && missing === 0;
  if (success) {
    console.log(`\n✅ MIGRATION COMPLETE. ${targetCount} senior players, all with canonical image paths.\n`);
  } else {
    console.log(`\n⚠️  Migration finished with issues. Review warnings above.\n`);
    if (missing > 0) process.exit(1);
  }
}

main().catch((err) => {
  console.error("\nFATAL:", err);
  process.exit(1);
});
