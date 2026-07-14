import { useEffect, useState } from "react";
import { Monitor, UploadCloud } from "lucide-react";

type BuildState = "checking" | "available" | "unavailable";

export default function ThreeDCourt() {
  const [buildState, setBuildState] = useState<BuildState>("checking");

  useEffect(() => {
    const buildUrl = `${import.meta.env.BASE_URL}unity-build/index.html`;
    fetch(buildUrl, { method: "HEAD" })
      .then((r) => setBuildState(r.ok ? "available" : "unavailable"))
      .catch(() => setBuildState("unavailable"));
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
      <iframe
        src={`${import.meta.env.BASE_URL}unity-build/index.html`}
        title="Beach Volleyball 3D Court"
        allow="fullscreen"
        style={{
          width: "100%",
          height: "100%",
          border: 0,
          display: "block",
          minWidth: 0,
        }}
      />
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
