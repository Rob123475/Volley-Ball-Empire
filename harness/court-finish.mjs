/**
 * Unity match brief (29 Sep), item 5 — a proper finish, then straight back to
 * the dashboard; and a way out mid-match.
 *
 * The behaviour inside the 3D court is proven in Unity (Editor/RallyPlanProof,
 * batch Play mode: the result box stays up by itself until Continue, which
 * sends the player back (overnight 1 Oct, N-29); the crowd stops, the serve
 * text goes, the boost stops). The finishing
 * on the server is harness/watched-result.mjs. This suite holds the two sides
 * of the wiring together, reading both repos' code as it is:
 *
 *   court.tsx     a "Leave match" button outside the Unity canvas, visible for
 *                 the whole match, that POSTs /matches/:id/leave and goes to the
 *                 dashboard; and on "unity-match-finished" from the court,
 *                 straight to the dashboard with every screen refreshed
 *   Unity         the result box (no automatic return; its Continue button is
 *                 the only thing that posts CourtBridge.MatchFinished; N-29);
 *                 the bridge posts exactly that message to the
 *                 parent page; the in-play header (Scoreboard.cs since N-27) has
 *                 no clock and no halves;
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
// Overnight brief 30 Sep, item 23: a confirm box first, in Rob's words; no sim option.
check("court.tsx: Leave match asks first: \"Leave the match?\" / \"Leaving forfeits it: it counts as a loss and pays no prize money.\", Stay or Leave and forfeit",
  /onClick=\{\(\) => \(matchId \? setConfirmLeave\(true\) : leaveMatch\(\)\)\}/.test(court)
  && /<AlertDialogTitle>Leave the match\?<\/AlertDialogTitle>/.test(court)
  && /Leaving forfeits it: it counts as a loss and pays no prize money\./.test(court)
  && /data-testid="button-confirm-leave" onClick=\{leaveMatch\}/.test(court) && />Stay</.test(court));
check("court.tsx: no option to simulate the rest of the match", !/[Ss]im(ulate)?|finishes the match from the score/.test(court.replace(/\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "")));
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
  // Overnight 1 Oct, N-29: the result stays up in a box; only Continue sends the player back.
  const posts = banner.match(/CourtBridge\.Post\(/g) ?? [];
  const cont = banner.slice(banner.indexOf("public void Continue()"));
  check("Unity: the result box has a Continue button, and only Continue sends the player back (no automatic return)",
    /_continue\.onClick\.AddListener\(Continue\)/.test(banner) && posts.length === 1
    && /CourtBridge\.Post\(CourtBridge\.MatchFinished\)/.test(cont.slice(0, cont.indexOf("\n    }")))
    && !/ShowSeconds|OnGUI/.test(banner.replace(/\/\/.*$/gm, "")));
  check("Unity: the banner shows the winner, the sets and each set's points",
    /WIN"/.test(banner) && /HomeSets\} - \{sc\.AwaySets/.test(banner) && /Set \{i \+ 1\}: \{s\[0\]\}-\{s\[1\]\}/.test(banner));
  check("Unity: the message is exactly the one court.tsx listens for, posted to the parent page",
    /MatchFinished = "unity-match-finished"/.test(bridge) && /window\.parent\.postMessage\(message, "\*"\)/.test(jslib));
  const board = read(unityFile("Scripts", "Scoreboard.cs"));
  check("Unity: the in-play header is the set, sets won and points: no clock, no halves",
    /SET \{m\.Score\.SetNumber\}   SETS \{m\.setsA\}-\{m\.setsB\}/.test(board) && !/Time:|HALF|currentTime/.test(mm + board) && !/OnGUI/.test(mm));
  check("Unity: at the end, boosts stop, the serve text and the action word go, the commentators stop, the crowd stops",
    /Boost\.Stop\(\);[\s\S]{0,200}_serveMessage = "";\s*ActionWordBanner\.Clear\(\);\s*if \(CommentaryManager\.Instance != null\) CommentaryManager\.Instance\.Stop\(\);[\s\S]{0,80}StopCrowd\(/.test(mm));
  const scene = read(unityFile("BeachVolleyball V19.unity"));
  check("Unity: no A1/A2/B1/B2 name labels in the V19 scene, and the label script is gone",
    !/m_text: [AB][12]\r?$/m.test(scene) && !fs.existsSync(unityFile("Scripts", "PlayerNameLabel.cs")));
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
process.exit(failures > 0 ? 1 : 0);
