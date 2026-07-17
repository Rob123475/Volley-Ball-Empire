import { useState } from "react";
import { cn } from "@/lib/utils";
import { Globe, LayoutList, CheckCircle2, BarChart2, Users, ArrowUpDown, FolderOpen } from "lucide-react";
import RegionalOverview    from "@/pages/competition/regional-overview";
import RegionalFixtures    from "@/pages/competition/regional-fixtures";
import RegionalResults     from "@/pages/competition/regional-results";
import RegionalLadders     from "@/pages/competition/regional-ladders";
import ContinentalPools    from "@/pages/competition/continental-pools";
import PromotionRelegation from "@/pages/competition/promotion-relegation";
import RegionalHistory     from "@/pages/competition/regional-history";

type Tab = "overview" | "fixtures" | "results" | "standings" | "pools" | "promotion" | "history";

const TABS: Array<{ id: Tab; label: string; icon: any }> = [
  { id: "overview",  label: "Overview",            icon: Globe          },
  { id: "fixtures",  label: "Fixtures",            icon: LayoutList     },
  { id: "results",   label: "Results",             icon: CheckCircle2   },
  { id: "standings", label: "Standings",           icon: BarChart2      },
  { id: "pools",     label: "Pools",               icon: Users          },
  { id: "promotion", label: "Promotion/Relegation",icon: ArrowUpDown    },
  { id: "history",   label: "History",             icon: FolderOpen     },
];

export default function ContinentalHub() {
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
      {tab === "overview"  && <RegionalOverview />}
      {tab === "fixtures"  && <RegionalFixtures />}
      {tab === "results"   && <RegionalResults />}
      {tab === "standings" && <RegionalLadders />}
      {tab === "pools"     && <ContinentalPools />}
      {tab === "promotion" && <PromotionRelegation />}
      {tab === "history"   && <RegionalHistory />}
    </div>
  );
}
