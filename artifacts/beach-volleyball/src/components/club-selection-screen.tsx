import { useState, useMemo } from "react";
import {
  useListClubTemplates,
  useUpsertCareerSave,
  getGetMyTeamQueryKey,
  getGetCurrentAuthUserQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, ArrowLeft, ChevronRight, Play, Star, Globe, Paintbrush, CheckCircle2 } from "lucide-react";
import { ClubCrest } from "@/components/club-crest";

type ClubTemplate = import("@workspace/api-client-react").ClubTemplate;

const CONTINENT_ORDER = ["Europe", "Asia", "North America", "South America", "Oceania", "Africa"];
const CONTINENT_FLAGS: Record<string, string> = {
  Europe: "🌍", Asia: "🌏", "North America": "🌎", "South America": "🌎", Oceania: "🌊", Africa: "🌍",
};

const PRESET_COLORS = [
  "#C8102E","#003DA5","#FFD700","#009A44","#BC002D","#FF6600",
  "#1A56DB","#8B0000","#006600","#00A8B0","#CC0000","#002244",
  "#1C1C1C","#DC143C","#C69214","#005EB8","#CC5500","#75AADB",
];

function RatingStars({ rating }: { rating: number }) {
  const stars = Math.round((rating / 100) * 5);
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`h-2.5 w-2.5 ${i < stars ? "fill-yellow-400 text-yellow-400" : "text-white/15"}`} />
      ))}
    </div>
  );
}

