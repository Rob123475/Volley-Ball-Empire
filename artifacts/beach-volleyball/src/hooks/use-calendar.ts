import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type CalendarSpeed = "pause" | "slow" | "medium" | "fast";

export type CalendarMatchDay = {
  matchId: number;
  round: number;
  isHome: boolean;
  opponent: string | null;
  location: string | null;
  prizeAmount: string | null;
  tier: string | null;
};

export type CalendarMatch = {
  id: number;
  round: number;
  season: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeamName: string | null;
  awayTeamName: string | null;
  locationName: string | null;
  prizeAmount: string | null;
  tier: string | null;
  status: string;
};

export type CalendarState = {
  currentDate: string;
  calendarSpeed: CalendarSpeed;
  pendingMatchId: number | null;
  pendingMatch: CalendarMatch | null;
  nextMatch: CalendarMatch | null;
  nextMatchDate: string | null;
  daysToNextMatch: number | null;
  seasonYear: number;
  seasonRound: number;
  seasonTotalRounds: number;
  teamFitness: {
    avgFitness: number;
    avgFatigue: number;
    injuredCount: number;
    totalActive: number;
  };
  todayEvents: Array<{
    type: string;
    round: number;
    opponent: string | null;
    isHome: boolean;
  }>;
};

export type AdvanceResult = {
  newDate?: string;
  events?: string[];
  isQuietDay?: boolean;
  atSeasonEnd?: boolean;
  matchDay?: CalendarMatchDay;
  blocked?: "pending_match" | "season_end";
  pendingMatchId?: number;
  currentDate?: string;
};

export const SPEED_MS: Record<CalendarSpeed, number | null> = {
  pause:  null,
  slow:   3000,
  medium: 1000,
  fast:   200,
};

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json() as Promise<T>;
}

export function useCalendar() {
  const queryClient = useQueryClient();

  const { data: calendar, isLoading, error } = useQuery<CalendarState>({
    queryKey: ["calendar"],
    queryFn:  () => apiFetch<CalendarState>("/api/calendar"),
    refetchInterval: false,
    retry: 1,
  });

  const advanceMutation = useMutation<AdvanceResult>({
    mutationFn: () => apiFetch<AdvanceResult>("/api/calendar/advance", { method: "POST" }),
    onSettled:  () => {
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
  });

  const setSpeedMutation = useMutation<{ speed: string }, Error, CalendarSpeed>({
    mutationFn: (speed) =>
      apiFetch<{ speed: string }>("/api/calendar/speed", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speed }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["calendar"] }),
  });

  const dismissMatchMutation = useMutation({
    mutationFn: () => apiFetch("/api/calendar/dismiss-match", { method: "POST" }),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ["calendar"] }),
  });

  const skipMatchMutation = useMutation({
    mutationFn: () => apiFetch("/api/calendar/skip-match", { method: "POST" }),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ["calendar"] }),
  });

  const simulateMatchMutation = useMutation<unknown, Error, number>({
    mutationFn: (matchId) =>
      apiFetch(`/api/matches/${matchId}/simulate`, { method: "POST" }),
    onSuccess: () => {
      dismissMatchMutation.mutate();
    },
  });

  return {
    calendar,
    isLoading,
    error,
    isAdvancing:       advanceMutation.isPending,
    isSettingSpeed:    setSpeedMutation.isPending,
    isDismissing:      dismissMatchMutation.isPending,
    isSimulating:      simulateMatchMutation.isPending,
    advance:           () => advanceMutation.mutate(),
    setSpeed:          (speed: CalendarSpeed) => setSpeedMutation.mutate(speed),
    dismissMatch:      () => dismissMatchMutation.mutate(),
    skipMatch:         () => skipMatchMutation.mutate(),
    simulateMatch:     (matchId: number) => simulateMatchMutation.mutate(matchId),
    lastAdvanceResult: advanceMutation.data,
    advanceMutation,
  };
}
