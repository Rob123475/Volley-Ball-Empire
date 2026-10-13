/**
 * Update 1, item 2: the player's manager in the active career (GET /manager):
 * the face, the name the player typed, the speciality and its effect, and the
 * multipliers the speciality puts on numbers a page works out for itself.
 */
import { useQuery } from "@tanstack/react-query";

export type MyManager = {
  faceId: number; name: string; image: string; gender: "male" | "female";
  speciality: string; effect: string; isPlayer: boolean;
  /** Fitness Guru: 0.8 on match injury risk; otherwise 1. */
  injuryRiskFactor: number;
};

export function useMyManager() {
  return useQuery<MyManager | null>({
    queryKey: ["my-manager"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/manager", { signal });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    staleTime: 60_000,
  });
}
