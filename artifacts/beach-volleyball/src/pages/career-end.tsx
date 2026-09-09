import { useGetCareerHistory } from "@workspace/api-client-react";
import { ShieldX } from "lucide-react";

/**
 * R-09: the career-ending screen "not a silent stop" requires.
 *
 * A TOP-LEVEL route (see App.tsx), deliberately outside <AuthGuard>/<Shell>:
 * by the time this renders the career has already been fully retired
 * server-side (endCareer — retiredAt set, archived to Hall of Fame,
 * disconnected from the session), so there is no active team any more.
 * AuthGuard hard-redirects to "/" the moment it notices that, which would
 * bounce a screen mounted inside it before the player ever saw it.
 *
 * No data needs to be passed in via navigation state — this reads the most
 * recent "dismissal" history entry itself (GET /careers/history only needs
 * the logged-in user, not an active career), so it renders correctly no
 * matter which page's confidence read was the one that triggered the sack.
 */
export default function CareerEnd() {
  const { data: history, isLoading } = useGetCareerHistory();
  const latestDismissal = history?.find(h => h.type === "dismissal") ?? null;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0a0f1e] p-6">
      <div className="w-full max-w-lg rounded-2xl border border-rose-500/25 bg-[#0f1117] p-8 text-center space-y-6">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center">
          <ShieldX className="h-8 w-8 text-rose-400" />
        </div>

        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-wide">You've Been Sacked</h1>
          <p className="text-sm text-white/50 mt-2 leading-relaxed">
            {isLoading
              ? "Loading…"
              : latestDismissal?.description
                ?? "The board's confidence in you collapsed to zero, and your contract has been terminated."}
          </p>
        </div>

        <div className="rounded-xl border border-white/8 bg-white/3 p-4 text-xs text-white/40 leading-relaxed">
          This career has ended and been archived to the Hall of Fame. Your history is preserved — start a
          new career or continue with another save.
        </div>

        <button
          onClick={() => { window.location.href = "/"; }}
          className="w-full rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black py-3 border border-rose-500 transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
