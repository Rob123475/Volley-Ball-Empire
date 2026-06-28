/**
 * StaffPortrait / StaffAvatarPortrait
 *
 * Staff image cards with graceful initials fallback.
 * Mirrors the PlayerPortrait / AvatarPortrait API so the two families
 * can be used interchangeably across the app.
 *
 * Fallback colours are keyed by staff role so each department has its
 * own distinct identity in the initials placeholder.
 */

import { useState } from "react";
import { resolveStaffImageUrl } from "@/data/image-registry";

// ── Role colours ──────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  head_coach:           { bg: "#78350f", text: "#fcd34d" },   // amber
  assistant_coach:      { bg: "#1e3a8a", text: "#93c5fd" },   // blue
  fitness_trainer:      { bg: "#14532d", text: "#86efac" },   // green
  strength_conditioner: { bg: "#7f1d1d", text: "#fca5a5" },   // red
  massage_therapist:    { bg: "#134e4a", text: "#5eead4" },   // teal
  promotions_manager:   { bg: "#4a1d96", text: "#c4b5fd" },   // purple
  scout:                { bg: "#164e63", text: "#67e8f9" },   // cyan
  sports_scientist:     { bg: "#1e3a5f", text: "#93c5fd" },   // indigo
  medical:              { bg: "#831843", text: "#f9a8d4" },   // pink
};

const DEFAULT_COLOR = { bg: "#1c1917", text: "#d6d3d1" };

function roleColor(role?: string | null): { bg: string; text: string } {
  return (role ? ROLE_COLORS[role] : undefined) ?? DEFAULT_COLOR;
}

// ── Initials helper ───────────────────────────────────────────────────────────

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return (words[0] ?? "").slice(0, 2).toUpperCase();
  return ((words[0]?.[0] ?? "") + (words[words.length - 1]?.[0] ?? "")).toUpperCase();
}

// ── StaffPortrait (full card height) ─────────────────────────────────────────

type StaffPortraitProps = {
  name:            string;
  imageUrl?:       string | null;
  imageKey?:       string | null;
  role?:           string | null;
  /** Tailwind height class, e.g. "h-52" or "h-56" */
  heightClass?:    string;
  objectPosition?: string;
  className?:      string;
};

export function StaffPortrait({
  name,
  imageUrl,
  imageKey,
  role,
  heightClass    = "h-52",
  objectPosition = "object-[center_15%]",
  className      = "",
}: StaffPortraitProps) {
  const [failed, setFailed] = useState(false);

  const src    = resolveStaffImageUrl(imageUrl, imageKey, name, role ?? undefined);
  const colors = roleColor(role);
  const ini    = initials(name);

  if (failed || !src) {
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
        <div
          className="mt-2 text-[10px] font-bold uppercase tracking-widest opacity-60"
          style={{ color: colors.text }}
        >
          {role?.replace(/_/g, " ") ?? "Staff"}
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

// ── StaffAvatarPortrait (compact round) ───────────────────────────────────────

type StaffAvatarPortraitProps = {
  name:            string;
  imageUrl?:       string | null;
  imageKey?:       string | null;
  role?:           string | null;
  size?:           number;
  className?:      string;
  objectPosition?: string;
};

export function StaffAvatarPortrait({
  name,
  imageUrl,
  imageKey,
  role,
  size           = 32,
  className      = "",
  objectPosition = "object-[center_10%]",
}: StaffAvatarPortraitProps) {
  const [failed, setFailed] = useState(false);

  const src    = resolveStaffImageUrl(imageUrl, imageKey, name, role ?? undefined);
  const colors = roleColor(role);
  const ini    = initials(name);

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
