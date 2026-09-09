import { useState } from "react";
import { cn } from "@/lib/utils";
import { Flag, Star, Calendar } from "lucide-react";
import NationalSquads       from "@/pages/competition/national-squads";
import OlympicQualifiers    from "@/pages/competition/olympic-qualifiers";
import OlympicSchedule      from "@/pages/competition/olympic-schedule";

// R-12: Results / Medal Table / History tabs removed — each rendered a bare
// "coming in a future update" stub. Not built, deleted.
type Tab = "overview" | "qualifying" | "fixtures";

const TABS: Array<{ id: Tab; label: string; icon: any }> = [
  { id: "overview",   label: "Overview",      icon: Flag        },
  { id: "qualifying", label: "Qualifying",    icon: Star        },
  { id: "fixtures",   label: "Fixtures",      icon: Calendar    },
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
      {tab === "qualifying" && <OlympicQualifiers />}
      {tab === "fixtures"   && <OlympicSchedule />}
    </div>
  );
}
