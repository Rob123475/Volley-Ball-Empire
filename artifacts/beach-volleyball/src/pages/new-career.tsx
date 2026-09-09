import {
  CONTINENTS,
  CONTINENT_COUNT,
  continentLabel,
  isContinentKey,
  type ContinentKey,
} from "@shared/continents";
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
import { careerSlotStatus } from "@/lib/career-slot-status";
import { cn } from "@/lib/utils";
import {
  NATIONALITIES,
  ColorPicker,
  ShapePicker,
  NationalityPicker,
  DifficultyPicker,
  type CareerDifficulty,
} from "@/components/career/career-wizard-fields";
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

// ── Continent helpers ─────────────────────────────────────────────────────────

type ContinentStyle = { emoji: string; colour: string };

/**
 * Presentation only, keyed by the canonical KEY. This file is the live career
 * creation flow (the title screen's START NEW CAREER lands here) and it carried
 * its own copy of the continent vocabulary spelled "Oceania"/"Africa". The
 * database said otherwise, the render below skipped anything it could not
 * match, and three Oceania clubs never appeared. Record<ContinentKey, …> makes
 * that a compile error.
 */
const CONTINENT_STYLE: Record<ContinentKey, ContinentStyle> = {
  north_america:      { emoji: "🌎", colour: "text-sky-400"    },
  south_america:      { emoji: "🌎", colour: "text-amber-400"  },
  europe:             { emoji: "🌍", colour: "text-indigo-400" },
  asia:               { emoji: "🌏", colour: "text-rose-400"   },
  oceania:            { emoji: "🌏", colour: "text-teal-400"   },
  africa_middle_east: { emoji: "🌍", colour: "text-orange-400" },
};

const UNRECOGNISED_STYLE: ContinentStyle = { emoji: "⚠️", colour: "text-red-300" };

const styleFor = (key: string): ContinentStyle =>
  isContinentKey(key) ? CONTINENT_STYLE[key] : UNRECOGNISED_STYLE;

