import { Trophy } from "lucide-react";

/**
 * 1.1.3 (Rob, 23 Oct; brief A5): the continental leagues have no 3D ceremony.
 * Once a season's ladder is final, its top three get a gold, silver and bronze
 * cup beside their names (the ladder, and the history of past seasons).
 */
const CUP = {
  1: { colour: "#E8B923", label: "Gold cup: 1st" },
  2: { colour: "#B8BEC7", label: "Silver cup: 2nd" },
  3: { colour: "#B0703A", label: "Bronze cup: 3rd" },
} as const;

export function LadderCup({ place, size = 16 }: { place: number; size?: number }) {
  const cup = CUP[place as 1 | 2 | 3];
  if (!cup) return null;
  return (
    <span data-testid="ladder-cup" data-place={place} title={cup.label} aria-label={cup.label} className="inline-flex shrink-0">
      <Trophy style={{ width: size, height: size, color: cup.colour, fill: cup.colour, fillOpacity: 0.35 }} strokeWidth={2.2} />
    </span>
  );
}