function ColorSwatch({ color, selected, onClick }: { color: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-7 h-7 rounded-lg border-2 transition-all ${selected ? "border-white scale-110 shadow-lg" : "border-transparent hover:border-white/40"}`}
      style={{ backgroundColor: color }}
      title={color}
    />
  );
}

interface Props {
  onComplete: () => void;
}

export function ClubSelectionScreen({ onComplete }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [step, setStep] = useState<1 | 2>(1);
  const [managerName, setManagerName] = useState("");
  const [mode, setMode] = useState<"browse" | "custom">("browse");

  // Browse state
  const [continentFilter, setContinentFilter] = useState<string>("all");
  const [townFilter, setTownFilter] = useState("");
  const [selectedClub, setSelectedClub] = useState<ClubTemplate | null>(null);
  const [customName, setCustomName] = useState("");

  // Custom club state
  const [customClubName, setCustomClubName] = useState("");
  const [customTown, setCustomTown] = useState("");
  const [customContinent, setCustomContinent] = useState("Europe");
  const [primaryColor, setPrimaryColor] = useState("#C8102E");
  const [secondaryColor, setSecondaryColor] = useState("#FFD700");

  const { data: templateData, isLoading: loadingClubs } = useListClubTemplates();
  const upsertMutation = useUpsertCareerSave();

  const clubs = useMemo(() => templateData?.clubs ?? [], [templateData]);

  const filteredClubs = useMemo(() => {
    return clubs.filter(c => {
      if (continentFilter !== "all" && c.continent !== continentFilter) return false;
      if (townFilter.trim() && !c.town.toLowerCase().includes(townFilter.toLowerCase())) return false;
      return true;
    });
  }, [clubs, continentFilter, townFilter]);

  const towns = useMemo(() => {
    const source = continentFilter === "all" ? clubs : clubs.filter(c => c.continent === continentFilter);
    return Array.from(new Set(source.map(c => c.town))).sort();
  }, [clubs, continentFilter]);

  const canProceedStep1 = managerName.trim().length >= 2;
  const canProceedBrowse = !!selectedClub;
  const canProceedCustom = customClubName.trim().length >= 2 && customTown.trim().length >= 1;

  const handleSubmit = () => {
    if (!canProceedStep1) return;

    if (mode === "browse" && !canProceedBrowse) return;
    if (mode === "custom" && !canProceedCustom) return;

    const payload = mode === "browse" && selectedClub
      ? {
          slotNumber: 1,
          managerName: managerName.trim(),
          clubName: customName.trim() || selectedClub.name,
          originalClubName: selectedClub.name,
          budget: selectedClub.startingBudget,
          primaryColor: selectedClub.primaryColor,
          secondaryColor: selectedClub.secondaryColor,
        }
      : {
          slotNumber: 1,
          managerName: managerName.trim(),
          clubName: customClubName.trim(),
          originalClubName: null,
          budget: "500000",
          primaryColor,
          secondaryColor,
        };

    upsertMutation.mutate({ data: payload }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMyTeamQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetCurrentAuthUserQueryKey() });
        toast({ title: "Career started!", description: `Welcome, Manager ${managerName.trim()}!` });
        onComplete();
      },
      onError: () => {
        toast({ title: "Failed to create career", variant: "destructive" });
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-900 shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: "90vh" }}>

        {/* Header */}
        <div className="px-6 py-4 border-b border-white/8 flex items-center gap-3 shrink-0">
          {step === 2 && (
            <button onClick={() => setStep(1)} className="text-white/40 hover:text-white transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div className="flex-1">
            <h2 className="text-lg font-black text-white">
              {step === 1 ? "New Career" : "Choose Your Club"}
            </h2>
            <div className="flex gap-2 mt-1">
              {[1, 2].map(s => (
                <div key={s} className={`h-1 rounded-full transition-all ${s <= step ? "bg-violet-500 w-8" : "bg-white/10 w-4"}`} />
              ))}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* Step 1: Manager name */}
          {step === 1 && (
            <div className="p-6 space-y-6">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-white/40">Manager Name</label>
                <input
                  autoFocus
                  value={managerName}
                  onChange={e => setManagerName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && canProceedStep1 && setStep(2)}
                  placeholder="e.g. Sarah Mitchell"
                  maxLength={80}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all"
                />
                <p className="text-xs text-white/35">This name appears on your manager profile throughout your career.</p>
              </div>
            </div>
          )}

          {/* Step 2: Club selection */}
          {step === 2 && (
            <div className="flex flex-col h-full">
              {/* Mode tabs */}
              <div className="flex border-b border-white/8 shrink-0">
                <button
                  onClick={() => setMode("browse")}
                  className={`flex-1 py-3 text-sm font-bold transition-colors flex items-center justify-center gap-2 ${mode === "browse" ? "text-white border-b-2 border-violet-500" : "text-white/40 hover:text-white/60"}`}
                >
                  <Globe className="h-4 w-4" /> Browse Clubs
                </button>
                <button
                  onClick={() => setMode("custom")}
                  className={`flex-1 py-3 text-sm font-bold transition-colors flex items-center justify-center gap-2 ${mode === "custom" ? "text-white border-b-2 border-violet-500" : "text-white/40 hover:text-white/60"}`}
                >
                  <Paintbrush className="h-4 w-4" /> Create Custom
                </button>
              </div>

              {/* Browse mode */}
              {mode === "browse" && (
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {/* Filters */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
                      <input
                        value={townFilter}
                        onChange={e => setTownFilter(e.target.value)}
                        placeholder="Filter by town…"
                        className="w-full rounded-lg border border-white/10 bg-white/5 pl-8 pr-3 py-2 text-xs text-white placeholder-white/25 outline-none focus:border-violet-500/50 transition-all"
                      />
                    </div>
                    <select
                      value={continentFilter}
                      onChange={e => { setContinentFilter(e.target.value); setTownFilter(""); }}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-violet-500/50 transition-all"
                    >
                      <option value="all">All continents</option>
                      {CONTINENT_ORDER.map(c => <option key={c} value={c}>{CONTINENT_FLAGS[c]} {c}</option>)}
                    </select>
                  </div>

                  {/* Town quick-filter chips */}
                  {continentFilter !== "all" && (
                    <div className="flex gap-1.5 flex-wrap">
                      <button
                        onClick={() => setTownFilter("")}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${!townFilter ? "bg-violet-600 text-white" : "border border-white/10 bg-white/5 text-white/40 hover:text-white/60"}`}
                      >All</button>
                      {towns.map(t => (
                        <button
                          key={t}
                          onClick={() => setTownFilter(t === townFilter ? "" : t)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${townFilter === t ? "bg-violet-600 text-white" : "border border-white/10 bg-white/5 text-white/40 hover:text-white/60"}`}
                        >{t}</button>
                      ))}
                    </div>
                  )}

                  {loadingClubs ? (
                    <div className="flex items-center justify-center py-12 gap-2 text-white/40">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Loading clubs…</span>
                    </div>
                  ) : filteredClubs.length === 0 ? (
                    <p className="text-center text-sm text-white/30 py-8">No clubs match your filters.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {filteredClubs.map(club => {
                        const isSelected = selectedClub?.id === club.id;
                        return (
                          <button
                            key={club.id}
                            onClick={() => { setSelectedClub(club); setCustomName(club.name); }}
                            className={`w-full rounded-xl border px-4 py-3 flex items-center gap-3 text-left transition-all ${isSelected ? "border-violet-500/60 bg-violet-500/10" : "border-white/8 bg-white/3 hover:bg-white/6 hover:border-white/15"}`}
                          >
                            {/* Club crest */}
                            <ClubCrest
                              name={club.name}
                              primaryColor={club.primaryColor}
                              secondaryColor={club.secondaryColor}
                              size={36}
                              className="shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-sm text-white truncate">{club.name}</div>
                              <div className="text-[11px] text-white/40">{club.town} · {club.continent}</div>
                            </div>
                            <div className="shrink-0 text-right space-y-0.5">
                              <RatingStars rating={club.rating} />
                              <div className="text-[10px] text-emerald-400 font-bold">${(Number(club.startingBudget) / 1000).toFixed(0)}K</div>
                            </div>
                            {isSelected && <CheckCircle2 className="h-4 w-4 text-violet-400 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Selected club name override */}
                  {selectedClub && (
                    <div className="mt-3 pt-3 border-t border-white/8 space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-white/40">Club Name (optional rename)</label>
                      <input
                        value={customName}
                        onChange={e => setCustomName(e.target.value)}
                        placeholder={selectedClub.name}
                        maxLength={80}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-violet-500/60 transition-all"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Custom club mode */}
              {mode === "custom" && (
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-white/40">Club Name *</label>
                    <input
                      autoFocus
                      value={customClubName}
                      onChange={e => setCustomClubName(e.target.value)}
                      placeholder="e.g. Sunset Spikers"
                      maxLength={80}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-violet-500/60 transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-white/40">Home Town *</label>
                      <input
                        value={customTown}
                        onChange={e => setCustomTown(e.target.value)}
                        placeholder="e.g. Sydney"
                        maxLength={80}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-violet-500/60 transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-white/40">Continent</label>
                      <select
                        value={customContinent}
                        onChange={e => setCustomContinent(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/60 transition-all"
                      >
                        {CONTINENT_ORDER.map(c => <option key={c} value={c}>{CONTINENT_FLAGS[c]} {c}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Kit preview */}
                  <div className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-3">
                    <div className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-2">Kit Colours</div>
                    <div className="flex items-center gap-4">
                      {/* Preview strip */}
                      <div className="flex gap-0.5 rounded-lg overflow-hidden shrink-0">
                        <div className="w-10 h-16" style={{ backgroundColor: primaryColor }} />
                        <div className="w-10 h-16" style={{ backgroundColor: secondaryColor }} />
                      </div>
                      <div className="flex-1 space-y-2">
                        <div>
                          <div className="text-[10px] font-bold text-white/40 mb-1">PRIMARY</div>
                          <div className="flex flex-wrap gap-1.5">
                            {PRESET_COLORS.slice(0, 9).map(c => (
                              <ColorSwatch key={c} color={c} selected={primaryColor === c} onClick={() => setPrimaryColor(c)} />
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-white/40 mb-1">SECONDARY</div>
                          <div className="flex flex-wrap gap-1.5">
                            {PRESET_COLORS.slice(0, 9).map(c => (
                              <ColorSwatch key={c} color={c} selected={secondaryColor === c} onClick={() => setSecondaryColor(c)} />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Custom hex inputs */}
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <div className="flex items-center gap-2 border border-white/10 bg-white/5 rounded-lg px-2.5 py-1.5">
                        <div className="w-4 h-4 rounded shrink-0" style={{ backgroundColor: primaryColor }} />
                        <input
                          value={primaryColor}
                          onChange={e => setPrimaryColor(e.target.value)}
                          placeholder="#000000"
                          maxLength={7}
                          className="flex-1 min-w-0 text-xs text-white bg-transparent outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-2 border border-white/10 bg-white/5 rounded-lg px-2.5 py-1.5">
                        <div className="w-4 h-4 rounded shrink-0" style={{ backgroundColor: secondaryColor }} />
                        <input
                          value={secondaryColor}
                          onChange={e => setSecondaryColor(e.target.value)}
                          placeholder="#FFFFFF"
                          maxLength={7}
                          className="flex-1 min-w-0 text-xs text-white bg-transparent outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/8 flex gap-3 shrink-0">
          {step === 1 && (
            <button
              onClick={() => setStep(2)}
              disabled={!canProceedStep1}
              className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 py-3 text-sm font-black text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              Choose Your Club <ChevronRight className="h-4 w-4" />
            </button>
          )}
          {step === 2 && (
            <button
              onClick={handleSubmit}
              disabled={upsertMutation.isPending || (mode === "browse" ? !canProceedBrowse : !canProceedCustom)}
              className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 py-3 text-sm font-black text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {upsertMutation.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Starting career…</>
                : <><Play className="h-4 w-4 fill-white" /> Start Career</>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
