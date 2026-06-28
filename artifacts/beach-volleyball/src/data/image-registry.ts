/**
 * Image Registry
 *
 * Single source of truth for all portrait imageKeys used across the app.
 * Each imageKey maps to a URL, type, role/continent, and style metadata.
 *
 * Priority chain used by the portrait components:
 *   1. Explicit imageUrl stored on the DB record (non-legacy path)
 *   2. /images/players/{seniors|youth}/{name-slug}.png — per-player individual file
 *   3. Initials avatar fallback — never a blank box (on 404 or missing imageUrl)
 *
 * Adding real portraits:
 *   Drop PNGs/JPGs into the appropriate public/images/ subfolder, then update
 *   the imageUrl in the entry below from the DiceBear placeholder to the
 *   local path, e.g. "/images/players/seniors/ps_eu_01.png".
 *
 * Folder conventions:
 *   public/images/players/seniors/   ← 60 senior portraits (ps_*)
 *   public/images/players/youth/     ← 60 youth illustrated portraits (py_*)
 *   public/images/staff/             ← 100+ staff portraits (st_*)
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type ImageStyle = "realistic" | "cartoon" | "professional";

export interface PlayerImageEntry {
  imageKey:  string;
  imageUrl:  string;
  type:      "senior" | "youth";
  continent: string;
  style:     ImageStyle;
  gender?:   "female" | "any";
}

export interface StaffImageEntry {
  imageKey: string;
  imageUrl: string;
  type:     "staff";
  role:     string;
  style:    ImageStyle;
  gender?:  "female" | "any";
}

export type ImageEntry = PlayerImageEntry | StaffImageEntry;

// ── URL builders ──────────────────────────────────────────────────────────────

const DICEBEAR_STAFF = (seed: string) =>
  `https://api.dicebear.com/7.x/personas/svg?seed=${encodeURIComponent(seed)}_staff&backgroundColor=b6e3f4,ffd5dc,d1d4f9`;

// ── Registry generation ───────────────────────────────────────────────────────

const CONTINENTS = ["africa", "asia", "europe", "northam", "southam", "oceania"] as const;
const CONTINENT_LABEL: Record<string, string> = {
  africa:  "Africa",
  asia:    "Asia",
  europe:  "Europe",
  northam: "North America",
  southam: "South America",
  oceania: "Oceania",
};

const STAFF_ROLE_GROUPS: { key: string; role: string; count: number }[] = [
  { key: "hcoach",   role: "head_coach",            count: 15 },
  { key: "acoach",   role: "assistant_coach",        count: 14 },
  { key: "fitness",  role: "fitness_trainer",        count: 14 },
  { key: "strength", role: "strength_conditioner",   count: 14 },
  { key: "massage",  role: "massage_therapist",      count: 15 },
  { key: "promo",    role: "promotions_manager",     count: 14 },
  { key: "scout",    role: "scout",                  count: 14 },
];

function buildPlayerRegistry(): Record<string, PlayerImageEntry> {
  const out: Record<string, PlayerImageEntry> = {};

  for (const slug of CONTINENTS) {
    for (let i = 1; i <= 10; i++) {
      const idx = String(i).padStart(2, "0");

      // Senior — individual portrait file convention: /images/players/seniors/{imageKey}.png
      const sk = `ps_${slug}_${idx}`;
      out[sk] = {
        imageKey:  sk,
        imageUrl:  `/images/players/seniors/${sk}.png`,
        type:      "senior",
        continent: CONTINENT_LABEL[slug] ?? slug,
        style:     "realistic",
      };

      // Youth — individual portrait file convention: /images/players/youth/{imageKey}.png
      const yk = `py_${slug}_${idx}`;
      out[yk] = {
        imageKey:  yk,
        imageUrl:  `/images/players/youth/${yk}.png`,
        type:      "youth",
        continent: CONTINENT_LABEL[slug] ?? slug,
        style:     "cartoon",
      };
    }
  }

  return out;
}

function buildStaffRegistry(): Record<string, StaffImageEntry> {
  const out: Record<string, StaffImageEntry> = {};

  for (const { key, role, count } of STAFF_ROLE_GROUPS) {
    for (let i = 1; i <= count; i++) {
      const imageKey = `st_${key}_${String(i).padStart(2, "0")}`;
      out[imageKey] = {
        imageKey,
        imageUrl:  DICEBEAR_STAFF(imageKey),
        type:      "staff",
        role,
        style:     "professional",
      };
    }
  }

  return out;
}

export const PLAYER_REGISTRY: Record<string, PlayerImageEntry> = buildPlayerRegistry();
export const STAFF_REGISTRY:  Record<string, StaffImageEntry>  = buildStaffRegistry();
export const IMAGE_REGISTRY:  Record<string, ImageEntry>       = {
  ...PLAYER_REGISTRY,
  ...STAFF_REGISTRY,
};

// ── Resolution helpers ────────────────────────────────────────────────────────

/**
 * Deterministic imageKey for a player based on type and continent slug.
 * Matches the existing `/players/{prefix}-{slug}-{idx}.png` convention.
 */
export function playerImageKey(
  name:       string,
  playerType: "senior" | "youth" | string | null | undefined,
  continent:  string | null | undefined,
): string {
  const slug   = continentSlug(continent ?? "Europe");
  const prefix = playerType === "youth" ? "py" : "ps";
  const idx    = String((nameHash(name) % 10) + 1).padStart(2, "0");
  return `${prefix}_${slug}_${idx}`;
}

/**
 * Resolve the best available image URL for a player.
 * Priority: explicit DB imageUrl → imageKey registry → local asset path.
 */
export function resolvePlayerImageUrl(
  imageUrl:   string | null | undefined,
  imageKey:   string | null | undefined,
  name:       string,
  playerType: string | null | undefined,
  continent:  string | null | undefined,
  nationality?: string | null,
): string | null {
  if (imageUrl)  return imageUrl;
  if (imageKey) {
    const entry = IMAGE_REGISTRY[imageKey];
    if (entry)   return entry.imageUrl;
  }
  // Fall through to null — PlayerPortrait will call getPortraitUrl itself
  return null;
}

/**
 * Resolve the best available image URL for a staff member.
 * Priority: explicit DB imageUrl → imageKey registry → DiceBear from name.
 */
export function resolveStaffImageUrl(
  imageUrl:  string | null | undefined,
  imageKey:  string | null | undefined,
  name:      string,
  role?:     string,
): string {
  if (imageUrl) return imageUrl;
  if (imageKey) {
    const entry = IMAGE_REGISTRY[imageKey];
    if (entry)   return entry.imageUrl;
  }
  return DICEBEAR_STAFF(name);
}

// ── Utilities ─────────────────────────────────────────────────────────────────

const SLUG_MAP: Record<string, string> = {
  "Africa":        "africa",
  "Asia":          "asia",
  "Europe":        "europe",
  "North America": "northam",
  "South America": "southam",
  "Oceania":       "oceania",
};

function continentSlug(continent: string): string {
  return SLUG_MAP[continent] ?? "europe";
}

function nameHash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 10;
}

/** Count of registered entries per category */
export const REGISTRY_STATS = {
  seniorPlayers: Object.values(PLAYER_REGISTRY).filter(e => e.type === "senior").length,
  youthPlayers:  Object.values(PLAYER_REGISTRY).filter(e => e.type === "youth").length,
  staff:         Object.values(STAFF_REGISTRY).length,
  total:         Object.keys(IMAGE_REGISTRY).length,
};
