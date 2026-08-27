import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

export type AnnualEventType = "regional" | "world_tour" | "finals" | "holiday" | "financial" | "contract" | "facility" | "olympic_qualifier" | "olympic";

export type AnnualEvent = {
  date: string;
  type: AnnualEventType;
  title: string;
  subtitle?: string;
  link: string;
  round?: number;
};

export type AnnualCalendarData = {
  year: number;
  seasonStart?: string;
  seasonEnd?: string;
  currentDate: string;
  calendarSpeed: CalendarSpeed;
  isOlympicSeason: boolean;
  hasSeasonData: boolean;
  events: AnnualEvent[];
};

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

  // Advance Day is the most-clicked button in the game and had only onSettled,
  // so a failure was completely silent. The auto-advance ticker then kept
  // firing against a date that never changed — at Fast speed, a failing POST
  // every 200ms, indefinitely. calendar-panel pauses the ticker on repeated
  // failures; this reports the failure to the player.
  const advanceMutation = useMutation<AdvanceResult>({
    mutationFn: () => apiFetch<AdvanceResult>("/api/calendar/advance", { method: "POST" }),
    onSuccess: (result) => {
      // The server returns { blocked: "season_end" } past the season's last
      // day. Nothing read that field, so the clock just froze with no
      // explanation. Pause and say so — for the manual button as well as the
      // auto-advance ticker.
      if (result?.blocked === "season_end") {
        setSpeedMutation.mutate("pause");
        toast({
          title: "Season complete",
          description: "The season has finished. There is nothing left to play on the calendar.",
        });
      }
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : String(err);
      toast({
        variant: "destructive",
        title: "Could not advance the day",
        description: message.replace(/^HTTP \d+ [^:]*: /, "") || "Please try again.",
      });
    },
    onSettled:  () => {
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
      queryClient.invalidateQueries({ queryKey: ["annual-calendar"] });
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

  // Starts the point-tick engine for a match. Does NOT dismiss the match-day
  // modal or invalidate calendar — the match isn't decided yet, it's just
  // begun. The caller (match-day-modal) navigates to /court after this
  // resolves; once the live view later reports the match finished, call
  // simulateMatch(matchId) to run the real economy off the live result.
  const watchMatchMutation = useMutation<{ ok: boolean; matchId: number }, Error, number>({
    mutationFn: (matchId) =>
      apiFetch(`/api/matches/${matchId}/watch`, { method: "POST" }),
  });

  return {
    calendar,
    isLoading,
    error,
    isAdvancing:       advanceMutation.isPending,
    isSettingSpeed:    setSpeedMutation.isPending,
    isDismissing:      dismissMatchMutation.isPending,
    isSkipping:        skipMatchMutation.isPending,
    isSimulating:      simulateMatchMutation.isPending,
    isStartingWatch:   watchMatchMutation.isPending,
    advance:           () => advanceMutation.mutate(),
    setSpeed:          (speed: CalendarSpeed) => setSpeedMutation.mutate(speed),
    dismissMatch:      () => dismissMatchMutation.mutate(),
    skipMatch:         () => skipMatchMutation.mutate(),
    simulateMatch:     (matchId: number) => simulateMatchMutation.mutate(matchId),
    watchMatch:        (matchId: number) => watchMatchMutation.mutateAsync(matchId),
    lastAdvanceResult: advanceMutation.data,
    advanceMutation,
    simulateMatchMutation,
    skipMatchMutation,
  };
}

export function useAnnualCalendar(year: number) {
  return useQuery<AnnualCalendarData>({
    queryKey: ["annual-calendar", year],
    queryFn:  () => apiFetch<AnnualCalendarData>(`/api/calendar/annual?year=${year}`),
    staleTime: 30_000,
    retry: 1,
  });
}
