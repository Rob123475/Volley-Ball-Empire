import { useState } from "react";
import { cn } from "@/lib/utils";
import { Users, Star, Activity, FileText, Swords } from "lucide-react";
import TeamRoster   from "@/pages/team";
import YouthAcademy from "@/pages/youth-academy";
import Training     from "@/pages/training";
import Contracts    from "@/pages/contracts";

type Tab = "senior" | "youth" | "training" | "tactics" | "contracts";

const TABS: Array<{ id: Tab; label: string; icon: any }> = [
  { id: "senior",    label: "Senior Team",  icon: Users     },
  { id: "youth",     label: "Youth Team",   icon: Star      },
  { id: "training",  label: "Training",     icon: Activity  },
  { id: "tactics",   label: "Tactics",      icon: Swords    },
  { id: "contracts", label: "Contracts",    icon: FileText  },
];

function TacticsPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-4">
      <Swords className="h-16 w-16 opacity-20" />
      <p className="text-lg font-semibold">Tactics coming soon</p>
      <p className="text-sm">Formation and strategy tools are in development.</p>
    </div>
  );
}

export default function TeamHub() {
  const [tab, setTab] = useState<Tab>("senior");
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
      {tab === "senior"    && <TeamRoster />}
      {tab === "youth"     && <YouthAcademy />}
      {tab === "training"  && <Training />}
      {tab === "tactics"   && <TacticsPlaceholder />}
      {tab === "contracts" && <Contracts />}
    </div>
  );
}
