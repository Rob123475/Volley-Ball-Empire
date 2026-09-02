import {
  continentKeyFrom,
  continentKeyForNationality,
  continentLabel,
  countryFlag,
  type ContinentKey,
} from "@shared/continents";
/**
 * PlayerPortrait — player image with a graceful initials fallback.
 *
 * Uses the `/players/{prefix}-{continent}-{index}.png` asset system.
 * On image load error shows a styled initials + continent-coloured placeholder.
 *
 * Full-size portraits (PlayerPortrait) are click-to-zoom via the global
 * ImageLightbox. Small round avatars (AvatarPortrait) are never zoomable.
 */
import { useRef, useState } from "react";
import { useLightbox } from "@/components/image-lightbox";

// ── Portrait URL helpers (also used by server routes) ────────────────────────

/**
 * Continent KEY -> portrait asset slug.
 *
 * The slug VALUES are filenames on disk and must not change. The KEYS used to
 * be display labels ("Africa", "Oceania") which stopped matching the database
 * once it moved to "Africa and Middle East" / "Australia and Pacific Islands",
 * so every African and Oceanian player silently fell back to a European
 * portrait. Keyed by ContinentKey now, so a mismatch is a compile error.
 */
export const CONTINENT_SLUG: Record<ContinentKey, string> = {
  africa_middle_east: "africa",
  asia:               "asia",
  europe:             "europe",
  north_america:      "northam",
  south_america:      "southam",
  oceania:            "oceania",
};

// nationality -> continent now comes from the shared module. This file used
// to carry its own copy keyed by country name and spelled "Africa"/"Oceania",
// which stopped matching the database and sent 85 players to a European
// portrait without a word.

/** Deterministic hash → 0–9 */
function nameHash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 10;
}

/**
 * @deprecated Old contact-sheet pool paths — kept only for reference.
 * Components no longer call this; individual portrait files are used instead.
 */
export function getPortraitUrl(
  name: string,
  continent: string | null | undefined,
  playerType: string | null | undefined,
  nationality?: string | null,
): string {
  const resolved: ContinentKey =
    continentKeyFrom(continent) ??
    continentKeyForNationality(nationality) ??
    "europe";
  const slug   = CONTINENT_SLUG[resolved];
  const prefix = playerType === "youth" ? "y" : "s";
  const index  = nameHash(name) + 1;
  return `/players/${prefix}-${slug}-${String(index).padStart(2, "0")}.png`;
}

/** Regex that matches the legacy contact-sheet pool paths — no longer used */
const LEGACY_POOL_PATH = /^\/players\//;

/** Filename-safe slug derived from a player's display name */
function nameSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

/** Rewrite `/objects/...` sidecar paths to the browser-accessible API route */
function normaliseObjectUrl(url: string): string {
  if (url.startsWith("/objects/")) {
    return `/api/storage/objects/${url.slice("/objects/".length)}`;
  }
  return url;
}

export function resolvePortraitSrc(
  imageUrl:   string | null | undefined,
  name:       string,
  playerType: string | null | undefined,
): string {
  if (imageUrl && !LEGACY_POOL_PATH.test(imageUrl)) return normaliseObjectUrl(imageUrl);
  const folder = playerType === "youth" ? "youth" : "seniors";
  return `/images/players/${folder}/${nameSlug(name)}.png`;
}

// ── Continent placeholder colours ─────────────────────────────────────────────

const CONTINENT_COLORS: Record<ContinentKey, { bg: string; text: string }> = {
  africa_middle_east: { bg: "#78350f", text: "#fcd34d" },
  asia:               { bg: "#7f1d1d", text: "#fca5a5" },
  europe:             { bg: "#1e3a5f", text: "#93c5fd" },
  north_america:      { bg: "#14532d", text: "#86efac" },
  south_america:      { bg: "#365314", text: "#bef264" },
  oceania:            { bg: "#164e63", text: "#67e8f9" },
};
const DEFAULT_COLOR = { bg: "#3b0764", text: "#d8b4fe" };

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return (words[0] ?? "").slice(0, 2).toUpperCase();
  return ((words[0]?.[0] ?? "") + (words[words.length - 1]?.[0] ?? "")).toUpperCase();
}

// ── Component ─────────────────────────────────────────────────────────────────

type PlayerPortraitProps = {
  name: string;
  imageUrl?: string | null;
  continent?: string | null;
  nationality?: string | null;
  playerType?: string | null;
  /** Tailwind class for height, e.g. "h-72" */
  heightClass?: string;
  objectPosition?: string;
  className?: string;
};

