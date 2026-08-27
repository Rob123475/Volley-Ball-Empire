import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { ClubCrest } from "@/components/club-crest";
import {
  useListCareerSaves,
  getListCareerSavesQueryKey,
  useUpsertCareerSave,
  useDeleteCareerSave,
  useLoadCareerSave,
  useListClubTemplates,
  getListClubTemplatesQueryKey,
} from "@workspace/api-client-react";
import { RetireModal } from "@/components/career/RetireModal";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Save,
  Trash2,
  PlusCircle,
  Play,
  Trophy,
  Globe,
  DollarSign,
  CalendarDays,
  User,
  Loader2,
  AlertTriangle,
  ArrowLeft,
  Star,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  XCircle,
  Zap,
} from "lucide-react";

type SaveSlot      = import("@workspace/api-client-react").CareerSaveSlot;
type ClubTemplate  = import("@workspace/api-client-react").ClubTemplate;

const SLOT_NUMBERS = [1, 2, 3] as const;

function formatBudget(budget: string | null | undefined): string {
  if (!budget) return "—";
  const n = parseFloat(budget);
  if (isNaN(n)) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// ── Continent config ─────────────────────────────────────────────────────────

const CONTINENT_META: Record<string, { emoji: string; color: string; bg: string; border: string; ring: string }> = {
  "Europe":        { emoji: "🌍", color: "text-blue-300",    bg: "bg-blue-500/10",    border: "border-blue-500/25",    ring: "ring-blue-500/50"    },
  "Asia":          { emoji: "🌏", color: "text-amber-300",   bg: "bg-amber-500/10",   border: "border-amber-500/25",   ring: "ring-amber-500/50"   },
  "Africa":        { emoji: "🌍", color: "text-orange-300",  bg: "bg-orange-500/10",  border: "border-orange-500/25",  ring: "ring-orange-500/50"  },
  "North America": { emoji: "🌎", color: "text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-500/25", ring: "ring-emerald-500/50" },
  "South America": { emoji: "🌎", color: "text-green-300",   bg: "bg-green-500/10",   border: "border-green-500/25",   ring: "ring-green-500/50"   },
  "Oceania":       { emoji: "🌊", color: "text-cyan-300",    bg: "bg-cyan-500/10",    border: "border-cyan-500/25",    ring: "ring-cyan-500/50"    },
};

const CONTINENT_ORDER = ["Europe", "Asia", "Africa", "North America", "South America", "Oceania"];

// ── Rating bar ────────────────────────────────────────────────────────────────

function RatingBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className={cn("h-full rounded-full", color)}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-[10px] font-black tabular-nums text-white/60 w-6 text-right">{value}</span>
    </div>
  );
}

// ── Club card ─────────────────────────────────────────────────────────────────

