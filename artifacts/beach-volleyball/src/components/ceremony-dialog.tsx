/**
 * 1.1.3 (Rob, 23 Oct; brief A5): the medal ceremony, the World Finals' and the
 * Empire Nations Cup's: the 3D court in ceremony mode (unity-build/index.html
 * ?ceremony=...), the podium with the six medallists, medals and banner.
 *
 * It plays every time, whoever is on the podium. The same interrupt pattern as
 * the Season Review (a dialog, not a route): it opens when the final is decided
 * (the calendar refreshes every query after a day) or on his next visit to the
 * Dashboard, until he skips it or closes it at the end (both mark it seen).
 * Never over the 3D court itself.
 *
 * Server: GET /ceremonies/pending, POST /ceremonies/:event/:year/seen
 * (routes/ceremonies.ts); the podium: GET /unity/ceremony-state.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SkipForward } from "lucide-react";

type Pending = { pending: { event: "world_finals" | "nations_cup"; seasonYear: number; readyOn: string; careerSaveId: number } | null };

const TITLE = { world_finals: "World Finals", nations_cup: "Empire Nations Cup" } as const;

export function CeremonyDialog() {
  const [location] = useLocation();
  const qc = useQueryClient();
  const { data } = useQuery<Pending>({
    queryKey: ["ceremonies-pending"],
    queryFn: () => fetch("/api/ceremonies/pending", { credentials: "same-origin" }).then((r) => r.json()),
    staleTime: 10_000,
  });
  const p = data?.pending ?? null;
  if (!p || location.startsWith("/court")) return null;
  const close = async () => {
    await fetch(`/api/ceremonies/${p.event}/${p.seasonYear}/seen`, { method: "POST", credentials: "same-origin" });
    qc.invalidateQueries({ queryKey: ["ceremonies-pending"] });
  };
  const src = `${import.meta.env.BASE_URL}unity-build/index.html?careerSaveId=${p.careerSaveId}&ceremony=${p.event}&year=${p.seasonYear}`;
  return (
    <Dialog open onOpenChange={(open) => { if (!open) void close(); }}>
      <DialogContent className="max-w-[min(1200px,96vw)] w-full p-3 gap-2" data-testid="ceremony-dialog">
        <DialogHeader className="flex-row items-center justify-between space-y-0 px-1">
          <div>
            <DialogTitle>{TITLE[p.event]} {p.seasonYear}: the medal ceremony</DialogTitle>
            <DialogDescription>Gold, silver and bronze on the podium.</DialogDescription>
          </div>
          <Button variant="secondary" size="sm" className="gap-1.5 mr-8" onClick={() => void close()} data-testid="ceremony-skip">
            <SkipForward className="h-4 w-4" /> Skip
          </Button>
        </DialogHeader>
        <iframe
          title="Medal ceremony"
          src={src}
          data-testid="ceremony-court"
          style={{ width: "100%", aspectRatio: "16 / 9", border: 0, borderRadius: 8, background: "black" }}
        />
      </DialogContent>
    </Dialog>
  );
}
