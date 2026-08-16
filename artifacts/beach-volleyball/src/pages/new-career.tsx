import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  useGetCurrentAuthUser,
  useGetMyTeam,
  getGetMyTeamQueryKey,
  useUpsertCareerSave,
  useListClubTemplates,
  getListClubTemplatesQueryKey,
} from "@workspace/api-client-react";
import { ClubCrest } from "@/components/club-crest";
import { cn } from "@/lib/utils";
import {
  Loader2,
  User,
  Globe,
  Trophy,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  Play,
  Check,
} from "lucide-react";

type ClubTemplate = import("@workspace/api-client-react").ClubTemplate;

// ── Nationality list ─────────────────────────────────────────────────────────

const NATIONALITIES = [
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

// ── Colour presets ────────────────────────────────────────────────────────────

const COLOR_PRESETS = [
  "#E05A00", "#CC0000", "#0044CC", "#008800",
  "#6600CC", "#CC9900", "#AA0044", "#004488",
  "#44AAFF", "#44CC88", "#FF88CC", "#FFEE44",
  "#222222", "#666666", "#AAAAAA", "#FFFFFF",
];

// ── Continent helpers ─────────────────────────────────────────────────────────

const CONTINENT_ORDER = [
  "North America", "South America", "Europe", "Asia", "Oceania", "Africa",
];

const CONTINENT_META: Record<string, { emoji: string; colour: string }> = {
  "North America": { emoji: "🌎", colour: "text-sky-400"    },
  "South America": { emoji: "🌎", colour: "text-amber-400"  },
  "Europe":        { emoji: "🌍", colour: "text-indigo-400" },
  "Asia":          { emoji: "🌏", colour: "text-rose-400"   },
  "Oceania":       { emoji: "🌏", colour: "text-teal-400"   },
  "Africa":        { emoji: "🌍", colour: "text-orange-400" },
};

function formatBudget(v: string | null | undefined) {
  if (!v) return "—";
  const n = parseFloat(v);
  if (isNaN(n)) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ColorSwatch({
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

function ColorPicker({
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

function ContinentGroup({
  continent,
  clubs,
  selectedId,
  onSelect,
  defaultOpen,
}: {
  continent: string;
  clubs: ClubTemplate[];
  selectedId: number | null;
  onSelect: (c: ClubTemplate) => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const meta = CONTINENT_META[continent] ?? { emoji: "🌍", colour: "text-white" };

  return (
    <div className="rounded-xl border border-white/8 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-white/3 hover:bg-white/6 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">{meta.emoji}</span>
          <span className={cn("text-xs font-black uppercase tracking-widest", meta.colour)}>{continent}</span>
          <span className="text-xs text-white/30">({clubs.length})</span>
        </div>
        {open ? <ChevronDown className="h-3.5 w-3.5 text-white/30" /> : <ChevronRight className="h-3.5 w-3.5 text-white/30" />}
      </button>
      {open && (
        <div className="divide-y divide-white/5">
          {clubs.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                selectedId === c.id
                  ? "bg-secondary/15 border-l-2 border-secondary"
                  : "hover:bg-white/4",
              )}
            >
              <div className="shrink-0">
                <ClubCrest name={c.name} primaryColor={c.primaryColor} secondaryColor={c.secondaryColor} size={32} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-black text-white truncate">{c.name}</div>
                <div className="text-[11px] text-white/40">{c.continent} · Rating {c.rating} · {formatBudget(c.startingBudget)} budget</div>
              </div>
              {selectedId === c.id && <Check className="h-4 w-4 text-secondary shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Step progress bar ─────────────────────────────────────────────────────────

const STEPS = ["Manager", "Club", "Customise"];

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className={cn("flex items-center gap-1.5")}>
            <div className={cn(
              "h-6 w-6 rounded-full flex items-center justify-center text-xs font-black transition-all",
              i + 1 < current ? "bg-secondary text-white" :
              i + 1 === current ? "bg-secondary text-white ring-2 ring-secondary/40" :
              "bg-white/10 text-white/30",
            )}>
              {i + 1 < current ? <Check className="h-3 w-3" /> : i + 1}
            </div>
            <span className={cn(
              "text-xs font-bold hidden sm:block",
              i + 1 === current ? "text-white" : "text-white/30",
            )}>{label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={cn("h-px w-6 sm:w-10 transition-all", i + 1 < current ? "bg-secondary" : "bg-white/15")} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NewCareer() {
  const [, navigate]   = useLocation();
  const { data: user, isLoading: authLoading } = useGetCurrentAuthUser();
  const { data: team, isLoading: teamLoading } = useGetMyTeam({
    query: { queryKey: getGetMyTeamQueryKey(), enabled: !!user, retry: false },
  });

  const [step, setStep]               = useState<1 | 2 | 3>(1);
  const [managerName, setManagerName] = useState("");
  const [nationality, setNationality] = useState("");
  const [natSearch, setNatSearch]     = useState("");
  const [natOpen, setNatOpen]         = useState(false);
  const [selectedClub, setSelectedClub]     = useState<ClubTemplate | null>(null);
  const [customClubName, setCustomClubName] = useState("");
  const [primaryColor, setPrimaryColor]     = useState("#E05A00");
  const [secondaryColor, setSecondaryColor] = useState("#FFFFFF");

  const upsertMutation = useUpsertCareerSave();

  const { data: templatesData, isLoading: loadingClubs } = useListClubTemplates({
    query: { queryKey: getListClubTemplatesQueryKey() },
  });

  const grouped = useMemo(() => {
    const clubs = templatesData?.clubs ?? [];
    const map = new Map<string, ClubTemplate[]>();
    for (const c of clubs) {
      if (!map.has(c.continent)) map.set(c.continent, []);
      map.get(c.continent)!.push(c);
    }
    return map;
  }, [templatesData]);

  const filteredNats = NATIONALITIES.filter(n =>
    n.name.toLowerCase().includes(natSearch.toLowerCase()),
  );
  const selectedNat = NATIONALITIES.find(n => n.name === nationality);

  const canStep1 = managerName.trim().length > 0 && nationality.length > 0;
  const canStep2 = selectedClub !== null;

  const advanceToStep3 = () => {
    if (selectedClub) {
      setCustomClubName(prev => prev || selectedClub.name);
      setPrimaryColor(selectedClub.primaryColor ?? "#E05A00");
      setSecondaryColor(selectedClub.secondaryColor ?? "#FFFFFF");
    }
    setStep(3);
  };

  const handleSubmit = () => {
    if (!selectedClub) return;
    const clubName = customClubName.trim() || selectedClub.name;
    upsertMutation.mutate(
      {
        data: {
          slotNumber:          1,
          managerName:         managerName.trim(),
          managerNationality:  nationality || null,
          clubName,
          originalClubName:    selectedClub.name,
          budget:              selectedClub.startingBudget,
          primaryColor,
          secondaryColor,
        },
      },
      {
        onSuccess: () => {
          window.location.href = "/";
        },
      },
    );
  };

  const handleCancel = () => {
    sessionStorage.removeItem("bvp-title-dismissed");
    window.location.href = "/";
  };

  if (authLoading || (!!user && teamLoading)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  if (!user) {
    window.location.href = "/login";
    return null;
  }

  // Occupied-slot guard: if an active career already exists, do not allow
  // the user to accidentally start a new one. Show options instead.
  if (team) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
        <div className="max-w-sm w-full rounded-2xl border border-white/10 bg-white/3 p-8 text-center space-y-5">
          <div className="text-4xl">🏖️</div>
          <div>
            <h2 className="text-lg font-black text-white">Career Already Active</h2>
            <p className="mt-2 text-sm text-white/50">
              A career already exists in Save Slot 1. Continue it, or retire your current career first before starting a new one.
            </p>
          </div>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => { window.location.href = "/"; }}
              className="w-full rounded-xl bg-secondary hover:bg-secondary/90 py-3 text-sm font-black text-white transition-all shadow-[0_0_20px_rgba(244,162,97,0.3)]"
            >
              Continue Existing Career
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="w-full rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-bold text-white/60 hover:bg-white/10 transition-all"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="border-b border-white/8 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleCancel}
            className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="h-4 w-px bg-white/10" />
          <span className="text-sm font-black text-white uppercase tracking-widest">New Career</span>
        </div>
        <StepBar current={step} />
      </div>

      {/* Body */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">

          {/* ── Step 1: Manager Profile ── */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-black text-white">Manager Profile</h2>
                <p className="text-sm text-white/40 mt-1">Enter your details to begin your career.</p>
              </div>

              <div className="space-y-5 rounded-2xl border border-white/10 bg-white/3 p-6">
                {/* Manager name */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-white/40">
                    <User className="h-3 w-3" /> Manager Name
                  </label>
                  <input
                    autoFocus
                    value={managerName}
                    onChange={e => setManagerName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && canStep1 && setStep(2)}
                    placeholder="e.g. Sarah Mitchell"
                    maxLength={100}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-secondary/60 focus:ring-1 focus:ring-secondary/30 transition-all"
                  />
                </div>

                {/* Nationality */}
                <div className="space-y-1.5 relative">
                  <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-white/40">
                    <Globe className="h-3 w-3" /> Nationality
                  </label>
                  <button
                    type="button"
                    onClick={() => { setNatOpen(o => !o); setNatSearch(""); }}
                    className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white hover:bg-white/8 transition-all"
                  >
                    {selectedNat ? (
                      <span className="flex items-center gap-2">
                        <span className="text-lg leading-none">{selectedNat.flag}</span>
                        <span className="font-semibold">{selectedNat.name}</span>
                      </span>
                    ) : (
                      <span className="text-white/30">Select your nationality…</span>
                    )}
                    <ChevronDown className={cn("h-4 w-4 text-white/30 transition-transform", natOpen && "rotate-180")} />
                  </button>

                  {natOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl border border-white/10 bg-slate-900 shadow-2xl overflow-hidden">
                      <div className="p-2 border-b border-white/8">
                        <input
                          autoFocus
                          value={natSearch}
                          onChange={e => setNatSearch(e.target.value)}
                          placeholder="Search…"
                          className="w-full rounded-lg bg-white/5 px-3 py-1.5 text-sm text-white placeholder-white/30 outline-none focus:bg-white/8"
                        />
                      </div>
                      <div className="max-h-56 overflow-y-auto py-1">
                        {filteredNats.map(n => (
                          <button
                            key={n.name}
                            type="button"
                            onClick={() => { setNationality(n.name); setNatOpen(false); }}
                            className={cn(
                              "w-full flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-white/8 transition-colors",
                              nationality === n.name && "bg-secondary/15 text-secondary",
                            )}
                          >
                            <span className="text-lg leading-none">{n.flag}</span>
                            <span className={nationality === n.name ? "font-bold" : "text-white"}>{n.name}</span>
                            {nationality === n.name && <Check className="ml-auto h-3.5 w-3.5" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-6 py-3 rounded-xl border border-white/10 bg-white/5 text-sm font-bold text-white/60 hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!canStep1}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-secondary hover:bg-secondary/90 py-3 text-sm font-black text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Choose Club <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Choose Club ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setStep(1)} className="text-white/40 hover:text-white transition-colors">
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                  <h2 className="text-2xl font-black text-white">Choose Your Club</h2>
                  <p className="text-sm text-white/40 mt-0.5">
                    {selectedNat?.flag} {managerName} · Select the club you'll manage.
                  </p>
                </div>
              </div>

              {selectedClub && (
                <div className="rounded-xl border border-secondary/25 bg-secondary/8 px-4 py-3 flex items-center gap-3">
                  <ClubCrest name={selectedClub.name} primaryColor={selectedClub.primaryColor} secondaryColor={selectedClub.secondaryColor} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-black text-white">{selectedClub.name}</div>
                    <div className="text-[11px] text-white/45">{selectedClub.continent} · Rating {selectedClub.rating} · {formatBudget(selectedClub.startingBudget)} budget</div>
                  </div>
                  <Check className="h-4 w-4 text-secondary shrink-0" />
                </div>
              )}

              <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1">
                {loadingClubs ? (
                  <div className="flex items-center justify-center py-16 gap-3 text-white/40">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm">Loading clubs…</span>
                  </div>
                ) : (
                  CONTINENT_ORDER.map(continent => {
                    const clubs = grouped.get(continent);
                    if (!clubs?.length) return null;
                    return (
                      <ContinentGroup
                        key={continent}
                        continent={continent}
                        clubs={clubs}
                        selectedId={selectedClub?.id ?? null}
                        onSelect={c => setSelectedClub(c)}
                        defaultOpen={selectedClub?.continent === continent}
                      />
                    );
                  })
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-6 py-3 rounded-xl border border-white/10 bg-white/5 text-sm font-bold text-white/60 hover:bg-white/10 transition-all flex items-center gap-1.5"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <button
                  type="button"
                  onClick={advanceToStep3}
                  disabled={!canStep2}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-secondary hover:bg-secondary/90 py-3 text-sm font-black text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Customise <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Customise ── */}
          {step === 3 && selectedClub && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setStep(2)} className="text-white/40 hover:text-white transition-colors">
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                  <h2 className="text-2xl font-black text-white">Customise Your Club</h2>
                  <p className="text-sm text-white/40 mt-0.5">Set your club name and colours.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left: inputs */}
                <div className="space-y-5 rounded-2xl border border-white/10 bg-white/3 p-5">
                  {/* Club name */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-white/40">
                      <Trophy className="h-3 w-3" /> Club Name
                    </label>
                    <input
                      autoFocus
                      value={customClubName}
                      onChange={e => setCustomClubName(e.target.value)}
                      placeholder={selectedClub.name}
                      maxLength={100}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-secondary/60 focus:ring-1 focus:ring-secondary/30 transition-all"
                    />
                  </div>

                  <ColorPicker label="Primary Colour" value={primaryColor} onChange={setPrimaryColor} />
                  <ColorPicker label="Secondary Colour" value={secondaryColor} onChange={setSecondaryColor} />
                </div>

                {/* Right: preview */}
                <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-white/3 p-8">
                  <ClubCrest
                    name={customClubName.trim() || selectedClub.name}
                    primaryColor={primaryColor}
                    secondaryColor={secondaryColor}
                    size={80}
                  />
                  <div className="text-center">
                    <div className="text-base font-black text-white">{customClubName.trim() || selectedClub.name}</div>
                    {customClubName.trim() && customClubName.trim() !== selectedClub.name && (
                      <div className="text-xs text-white/40 mt-0.5">Based on {selectedClub.name}</div>
                    )}
                    <div className="mt-2 flex items-center justify-center gap-2">
                      <div className="h-3 w-3 rounded-full border border-white/20" style={{ backgroundColor: primaryColor }} />
                      <div className="h-3 w-3 rounded-full border border-white/20" style={{ backgroundColor: secondaryColor }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={upsertMutation.isPending}
                  className="px-6 py-3 rounded-xl border border-white/10 bg-white/5 text-sm font-bold text-white/60 hover:bg-white/10 transition-all flex items-center gap-1.5"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={upsertMutation.isPending || !customClubName.trim() && !selectedClub?.name}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-secondary hover:bg-secondary/90 py-3 text-sm font-black text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(244,162,97,0.3)]"
                >
                  {upsertMutation.isPending
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Starting Career…</>
                    : <><Play className="h-4 w-4 fill-white" /> Start Career</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