function formatBudget(v: string | null | undefined) {
  if (!v) return "—";
  const n = parseFloat(v);
  if (isNaN(n)) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ContinentGroup({
  label,
  meta,
  warning,
  clubs,
  selectedId,
  onSelect,
  defaultOpen,
}: {
  label: string;
  meta: ContinentStyle;
  warning?: string;
  clubs: ClubTemplate[];
  selectedId: number | null;
  onSelect: (c: ClubTemplate) => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);


  return (
    <div className="rounded-xl border border-white/8 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-white/3 hover:bg-white/6 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">{meta.emoji}</span>
          <span className={cn("text-xs font-black uppercase tracking-widest", meta.colour)}>{label}</span>
          <span className="text-xs text-white/30">({clubs.length})</span>
        </div>
        {open ? <ChevronDown className="h-3.5 w-3.5 text-white/30" /> : <ChevronRight className="h-3.5 w-3.5 text-white/30" />}
      </button>
      {warning && (
        <p className="px-4 pb-2 pt-1 text-[11px] text-red-300/90 leading-relaxed">{warning}</p>
      )}
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
                <div className="text-[11px] text-white/40">{continentLabel(c.continent)} · Rating {c.rating} · {formatBudget(c.startingBudget)} budget</div>
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
  const teamQuery = useGetMyTeam({
    query: { queryKey: getGetMyTeamQueryKey(), enabled: !!user, retry: false },
  });
  const { data: team, isLoading: teamLoading, refetch: refetchTeam } = teamQuery;
  // Only a 404 proves the slot is free. If the check itself failed we must not
  // let the wizard run — POST /careers would overwrite an existing save.
  const slot = careerSlotStatus(teamQuery);

  const [step, setStep]               = useState<1 | 2 | 3>(1);
  const [managerName, setManagerName] = useState("");
  const [nationality, setNationality] = useState("");
  const [difficulty, setDifficulty]   = useState<CareerDifficulty | null>(null);
  const [selectedClub, setSelectedClub]     = useState<ClubTemplate | null>(null);
  const [customClubName, setCustomClubName] = useState("");
  const [primaryColor, setPrimaryColor]     = useState("#E05A00");
  const [secondaryColor, setSecondaryColor] = useState("#FFFFFF");
  const [shapeIndex, setShapeIndex]         = useState(0);

  const upsertMutation = useUpsertCareerSave();

  const { data: templatesData, isLoading: loadingClubs } = useListClubTemplates({
    query: { queryKey: getListClubTemplatesQueryKey() },
  });

  /**
   * Total partition: every club lands in exactly one bucket, so nothing can be
   * dropped by failing to match. See career-management.tsx — same fix, and the
   * fact that this logic existed twice is why fixing it once was not enough.
   */
  const { groups, unrecognised, allClubs } = useMemo(() => {
    const all = templatesData?.clubs ?? [];
    const byKey = new Map<ContinentKey, ClubTemplate[]>();
    const strays: ClubTemplate[] = [];
    for (const c of all) {
      if (isContinentKey(c.continent)) {
        const list = byKey.get(c.continent);
        if (list) list.push(c); else byKey.set(c.continent, [c]);
      } else {
        strays.push(c);
      }
    }
    const ordered = CONTINENTS
      .map(({ key, label }) => ({ key, label, clubs: byKey.get(key) ?? [] }))
      .filter(g => g.clubs.length > 0);
    return { groups: ordered, unrecognised: strays, allClubs: all };
  }, [templatesData]);

  const selectedNat = NATIONALITIES.find(n => n.name === nationality);

  const canStep1 = managerName.trim().length > 0 && nationality.length > 0 && difficulty !== null;
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
    if (!selectedClub || !difficulty) return;
    const clubName = customClubName.trim() || selectedClub.name;
    upsertMutation.mutate(
      {
        data: {
          slotNumber:          1,
          managerName:         managerName.trim(),
          managerNationality:  nationality || null,
          clubName,
          originalClubName:    selectedClub.name,
          // R-11: starting budget is now decided server-side from difficulty,
          // not the club's own startingBudget — see careerDifficulty.ts. This
          // field is still sent as the club's figure for older/other callers,
          // but POST /careers overrides it once `difficulty` is present.
          budget:              selectedClub.startingBudget,
          difficulty,
          primaryColor,
          secondaryColor,
          crestShapeIndex:     shapeIndex,
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

  // The slot check failed, so we cannot tell whether a career is already
  // there. Refuse to start one rather than risk overwriting a real save.
  if (slot === "unknown") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
        <div className="max-w-sm w-full rounded-2xl border border-white/10 bg-white/3 p-8 text-center space-y-5">
          <div className="text-4xl">📡</div>
          <div>
            <h2 className="text-lg font-black text-white">Could not check your save slots</h2>
            <p className="mt-2 text-sm text-white/50">
              Starting a new career now could overwrite an existing one, so it
              has been blocked. Try again, or restart the game.
            </p>
          </div>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => { refetchTeam(); }}
              className="w-full rounded-xl bg-secondary hover:bg-secondary/90 py-3 text-sm font-black text-white transition-all shadow-[0_0_20px_rgba(244,162,97,0.3)]"
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={() => { window.location.href = "/"; }}
              className="w-full rounded-xl border border-white/10 py-3 text-sm font-bold text-white/60 hover:text-white transition-all"
            >
              Back to Title
            </button>
          </div>
        </div>
      </div>
    );
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
                    autoComplete="off"
                    value={managerName}
                    onChange={e => setManagerName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && canStep1 && setStep(2)}
                    placeholder="e.g. Sarah Mitchell"
                    maxLength={100}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-secondary/60 focus:ring-1 focus:ring-secondary/30 transition-all"
                  />
                </div>

                {/* Nationality */}
                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-white/40 mb-1.5">
                    <Globe className="h-3 w-3" /> Nationality
                  </label>
                  <NationalityPicker
                    value={nationality}
                    onChange={setNationality}
                    accentClassName="bg-secondary/15 text-secondary"
                  />
                </div>

                {/* Difficulty (R-11) */}
                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-white/40 mb-1.5">
                    <Trophy className="h-3 w-3" /> Career Difficulty
                  </label>
                  <DifficultyPicker
                    value={difficulty}
                    onChange={setDifficulty}
                    accentClassName="border-secondary/60 bg-secondary/10"
                  />
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
                    <div className="text-[11px] text-white/45">{continentLabel(selectedClub.continent)} · Rating {selectedClub.rating} · {formatBudget(selectedClub.startingBudget)} budget</div>
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
                  <>
                    <div className="flex items-center justify-between px-1 pb-1">
                      <span className="text-[11px] text-white/35">
                        {allClubs.length} club{allClubs.length === 1 ? "" : "s"} · {groups.length} of {CONTINENT_COUNT} regions
                      </span>
                    </div>

                    {groups.map(({ key, label, clubs }) => (
                      <ContinentGroup
                        key={key}
                        label={label}
                        meta={CONTINENT_STYLE[key]}
                        clubs={clubs}
                        selectedId={selectedClub?.id ?? null}
                        onSelect={c => setSelectedClub(c)}
                        defaultOpen={selectedClub?.continent === key}
                      />
                    ))}

                    {/* Never silently dropped — see career-management.tsx. */}
                    {unrecognised.length > 0 && (
                      <ContinentGroup
                        label="Unrecognised region"
                        meta={UNRECOGNISED_STYLE}
                        warning={
                          `${unrecognised.length} club${unrecognised.length === 1 ? " carries a continent" : "s carry continents"} ` +
                          `outside the canonical six: ` +
                          `${[...new Set(unrecognised.map(c => c.continent ?? "(none)"))].join(", ")}. ` +
                          `Still playable — but the data needs fixing.`
                        }
                        clubs={unrecognised}
                        selectedId={selectedClub?.id ?? null}
                        onSelect={c => setSelectedClub(c)}
                        defaultOpen
                      />
                    )}
                  </>
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
                  <ShapePicker
                    primaryColor={primaryColor}
                    secondaryColor={secondaryColor}
                    value={shapeIndex}
                    onChange={setShapeIndex}
                  />
                </div>

                {/* Right: preview */}
                <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-white/3 p-8">
                  <ClubCrest
                    name={customClubName.trim() || selectedClub.name}
                    primaryColor={primaryColor}
                    secondaryColor={secondaryColor}
                    shapeIndex={shapeIndex}
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
