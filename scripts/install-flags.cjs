#!/usr/bin/env node
/**
 * 1.1.3 (brief A2): real flags on every screen, from the MIT `flag-icons` set
 * (ISO 3166-1 alpha-2 SVGs, plus gb-eng / gb-sct / gb-wls), copied into the game
 * so they work offline.
 *
 *   1. copies <flag-icons>/flags/4x3/*.svg and its LICENSE into
 *      artifacts/beach-volleyball/public/images/flags/ (the frontend's
 *      <Flag nation=... /> draws /images/flags/<flagCode()>.svg)
 *   2. with --unity <Unity project>, renders the same flags as 128 x 96 PNG
 *      textures into Assets/Resources/Flags/<code>.png, for the podium's name
 *      plates (A5); only the flags of nations the game knows (every code
 *      continents.ts's flagCode() can return), not all 271
 *
 * The package is fetched with `npm pack flag-icons@<version>` and unpacked
 * outside the repo; the worktrees' node_modules are junctions to the main
 * tree's, so it is not added to a package.json here (docs/STATUS-1.1.3.md A2).
 *
 * Usage:
 *   node scripts/install-flags.cjs <unpacked flag-icons "package" folder> [--unity "<Unity project>"]
 */
const fs = require("fs");
const path = require("path");

const REPO = path.resolve(__dirname, "..");
const TAG = "[install-flags]";
const OUT = path.join(REPO, "artifacts/beach-volleyball/public/images/flags");
const src = process.argv[2];
const unityAt = process.argv.indexOf("--unity");
const UNITY = unityAt > 0 ? process.argv[unityAt + 1] : null;
if (!src || !fs.existsSync(path.join(src, "flags", "4x3"))) {
  console.error(`${TAG} usage: node scripts/install-flags.cjs <flag-icons package folder> [--unity <Unity project>]`);
  process.exit(1);
}
const pkg = JSON.parse(fs.readFileSync(path.join(src, "package.json"), "utf8"));
if (pkg.name !== "flag-icons" || pkg.license !== "MIT") {
  console.error(`${TAG} ${src} is not the MIT flag-icons package (${pkg.name} ${pkg.license})`);
  process.exit(1);
}

/** Every flag code the game can ask for: continents.ts's iso() lines, lower-cased, and the three subdivisions. */
function gameCodes() {
  const s = fs.readFileSync(path.join(REPO, "lib/db/src/schema/continents.ts"), "utf8");
  const codes = new Set([...s.matchAll(/^iso\("([A-Z]{2})"/gm)].map((m) => m[1].toLowerCase()));
  for (const m of s.matchAll(/"(gb-[a-z]{3})"/g)) codes.add(m[1]);
  return [...codes].sort();
}

fs.mkdirSync(OUT, { recursive: true });
const svgs = fs.readdirSync(path.join(src, "flags", "4x3")).filter((f) => f.endsWith(".svg"));
for (const f of svgs) fs.copyFileSync(path.join(src, "flags", "4x3", f), path.join(OUT, f));
fs.writeFileSync(path.join(OUT, "LICENSE.txt"), `flag-icons ${pkg.version} (${pkg.homepage ?? "https://github.com/lipis/flag-icons"})\n\n`
  + fs.readFileSync(path.join(src, "LICENSE"), "utf8").replace(/\r\n/g, "\n"));
const missing = gameCodes().filter((c) => !svgs.includes(`${c}.svg`));
console.log(`${TAG} ${svgs.length} flags (flag-icons ${pkg.version}, 4x3) -> ${path.relative(REPO, OUT)}`);
if (missing.length) { console.error(`${TAG} the set has no flag for: ${missing.join(", ")}`); process.exit(1); }

if (UNITY) {
  const sharp = require(path.join(REPO, "scripts/node_modules/sharp"));
  const dir = path.join(UNITY, "Assets", "Resources", "Flags");
  fs.mkdirSync(dir, { recursive: true });
  (async () => {
    const codes = gameCodes();
    for (const c of codes) {
      await sharp(fs.readFileSync(path.join(OUT, `${c}.svg`)), { density: 300 })
        .resize(128, 96, { fit: "fill" }).png().toFile(path.join(dir, `${c}.png`));
    }
    console.log(`${TAG} ${codes.length} PNG textures (128 x 96) -> ${dir}`);
  })();
}
