/**
 * R-13: the nationality list, colour presets and colour/crest-shape pickers
 * used to exist only in new-career.tsx. career-management.tsx's own wizard
 * (NewCareerModal) never collected either — not a payload bug so much as a
 * UI feature the second wizard never had — so its create-career payload
 * always sent managerNationality/crestShapeIndex as absent, silently
 * different from what the title-screen wizard sends for the exact same
 * form. Extracted here so both wizards render (and eventually validate)
 * nationality and crest-shape identically, rather than each carrying its
 * own copy that can drift.
 */
import { useState } from "react";
import { ClubCrest, CREST_SHAPE_COUNT } from "@/components/club-crest";
import { cn } from "@/lib/utils";
import { Check, Sprout, Building2 } from "lucide-react";

export const NATIONALITIES = [
  { name: "Argentina",     flag: "🇦🇷" },
  { name: "Australia",     flag: "🇦🇺" },
  { name: "Austria",       flag: "🇦🇹" },
  { name: "Belgium",       flag: "🇧🇪" },
  { name: "Brazil",        flag: "🇧🇷" },
  { name: "Bulgaria",      flag: "🇧🇬" },
  { name: "Canada",        flag: "🇨🇦" },
  { name: "China",         flag: "🇨🇳" },
  { name: "Croatia",       flag: "🇭🇷" },
  { name: "Cuba",          flag: "🇨🇺" },
  { name: "Czech Republic",flag: "🇨🇿" },
  { name: "Denmark",       flag: "🇩🇰" },
  { name: "Finland",       flag: "🇫🇮" },
  { name: "France",        flag: "🇫🇷" },
  { name: "Germany",       flag: "🇩🇪" },
  { name: "Great Britain", flag: "🇬🇧" },
  { name: "Hungary",       flag: "🇭🇺" },
  { name: "Italy",         flag: "🇮🇹" },
  { name: "Japan",         flag: "🇯🇵" },
  { name: "Kenya",         flag: "🇰🇪" },
  { name: "Latvia",        flag: "🇱🇻" },
  { name: "Mexico",        flag: "🇲🇽" },
  { name: "Netherlands",   flag: "🇳🇱" },
  { name: "New Zealand",   flag: "🇳🇿" },
  { name: "Norway",        flag: "🇳🇴" },
  { name: "Peru",          flag: "🇵🇪" },
  { name: "Poland",        flag: "🇵🇱" },
  { name: "Portugal",      flag: "🇵🇹" },
  { name: "Russia",        flag: "🇷🇺" },
  { name: "Slovakia",      flag: "🇸🇰" },
  { name: "South Africa",  flag: "🇿🇦" },
  { name: "South Korea",   flag: "🇰🇷" },
  { name: "Spain",         flag: "🇪🇸" },
  { name: "Sweden",        flag: "🇸🇪" },
  { name: "Switzerland",   flag: "🇨🇭" },
  { name: "Thailand",      flag: "🇹🇭" },
  { name: "Turkey",        flag: "🇹🇷" },
  { name: "Ukraine",       flag: "🇺🇦" },
  { name: "United States", flag: "🇺🇸" },
  { name: "Other",         flag: "🌍" },
];

export const COLOR_PRESETS = [
  "#E05A00", "#CC0000", "#0044CC", "#008800",
  "#6600CC", "#CC9900", "#AA0044", "#004488",
  "#44AAFF", "#44CC88", "#FF88CC", "#FFEE44",
  "#222222", "#666666", "#AAAAAA", "#FFFFFF",
];

export function ColorSwatch({
  color,
  selected,
  onSelect,
}: {
  color: string;
  selected: boolean;
  onSelect: (c: string) => void;
}) {
  return (
    <button
      type="button"
      title={color}
      onClick={() => onSelect(color)}
      style={{ backgroundColor: color }}
      className={cn(
        "h-8 w-8 rounded-lg border-2 transition-all flex items-center justify-center",
        selected ? "border-white scale-110 shadow-lg" : "border-white/20 hover:border-white/50",
      )}
    >
      {selected && <Check className="h-3.5 w-3.5" style={{ color: color === "#FFFFFF" ? "#000" : "#fff", filter: "drop-shadow(0 0 1px rgba(0,0,0,0.5))" }} />}
    </button>
  );
}

export function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-bold uppercase tracking-widest text-white/40">{label}</label>
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-md border border-white/20" style={{ backgroundColor: value }} />
          <input
            type="color"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="h-5 w-12 cursor-pointer rounded border-0 bg-transparent p-0 opacity-0 absolute"
            title="Custom colour"
          />
          <span className="text-xs font-mono text-white/50">{value}</span>
          <input
            type="color"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="h-6 w-6 cursor-pointer rounded border border-white/20 bg-transparent p-0"
            title="Custom colour"
          />
        </div>
      </div>
      <div className="grid grid-cols-8 gap-1.5">
        {COLOR_PRESETS.map(c => (
          <ColorSwatch key={c} color={c} selected={value === c} onSelect={onChange} />
        ))}
      </div>
    </div>
  );
}

