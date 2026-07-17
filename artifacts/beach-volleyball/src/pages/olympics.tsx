import { useState } from "react";
import { cn } from "@/lib/utils";
import { Flag, Star, Calendar, CheckCircle2, Medal, FolderOpen } from "lucide-react";
import NationalSquads       from "@/pages/competition/national-squads";
import WorldTourLocations   from "@/pages/locations";
import OlympicSchedule      from "@/pages/competition/olympic-schedule";
import OlympicResults       from "@/pages/competition/olympic-results";
import MedalTable           from "@/pages/competition/medal-table";
import OlympicHistory       from "@/pages/competition/olympic-history";

type Tab = "overview" | "qualifying" | "fixtures" | "results" | "medals" | "history";

const TABS: Array<{ id: Tab; label: string; icon: any }> = [
  { id: "overview",   label: "Overview",      icon: Flag        },
  { id: "qualifying", label: "Qualifying",    icon: Star        },
  { id: "fixtures",   label: "Fixtures",      icon: Calendar    },
  { id: "results",    label: "Results",       icon: CheckCircle2 },
  { id: "medals",     label: "Medal Table",   icon: Medal       },
  { id: "history",    label: "History",       icon: FolderOpen  },
];

export default function OlympicsHub() {
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
      {tab === "overview"   && <NationalSquads />}
      {tab === "qualifying" && <WorldTourLocations />}
      {tab === "fixtures"   && <OlympicSchedule />}
      {tab === "results"    && <OlympicResults />}
      {tab === "medals"     && <MedalTable />}
      {tab === "history"    && <OlympicHistory />}
    </div>
  );
}
