import { useState } from "react";
import { useLocation } from "wouter";
import { CalendarPanel } from "@/components/calendar-panel";
import {
  useGetCurrentAuthUser,
  getGetCurrentAuthUserQueryKey,
  useGetOlympicSelection,
  getGetOlympicSelectionQueryKey,
  useGetAttentionItems,
  getGetAttentionItemsQueryKey,
} from "@workspace/api-client-react";
import {
  Bell,
  Save,
  HelpCircle,
  Medal,
  Briefcase,
  BookOpen,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ── Rules content (same as start screen) ─────────────────────────────────────

const RULES = [
  { heading: "Scoring",     body: "Every rally awards a point to the winner — you don't need to be serving." },
  { heading: "Sets",        body: "Sets 1 & 2: first to 21, win by 2. Set 3 (if needed): first to 15, win by 2." },
  { heading: "Match",       body: "Best of 3 sets. Win 2 sets to take the match." },
  { heading: "Court Swap",  body: "Teams swap ends every 7 combined points in sets 1 & 2, every 5 in set 3." },
  { heading: "Service",     body: "The team that wins a rally earns the right to serve next." },
  { heading: "Boosts",      body: "Attack & Defense boosts: 15 s active, 30 s cooldown. Use them on key rallies." },
  { heading: "Match Clock", body: "Two 3-minute halves. Clock pauses with the game. After Full Time the score stands." },
];

// ── Icon button ───────────────────────────────────────────────────────────────

function IconBtn({
  icon: Icon,
  label,
  onClick,
  badge,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  badge?: number;
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      className="relative flex items-center justify-center w-7 h-7 rounded text-sidebar-foreground/55 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors shrink-0"
    >
      <Icon className="h-4 w-4" />
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[14px] h-[14px] rounded-full bg-red-500 text-white text-[9px] font-black leading-none px-0.5">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </button>
  );
}

function VDiv() {
  return <div className="w-px h-7 bg-sidebar-border shrink-0 mx-1" />;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GameplayHeader() {
  const [location, navigate] = useLocation();
  const [rulesOpen, setRulesOpen] = useState(false);

  const { data: user } = useGetCurrentAuthUser({
    query: { queryKey: getGetCurrentAuthUserQueryKey() },
  });
  const { data: selection } = useGetOlympicSelection({
    query: { queryKey: getGetOlympicSelectionQueryKey(), retry: false },
  });
  const { data: attention } = useGetAttentionItems({
    query: { queryKey: getGetAttentionItemsQueryKey() },
  });

  const bellCount = attention?.items?.length ?? 0;

  const handleBell = () => {
    if (location === "/") {
      document.getElementById("attention-required")?.scrollIntoView({ behavior: "smooth" });
    } else {
      navigate("/");
    }
  };

  return (
    <>
      <div className="shrink-0 flex items-center gap-0 px-3 bg-sidebar border-b border-sidebar-border text-sidebar-foreground h-12 overflow-hidden">

        {/* ── Calendar HUD ── */}
        <CalendarPanel />

        <div className="flex-1 min-w-0" />

        {/* ── Manager identity ── */}
        <VDiv />

        <div className="flex items-center gap-2 px-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <div className="h-5 w-5 rounded bg-primary/20 flex items-center justify-center shrink-0">
              <Briefcase className="h-3 w-3 text-primary" />
            </div>
            <span className="text-xs font-semibold text-sidebar-foreground/80 truncate max-w-[120px]">
              {user?.username ?? "—"}
            </span>
          </div>

          {selection ? (
            <div className="flex items-center gap-1 rounded px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/15">
              <Medal className="h-3 w-3 text-blue-400 shrink-0" />
              <span className="text-[11px] font-semibold text-blue-300 leading-none">
                {selection.flag} {selection.country}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1 rounded px-1.5 py-0.5 bg-sidebar-accent/20 border border-sidebar-border">
              <Medal className="h-3 w-3 text-sidebar-foreground/30 shrink-0" />
              <span className="text-[11px] text-sidebar-foreground/30 italic leading-none">No nat. team</span>
            </div>
          )}
        </div>

        <VDiv />

        {/* ── Action icons ── */}
        <div className="flex items-center gap-0.5 px-2 shrink-0">
          <IconBtn icon={Bell}       label="Attention Required" onClick={handleBell}             badge={bellCount} />
          <IconBtn icon={Save}       label="Save Slots"         onClick={() => navigate("/career")} />
          <IconBtn icon={HelpCircle} label="Rules & Help"       onClick={() => setRulesOpen(true)} />
        </div>
      </div>

      {/* ── Rules Dialog ── */}
      <Dialog open={rulesOpen} onOpenChange={setRulesOpen}>
        <DialogContent className="max-w-lg bg-zinc-950 border-white/15 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <BookOpen className="h-5 w-5 text-secondary shrink-0" />
              Game Rules
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {RULES.map((r) => (
              <div key={r.heading}>
                <div className="text-secondary font-black text-xs uppercase tracking-widest mb-0.5">
                  {r.heading}
                </div>
                <div className="text-white/70 text-sm leading-relaxed">{r.body}</div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
