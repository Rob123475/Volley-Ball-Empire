/**
 * Unity match brief (29 Sep), item 5 — a proper finish, then straight back to
 * the dashboard; and a way out mid-match.
 *
 * The behaviour inside the 3D court is proven in Unity (Editor/RallyPlanProof,
 * batch Play mode: the banner stays 5 s and then sends the player back by
 * itself, the crowd stops, the serve text goes, the boost stops). The finishing
 * on the server is harness/watched-result.mjs. This suite holds the two sides
 * of the wiring together, reading both repos' code as it is:
 *
 *   court.tsx     a "Leave match" button outside the Unity canvas, visible for
 *                 the whole match, that POSTs /matches/:id/leave and goes to the
 *                 dashboard; and on "unity-match-finished" from the court,
 *                 straight to the dashboard with every screen refreshed
 *   Unity         the result banner (5 s, then CourtBridge.MatchFinished; a
 *                 Continue button); the bridge posts exactly that message to the
 *                 parent page; the in-play header has no clock and no halves;
 *                 no A1/A2/B1/B2 name labels in the V19 scene
 *
 * Usage: node harness/court-finish.mjs
 */
import fs from "node:fs";
import path from "node:path";

const REPO = path.join(import.meta.dirname, "..");
const UNITY = process.env.UNITY_REPO ?? "C:/Users/rbonn/Game_Dev/VolleyBall Empire/volleyball";

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
const read = (p) => fs.readFileSync(p, "utf8");

console.log("=".repeat(72));
console.log("  UNITY 5: A PROPER FINISH, AND A WAY OUT");
console.log("=".repeat(72));

const court = read(path.join(REPO, "artifacts", "beach-volleyball", "src", "pages", "court.tsx"));
const iframeAt = court.indexOf("<iframe"), leaveAt = court.indexOf("{leaveBar}");
check("court.tsx: the Leave match bar sits outside the Unity canvas, above it, whenever the court is up",
  leaveAt > 0 && leaveAt < iframeAt && /data-testid="button-leave-match"/.test(court) && /"Leave match"/.test(court));
check("court.tsx: leaving POSTs /matches/:id/leave, then goes to the dashboard",
  /fetch\(`\/api\/matches\/\$\{matchId\}\/leave`, \{ method: "POST"/.test(court) && /navigate\("\/"\)/.test(court));
check("court.tsx: on \"unity-match-finished\" it goes straight to the dashboard, every screen refreshed",
  /e\.data === "unity-match-finished"\)\s*\{\s*queryClient\.invalidateQueries\(\);\s*navigate\("\/"\);/.test(court));

const unityFile = (...p) => path.join(UNITY, "Assets", ...p);
if (!fs.existsSync(unityFile("Scripts", "MatchManager.cs"))) {
  check(`the Unity project is at ${UNITY}`, false, "set UNITY_REPO");
} else {
  const banner = read(unityFile("Scripts", "MatchResultBanner.cs"));
  const bridge = read(unityFile("Scripts", "CourtBridge.cs"));
  const jslib = read(unityFile("Plugins", "WebGL", "CourtBridge.jslib"));
  const mm = read(unityFile("Scripts", "MatchManager.cs"));
  check("Unity: the banner shows 5 s, then sends the player back by itself; Continue goes at once",
    /ShowSeconds = 5f/.test(banner) && /CourtBridge\.Post\(CourtBridge\.MatchFinished\)/.test(banner) && /GUI\.Button\(.*"Continue"\)\) Leave\(\)/.test(banner));
  check("Unity: the banner shows the winner, the sets and each set's points",
    /WIN"/.test(banner) && /HomeSets\} - \{sc\.AwaySets/.test(banner) && /Set \{i \+ 1\}: \{s\[0\]\}-\{s\[1\]\}/.test(banner));
  check("Unity: the message is exactly the one court.tsx listens for, posted to the parent page",
    /MatchFinished = "unity-match-finished"/.test(bridge) && /window\.parent\.postMessage\(message, "\*"\)/.test(jslib));
  const gui = mm.slice(mm.indexOf("private void OnGUI()"));
  check("Unity: the in-play header is the set, sets won and points: no clock, no halves",
    /SET \{Score\.SetNumber\}/.test(gui) && !/Time:|HALF|currentTime/.test(mm));
  check("Unity: at the end, boosts stop, the serve text goes, the crowd stops",
    /Boost\.Stop\(\);[\s\S]{0,200}_serveMessage = "";[\s\S]{0,120}StopCrowd\(/.test(mm));
  const scene = read(unityFile("BeachVolleyball V19.unity"));
  check("Unity: no A1/A2/B1/B2 name labels in the V19 scene, and the label script is gone",
    !/m_text: [AB][12]\r?$/m.test(scene) && !fs.existsSync(unityFile("Scripts", "PlayerNameLabel.cs")));
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
process.exit(failures > 0 ? 1 : 0);
