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
  Malaysia: "Asia", Maldives: "Asia",
  // Europe
  Germany: "Europe", France: "Europe", Italy: "Europe", Spain: "Europe",
  Norway: "Europe", Sweden: "Europe", Denmark: "Europe", Netherlands: "Europe",
  Switzerland: "Europe", Poland: "Europe", Greece: "Europe", Portugal: "Europe",
  Austria: "Europe", Belgium: "Europe", Russia: "Europe", Czech: "Europe",
  Finland: "Europe", Croatia: "Europe", Serbia: "Europe", Ukraine: "Europe",
  England: "Europe", Monaco: "Europe",
  // North America
  USA: "North America", Canada: "North America", Mexico: "North America",
  "United States": "North America", Jamaica: "North America",
  "Costa Rica": "North America", Cuba: "North America",
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
  Samoa: "Oceania", Tahiti: "Oceania", "Papua New Guinea": "Oceania",
};

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
  const resolved =
    continent ??
    (nationality ? NATIONALITY_CONTINENT[nationality] : null) ??
    "Europe";
  const slug   = CONTINENT_SLUG[resolved] ?? "europe";
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

const CONTINENT_COLORS: Record<string, { bg: string; text: string }> = {
  Africa:            { bg: "#78350f", text: "#fcd34d" },
  Asia:              { bg: "#7f1d1d", text: "#fca5a5" },
  Europe:            { bg: "#1e3a5f", text: "#93c5fd" },
  "North America":   { bg: "#14532d", text: "#86efac" },
  "South America":   { bg: "#365314", text: "#bef264" },
  Oceania:           { bg: "#164e63", text: "#67e8f9" },
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

  const resolved =
    continent ??
    (nationality ? NATIONALITY_CONTINENT[nationality] : null) ??
    "Europe";
  const colors = CONTINENT_COLORS[resolved] ?? DEFAULT_COLOR;
  const ini    = initials(name);

  const src = resolvePortraitSrc(imageUrl, name, playerType);

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
          {resolved}
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

  const resolved =
    continent ??
    (nationality ? NATIONALITY_CONTINENT[nationality] : null) ??
    "Europe";
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