function ClubCard({
  club,
  selected,
  onSelect,
}: {
  club: ClubTemplate;
  selected: boolean;
  onSelect: () => void;
}) {
  const meta = CONTINENT_META[club.continent] ?? CONTINENT_META["Europe"];

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full text-left rounded-xl border p-3.5 transition-all focus:outline-none",
        selected
          ? `${meta.bg} ${meta.border} ring-2 ${meta.ring}`
          : "border-white/8 bg-white/3 hover:bg-white/6 hover:border-white/15",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {selected && <CheckCircle2 className={cn("h-3.5 w-3.5 shrink-0", meta.color)} />}
            <span className="text-sm font-black text-white leading-tight truncate">{club.name}</span>
          </div>

          {/* Stats */}
          <div className="mt-2 space-y-1.5">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-white/30 mb-0.5">Rating</div>
              <RatingBar value={club.rating} color={selected ? meta.color.replace("text-", "bg-") : "bg-white/40"} />
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-white/30 mb-0.5">Reputation</div>
              <RatingBar value={club.reputation} color={selected ? meta.color.replace("text-", "bg-") : "bg-white/30"} />
            </div>
          </div>
        </div>

        {/* Budget badge */}
        <div className={cn(
          "shrink-0 rounded-lg px-2 py-1 text-center border",
          selected ? `${meta.bg} ${meta.border}` : "bg-white/5 border-white/10",
        )}>
          <div className="text-[9px] font-bold uppercase tracking-wide text-white/35">Budget</div>
          <div className={cn("text-xs font-black", selected ? "text-emerald-400" : "text-white/60")}>
            {formatBudget(club.startingBudget)}
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Continent group ────────────────────────────────────────────────────────────

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
  const meta = CONTINENT_META[continent] ?? CONTINENT_META["Europe"];
  const [open, setOpen] = useState(defaultOpen);
  const hasSelection = clubs.some(c => c.id === selectedId);

  return (
    <div className="rounded-xl border border-white/8 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3 transition-all",
          open ? "bg-white/6" : "bg-white/3 hover:bg-white/5",
        )}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-lg leading-none">{meta.emoji}</span>
          <span className={cn("text-sm font-black", meta.color)}>{continent}</span>
          <span className="text-[10px] text-white/30 font-semibold">{clubs.length} clubs</span>
          {hasSelection && (
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black border", meta.bg, meta.border, meta.color)}>
              <CheckCircle2 className="h-2.5 w-2.5" /> Selected
            </span>
          )}
        </div>
        {open
          ? <ChevronDown className="h-4 w-4 text-white/30" />
          : <ChevronRight className="h-4 w-4 text-white/30" />
        }
      </button>

      {open && (
        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-white/6">
          {clubs.map(c => (
            <ClubCard
              key={c.id}
              club={c}
              selected={c.id === selectedId}
              onSelect={() => onSelect(c)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── New Career Modal (3-step) ─────────────────────────────────────────────────

interface NewCareerModalProps {
  slotNumber: number;
  onClose: () => void;
  onSave: (data: {
    slotNumber:       number;
    managerName:      string;
    clubName:         string;
    originalClubName: string;
    budget:           string;
    primaryColor?:    string;
    secondaryColor?:  string;
  }) => void;
  isSaving: boolean;
}

function NewCareerModal({ slotNumber, onClose, onSave, isSaving }: NewCareerModalProps) {
  const [step, setStep]                   = useState<1 | 2 | 3>(1);
  const [managerName, setManagerName]     = useState("");
  const [selectedClub, setSelectedClub]   = useState<ClubTemplate | null>(null);
  const [customClubName, setCustomClubName] = useState("");

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

  // Pre-fill club name when club is selected and we advance to step 3
  const goToStep3 = () => {
    if (!customClubName && selectedClub) setCustomClubName(selectedClub.name);
    else if (selectedClub && customClubName === "") setCustomClubName(selectedClub.name);
    setStep(3);
  };

  const canProceedStep1  = managerName.trim().length > 0;
  const canProceedStep2  = selectedClub !== null;
  const displayClubName  = customClubName.trim() || selectedClub?.name || "";
  const canSave          = canProceedStep1 && canProceedStep2 && displayClubName.length > 0;

  const isCustomised     = selectedClub !== null && customClubName.trim() !== "" && customClubName.trim() !== selectedClub.name;

  // One payload for both the Enter-key and the click path. They used to be
  // written out separately and had drifted: the Enter path omitted the club
  // colours, so pressing Enter instead of clicking silently discarded the
  // player's colour choice. Both fields are optional, so it typechecked.
  const buildSavePayload = (club: NonNullable<typeof selectedClub>) => ({
    slotNumber,
    managerName:      managerName.trim(),
    clubName:         customClubName.trim() || club.name,
    originalClubName: club.name,
    budget:           club.startingBudget,
    primaryColor:     club.primaryColor,
    secondaryColor:   club.secondaryColor,
  });

  const STEP_LABELS: Record<number, string> = {
    1: "Step 1 of 3 — Your manager name",
    2: "Step 2 of 3 — Select your club",
    3: "Step 3 of 3 — Name your club",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-900 shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-white/8 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                <Save className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <h2 className="text-base font-black text-white">New Career — Slot {slotNumber}</h2>
                <p className="text-[11px] text-white/45 mt-0.5">{STEP_LABELS[step]}</p>
              </div>
            </div>
            {/* Step dots */}
            <div className="flex items-center gap-1.5">
              {[1, 2, 3].map(s => (
                <div key={s} className={cn("h-2 w-2 rounded-full transition-all", step >= s ? "bg-violet-500" : "bg-white/15")} />
              ))}
            </div>
          </div>

          {/* Context pills for steps 2 and 3 */}
          {step >= 2 && (
            <div className="mt-3 flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/4 px-3 py-1.5">
                <User className="h-3 w-3 text-white/35 shrink-0" />
                <span className="text-xs font-bold text-white/80">{managerName}</span>
                <button type="button" onClick={() => setStep(1)} className="text-[10px] font-bold text-violet-400 hover:text-violet-300 ml-1">Edit</button>
              </div>
              {step === 3 && selectedClub && (
                <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/4 px-3 py-1.5 min-w-0">
                  <Trophy className="h-3 w-3 text-amber-400/70 shrink-0" />
                  <span className="text-xs font-bold text-white/80 truncate">{selectedClub.name}</span>
                  <button type="button" onClick={() => setStep(2)} className="text-[10px] font-bold text-violet-400 hover:text-violet-300 ml-1">Edit</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Step 1: Manager Name ── */}
          {step === 1 && (
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-white/40">Manager Name</label>
                <input
                  autoFocus
                  value={managerName}
                  onChange={e => setManagerName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && canProceedStep1 && setStep(2)}
                  placeholder="e.g. Sarah Mitchell"
                  maxLength={100}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all"
                />
              </div>
              <p className="text-xs text-white/35">
                This is the name that will appear on your manager profile throughout the game.
              </p>
            </div>
          )}

          {/* ── Step 2: Club Selection ── */}
          {step === 2 && (
            <div className="p-4 space-y-2.5">
              {loadingClubs ? (
                <div className="flex items-center justify-center py-16 gap-3 text-white/40">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Loading clubs…</span>
                </div>
              ) : (
                <>
                  {selectedClub && (
                    <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-4 py-3 flex items-center gap-3 mb-1">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-black text-white truncate">{selectedClub.name}</div>
                        <div className="text-[11px] text-white/45">{selectedClub.continent} · Rating {selectedClub.rating} · {formatBudget(selectedClub.startingBudget)} budget</div>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    {CONTINENT_ORDER.map(continent => {
                      const clubs = grouped.get(continent);
                      if (!clubs || clubs.length === 0) return null;
                      const isSelectedContinent = selectedClub?.continent === continent;
                      return (
                        <ContinentGroup
                          key={continent}
                          continent={continent}
                          clubs={clubs}
                          selectedId={selectedClub?.id ?? null}
                          onSelect={c => { setSelectedClub(c); setCustomClubName(c.name); }}
                          defaultOpen={isSelectedContinent}
                        />
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Step 3: Club Name ── */}
          {step === 3 && selectedClub && (
            <div className="p-6 space-y-5">

              {/* Selected club summary */}
              <div className="rounded-xl border border-white/8 bg-white/4 px-4 py-3 flex items-center gap-3">
                <div className="text-2xl leading-none">{CONTINENT_META[selectedClub.continent]?.emoji ?? "🏐"}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-black text-white truncate">{selectedClub.name}</div>
                  <div className="text-[11px] text-white/40">{selectedClub.continent} · Rating {selectedClub.rating} · Rep {selectedClub.reputation}</div>
                </div>
                <div className="text-sm font-black text-emerald-400">{formatBudget(selectedClub.startingBudget)}</div>
              </div>

              {/* Custom name input */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-white/40">Club Name</label>
                <input
                  autoFocus
                  value={customClubName}
                  onChange={e => setCustomClubName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && canSave && !isSaving && selectedClub && onSave(buildSavePayload(selectedClub))}
                  placeholder={selectedClub.name}
                  maxLength={100}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all"
                />
              </div>

              {/* Keep / customise toggle hint */}
              <div className="space-y-2">
                {isCustomised ? (
                  <div className="rounded-xl border border-violet-500/20 bg-violet-500/8 px-4 py-3 space-y-1">
                    <div className="text-[11px] font-bold text-violet-300">Custom name set</div>
                    <div className="text-xs text-white/40">
                      Your club will be known as <span className="font-black text-white">{customClubName.trim()}</span>.
                      The original name <span className="font-semibold text-white/60">{selectedClub.name}</span> is stored for reference.
                    </div>
                    <button
                      type="button"
                      onClick={() => setCustomClubName(selectedClub.name)}
                      className="text-[11px] font-bold text-violet-400 hover:text-violet-300 mt-1"
                    >
                      ← Keep original name
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/8 bg-white/3 px-4 py-3">
                    <div className="text-xs text-white/40">
                      You can rename your club to anything you like — e.g. <span className="font-semibold text-white/60">Rob's AI's</span>.
                      Leave unchanged to keep the original name.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/8 flex gap-3 shrink-0">
          {step === 1 && (
            <>
              <button onClick={onClose} className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-bold text-white/60 hover:bg-white/10 transition-all">
                Cancel
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={!canProceedStep1}
                className="flex-1 rounded-xl bg-violet-600 hover:bg-violet-500 py-2.5 text-sm font-black text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                Choose Club <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <button
                onClick={() => setStep(1)}
                disabled={isSaving}
                className="flex-shrink-0 flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white/60 hover:bg-white/10 transition-all"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <button
                onClick={goToStep3}
                disabled={!canProceedStep2}
                className="flex-1 rounded-xl bg-violet-600 hover:bg-violet-500 py-2.5 text-sm font-black text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                Name Your Club <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}

          {step === 3 && (
            <>
              <button
                onClick={() => setStep(2)}
                disabled={isSaving}
                className="flex-shrink-0 flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white/60 hover:bg-white/10 transition-all"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <button
                onClick={() => selectedClub && onSave(buildSavePayload(selectedClub))}
                disabled={!canSave || isSaving}
                className="flex-1 rounded-xl bg-violet-600 hover:bg-violet-500 py-2.5 text-sm font-black text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {isSaving ? "Creating…" : "Start Career"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirm Modal ──────────────────────────────────────────────────────

interface DeleteConfirmProps {
  save: SaveSlot;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}

function DeleteConfirmModal({ save, onClose, onConfirm, isDeleting }: DeleteConfirmProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-red-500/20 bg-slate-900 shadow-2xl overflow-hidden">
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">Delete this save slot permanently?</h2>
              <p className="text-[11px] text-white/45 mt-0.5">This cannot be undone</p>
            </div>
          </div>

          <div className="rounded-xl border border-white/8 bg-white/4 px-4 py-3">
            <div className="text-sm font-bold text-white">{save.managerName}</div>
            <div className="text-xs text-white/45 mt-0.5">{save.clubName} · {save.season}</div>
          </div>

          <p className="text-sm text-white/50">
            All data in Slot {save.slotNumber} will be removed. Other save slots are not affected.
          </p>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-bold text-white/60 hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 rounded-xl bg-red-600 hover:bg-red-500 py-2.5 text-sm font-black text-white transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {isDeleting ? "Deleting…" : "Delete Slot"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Filled Slot Card ──────────────────────────────────────────────────────────

interface FilledCardProps {
  save: SaveSlot;
  isActive: boolean;
  onLoad: () => void;
  onDelete: () => void;
  onEndCareer: () => void;
}

function FilledSlotCard({ save, isActive, onLoad, onDelete, onEndCareer }: FilledCardProps) {
  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl border bg-gradient-to-br shadow-lg group transition-all",
      isActive
        ? "border-emerald-500/40 from-emerald-950/60 to-slate-900 hover:border-emerald-500/60"
        : "border-white/10 from-slate-800/80 to-slate-900 hover:border-white/20",
    )}>

      {/* Slot badge + Active indicator */}
      <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5">
        {isActive && (
          <div className="flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5">
            <Zap className="h-2.5 w-2.5 text-emerald-400" />
            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Active</span>
          </div>
        )}
        <div className="h-6 w-6 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-[10px] font-black text-violet-400">
          {save.slotNumber}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Manager + club */}
        <div className="flex items-start gap-3 pr-8">
          <ClubCrest
            name={save.originalClubName ?? save.clubName}
            primaryColor={save.primaryColor}
            shapeIndex={save.crestShapeIndex}
            size={48}
            className="shrink-0 mt-0.5 drop-shadow-lg"
          />
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <User className="h-3.5 w-3.5 text-white/35 shrink-0" />
              <span className="text-base font-black text-white leading-tight truncate">{save.managerName}</span>
            </div>
            <div className="flex items-center gap-2">
              <Trophy className="h-3.5 w-3.5 text-amber-400/70 shrink-0" />
              <span className="text-sm font-semibold text-white/70 truncate">{save.clubName}</span>
            </div>
            {/* Show original name when the club has been renamed */}
            {save.originalClubName && save.originalClubName !== save.clubName && (
              <div className="flex items-center gap-1.5 pl-0.5">
                <span className="text-[10px] text-white/30 italic">formerly {save.originalClubName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2.5 space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-white/35">
              <CalendarDays className="h-3 w-3" />
              Season
            </div>
            <div className="text-sm font-black text-white truncate">{save.season}</div>
          </div>

          <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2.5 space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-white/35">
              <Globe className="h-3 w-3" />
              Ranking
            </div>
            <div className={cn("text-sm font-black", save.worldRanking ? "text-white" : "text-white/25")}>
              {save.worldRanking ? `#${save.worldRanking}` : "Unranked"}
            </div>
          </div>

          <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2.5 space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-white/35">
              <DollarSign className="h-3 w-3" />
              Budget
            </div>
            <div className={cn("text-sm font-black", save.budget ? "text-emerald-400" : "text-white/25")}>
              {formatBudget(save.budget)}
            </div>
          </div>

          <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2.5 space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-white/35">
              <CalendarDays className="h-3 w-3" />
              Last Played
            </div>
            <div className="text-[11px] font-bold text-white/60 leading-snug">{formatDate(save.lastPlayedAt)}</div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-1">
          {isActive ? (
            <button
              onClick={onEndCareer}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 py-2.5 text-sm font-black text-orange-400 transition-all"
            >
              <XCircle className="h-4 w-4" />
              End Career
            </button>
          ) : (
            <button
              onClick={onLoad}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 py-2.5 text-sm font-black text-white transition-all"
            >
              <Play className="h-4 w-4" />
              Load Career
            </button>
          )}
          <button
            onClick={onDelete}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/8 hover:bg-red-500/15 py-2 text-xs font-bold text-red-400/70 hover:text-red-400 transition-all"
            title="Delete save slot"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete Save Slot
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Empty Slot Card ───────────────────────────────────────────────────────────

interface EmptyCardProps {
  slotNumber: number;
  onCreate: () => void;
}

function EmptySlotCard({ slotNumber, onCreate }: EmptyCardProps) {
  return (
    <div
      onClick={onCreate}
      className="relative overflow-hidden rounded-2xl border border-dashed border-white/15 bg-transparent cursor-pointer group hover:border-violet-500/40 hover:bg-violet-500/5 transition-all"
    >
      <div className="absolute top-3.5 right-3.5 h-6 w-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-black text-white/30">
        {slotNumber}
      </div>

      <div className="p-5 flex flex-col items-center justify-center gap-3 min-h-[220px]">
        <div className="h-12 w-12 rounded-2xl border border-white/10 bg-white/4 group-hover:bg-violet-500/15 group-hover:border-violet-500/30 flex items-center justify-center transition-all">
          <PlusCircle className="h-6 w-6 text-white/25 group-hover:text-violet-400 transition-all" />
        </div>
        <div className="text-center space-y-1">
          <div className="text-sm font-black text-white/35 group-hover:text-white/70 transition-all">Empty Slot</div>
          <div className="text-[11px] text-white/25 group-hover:text-white/45 transition-all">Click to start a new career</div>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CareerManagement() {
  const queryClient = useQueryClient();
  const { toast }   = useToast();

  const { data, isLoading } = useListCareerSaves({
    query: { queryKey: getListCareerSavesQueryKey() },
  });

  const [, navigate]   = useLocation();
  const upsertMutation = useUpsertCareerSave();
  const deleteMutation = useDeleteCareerSave();
  const loadMutation   = useLoadCareerSave();

  const [newSlot,       setNewSlot]       = useState<number | null>(null);
  const [deleteSlot,    setDeleteSlot]    = useState<SaveSlot | null>(null);
  const [showEndCareer, setShowEndCareer] = useState(false);

  const activeCareerSaveId = data?.activeCareerSaveId ?? null;

  const savesBySlot = new Map<number, SaveSlot>(
    (data?.saves ?? []).map(s => [s.slotNumber, s]),
  );

  const handleCreate = (body: {
    slotNumber:       number;
    managerName:      string;
    clubName:         string;
    originalClubName: string;
    budget:           string;
    primaryColor?:    string;
    secondaryColor?:  string;
  }) => {
    upsertMutation.mutate(
      { data: { slotNumber: body.slotNumber, managerName: body.managerName, clubName: body.clubName, originalClubName: body.originalClubName, budget: body.budget, primaryColor: body.primaryColor, secondaryColor: body.secondaryColor } },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getListCareerSavesQueryKey() });
          setNewSlot(null);
          toast({ title: "Career created", description: `${body.managerName} at ${body.clubName}` });
        },
        onError: () => {
          toast({ title: "Failed to create career", variant: "destructive" });
        },
      },
    );
  };

  const handleDelete = (save: SaveSlot) => {
    deleteMutation.mutate(
      { id: save.id },
      {
        onSuccess: () => {
          setDeleteSlot(null);
          void queryClient.invalidateQueries({ queryKey: getListCareerSavesQueryKey() });
          toast({ title: "Slot cleared", description: `Slot ${save.slotNumber} is now empty` });
        },
        onError: (err) => {
          const raw = err as { response?: { data?: { error?: string } }; message?: string };
          const detail = raw?.response?.data?.error ?? raw?.message ?? "Unknown error";
          console.error("[Delete save slot] failed:", detail, err);
          toast({
            title: "Delete failed",
            description: detail,
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleLoad = (save: SaveSlot) => {
    loadMutation.mutate(
      { id: save.id },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries();
          navigate("/");
        },
        onError: () => {
          toast({ title: "Failed to load career", variant: "destructive" });
        },
      },
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-5 md:p-8 space-y-8">

      {/* Page header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
            <Save className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white leading-none">Career Management</h1>
            <p className="text-sm text-white/45 mt-1">Manage your Volleyball Empire save files</p>
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="rounded-xl border border-sky-500/15 bg-sky-500/8 px-4 py-3 flex items-start gap-3">
        <div className="text-sky-400 mt-0.5 shrink-0">ℹ️</div>
        <p className="text-sm text-white/55">
          You can maintain up to <span className="font-bold text-white/80">3 separate careers</span> simultaneously.
          Each slot tracks its own manager, club, season progression, world ranking, and budget independently.
        </p>
      </div>

      {/* Save slots grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 gap-3 text-white/40">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading save slots…</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SLOT_NUMBERS.map(slot => {
            const save = savesBySlot.get(slot);
            return save ? (
              <FilledSlotCard
                key={slot}
                save={save}
                isActive={save.id === activeCareerSaveId}
                onLoad={() => handleLoad(save)}
                onDelete={() => setDeleteSlot(save)}
                onEndCareer={() => setShowEndCareer(true)}
              />
            ) : (
              <EmptySlotCard
                key={slot}
                slotNumber={slot}
                onCreate={() => setNewSlot(slot)}
              />
            );
          })}
        </div>
      )}

      {/* Modals */}
      {newSlot !== null && (
        <NewCareerModal
          slotNumber={newSlot}
          onClose={() => setNewSlot(null)}
          onSave={handleCreate}
          isSaving={upsertMutation.isPending}
        />
      )}

      {deleteSlot !== null && (
        <DeleteConfirmModal
          save={deleteSlot}
          onClose={() => setDeleteSlot(null)}
          onConfirm={() => handleDelete(deleteSlot)}
          isDeleting={deleteMutation.isPending}
        />
      )}

      {showEndCareer && (
        <RetireModal
          onClose={() => setShowEndCareer(false)}
          onRetired={() => {
            setShowEndCareer(false);
            sessionStorage.removeItem("bvp-title-dismissed");
            window.location.href = "/";
          }}
        />
      )}
    </div>
  );
}
