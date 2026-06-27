import { useState } from "react";
import { 
  useGetCurrentAuthUser, 
  useGetMyTeam,
  getGetMyTeamQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Activity, Loader2, Play, ChevronRight, BookOpen, X } from "lucide-react";
import { ClubSelectionScreen } from "@/components/club-selection-screen";


const RULES = [
  { heading: "Scoring",     body: "Every rally awards a point to the winner — you don't need to be serving." },
  { heading: "Sets",        body: "Sets 1 & 2: first to 21, win by 2. Set 3 (if needed): first to 15, win by 2." },
  { heading: "Match",       body: "Best of 3 sets. Win 2 sets to take the match." },
  { heading: "Court Swap",  body: "Teams swap ends every 7 combined points in sets 1 & 2, every 5 in set 3." },
  { heading: "Service",     body: "The team that wins a rally earns the right to serve next." },
  { heading: "Boosts",      body: "Attack & Defense boosts: 15 s active, 30 s cooldown. Use them on key rallies." },
  { heading: "Match Clock", body: "Two 3-minute halves. Clock pauses with the game. After Full Time the score stands." },
];

function RulesPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-black/90 border border-white/15 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-secondary" />
            <span className="text-white font-black text-lg uppercase tracking-widest">Rules</span>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {RULES.map((r) => (
            <div key={r.heading}>
              <div className="text-secondary font-black text-xs uppercase tracking-widest mb-0.5">{r.heading}</div>
              <div className="text-white/70 text-sm leading-relaxed">{r.body}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  // Title screen: shown on every fresh session until dismissed
  const [showTitle, setShowTitle] = useState(
    () => sessionStorage.getItem("bvp-title-dismissed") !== "1"
  );
  const [showRules, setShowRules] = useState(false);

  const { data: user, isLoading: authLoading } = useGetCurrentAuthUser();

  const { data: team, isLoading: teamLoading, isError: noTeam, refetch: refetchTeam } = useGetMyTeam({
    query: { enabled: !!user, queryKey: getGetMyTeamQueryKey(), retry: false }
  });

  const hasTeam   = !!user && !!team && !noTeam;
  const needsTeam = !!user && (noTeam || !team) && !teamLoading;
  const isLoading = authLoading || (!!user && teamLoading);

  const loginUrl = `/api/login?returnTo=${encodeURIComponent(window.location.origin + import.meta.env.BASE_URL)}`;

  const dismissTitle = () => {
    sessionStorage.setItem("bvp-title-dismissed", "1");
    setShowTitle(false);
  };

  const handlePrimary = () => {
    if (isLoading) return;
    if (!user) { sessionStorage.setItem("bvp-title-dismissed", "1"); window.location.href = loginUrl; }
    else        { dismissTitle(); }
  };

  const handleSecondary = () => {
    if (isLoading) return;
    if (!user) { sessionStorage.setItem("bvp-title-dismissed", "1"); window.location.href = loginUrl; }
    else        { dismissTitle(); }
  };

  // ── Title screen (shown to everyone on fresh session) ──────────────────────
  if (showTitle) {
    return (
      <div className="relative h-screen w-full overflow-hidden bg-black">
        {showRules && <RulesPanel onClose={() => setShowRules(false)} />}

        <img
          src={`${import.meta.env.BASE_URL}title-hero.png`}
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
            <span className="text-white/70 text-xs font-semibold uppercase tracking-wide">Season 2026</span>
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
              Build your dream team. Conquer 11 cities across 9 countries. Claim the world championship.
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
                {hasTeam ? "CONTINUE" : "START NEW GAME"}
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors" />
              </Button>

              {/* Secondary action — only show when there's a meaningful distinction */}
              {!hasTeam && (
                <Button
                  size="lg"
                  variant="outline"
                  className="group border-white/30 bg-white/10 backdrop-blur hover:bg-white/20 text-white font-bold text-lg px-10 py-6 rounded-xl transition-all"
                  onClick={handleSecondary}
                  disabled={isLoading}
                  data-testid="button-continue"
                >
                  CONTINUE
                  <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              )}

              {/* Rules */}
              <Button
                size="lg"
                variant="outline"
                className="border-white/20 bg-white/5 backdrop-blur hover:bg-white/15 text-white/70 hover:text-white font-bold text-lg px-7 py-6 rounded-xl transition-all"
                onClick={() => setShowRules(true)}
              >
                <BookOpen className="mr-2 h-5 w-5" />
                RULES
              </Button>
            </div>

            <p className="mt-6 text-white/30 text-xs">
              {user
                ? `Signed in · ${hasTeam ? "Your progress is saved." : "Set up your team to begin."}`
                : "Sign in with your Replit account to save your progress across sessions."}
            </p>
          </div>
        </div>

        {/* Right-side stat pills */}
        <div className="hidden lg:flex absolute right-12 top-1/2 -translate-y-1/2 flex-col gap-3">
          {[
            { label: "World Tour Stops", value: "11" },
            { label: "Countries",        value: "9"  },
            { label: "Grand Final Prize",value: "$50k"},
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

  // ── First-time user — pick a club ───────────────────────────────────────────
  if (needsTeam) {
    return <ClubSelectionScreen onComplete={() => refetchTeam()} />;
  }

  return <>{children}</>;
}
