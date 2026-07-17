import { useState } from "react";
import { cn } from "@/lib/utils";
import { Globe, Calendar, LayoutList, CheckCircle2, BarChart2, Trophy, Sparkles, FolderOpen, Star } from "lucide-react";
import QualifiedTeams   from "@/pages/competition/qualified-teams";
import Matches          from "@/pages/matches";
import WtFixtures       from "@/pages/competition/wt-fixtures";
import WtResults        from "@/pages/competition/wt-results";
import WtLadder         from "@/pages/competition/wt-ladder";
import WorldFinals      from "@/pages/competition/world-finals";
import AllStar          from "@/pages/competition/all-star";
import WtHistory        from "@/pages/competition/wt-history";

type Tab = "overview" | "calendar" | "fixtures" | "results" | "standings" | "finals" | "allstar" | "history";

const TABS: Array<{ id: Tab; label: string; icon: any }> = [
  { id: "overview",  label: "Overview",     icon: Globe       },
  { id: "calendar",  label: "Calendar",     icon: Calendar    },
  { id: "fixtures",  label: "Fixtures",     icon: LayoutList  },
  { id: "results",   label: "Results",      icon: CheckCircle2 },
  { id: "standings", label: "Standings",    icon: BarChart2   },
  { id: "finals",    label: "World Finals", icon: Trophy      },
  { id: "allstar",   label: "All-Star",     icon: Sparkles    },
  { id: "history",   label: "History",      icon: FolderOpen  },
];

export default function WorldTourHub() {
  const [tab, setTab] = useState<Tab>("overview");
  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap border-b border-border pb-4">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
              tab === id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>
      {tab === "overview"  && <QualifiedTeams />}
      {tab === "calendar"  && <Matches />}
      {tab === "fixtures"  && <WtFixtures />}
      {tab === "results"   && <WtResults />}
      {tab === "standings" && <WtLadder />}
      {tab === "finals"    && <WorldFinals />}
      {tab === "allstar"   && <AllStar />}
      {tab === "history"   && <WtHistory />}
    </div>
  );
}
