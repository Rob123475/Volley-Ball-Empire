/**
 * 1.1.1, Part 10 (Rob, S-1 A): who scouts at the club and what each is
 * working on. A Scout, Head Coach or Assistant Coach works on at most
 * SCOUT_REPORTS_AT_ONCE reports at a time (players, youths, staff and medical,
 * and youth-deal negotiations); a Scout away on a continental youth mission
 * works on none until it ends. Data: GET /api/staff/scouting-work.
 */
import { useQuery } from "@tanstack/react-query";
import { Radar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Work = {
  today: string; perScout: number;
  scouts: Array<{
    id: number; name: string; role: string | null; imageUrl: string | null; rating: number; onDuty: boolean; free: number;
    reports: Array<{ kind: string; name: string; startedOn: string; readyOn: string }>;
    mission: { region: string; endsOn: string } | null;
  }>;
};

const KIND: Record<string, string> = { player: "Player", youth: "Youth", staff: "Staff", medical: "Medical", youth_deal: "Youth deal" };
const dateText = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function ScoutingWork() {
  const { data } = useQuery<Work>({
    queryKey: ["staff-scouting-work"],
    queryFn: async () => { const r = await fetch("/api/staff/scouting-work"); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); },
  });
  if (!data || data.scouts.length === 0) return null;
  return (
    <Card data-testid="scouting-work">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><Radar className="h-4 w-4" /> Scouting work</CardTitle>
        <CardDescription>Each Scout, Head Coach and Assistant Coach works on {data.perScout} reports at a time. A Scout away on a youth mission does none until he is back.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {data.scouts.map((s) => (
          <div key={s.id} className="rounded-lg border p-3 space-y-1.5" data-testid={`scouting-work-${s.id}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-sm">{s.name} <span className="text-muted-foreground font-normal">· {s.role} · scouting {s.rating}</span></span>
              {s.mission ? <Badge variant="secondary">Away</Badge>
                : !s.onDuty ? <Badge variant="destructive">Off</Badge>
                : <Badge variant={s.free === 0 ? "destructive" : "outline"} data-testid={`scouting-work-free-${s.id}`}>{s.reports.length} of {data.perScout}</Badge>}
            </div>
            {s.mission && <p className="text-xs text-muted-foreground">On a scouting mission in {s.mission.region} until {dateText(s.mission.endsOn)}.</p>}
            {s.reports.length === 0 && !s.mission && <p className="text-xs text-muted-foreground">No reports in progress.</p>}
            {s.reports.map((r, i) => (
              <p key={i} className="text-xs">{KIND[r.kind] ?? r.kind}: <b>{r.name}</b>, ready {dateText(r.readyOn)}</p>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