export function PlayerPortrait({
  name,
  imageUrl,
  continent,
  nationality,
  playerType,
  heightClass = "h-72",
  objectPosition = "object-top",
  className = "",
}: PlayerPortraitProps) {
  const [failed, setFailed] = useState(false);
  const { open } = useLightbox();
  const triggerRef = useRef<HTMLDivElement>(null);

  const resolved: ContinentKey =
    continentKeyFrom(continent) ??
    continentKeyForNationality(nationality) ??
    "europe";
  const colors = CONTINENT_COLORS[resolved] ?? DEFAULT_COLOR;
  const ini    = initials(name);

  const src = resolvePortraitSrc(imageUrl, name, playerType);

  // ── Academy players are never depicted ────────────────────────────────────
  // Youth players are minors. The game deliberately ships no photographs of
  // them — a beachwear portrait of a 14-to-18-year-old is not something this
  // project will put on screen, and every youth row points at the same blank
  // card for exactly that reason. The flag of their country stands in: it
  // identifies the player without picturing her.
  //
  // Rendered from the nationality rather than from any image, so there is no
  // asset to mislabel and nothing to swap in later by accident.
  if (playerType === "youth") {
    return (
      <div
        className={`w-full ${heightClass} flex flex-col items-center justify-center select-none ${className}`}
        style={{ backgroundColor: colors.bg }}
        aria-label={nationality ? `${name} — ${nationality}` : name}
      >
        <div className="leading-none" style={{ fontSize: "3.5rem" }} aria-hidden="true">
          {countryFlag(nationality)}
        </div>
        <div
          className="mt-3 text-[11px] font-black uppercase tracking-widest text-center px-2"
          style={{ color: colors.text }}
        >
          {nationality ?? continentLabel(resolved)}
        </div>
        <div className="mt-1 text-[9px] font-bold uppercase tracking-widest opacity-50" style={{ color: colors.text }}>
          Academy
        </div>
      </div>
    );
  }

  if (failed) {
    // Initials placeholder — not zoomable (no real image)
    return (
      <div
        className={`w-full ${heightClass} flex flex-col items-center justify-center select-none ${className}`}
        style={{ backgroundColor: colors.bg }}
      >
        <div
          className="text-5xl font-black leading-none"
          style={{ color: colors.text }}
        >
          {ini}
        </div>
        <div className="mt-2 text-[10px] font-bold uppercase tracking-widest opacity-60" style={{ color: colors.text }}>
          {continentLabel(resolved)}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={triggerRef}
      role="button"
      tabIndex={0}
      aria-label={`View ${name} portrait`}
      className={`w-full ${heightClass} relative overflow-hidden ${className} cursor-zoom-in`}
      onClick={() => open(src, name, triggerRef.current)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(src, name, triggerRef.current); } }}
    >
      {/* Blurred background fill */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${src})`,
          backgroundSize: "cover",
          backgroundPosition: "top center",
          filter: "blur(14px) brightness(0.28)",
          transform: "scale(1.2)",
          transformOrigin: "top center",
        }}
      />
      <img
        src={src}
        alt={name}
        className="absolute top-0 left-1/2 -translate-x-1/2 h-auto"
        style={{ width: "62%", zIndex: 1 }}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

/**
 * Compact round avatar with portrait or initials fallback.
 * NOT zoomable — small avatars are decorative navigation elements.
 */
type AvatarPortraitProps = {
  name: string;
  imageUrl?: string | null;
  continent?: string | null;
  nationality?: string | null;
  playerType?: string | null;
  size?: number;
  className?: string;
  objectPosition?: string;
};

export function AvatarPortrait({
  name,
  imageUrl,
  continent,
  nationality,
  playerType,
  size = 32,
  className = "",
  objectPosition = "object-[center_10%]",
}: AvatarPortraitProps) {
  const [failed, setFailed] = useState(false);

  const resolved: ContinentKey =
    continentKeyFrom(continent) ??
    continentKeyForNationality(nationality) ??
    "europe";
  const colors = CONTINENT_COLORS[resolved] ?? DEFAULT_COLOR;
  const ini    = initials(name);
  const src    = resolvePortraitSrc(imageUrl, name, playerType);

  const style: React.CSSProperties = { width: size, height: size, minWidth: size };

  if (failed) {
    return (
      <div
        className={`rounded-full shrink-0 flex items-center justify-center font-black select-none ${className}`}
        style={{ ...style, backgroundColor: colors.bg, color: colors.text, fontSize: size * 0.36 }}
      >
        {ini}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      className={`rounded-full shrink-0 object-cover ${objectPosition} ${className}`}
      style={style}
      onError={() => setFailed(true)}
    />
  );
}
