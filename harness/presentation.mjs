/**
 * 1.2 Part B: TV presentation, the game page's side (headless; no Electron window, no save).
 * The court's side is proved in Unity batch mode with Unity closed (docs/update-1.2/proof/B*),
 * and this suite reads those proofs' results too.
 *
 *   B1  the camera looks: TV or Game, one choice for a played and one for a watched match,
 *       remembered on this PC; defaults Game (behind your baseline) when playing, TV when
 *       watching; chosen in Settings > Camera and in the court's own settings; sent to the
 *       court when it loads and when it changes; a change on the court comes back and is kept.
 *
 *   node harness/presentation.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const REPO = path.join(import.meta.dirname, "..");
const UNITY = process.env.UNITY_REPO ?? "C:/Users/rbonn/Game_Dev/VolleyBall Empire/volleyball";
const PROOF = path.join(REPO, "docs", "update-1.2", "proof");
const require = createRequire(import.meta.url);
const ts = require(path.join(REPO, "node_modules", "typescript"));
const FE = (p) => fs.readFileSync(path.join(REPO, "artifacts", "beach-volleyball", "src", p), "utf8");
const U = (p) => fs.readFileSync(path.join(UNITY, p), "utf8");

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  1.2 PART B: TV PRESENTATION (THE GAME PAGE'S SIDE)");
console.log("=".repeat(72));

// The real module (lib/court-settings.ts), compiled as it is, with a localStorage of our own.
function loadCourtSettings(store) {
  const src = FE("lib/court-settings.ts");
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  const localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  const window = { dispatchEvent: () => true };
  new Function("module", "exports", "localStorage", "window", "Event", js)(mod, mod.exports, localStorage, window, class { constructor(t) { this.type = t; } });
  return mod.exports;
}

console.log("\nB1. THE CAMERA LOOKS");
{
  const store = {};
  const cs = loadCourtSettings(store);
  const d = cs.readCourtCamera();
  check("nothing stored: a played match opens on Game, view 1 (behind your baseline); a watched one on TV",
    d.played.look === "game" && d.played.view === 1 && d.watched.look === "tv", JSON.stringify(d));
  check("what the court is sent", cs.cameraPrefs(d) === "played=game:1;watched=tv:1", cs.cameraPrefs(d));
  cs.saveCourtCamera({ played: { look: "tv", view: 2 }, watched: { look: "game", view: 5 } });
  const back = cs.readCourtCamera();
  check("a choice is stored and read back", back.played.look === "tv" && back.played.view === 2 && back.watched.look === "game" && back.watched.view === 5, JSON.stringify(back));
  store[cs.COURT_CAMERA_KEY] = JSON.stringify({ played: { look: "drone", view: 9 }, watched: "x" });
  const bad = cs.readCourtCamera();
  check("bad stored values are made good (the defaults)", bad.played.look === "game" && bad.played.view === 1 && bad.watched.look === "tv", JSON.stringify(bad));
  store[cs.COURT_CAMERA_KEY] = "{broken";
  check("a broken store reads as the defaults", cs.cameraPrefs(cs.readCourtCamera()) === "played=game:1;watched=tv:1");
  const fromCourt = cs.cameraFromCourt("unity-camera:played:game:3");
  check("a change made on the court (keys 1-6, V, the pad) is kept for that kind of match",
    fromCourt && fromCourt.played.look === "game" && fromCourt.played.view === 3 && JSON.parse(store[cs.COURT_CAMERA_KEY]).played.view === 3, JSON.stringify(fromCourt));
  check("anything else from the court is not taken", cs.cameraFromCourt("unity-camera:played:game:7") === null && cs.cameraFromCourt("unity-camera:both:tv:1") === null);
  check("six views, named as the court names them", cs.CAMERA_VIEWS.length === 6
    && U("Assets/Scripts/CourtCamera.cs").includes(cs.CAMERA_VIEWS.map((v) => `"${v}"`).join(", ")), cs.CAMERA_VIEWS.join(" | "));
}
{
  const settings = FE("pages/settings.tsx"), court = FE("pages/court.tsx"), panel = FE("components/camera-settings.tsx"), lib = FE("lib/court-settings.ts");
  const html = fs.readFileSync(path.join(REPO, "artifacts", "beach-volleyball", "public", "unity-build", "index.html"), "utf8");
  check("(source) Settings has a Camera card with the panel, stored at once", /<CameraSettings camera=\{camera\} onChange=\{chooseCamera\} \/>/.test(settings) && /saveCourtCamera\(c\)/.test(settings));
  check("(source) the panel offers TV and Game for playing and for watching, and the six views for Game",
    /camera-\$\{id\}-tv/.test(panel) && /camera-\$\{id\}-game/.test(panel) && /CAMERA_VIEWS\.map/.test(panel) && /id="played"/.test(panel) && /id="watched"/.test(panel));
  check("(source) the court's own settings carry it too, and a change goes to the court at once",
    /<CameraSettings camera=\{camera\} onChange=\{chooseCamera\} \/>/.test(court) && /function chooseCamera\(c: CourtCamera\) \{\s*setCamera\(c\);\s*saveCourtCamera\(c\);\s*sendCamera\(c\);/.test(court));
  check("(source) the court is sent both choices when it has loaded", /sendMatchVolume\(\);\s*sendCamera\(\);/.test(court)
    && /postMessage\(\{ type: "vbe-camera", prefs: cameraPrefs\(c\) \}/.test(court));
  check("(source) a change on the court comes back and is kept", /startsWith\("unity-camera:"\)/.test(court) && /cameraFromCourt\(e\.data\)/.test(court));
  check("(source) the court's page passes it to the court camera, only in the shape it expects",
    html.includes(`d.type !== "vbe-camera"`) && html.includes(`SendMessage("Camera_Gameplay_Close", "SetCameraPrefs", d.prefs)`)
    && html.includes("/^played=(tv|game):[1-6];watched=(tv|game):[1-6]$/"));
  const cc = U("Assets/Scripts/CourtCamera.cs");
  check("(Unity source) the court camera takes it, and tells the page in the shape the page reads",
    /public void SetCameraPrefs\(string prefs\)/.test(cc) && cc.includes('CourtBridge.Post($"unity-camera:{(_played ? "played" : "watched")}:{pref}")'));
  check("(source) the controls panel names the new camera keys (no old 1-2-3 line)",
    /Camera look", how: "V \(L3 on a pad\)/.test(lib) && /Game views", how: "1 to 6/.test(lib) && !/1, 2 and 3/.test(lib));
  const proof = path.join(PROOF, "B1", "b1-court-camera.txt");
  const text = fs.existsSync(proof) ? fs.readFileSync(proof, "utf8") : "";
  const n = (text.match(/CHECK .*: PASS/g) ?? []).length;
  check("the court's own proof (Unity batch, V19): the TV director and the six Game views", /RESULT: PASS/.test(text), `${n} checks passed, ${path.relative(REPO, proof)}`);
}

console.log("\n" + "=".repeat(72));
console.log(`  ${failures === 0 ? "PASS" : "FAIL"}: ${checks - failures}/${checks} checks`);
console.log("=".repeat(72));
process.exit(failures === 0 ? 0 : 1);
