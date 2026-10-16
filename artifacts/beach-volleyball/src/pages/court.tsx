import { useEffect, useRef, useState } from "react";
import { readControlMode, saveControlMode, courtVolumes, MATCH_VOLUME_EVENT, MATCH_VOLUME_KEY, type ControlMode } from "@/lib/court-settings";
import { SoundSettings } from "@/components/sound-settings";
import { ControlsSettings } from "@/components/controls-settings";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Monitor, UploadCloud, Loader2, LogOut, Settings as SettingsIcon, X, Pause, Play } from "lucide-react";
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

// Final brief 5 Oct, Part C, and Update 1, overnight part 8: Auto or Manual is
// chosen on the Settings page (lib/court-settings.ts, the same stored key). It
// goes to the court in its URL when the court opens; the court can still
// switch it with Tab / View / Share, and tells this page, which stores it.
//
// Rob, 16 Oct: a Pause button above the court, in Auto and Manual. The court's
// own page pauses it (unity-build/index.html, "vbe-pause") and says when it has
// ("unity-paused:1" / ":0"); only Resume starts it again.
//
// Rob, 16 Oct: Settings on the match screen, without leaving the match (which
// forfeits it). The gear above the court opens Sound (master, music, crowd,
// commentary) and Controls (Auto / Manual and the controls) over the court;
// every change goes to the court at once. The court keeps playing, and is
// heard, while the focus is on these settings (unity-build/index.html).

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
  // Part C: the mode the court opened with (in its URL, so set once).
  const [openingMode] = useState<ControlMode>(readControlMode);
  // The mode now: the opening one, then the court's own switches and the settings over the match.
  const [mode, setMode] = useState<ControlMode>(openingMode);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paused, setPaused] = useState(false);

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
    if (openingMode === "manual") p.set("mode", "manual");
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
      if (e.data === "unity-loaded") {
        setUnityLoaded(true);
        sendMatchVolume();
        // Part C: the keyboard goes to the court, so WASD, Tab and the rest work at once.
        iframeRef.current?.focus();
        iframeRef.current?.contentWindow?.focus();
      }
      // Part C: the court switched mode itself (Tab / View / Share).
      if (typeof e.data === "string" && e.data.startsWith("unity-control-mode:")) {
        const m: ControlMode = e.data.endsWith("manual") ? "manual" : "auto";
        saveControlMode(m);
        setMode(m);
      }
      if (e.data === "unity-paused:1" || e.data === "unity-paused:0") setPaused(e.data === "unity-paused:1");
      if (e.data === "unity-match-finished") {
        queryClient.invalidateQueries();
        navigate("/");
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [navigate, queryClient]);

  // Update 1, O-5: the match sound's volumes (Settings > Sound) go to the
  // court when it has loaded and whenever they change, the way the control
  // mode's message goes (unity-build/index.html passes it to MatchManager).
  function sendMatchVolume() {
    // Each of the court's volumes times the master (Rob, 16 Oct).
    iframeRef.current?.contentWindow?.postMessage({ type: "vbe-volume", ...courtVolumes() }, "*");
  }
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === MATCH_VOLUME_KEY) sendMatchVolume(); };
    window.addEventListener(MATCH_VOLUME_EVENT, sendMatchVolume);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(MATCH_VOLUME_EVENT, sendMatchVolume);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // The settings over the match: Auto or Manual goes to the court at once (its own page passes it on).
  function chooseMode(m: ControlMode) {
    setMode(m);
    saveControlMode(m);
    iframeRef.current?.contentWindow?.postMessage({ type: "vbe-control-mode", mode: m }, "*");
  }
  function togglePause() {
    iframeRef.current?.contentWindow?.postMessage({ type: "vbe-pause", paused: !paused }, "*");
  }
  function closeSettings() {
    setSettingsOpen(false);
    // The keyboard goes back to the court.
    iframeRef.current?.focus();
    iframeRef.current?.contentWindow?.focus();
  }

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
      {unityLoaded && (
        <button
          type="button"
          data-testid="button-court-pause"
          aria-pressed={paused}
          onClick={togglePause}
          style={{
            flexShrink: 0, whiteSpace: "nowrap", marginLeft: "auto",
            display: "flex", alignItems: "center", gap: "6px", padding: "6px 14px", borderRadius: "6px",
            background: paused ? "rgba(245,158,11,0.85)" : "rgba(255,255,255,0.12)", color: paused ? "black" : "white", fontWeight: 700, fontSize: "12px",
            border: "1px solid rgba(255,255,255,0.25)", cursor: "pointer",
          }}
        >
          {paused ? <Play style={{ width: 14, height: 14 }} /> : <Pause style={{ width: 14, height: 14 }} />}
          {paused ? "Resume" : "Pause"}
        </button>
      )}
      <button
        type="button"
        data-testid="button-court-settings"
        aria-label="Settings"
        aria-expanded={settingsOpen}
        onClick={() => (settingsOpen ? closeSettings() : setSettingsOpen(true))}
        style={{
          flexShrink: 0, whiteSpace: "nowrap", marginLeft: unityLoaded ? undefined : "auto",
          display: "flex", alignItems: "center", gap: "6px", padding: "6px 14px", borderRadius: "6px",
          background: settingsOpen ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.12)", color: "white", fontWeight: 700, fontSize: "12px",
          border: "1px solid rgba(255,255,255,0.25)", cursor: "pointer",
        }}
      >
        <SettingsIcon style={{ width: 14, height: 14 }} />
        Settings
      </button>
      <button
        type="button"
        data-testid="button-leave-match"
        onClick={() => (matchId ? setConfirmLeave(true) : leaveMatch())}
        disabled={leaving}
        style={{
          flexShrink: 0, whiteSpace: "nowrap",
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
        {paused && (
          <div
            data-testid="court-paused"
            style={{
              position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 40,
              padding: "14px 28px", borderRadius: 12, background: "rgba(0,0,0,0.8)", color: "white",
              fontWeight: 900, fontSize: 28, letterSpacing: 2, pointerEvents: "none",
            }}
          >
            PAUSED
          </div>
        )}
        {settingsOpen && (
          <div
            role="dialog"
            aria-label="Settings"
            data-testid="court-settings-overlay"
            className="bg-background text-foreground border border-border shadow-2xl"
            onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); closeSettings(); } }}
            style={{
              position: "fixed", top: 52, right: 12, zIndex: 50, width: "min(620px, calc(100% - 24px))",
              maxHeight: "calc(100% - 64px)", overflowY: "auto", borderRadius: 12, padding: 16,
            }}
          >
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-lg font-black tracking-tight text-primary">Settings</h2>
              <button type="button" onClick={closeSettings} aria-label="Close settings" data-testid="button-close-court-settings"
                className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">The match carries on. Every change applies at once.</p>
            <h3 className="text-sm font-bold mb-2">Sound</h3>
            <SoundSettings onCourt />
            <h3 className="text-sm font-bold mt-5 mb-2">Controls</h3>
            <ControlsSettings mode={mode} onChoose={chooseMode} />
          </div>
        )}
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
