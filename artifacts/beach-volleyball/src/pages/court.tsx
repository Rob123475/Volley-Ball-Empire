import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Monitor, UploadCloud, Loader2, LogOut } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useListCareerSaves,
  getListCareerSavesQueryKey,
} from "@workspace/api-client-react";

type BuildState = "checking" | "available" | "unavailable";

export default function ThreeDCourt() {
  const [buildState, setBuildState] = useState<BuildState>("checking");
  const [unityLoaded, setUnityLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  // Overnight brief 30 Sep, item 23: leaving a match in play asks first.
  const [confirmLeave, setConfirmLeave] = useState(false);

  // matchId set by match-day-modal's "Watch Match" button (navigate(`/court?matchId=...`)).
  // Unity reads this from its own iframe location and calls
  // GET /unity/match-state?matchId=<id>.
  const matchId = new URLSearchParams(window.location.search).get("matchId");

  // R-38: the build also needs the career id. /unity/match-state is career-scoped
  // and used to read it from the session, which the Unity side never has - the
  // WebGL build runs in an iframe with no app session, and Editor Play mode has no
  // cookie at all. So the id travels in the URL, and Unity reads it back out of
  // its own location.
  const { data: savesData } = useListCareerSaves({
    query: { queryKey: getListCareerSavesQueryKey() },
  });
  const careerSaveId = savesData?.activeCareerSaveId ?? null;

  // Undefined means the query has not settled. Waiting matters: mounting the
  // iframe before the id is known and then adding it would change src and reload
  // the whole Unity build.
  const careerSettled = savesData !== undefined;

  const unityQuery = (() => {
    const p = new URLSearchParams();
    if (careerSaveId != null) p.set("careerSaveId", String(careerSaveId));
    if (matchId) p.set("matchId", matchId);
    const qs = p.toString();
    return qs ? `?${qs}` : "";
  })();

  useEffect(() => {
    const buildUrl = `${import.meta.env.BASE_URL}unity-build/index.html`;
    fetch(buildUrl, { method: "HEAD" })
      .then((r) => setBuildState(r.ok ? "available" : "unavailable"))
      .catch(() => setBuildState("unavailable"));
  }, []);

  // Listen for a postMessage from the Unity iframe to know it finished loading.
  // Unity calls this automatically when the game is ready if we add the hook.
  // As a fallback we also poll a flag set by the Unity HTML when it finishes.
  // Unity brief item 5, overnight 1 Oct N-29: when the match is over the court
  // shows its result in a box until the player presses Continue (nothing leaves
  // by itself), then says "unity-match-finished": the result is already
  // recorded, so this goes straight back to the dashboard, with every screen's
  // data refreshed.
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data === "unity-loaded") setUnityLoaded(true);
      if (e.data === "unity-match-finished") {
        queryClient.invalidateQueries();
        navigate("/");
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [navigate, queryClient]);

  // Unity brief item 5: the only way out used to be closing the game. Leaving
  // mid-match finishes it from the last score the court sent (item 4) and goes
  // back to the dashboard.
  async function leaveMatch() {
    setLeaving(true);
    setLeaveError(null);
    try {
      if (matchId) {
        const r = await fetch(`/api/matches/${matchId}/leave`, { method: "POST", credentials: "same-origin" });
        if (!r.ok && r.status !== 409) throw new Error(`HTTP ${r.status}`);
      }
      queryClient.invalidateQueries();
      navigate("/");
    } catch (err) {
      setLeaveError(err instanceof Error ? err.message : String(err));
      setLeaving(false);
    }
  }

  // N-30: the bar always fits the window: it is the full width of the court
  // page (pinned to the window in App.tsx), the note wraps onto a second line
  // rather than run under the button, and the button never shrinks or wraps.
  const leaveBar = (
    <div
      data-testid="court-leave-bar"
      style={{
        display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "6px 12px",
        padding: "6px 12px", background: "rgba(0,0,0,0.9)", borderBottom: "1px solid rgba(255,255,255,0.1)",
        flexShrink: 0, color: "rgba(255,255,255,0.7)", fontSize: "12px", width: "100%", boxSizing: "border-box",
      }}
    >
      <span style={{ flex: "1 1 160px", minWidth: 0, overflowWrap: "anywhere" }}>
        {leaveError ? `Could not leave: ${leaveError}` : matchId ? "Leaving forfeits the match." : ""}
      </span>
      <button
        type="button"
        data-testid="button-leave-match"
        onClick={() => (matchId ? setConfirmLeave(true) : leaveMatch())}
        disabled={leaving}
        style={{
          flexShrink: 0, whiteSpace: "nowrap", marginLeft: "auto",
          display: "flex", alignItems: "center", gap: "6px", padding: "6px 14px", borderRadius: "6px",
          background: "rgba(255,255,255,0.12)", color: "white", fontWeight: 700, fontSize: "12px",
          border: "1px solid rgba(255,255,255,0.25)", cursor: leaving ? "default" : "pointer", opacity: leaving ? 0.6 : 1,
        }}
      >
        {leaving ? <Loader2 style={{ width: 14, height: 14 }} /> : <LogOut style={{ width: 14, height: 14 }} />}
        {matchId ? "Leave match" : "Back to dashboard"}
      </button>
      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent data-testid="dialog-leave-match">
          <AlertDialogHeader>
            <AlertDialogTitle>Leave the match?</AlertDialogTitle>
            <AlertDialogDescription>
              Leaving forfeits it: it counts as a loss and pays no prize money.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-stay-in-match">Stay</AlertDialogCancel>
            <AlertDialogAction data-testid="button-confirm-leave" onClick={leaveMatch}>
              Leave and forfeit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  if (buildState === "checking" || !careerSettled) {
    return (
      <div
        style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
        className="text-muted-foreground text-sm"
      >
        {buildState === "checking" ? "Checking for Unity build…" : "Loading career…"}
      </div>
    );
  }

  if (buildState === "available") {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
        {leaveBar}
        <iframe
          ref={iframeRef}
          src={`${import.meta.env.BASE_URL}unity-build/index.html${unityQuery}`}
          title="Beach Volleyball 3D Court"
          allow="fullscreen"
          onLoad={() => {
            // The iframe load fires when the HTML is parsed — not when Unity finishes.
            // We give Unity up to 5 minutes to call postMessage("unity-loaded").
            // If it never arrives, show a subtle hint but keep the iframe visible.
          }}
          style={{
            width: "100%",
            flex: 1,
            border: 0,
            display: "block",
            minWidth: 0,
            minHeight: 0,
          }}
        />
        {!unityLoaded && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 16px",
              background: "rgba(0,0,0,0.85)",
              borderTop: "1px solid rgba(255,255,255,0.08)",
              fontSize: "12px",
              color: "rgba(255,255,255,0.45)",
              flexShrink: 0,
            }}
          >
            <Loader2
              style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }}
            />
            {/* Unity brief item 6: the download size shown here was stale
                and changes with every export, so no number. The court's page
                posts "unity-loaded" when it is ready, which hides this strip. */}
            <span>Loading the 3D court…</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1.5rem", textAlign: "center", padding: "1.5rem" }}
    >
      <div className="rounded-full bg-muted p-5">
        <Monitor className="h-10 w-10 text-muted-foreground" />
      </div>
      <div className="space-y-2 max-w-sm">
        <h2 className="text-lg font-bold tracking-tight">Unity 3D Court not available</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Upload the latest Unity WebGL build to{" "}
          <code className="text-xs bg-muted rounded px-1.5 py-0.5 font-mono">
            public/unity-build/
          </code>{" "}
          to enable the 3D match viewer.
        </p>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground border border-dashed border-border rounded-lg px-4 py-3">
        <UploadCloud className="h-4 w-4 shrink-0" />
        <span>
          Place <code className="font-mono">index.html</code> and Unity build files in{" "}
          <code className="font-mono">public/unity-build/</code>
        </span>
      </div>
    </div>
  );
}
