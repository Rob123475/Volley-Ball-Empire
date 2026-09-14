import { useGetCareerHistory } from "@workspace/api-client-react";
import { ShieldX, LogOut, Scissors } from "lucide-react";

/**
 * The career-ending screen (R-09, R-60).
 *
 * A TOP-LEVEL route (see App.tsx), deliberately outside <AuthGuard>/<Shell>:
 * by the time this renders the career has already been finished server-side
 * (endCareer — retiredAt set, archived to the Hall of Fame, disconnected from
 * the session), so there is no active team any more. AuthGuard hard-redirects
 * to "/" the moment it notices that, which would bounce a screen mounted inside
 * it before the player ever saw it.
 *
 * It reads the most recent ending in the manager history itself (GET
 * /careers/history only needs the logged-in user). R-60: a career ends three
 * ways here — sacked, resigned or contract broken — and each shows its own
 * reason, in the words the server recorded.
 */
const ENDINGS = {
  dismissal:      { title: "You've Been Sacked",        Icon: ShieldX,  tone: "rose"  },
  resignation:    { title: "You Resigned",              Icon: LogOut,   tone: "amber" },
  contract_break: { title: "You Broke Your Contract",   Icon: Scissors, tone: "rose"  },
} as const;

type EndingType = keyof typeof ENDINGS;
const isEnding = (t: string): t is EndingType => t in ENDINGS;

export default function CareerEnd() {
  const { data: history, isLoading } = useGetCareerHistory();
  // Newest first, as the server orders it.
  const latest = history?.find((h) => isEnding(h.type)) ?? null;
  const ending = latest && isEnding(latest.type) ? ENDINGS[latest.type] : ENDINGS.dismissal;
  const { Icon } = ending;
  const amber = ending.tone === "amber";

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0a0f1e] p-6">
      <div className={`w-full max-w-lg rounded-2xl border ${amber ? "border-amber-500/25" : "border-rose-500/25"} bg-[#0f1117] p-8 text-center space-y-6`} data-testid="career-end">
        <div className={`mx-auto h-16 w-16 rounded-2xl ${amber ? "bg-amber-500/15 border-amber-500/25" : "bg-rose-500/15 border-rose-500/25"} border flex items-center justify-center`}>
          <Icon className={`h-8 w-8 ${amber ? "text-amber-400" : "text-rose-400"}`} />
        </div>

        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-wide">
            {isLoading ? "Career ended" : ending.title}
          </h1>
          <p className="text-sm text-white/50 mt-2 leading-relaxed" data-testid="career-end-reason">
            {isLoading ? "Loading…" : latest?.description ?? "This career has ended."}
          </p>
        </div>

        <div className="rounded-xl border border-white/8 bg-white/3 p-4 text-xs text-white/40 leading-relaxed">
          This career has ended and been archived to the Hall of Fame. Your history is preserved — start a
          new career or continue with another save.
        </div>

        <button
          onClick={() => { window.location.href = "/"; }}
          className={`w-full rounded-xl ${amber ? "bg-amber-600 hover:bg-amber-500 border-amber-500" : "bg-rose-600 hover:bg-rose-500 border-rose-500"} text-white font-black py-3 border transition-colors`}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
