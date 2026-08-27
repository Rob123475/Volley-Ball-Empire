import { useState } from "react";
import { 
  useGetCurrentAuthUser, 
  useGetMyTeam,
  getGetMyTeamQueryKey,
  useGetCurrentSeason,
  getGetCurrentSeasonQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Activity, Loader2, Play } from "lucide-react";
import CareerManagement from "@/pages/career-management";
import { useQuery } from "@tanstack/react-query";
import { careerSlotStatus } from "@/lib/career-slot-status";



export function AuthGuard({ children }: { children: React.ReactNode }) {
  // Title screen: shown on every fresh session until dismissed
  const [showTitle, setShowTitle] = useState(
    () => sessionStorage.getItem("bvp-title-dismissed") !== "1"
  );
  const { data: user, isLoading: authLoading } = useGetCurrentAuthUser();

  const teamQuery = useGetMyTeam({
    query: { enabled: !!user, queryKey: getGetMyTeamQueryKey(), retry: false }
  });
  const { data: team, isLoading: teamLoading, refetch: refetchTeam } = teamQuery;

  // A 404 means "no career yet"; anything else means the request failed and we
  // do not know. Never let a failed request present as an empty account — that
  // turns Continue into "Start New Career" over the top of a real save.
  const slot = careerSlotStatus(teamQuery);

  const hasTeam    = !!user && slot === "present";
  const needsTeam  = !!user && slot === "absent";
  const teamFailed = !!user && slot === "unknown";
  const isLoading  = authLoading || (!!user && teamLoading);

  // The season year was hardcoded to 2026 here, so a player in their third
  // season saw the wrong year on the front of the game.
  const { data: currentSeason } = useGetCurrentSeason({
    query: { queryKey: getGetCurrentSeasonQueryKey(), retry: false },
  });
  const seasonYear = currentSeason?.year ?? null;

  // World-size figures are counted from the locations table rather than typed
  // in. The originals ("11 cities across 9 countries") happen to be right
  // today, but they were written when the world was seeded and nothing would
  // have caught them drifting as venues were added.
  const { data: world } = useQuery({
    queryKey: ["world-summary"],
    retry: false,
    queryFn: async () => {
      const res = await fetch("/api/locations/world-summary");
      if (!res.ok) throw new Error("Failed to load world summary");
      return res.json() as Promise<{
        venues: number; cities: number; countries: number;
        totalEvents: number; topPrize: number;
      }>;
    },
  });

  const venueCount   = world?.venues    ?? 0;
  const cityCount    = world?.cities    ?? 0;
  const countryCount = world?.countries ?? 0;
  // Formatted from the real top purse (500,000 -> "$500k") rather than typed
  // in — the old pill said "$50k", off by a factor of ten.
  const topPrizeLabel = world?.topPrize
    ? `$${Math.round(world.topPrize / 1000).toLocaleString()}k`
    : "—";

  const loginUrl = `/login?returnTo=${encodeURIComponent(import.meta.env.BASE_URL)}`;

  const dismissTitle = () => {
    sessionStorage.setItem("bvp-title-dismissed", "1");
    setShowTitle(false);
  };

  const handlePrimary = () => {
    if (isLoading) return;
    if (!user) {
      sessionStorage.setItem("bvp-title-dismissed", "1");
      window.location.href = loginUrl;
    } else if (teamFailed) {
      // We could not read the save slot. Retry — do not offer a new career.
      refetchTeam();
    } else if (!hasTeam) {
      sessionStorage.setItem("bvp-title-dismissed", "1");
      window.location.href = "/new-career";
    } else {
      dismissTitle();
    }
  };

  // ── Title screen (shown to everyone on fresh session) ──────────────────────
  if (showTitle) {
    return (
      <div className="relative h-screen w-full overflow-hidden bg-black">

        <img
          src={`${import.meta.env.BASE_URL}title-hero.webp`}
          alt="Beach Volleyball Pro"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/40" />

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-8 py-6">
          <div className="flex items-center gap-3">
            <Activity className="h-7 w-7 text-secondary" />
            <span className="text-white/80 font-bold text-sm uppercase tracking-widest">Beach Volley Pro</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur px-3 py-1.5 rounded-full border border-white/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white/70 text-xs font-semibold uppercase tracking-wide">
              {seasonYear ? `Season ${seasonYear}` : "Beach Volley Pro"}
            </span>
          </div>
        </div>

        {/* Main content */}
        <div className="absolute bottom-0 left-0 right-0 px-8 md:px-16 pb-16 md:pb-20">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 bg-secondary/90 backdrop-blur px-3 py-1 rounded-full">
              <span className="text-white text-xs font-black uppercase tracking-widest">All-Women World Tour</span>
            </div>

            <h1 className="text-6xl md:text-8xl font-black text-white leading-none tracking-tight drop-shadow-2xl">
              BEACH<br />
              <span className="text-secondary drop-shadow-[0_0_30px_rgba(244,162,97,0.6)]">VOLLEY</span><br />
              PRO
            </h1>

            <p className="mt-4 text-white/60 text-base md:text-lg max-w-md leading-relaxed">
              Build your dream team.{" "}
              {cityCount > 0 && countryCount > 0
                ? `Conquer ${cityCount} cities across ${countryCount} countries.`
                : "Conquer the world tour."}{" "}
              Claim the world championship.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 flex-wrap">
              {/* Primary action */}
              <Button
                size="lg"
                className="group relative overflow-hidden bg-secondary hover:bg-secondary/90 text-white font-black text-lg px-10 py-6 rounded-xl shadow-[0_0_30px_rgba(244,162,97,0.4)] hover:shadow-[0_0_40px_rgba(244,162,97,0.6)] transition-all"
                onClick={handlePrimary}
                disabled={isLoading}
                data-testid="button-signin"
              >
                {isLoading
                  ? <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  : <Play className="mr-2 h-5 w-5 fill-white" />}
                {teamFailed ? "RETRY" : hasTeam ? "CONTINUE" : "START NEW CAREER"}
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors" />
              </Button>
            </div>

            <p className="mt-6 text-white/30 text-xs">
              {user
                ? teamFailed
                  ? "Could not reach your save data. Your career is safe — press Retry."
                  : `Signed in · ${hasTeam ? "Your progress is saved." : "Set up your team to begin."}`
                : "Select or create a manager profile to save your progress."}
            </p>
          </div>
        </div>

        {/* Right-side stat pills */}
        <div className="hidden lg:flex absolute right-12 top-1/2 -translate-y-1/2 flex-col gap-3">
          {[
            { label: "World Tour Stops", value: venueCount   > 0 ? String(venueCount)   : "—" },
            { label: "Countries",        value: countryCount > 0 ? String(countryCount) : "—" },
            { label: "Grand Final Prize",value: topPrizeLabel },
          ].map((s) => (
            <div key={s.label} className="bg-black/50 backdrop-blur border border-white/10 rounded-xl px-5 py-3 text-right">
              <div className="text-white font-black text-2xl">{s.value}</div>
              <div className="text-white/40 text-xs uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Post-title loading spinner ──────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ── Not authenticated — redirect to login ───────────────────────────────────
  if (!user) {
    window.location.href = loginUrl;
    return null;
  }

  // ── No active career — redirect to title screen ─────────────────────────────
  if (needsTeam) {
    sessionStorage.removeItem("bvp-title-dismissed");
    window.location.href = "/";
    return null;
  }

  // ── Could not read the save slot — say so, rather than rendering an empty
  //    game or bouncing the player into career creation over a live save. ─────
  if (teamFailed) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background p-8">
        <div className="max-w-sm w-full rounded-2xl border border-white/10 bg-white/5 p-8 text-center space-y-5">
          <div className="text-4xl">📡</div>
          <div>
            <h2 className="text-lg font-black text-white">Could not load your career</h2>
            <p className="mt-2 text-sm text-white/50">
              The game could not reach its local server. Your save has not been
              changed. Try again, and restart the game if this keeps happening.
            </p>
          </div>
          <Button className="w-full font-black" onClick={() => refetchTeam()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
