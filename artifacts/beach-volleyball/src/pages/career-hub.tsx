import { useState } from "react";
import { cn } from "@/lib/utils";
import { UserCog, Star, Flame, Activity, Briefcase, Building2 } from "lucide-react";
import ManagerProfile   from "@/pages/profile";
import Achievements     from "@/pages/achievements";
import ManagerRecords   from "@/pages/manager-records";
import CareerHistory    from "@/pages/career-history";
import ManagerContract  from "@/pages/manager-contract";
import JobMarketPage    from "@/pages/job-market";
import { NationalCoachOffers } from "@/components/national-coach";

type Tab = "overview" | "achievements" | "records" | "history" | "options" | "jobs";

const TABS: Array<{ id: Tab; label: string; icon: any }> = [
  { id: "overview",      label: "Overview",        icon: UserCog   },
  { id: "achievements",  label: "Achievements",    icon: Star      },
  { id: "records",       label: "Records",         icon: Flame     },
  { id: "history",       label: "Manager History", icon: Activity  },
  { id: "options",       label: "Career Options",  icon: Briefcase },
  // 1.1.3 (Rob, 25 Oct; AI market brief item 5): the Job Market, mid-season too.
  { id: "jobs",          label: "Job Market",      icon: Building2 },
];

export default function CareerHub() {
  const [tab, setTab] = useState<Tab>("overview");
  return (
    <div className="space-y-6">
      {/* 1.1.3 (A4c): national coach offers wait here (and on the job market); his contract once he has one. */}
      <NationalCoachOffers />
      <div className="flex gap-2 flex-wrap border-b border-border pb-4">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            data-testid={`career-tab-${id}`}
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
      {/* Overnight 30 Sep item 1: the manager's own records. The club's
          honours (Trophy Cabinet) are under Club. */}
      {tab === "records"      && <ManagerRecords />}
      {tab === "history"      && <CareerHistory />}
      {/* R-43: the Job Market's listings were hardcoded clubs, and applying
          created a club with no squad and no fixtures. Removed. The real one (routes/job-market.ts,
          clubs of this world) is the Job Market tab below, 1.1.3 item 5. */}
      {tab === "options"      && <ManagerContract />}
      {tab === "jobs"         && <JobMarketPage embedded />}
    </div>
  );
}
