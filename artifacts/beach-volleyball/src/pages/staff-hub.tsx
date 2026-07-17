import { useState } from "react";
import { cn } from "@/lib/utils";
import { UserCog, ShoppingBag, Radar } from "lucide-react";
import StaffManagement    from "@/pages/staff";
import StaffMarket        from "@/pages/staff-market";
import ContinentalScouting from "@/pages/continental-scouting";

type Tab = "my-staff" | "market" | "scouting";

const TABS: Array<{ id: Tab; label: string; icon: any }> = [
  { id: "my-staff",  label: "My Staff", icon: UserCog    },
  { id: "market",    label: "Market",   icon: ShoppingBag },
  { id: "scouting",  label: "Scouting", icon: Radar      },
];

export default function StaffHub() {
  const [tab, setTab] = useState<Tab>("my-staff");
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
      {tab === "my-staff" && <StaffManagement />}
      {tab === "market"   && <StaffMarket />}
      {tab === "scouting" && <ContinentalScouting />}
    </div>
  );
}
