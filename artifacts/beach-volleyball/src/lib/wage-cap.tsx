/**
 * Update 1, item 4a (Rob, 14 Oct; C-2, C-3): the salary cap on screen.
 * "Senior wages $X of $60,000", from the server's own figure
 * (GET /contracts/wage-cap: utils/salaryCap.ts seniorWageBill), and the room
 * left, so a signing or renewal screen never offers a deal the server refuses.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export type WageCap = { seniorWages: number; cap: number; room: number };

export const WAGE_CAP_QUERY_KEY = ["wage-cap"] as const;

export function useWageCap() {
  return useQuery<WageCap>({
    queryKey: WAGE_CAP_QUERY_KEY,
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/contracts/wage-cap", { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    staleTime: 10_000,
  });
}

/** After a signing, renewal or release: the figure moves. */
export function useRefreshWageCap() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: WAGE_CAP_QUERY_KEY });
}

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** The server's refusal, in the same words (utils/salaryCap.ts wageCapRefusal), or null when it fits. */
export function capRefusalText(cap: WageCap | undefined, adding: number): string | null {
  if (!cap || adding <= 0) return null;
  const after = cap.seniorWages + adding;
  if (after <= cap.cap) return null;
  return `That takes your wages to ${money(after)}. The cap is ${money(cap.cap)}. Free up ${money(after - cap.cap)} first.`;
}

/** "Senior wages $X of $60,000", and the room left. */
export function WageCapLine({ className }: { className?: string }) {
  const { data } = useWageCap();
  if (!data) return null;
  const over = data.seniorWages > data.cap;
  return (
    <p className={cn("text-sm", over ? "text-red-500" : "text-muted-foreground", className)} data-testid="wage-cap-line">
      Senior wages <span className="font-semibold text-foreground">{money(data.seniorWages)}</span> of {money(data.cap)}
      {over ? " (over the cap: no signings or raises until you are back under)" : ` · ${money(data.room)} room`}
    </p>
  );
}