export function ShapeSwatch({
  index,
  primaryColor,
  secondaryColor,
  selected,
  onSelect,
}: {
  index: number;
  primaryColor: string;
  secondaryColor: string;
  selected: boolean;
  onSelect: (i: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(index)}
      className={cn(
        "h-11 w-11 rounded-lg border-2 transition-all flex items-center justify-center bg-white/5",
        selected ? "border-white scale-110 shadow-lg" : "border-white/20 hover:border-white/50",
      )}
    >
      <ClubCrest name="" primaryColor={primaryColor} secondaryColor={secondaryColor} shapeIndex={index} size={28} />
    </button>
  );
}

export function ShapePicker({
  primaryColor,
  secondaryColor,
  value,
  onChange,
}: {
  primaryColor: string;
  secondaryColor: string;
  value: number;
  onChange: (i: number) => void;
}) {
  return (
    <div className="space-y-2.5">
      <label className="text-[11px] font-bold uppercase tracking-widest text-white/40">Crest Shape</label>
      <div className="flex gap-2">
        {Array.from({ length: CREST_SHAPE_COUNT }, (_, i) => (
          <ShapeSwatch
            key={i}
            index={i}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            selected={value === i}
            onSelect={onChange}
          />
        ))}
      </div>
    </div>
  );
}

/** Nationality dropdown with search — the same picker new-career.tsx renders
 *  inline in its own step 1, extracted so both wizards use one definition.
 *  `accentClassName` lets each caller match its own surrounding theme (the
 *  title-screen wizard uses the app's `secondary` token; the save-slot
 *  modal uses a literal violet to match its own modal chrome) — the two
 *  already used different accents before this was shared, and unifying the
 *  accent colour was never part of what R-13 asked for. */
export function NationalityPicker({
  value,
  onChange,
  accentClassName = "bg-violet-500/15 text-violet-300",
}: {
  value: string;
  onChange: (name: string) => void;
  accentClassName?: string;
}) {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState("");
  const filtered  = NATIONALITIES.filter(n => n.name.toLowerCase().includes(search.toLowerCase()));
  const selected  = NATIONALITIES.find(n => n.name === value);

  return (
    <div className="space-y-1.5 relative">
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setSearch(""); }}
        className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white hover:bg-white/8 transition-all"
      >
        {selected ? (
          <span className="flex items-center gap-2">
            <span className="text-lg leading-none">{selected.flag}</span>
            <span className="font-semibold">{selected.name}</span>
          </span>
        ) : (
          <span className="text-white/30">Select your nationality…</span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl border border-white/10 bg-slate-900 shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-white/8">
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full rounded-lg bg-white/5 px-3 py-1.5 text-sm text-white placeholder-white/30 outline-none focus:bg-white/8"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.map(n => (
              <button
                key={n.name}
                type="button"
                onClick={() => { onChange(n.name); setOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-white/8 transition-colors",
                  value === n.name && accentClassName,
                )}
              >
                <span className="text-lg leading-none">{n.flag}</span>
                <span className={value === n.name ? "font-bold" : "text-white"}>{n.name}</span>
                {value === n.name && <Check className="ml-auto h-3.5 w-3.5" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── R-11: career difficulty ──────────────────────────────────────────────────
// Wording drawn directly from docs/economy-design.md's "What the player
// should feel" — the plain description Phase 8's UI scope calls for, not
// paraphrased.

export type CareerDifficulty = "underdog" | "established";

export const DIFFICULTY_OPTIONS: ReadonlyArray<{
  value: CareerDifficulty;
  label: string;
  tagline: string;
  description: string;
  icon: typeof Sprout;
}> = [
  {
    value: "underdog",
    label: "Underdog",
    tagline: "Bronze-locked. Every signing hurts.",
    description:
      "Money is tight from the first week. Survival is an achievement — the climb is the game.",
    icon: Sprout,
  },
  {
    value: "established",
    label: "Established",
    tagline: "Competing in Silver/Gold from day one.",
    description:
      "Comfortable but not rich. The job is running a business well, not surviving.",
    icon: Building2,
  },
];

export function DifficultyPicker({
  value,
  onChange,
  accentClassName = "border-secondary/60 bg-secondary/10",
}: {
  value: CareerDifficulty | null;
  onChange: (d: CareerDifficulty) => void;
  accentClassName?: string;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {DIFFICULTY_OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "text-left rounded-xl border p-4 transition-all hover:bg-white/8",
              selected ? accentClassName : "border-white/10 bg-white/5",
            )}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <Icon className="h-4 w-4 text-white/70" />
              <span className="font-black text-sm text-white">{opt.label}</span>
              {selected && <Check className="ml-auto h-3.5 w-3.5 text-white" />}
            </div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-white/40 mb-1">{opt.tagline}</p>
            <p className="text-xs text-white/55 leading-relaxed">{opt.description}</p>
          </button>
        );
      })}
    </div>
  );
}
