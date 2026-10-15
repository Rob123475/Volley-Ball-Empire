/**
 * Update 1, night 2 (O-6 to O-8): what the server says about staff and
 * injuries, for the Staff, Medical and Team pages: each member's real effect
 * and the pairs (GET /staff/effects), and a player's injury history
 * (GET /players/:id/injuries), with a repeat body area made obvious.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BODY_AREA_LABELS, type BodyArea } from "@shared/injuries";

export type StaffEffects = {
  members: Array<{ id: number; name: string; role: string; roleKey: string | null; onDuty: boolean; counts: boolean; effect: string }>;
  pairs: Array<{ key: string; label: string; effect: string; has: boolean }>;
  treatment: { doctorInjuries: number; physioInjuries: number; reconstruction: number };
  injuryRiskFactor: number;
};

/** Each member's real effect, the pairs and today's treatment factors. */
export function useStaffEffects() {
  return useQuery<StaffEffects>({
    queryKey: ["staff-effects"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/staff/effects", { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });
}

/** "Ankle" for the area key the server stores. */
export function areaLabel(area: string | null | undefined): string | null {
  return area ? BODY_AREA_LABELS[area as BodyArea] ?? area : null;
}

type InjuryHistoryData = {
  injuries: Array<{ injury: string; area: string; gameDate: string; weeksOut: number; reconstruction: boolean }>;
  areasLast12Months: Array<{ area: string; count: number }>;
  reconstructionAt: number;
};

const dateText = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** A player's injuries, each with its date, and her areas hurt in the last 12 months. */
export function InjuryHistory({ playerId }: { playerId: number }) {
  const [open, setOpen] = useState(false);
  const { data } = useQuery<InjuryHistoryData>({
    queryKey: ["player-injuries", playerId],
    enabled: open,
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/players/${playerId}/injuries`, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });
  return (
    <div className="text-xs" data-testid={`injury-history-${playerId}`}>
      <button type="button" className="text-muted-foreground underline-offset-2 hover:underline" onClick={() => setOpen((o) => !o)}>
        {open ? "Hide injury history" : "Injury history"}
      </button>
      {open && data && (
        <div className="mt-1.5 space-y-1.5">
          {data.injuries.length === 0 ? (
            <div className="text-muted-foreground">No injuries yet.</div>
          ) : (
            <>
              {data.areasLast12Months.filter((a) => a.count >= 2).map((a) => (
                <div key={a.area} className="font-semibold text-red-600 dark:text-red-400">
                  {a.area}: {a.count} in the last 12 months
                  {a.count === data.reconstructionAt - 1 ? " (one more there and it's a reconstruction)" : ""}
                </div>
              ))}
              <ul className="space-y-0.5">
                {data.injuries.map((i, n) => (
                  <li key={n} className="flex justify-between gap-2">
                    <span>{i.injury}{i.reconstruction ? " (surgery)" : ""} · {i.area}</span>
                    <span className="text-muted-foreground whitespace-nowrap">{dateText(i.gameDate)} · {Math.round(i.weeksOut)} wk</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
