import { useState } from "react";
import { cn } from "@/lib/utils";
import { BarChart2, Building2, Heart, Sparkles, Trophy } from "lucide-react";
import LeagueLadders  from "@/pages/league-ladders";
import Facilities     from "@/pages/facilities";
import MedicalCentre  from "@/pages/medical";
import MedicalMarket  from "@/pages/medical-market";
import Wellbeing      from "@/pages/wellbeing";
import TrophyCabinet  from "@/pages/trophy-cabinet";

type Tab = "overview" | "facilities" | "medical" | "wellbeing" | "trophy";

const TABS: Array<{ id: Tab; label: string; icon: any }> = [
  { id: "overview",   label: "Overview",        icon: BarChart2  },
  { id: "facilities", label: "Facilities",      icon: Building2  },
  { id: "medical",    label: "Medical Centre",  icon: Heart      },
  { id: "wellbeing",  label: "Wellbeing",       icon: Sparkles   },
  { id: "trophy",     label: "Trophy Cabinet",  icon: Trophy     },
];

export default function ClubHub() {
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
      {tab === "overview"   && <LeagueLadders />}
      {tab === "facilities" && <Facilities />}
      {tab === "medical"    && (
        <div className="space-y-8">
          <MedicalCentre />
          <MedicalMarket />
        </div>
      )}
      {tab === "wellbeing"  && <Wellbeing />}
      {tab === "trophy"     && <TrophyCabinet />}
    </div>
  );
}
