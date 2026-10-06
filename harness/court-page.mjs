/**
 * Unity match brief (29 Sep), item 6 — the WebGL page looks like our game.
 *
 * Rob, 29 Sep: the 3D court still used Unity's sample page (Unity logo, the
 * word "volleyball", a fixed 960x600 canvas with grey around it, "Unity Web
 * Player | volleyball", company "DefaultCompany"); and the game's loading strip
 * ("637 MB") never went away because the page never said "unity-loaded".
 *
 * Asserted, on the shipped page (artifacts/beach-volleyball/public/unity-build/
 * index.html) and the Unity project's settings: the title and names are the
 * game's; no Unity logo, footer, build title or TemplateData; the canvas fills
 * the page at 100% and follows its size; the page posts "unity-loaded" to the
 * game page once the instance is ready, which is exactly what court.tsx waits
 * for; the loading strip carries no stale size. The headless render of the
 * page (scripts/webgl-proof/court-proof.mjs) is in the status file.
 *
 * Usage: node harness/court-page.mjs
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
console.log("=".repeat(72));
console.log("  UNITY 6: THE 3D COURT'S PAGE LOOKS LIKE OUR GAME");
console.log("=".repeat(72));

const dir = path.join(REPO, "artifacts", "beach-volleyball", "public", "unity-build");
const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
const visible = html.replace(/<title>[\s\S]*?<\/title>/, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");

check("title: \"Beach Volleyball Empire\"", /<title>Beach Volleyball Empire<\/title>/.test(html));
check("no Unity logo, footer, build title or fullscreen button", !/unity-logo|unity-footer|unity-build-title|unity-fullscreen-button|TemplateData/.test(html));
check("no \"volleyball\" or \"Unity\" anywhere a player can read", !/volleyball|unity/i.test(visible.replace(/id="[^"]*"|class="[^"]*"|src="[^"]*"/g, "")));
check("the TemplateData folder (Unity's sample images) is gone", !fs.existsSync(path.join(dir, "TemplateData")));
check("the canvas fills the page and follows its size (no fixed 960x600)",
  /#unity-canvas \{[^}]*width: 100%; height: 100%/.test(html) && !/960|600px/.test(html) && /#court \{ position: fixed; inset: 0; \}/.test(html));
check("companyName \"Bean & Label\", productName \"Beach Volleyball Empire\"",
  /companyName: "Bean & Label"/.test(html) && /productName: "Beach Volleyball Empire"/.test(html));
check("\"unity-loaded\" is posted to the game page once the instance is ready",
  /createUnityInstance\([\s\S]*\.then\(function \(unityInstance\) \{[\s\S]*window\.parent\.postMessage\("unity-loaded", "\*"\)/.test(html));

const court = fs.readFileSync(path.join(REPO, "artifacts", "beach-volleyball", "src", "pages", "court.tsx"), "utf8");
// Final brief 5 Oct, Part C: the handler is a block now (it also gives the court the keyboard).
check("court.tsx hides its loading strip on exactly that message", /e\.data === "unity-loaded"\)\s*\{?\s*setUnityLoaded\(true\)/.test(court));
check("the loading strip carries no stale download size", !/\d+\s*MB/.test(court), (court.match(/Loading[^<]*/) ?? [""])[0]);

const ps = path.join(UNITY, "ProjectSettings", "ProjectSettings.asset");
if (fs.existsSync(ps)) {
  const s = fs.readFileSync(ps, "utf8");
  check("Unity player settings: company Bean & Label, product Beach Volleyball Empire",
    /^\s*companyName: Bean & Label\s*$/m.test(s) && /^\s*productName: Beach Volleyball Empire\s*$/m.test(s));
} else check(`the Unity project is at ${UNITY}`, false, "set UNITY_REPO");

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
process.exit(failures > 0 ? 1 : 0);
