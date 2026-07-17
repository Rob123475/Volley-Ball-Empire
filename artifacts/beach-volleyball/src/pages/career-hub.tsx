import { useState } from "react";
import { cn } from "@/lib/utils";
import { UserCog, Star, Flame, Activity, Briefcase } from "lucide-react";
import ManagerProfile   from "@/pages/profile";
import Achievements     from "@/pages/achievements";
import TrophyCabinet    from "@/pages/trophy-cabinet";
import CareerHistory    from "@/pages/career-history";
import JobMarket        from "@/pages/job-market";
import ManagerContract  from "@/pages/manager-contract";

type Tab = "overview" | "achievements" | "records" | "history" | "options";

const TABS: Array<{ id: Tab; label: string; icon: any }> = [
  { id: "overview",      label: "Overview",        icon: UserCog   },
  { id: "achievements",  label: "Achievements",    icon: Star      },
  { id: "records",       label: "Records",         icon: Flame     },
  { id: "history",       label: "Manager History", icon: Activity  },
  { id: "options",       label: "Career Options",  icon: Briefcase },
];

export default function CareerHub() {
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
      {tab === "overview"     && <ManagerProfile />}
      {tab === "achievements" && <Achievements />}
      {tab === "records"      && <TrophyCabinet />}
      {tab === "history"      && <CareerHistory />}
      {tab === "options"      && (
        <div className="space-y-8">
          <JobMarket />
          <ManagerContract />
        </div>
      )}
    </div>
  );
}
