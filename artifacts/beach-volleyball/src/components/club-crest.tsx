/**
 * ClubCrest — deterministic SVG shield generated from club identity data.
 * No API calls, no extra DB columns — purely derived from name + colors.
 * The same inputs always produce the same crest, so it stays consistent after reload.
 */

type ClubCrestProps = {
  name: string;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  shapeIndex?: number | null;
  size?: number;
  className?: string;
};

function nameHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 5;
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return (words[0] ?? "").slice(0, 2).toUpperCase();
  if (words.length === 2) return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase();
  const mid = Math.floor(words.length / 2);
  return (
    (words[0]?.[0] ?? "") +
    (words[mid]?.[0] ?? "") +
    (words[words.length - 1]?.[0] ?? "")
  ).toUpperCase();
}

// 5 shield variants — outer path, inner decoration path, text y-center
const VARIANTS: Array<{ outer: string; inner: string; cy: number }> = [
  // 0 — Classic heraldic (pointed bottom)
  {
    outer: "M44 4L82 17V47C82 68 65 87 44 97C23 87 6 68 6 47V17Z",
    inner: "M44 11L75 21V47C75 64 61 80 44 89C27 80 13 64 13 47V21Z",
    cy: 50,
  },
  // 1 — Round top
  {
    outer: "M44 4C24 4 6 20 6 44V68C6 80 22 93 44 97C66 93 82 80 82 68V44C82 20 64 4 44 4Z",
    inner: "M44 11C28 11 13 24 13 44V68C13 76 26 87 44 90C62 87 75 76 75 68V44C75 24 60 11 44 11Z",
    cy: 52,
  },
  // 2 — Angular / kite
  {
    outer: "M44 3L84 19V50C84 72 64 88 44 97L4 88V19Z",
    inner: "M44 10L77 23V50C77 68 61 82 44 90L11 82V23Z",
    cy: 50,
  },
  // 3 — Curved sides
  {
    outer: "M8 28C14 13 28 4 44 4C60 4 74 13 80 28V57C80 75 64 90 44 97C24 90 8 75 8 57Z",
    inner: "M15 32C20 19 32 11 44 11C56 11 68 19 73 32V57C73 71 61 83 44 89C27 83 15 71 15 57Z",
    cy: 52,
  },
  // 4 — Flat top banner
  {
    outer: "M6 12H82V52C82 72 65 88 44 97C23 88 6 72 6 52Z",
    inner: "M13 18H75V52C75 68 61 82 44 90C27 82 13 68 13 52Z",
    cy: 54,
  },
];

function darkenHex(hex: string, amount = 0.35): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = Math.round(parseInt(h.slice(0, 2), 16) * (1 - amount));
  const g = Math.round(parseInt(h.slice(2, 4), 16) * (1 - amount));
  const b = Math.round(parseInt(h.slice(4, 6), 16) * (1 - amount));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export function ClubCrest({
  name,
  primaryColor,
  secondaryColor,
  shapeIndex,
  size = 44,
  className,
}: ClubCrestProps) {
  const primary   = primaryColor   ?? "#E05A00";
  const secondary = secondaryColor ?? "#FFFFFF";
  const variant   = VARIANTS[shapeIndex ?? nameHash(name)]!;
  const initials  = getInitials(name);
  const stroke    = darkenHex(primary);

  // Font size scales with shield size
  const fontSize = initials.length >= 3
    ? Math.round(size * 0.26)
    : Math.round(size * 0.32);

  const w = size;
  const h = Math.round(size * (100 / 88));
  const cx = w / 2;
  const cy = (variant.cy / 100) * h;

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 88 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label={`${name} crest`}
    >
      {/* Drop shadow filter */}
      <defs>
        <filter id={`shadow-${initials}`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.35" />
        </filter>
      </defs>

      {/* Outer shield */}
      <path
        d={variant.outer}
        fill={primary}
        stroke={stroke}
        strokeWidth="1.5"
        filter={`url(#shadow-${initials})`}
      />

      {/* Inner decorative inset */}
      <path
        d={variant.inner}
        fill="none"
        stroke={secondary}
        strokeWidth="1.2"
        strokeOpacity="0.35"
      />

      {/* Club initials */}
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fill={secondary}
        fontSize={fontSize}
        fontWeight="900"
        fontFamily="system-ui, -apple-system, sans-serif"
        letterSpacing={initials.length >= 3 ? "-0.5" : "0"}
        style={{ userSelect: "none" }}
      >
        {initials}
      </text>
    </svg>
  );
}

/**
 * Fallback initials badge when no crest data is available.
 * Uses the same color logic but renders as a rounded square.
 */
export function ClubInitialsBadge({
  name,
  primaryColor,
  secondaryColor,
  size = 40,
  className,
}: ClubCrestProps) {
  const primary   = primaryColor   ?? "#E05A00";
  const secondary = secondaryColor ?? "#FFFFFF";
  const initials  = getInitials(name).slice(0, 2);
  const fontSize  = Math.round(size * 0.36);

  return (
    <div
      className={`shrink-0 flex items-center justify-center font-black rounded-xl select-none ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        backgroundColor: primary + "33",
        border: `1.5px solid ${primary}66`,
        fontSize,
        color: primary,
      }}
    >
      {initials}
    </div>
  );
}
