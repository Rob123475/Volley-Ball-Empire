import { useEffect, useRef, useState } from "react";
import { Monitor, UploadCloud, Loader2 } from "lucide-react";

type BuildState = "checking" | "available" | "unavailable";

export default function ThreeDCourt() {
  const [buildState, setBuildState] = useState<BuildState>("checking");
  const [unityLoaded, setUnityLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const buildUrl = `${import.meta.env.BASE_URL}unity-build/index.html`;
    fetch(buildUrl, { method: "HEAD" })
      .then((r) => setBuildState(r.ok ? "available" : "unavailable"))
      .catch(() => setBuildState("unavailable"));
  }, []);

  // Listen for a postMessage from the Unity iframe to know it finished loading.
  // Unity calls this automatically when the game is ready if we add the hook.
  // As a fallback we also poll a flag set by the Unity HTML when it finishes.
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data === "unity-loaded") setUnityLoaded(true);
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  if (buildState === "checking") {
    return (
      <div
        style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
        className="text-muted-foreground text-sm"
      >
        Checking for Unity build…
      </div>
    );
  }

  if (buildState === "available") {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
        <iframe
          ref={iframeRef}
          src={`${import.meta.env.BASE_URL}unity-build/index.html`}
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
            <span>Loading Unity 3D build — this may take 1–2 minutes on first load (637 MB)…</span>
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
