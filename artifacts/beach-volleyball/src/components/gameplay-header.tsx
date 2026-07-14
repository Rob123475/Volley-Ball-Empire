import { CalendarPanel } from "@/components/calendar-panel";
import {
  useGetCurrentAuthUser,
  getGetCurrentAuthUserQueryKey,
  useGetOlympicSelection,
  getGetOlympicSelectionQueryKey,
  useGetAttentionItems,
  getGetAttentionItemsQueryKey,
} from "@workspace/api-client-react";
import { Bell, Save, Settings, HelpCircle, Medal, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

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

export function GameplayHeader() {
  const [location, navigate] = useLocation();

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
    <div className="shrink-0 flex items-center gap-0 px-3 bg-sidebar border-b border-sidebar-border text-sidebar-foreground h-12 overflow-hidden">

      {/* ── Calendar HUD (date, season, match, speed, fitness) ── */}
      <CalendarPanel />

      {/* ── Spacer ── */}
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
          <div className={cn(
            "flex items-center gap-1 rounded px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/15",
          )}>
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
        <IconBtn icon={Bell} label="Attention Required" onClick={handleBell} badge={bellCount} />
        <IconBtn icon={Save} label="Save" />
        <IconBtn icon={Settings} label="Settings" />
        <IconBtn icon={HelpCircle} label="Help" />
      </div>
    </div>
  );
}
