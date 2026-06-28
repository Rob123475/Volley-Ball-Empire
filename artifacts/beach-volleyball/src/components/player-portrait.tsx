/**
 * PlayerPortrait — player image with a graceful initials fallback.
 *
 * Uses the `/players/{prefix}-{continent}-{index}.png` asset system.
 * On image load error shows a styled initials + continent-coloured placeholder.
 */
import { useState } from "react";

// ── Portrait URL helpers (also used by server routes) ────────────────────────

export const CONTINENT_SLUG: Record<string, string> = {
  "Africa":        "africa",
  "Asia":          "asia",
  "Europe":        "europe",
  "North America": "northam",
  "South America": "southam",
  "Oceania":       "oceania",
};

/** nationality → continent (used when continent field is absent) */
export const NATIONALITY_CONTINENT: Record<string, string> = {
  // Asia
  Japan: "Asia", "South Korea": "Asia", China: "Asia", India: "Asia",
  Thailand: "Asia", Indonesia: "Asia", Philippines: "Asia", Vietnam: "Asia",
  // Europe
  Germany: "Europe", France: "Europe", Italy: "Europe", Spain: "Europe",
  Norway: "Europe", Sweden: "Europe", Denmark: "Europe", Netherlands: "Europe",
  Switzerland: "Europe", Poland: "Europe", Greece: "Europe", Portugal: "Europe",
  Austria: "Europe", Belgium: "Europe", Russia: "Europe", Czech: "Europe",
  Finland: "Europe", Croatia: "Europe", Serbia: "Europe", Ukraine: "Europe",
  // North America
  USA: "North America", Canada: "North America", Mexico: "North America",
  // South America
  Brazil: "South America", Argentina: "South America", Colombia: "South America",
  Chile: "South America", Peru: "South America", Venezuela: "South America",
  Ecuador: "South America", Bolivia: "South America", Uruguay: "South America",
  // Africa
  Nigeria: "Africa", Ghana: "Africa", Kenya: "Africa", Egypt: "Africa",
  "South Africa": "Africa", Ethiopia: "Africa", Senegal: "Africa",
  Tanzania: "Africa", Uganda: "Africa", Cameroon: "Africa", Ivory: "Africa",
  Morocco: "Africa", Algeria: "Africa", Tunisia: "Africa",
  // Oceania
  Australia: "Oceania", "New Zealand": "Oceania", Fiji: "Oceania",
  Samoa: "Oceania", Tahiti: "Oceania",
};

/** Deterministic hash → 0–9 */
function nameHash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 10;
}

/** Build a `/players/…` URL from player identity data */
export function getPortraitUrl(
  name: string,
  continent: string | null | undefined,
  playerType: string | null | undefined,
  nationality?: string | null,
): string {
  const resolved =
    continent ??
    (nationality ? NATIONALITY_CONTINENT[nationality] : null) ??
    "Europe";
  const slug   = CONTINENT_SLUG[resolved] ?? "europe";
  const prefix = playerType === "youth" ? "y" : "s";
  const index  = nameHash(name) + 1;
  return `/players/${prefix}-${slug}-${String(index).padStart(2, "0")}.png`;
}

// ── Continent placeholder colours ─────────────────────────────────────────────

const CONTINENT_COLORS: Record<string, { bg: string; text: string }> = {
  Africa:          { bg: "#78350f", text: "#fcd34d" },
  Asia:            { bg: "#7f1d1d", text: "#fca5a5" },
  Europe:          { bg: "#1e3a5f", text: "#93c5fd" },
  "North America": { bg: "#14532d", text: "#86efac" },
  "South America": { bg: "#365314", text: "#bef264" },
  Oceania:         { bg: "#164e63", text: "#67e8f9" },
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

  const resolved =
    continent ??
    (nationality ? NATIONALITY_CONTINENT[nationality] : null) ??
    "Europe";
  const colors = CONTINENT_COLORS[resolved] ?? DEFAULT_COLOR;
  const ini    = initials(name);

  const src = imageUrl ?? getPortraitUrl(name, continent, playerType, nationality);

  if (failed || !src) {
    // Styled initials placeholder — never shows a blank box
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
          {resolved}
        </div>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      className={`w-full ${heightClass} object-cover ${objectPosition} ${className}`}
      onError={() => setFailed(true)}
    />
  );
}

/**
 * Compact round avatar with portrait or initials fallback.
 * Matches the existing `w-N h-N rounded-full` pattern.
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

  const resolved =
    continent ??
    (nationality ? NATIONALITY_CONTINENT[nationality] : null) ??
    "Europe";
  const colors = CONTINENT_COLORS[resolved] ?? DEFAULT_COLOR;
  const ini    = initials(name);
  const src    = imageUrl ?? getPortraitUrl(name, continent, playerType, nationality);

  const style: React.CSSProperties = { width: size, height: size, minWidth: size };

  if (failed || !src) {
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
