# Packaging the desktop app

How `artifacts/beach-volleyball` (frontend) + `artifacts/api-server` (backend)
get turned into the Windows Electron build under `electron/`. The ordering
below is non-obvious and easy to get wrong — read this before changing the
pipeline, not after.

## What ships where

The packaged app is `electron/main.js` forking the compiled API server as a
child process and pointing a `BrowserWindow` at `http://localhost:4173`
(`SERVER_PORT` in `electron/main.js`). `package.json`'s `build.extraResources`
controls what electron-builder copies into `resources/`:

| Source (repo) | → | Packaged path | Used for |
|---|---|---|---|
| `artifacts/api-server/dist` | → | `resources/server/dist` | the compiled server (`index.mjs` + its native deps) |
| `artifacts/beach-volleyball/dist/public` | → | `resources/public` | the built frontend + everything from `beach-volleyball/public/` (Vite copies `public/` into `dist/public/` automatically on build) |
| `lib/db/volleyball-empire.sqlite` | → | `resources/starter-db` | first-launch starter DB, copied to per-user `userData` on first run |

### Why `api-server/dist` ships with `"filter": ["**/*", "!public/**"]`

`scripts/sync-public.cjs` copies the built frontend into
`artifacts/api-server/dist/public`, because `electron/main.js` sets
`PUBLIC_DIR` there **when unpackaged**. A packaged app is given
`resources/public` instead, filled from the second row of the table above.

That copy is therefore dev-only, and without the filter it is packaged as well —
the entire frontend, Unity build included, shipping twice with the second copy
never opened. It cost **1,094 MB**: the installer was 1,780 MB and is 686 MB
with the filter in place.

Do not remove the filter, and do not add a `"//"` comment key next to it —
electron-builder validates its config against a schema and rejects unknown
properties, so the build fails before it starts.

`electron/main.js` picks paths based on `app.isPackaged`:
- **Packaged**: `PUBLIC_DIR = process.resourcesPath/public`, server entry =
  `process.resourcesPath/server/dist/index.mjs`.
- **Unpackaged** (`electron:dev`, or running the server standalone):
  `PUBLIC_DIR = artifacts/api-server/dist/public`, server entry =
  `artifacts/api-server/dist/index.mjs`.

That second row is the trap — see [The dist/public trap](#the-distpublic-trap-dont-skip-this).

The Unity WebGL `.data`/`.wasm` under `unity-build/Build/` are served
Brotli-precompressed rather than raw — see [Brotli-precompressed Unity
assets](#brotli-precompressed-unity-assets) — which adds its own
double-shipping trap, [The Unity double-ship
trap](#the-unity-double-ship-trap-dont-skip-this-either).

## Full rebuild + repackage, in order

```powershell
# 0a. Regenerate the .br siblings for the Unity build if the build changed
#    (skips work if they're already up to date - safe to always run).
#    See "Brotli-precompressed Unity assets" below.
node scripts/compress-unity-data.cjs

# 0b. Rebuild native modules (better-sqlite3) for Electron's ABI - BEFORE
#    step 1, not after. Step 1 vendors better-sqlite3 into
#    artifacts/api-server/dist/node_modules from whatever is currently in
#    the pnpm store, so the store copy must already be Electron-ABI by then.
#    `pnpm exec electron-rebuild -f -w better-sqlite3` can silently no-op -
#    it may print "Rebuild Complete" without producing a new file. Verify a
#    freshly-timestamped .node file actually appeared; if not, drive
#    node-gyp directly. See "Native module ABI" below.
find node_modules artifacts/api-server/dist -name better_sqlite3.node -delete
pnpm exec electron-rebuild -f -w better-sqlite3
find node_modules -name better_sqlite3.node -exec ls -la {} \;   # check the timestamp is today

# 1. Typecheck + build every workspace (frontend, api-server, scripts, etc.)
#    vite needs these two env vars even for a one-shot build, not just dev.
#    This copies public/ (including the .br files from step 0) into
#    artifacts/beach-volleyball/dist/public.
$env:PORT = "5173"; $env:BASE_PATH = "/"
pnpm run build

# 2. api-server's build.mjs wipes artifacts/api-server/dist/ on every build,
#    so if you want a standalone (non-Electron) dev server to serve the new
#    images, re-copy AFTER building, not before:
Remove-Item -Recurse -Force artifacts/api-server/dist/public -ErrorAction SilentlyContinue
Copy-Item -Recurse artifacts/beach-volleyball/public/* artifacts/api-server/dist/public/

# 3. Strip that same folder again before packaging — see next section.
Remove-Item -Recurse -Force artifacts/api-server/dist/public

# 4. Package. See "NSIS installer" below for the Bitdefender prerequisite.
#    electron-builder's beforePack hook (scripts/before-pack.cjs) runs
#    automatically here, chaining two checks: it aborts loudly if the .br
#    files are missing or stale, strips the raw Unity .data/.wasm from
#    beach-volleyball/dist/public for you if step 1 put them back (see "The
#    Unity double-ship trap" below), and separately aborts if the vendored
#    better-sqlite3 fails to load under Electron's actual runtime (see
#    "Native module ABI" below). There is no longer a manual "strip before
#    you package" step, or a way to accidentally ship a broken DB binary,
#    to forget.
pnpm run electron:build

# 5. Nothing to restore. `pnpm run build` runs scripts/sync-public.cjs after
#    every workspace build, which copies artifacts/beach-volleyball/dist/public
#    into artifacts/api-server/dist/public and FAILS the build if the frontend
#    is not there.
```

### Why that step used to exist, and why it does not now

`artifacts/api-server/build.mjs` wipes its entire `dist/` on every build, and
nothing put `dist/public` back. In an unpackaged run `electron/main.js` points
`PUBLIC_DIR` at `artifacts/api-server/dist/public`, so after any api-server
build the app started cleanly, logged nothing wrong, and served Express's own
`Cannot GET /` — a 404 that reads like a routing bug rather than a missing
directory. It cost real time more than once.

That is the silent-success pattern this project has spent weeks removing, so it
now fails the build instead:

- `scripts/sync-public.cjs` runs AFTER all workspace builds — not inside
  `build.mjs`, because `pnpm -r` does not guarantee the frontend builds first,
  and copying from inside `build.mjs` would either deadlock a clean checkout or
  silently copy a stale frontend.
- It verifies the RESULT rather than the copy: `index.html` present, and more
  than one file, because an index with no assets is not an app.
- `harness/fresh-install.mjs` then boots a server in `NODE_ENV=production` —
  `app.ts` only mounts `express.static` under production, so checking the
  development server would pass while proving nothing — and asserts `GET /`
  returns 200, is not `Cannot GET`, and contains the app shell.

`win-unpacked` (a runnable, unsigned build — good for quick local testing)
lands in `C:\build\vbe\win-unpacked`; the NSIS installer lands next to it as
`C:\build\vbe\Volley-Ball-Empire Setup <version>.exe` — 641.5 MB as of the
2026-08-22 Brotli-precompression build, essentially unchanged from the
pre-Brotli 641 MB baseline despite `resources/` dropping from 746 MB to
592 MB — see [Brotli-precompressed Unity
assets](#brotli-precompressed-unity-assets) for why the installer didn't
shrink even though the unpacked footprint did (see
`build.directories.output` in `package.json` — deliberately outside
`Documents`, see below).

### The dist/public trap — don't skip this

`artifacts/api-server/dist/public` only exists for the **unpackaged**
dev-mode fallback (`electron:dev`, or `node dist/index.mjs` run directly).
electron-builder's `extraResources` copies **the entire**
`artifacts/api-server/dist` folder into `resources/server/dist` — it does not
know or care that `public/` doesn't belong there.

If you leave a manually-copied `dist/public` sitting in `api-server/dist/`
when you run `electron-builder`, it gets bundled a **second time**, on top of
the copy that legitimately belongs in `resources/public` (sourced from
`beach-volleyball/dist/public`). This happened during the 2026-08-21 portrait
re-encode: `resources/server` ballooned from 33 MB to 743 MB because the
dev-mode copy was still in place when packaging ran. Always strip
`artifacts/api-server/dist/public` immediately before running
`electron-builder`, and only restore it afterward if you need the standalone
server for local testing.

### Brotli-precompressed Unity assets

`unity-build/Build/Volleyball_WebGL_Uncompressed_2.data` (636 MB) and its
`.wasm` (47 MB) are Unity's own uncompressed WebGL output — Unity's
"Compression Format: Disabled" publishing setting, not this repo's doing.
`scripts/compress-unity-data.cjs` Brotli-compresses both (quality 11) into
`.data.br` / `.wasm.br` siblings next to the originals in
`artifacts/beach-volleyball/public/unity-build/Build/`.
`artifacts/api-server/src/middlewares/precompressedUnityAssets.ts` serves
those `.br` files with `Content-Encoding: br` whenever a request for the
plain `.data`/`.wasm` path arrives with `Accept-Encoding: br` — Chromium
(all Electron windows, and any Chromium browser hitting `localhost` even
over plain HTTP, since `localhost` is treated as a secure context) decodes
it transparently before handing the bytes to Unity's loader.

**The `.br` files are not committed to git** (they're gitignored — 560 MB
combined is too much to put in history for build output). Run
`node scripts/compress-unity-data.cjs` after checkout or whenever the Unity
build changes; it skips work if the `.br` is already newer than its source.

**This did not shrink the installer.** `resources/` and the unpacked build
dropped by ~154 MB (746→592 MB, 1011→857 MB) because the Brotli-compressed
`.data.br`/`.wasm.br` are smaller on disk than the raw originals they
replace. But the NSIS installer itself stayed flat (641→641.5 MB): NSIS
compresses everything it packs with LZMA, and it was *already* squeezing the
raw, "uncompressed" `.data`/`.wasm` down to roughly the same size Brotli
achieves — pre-compressing with Brotli just moved where that compression
happens, it didn't add new savings, because Brotli output is high-entropy
and barely compresses further under LZMA. If the goal is a smaller
*download*, the real lever is the source Unity assets themselves (texture
compression settings, audio import quality) — see the `data.unity3d`
breakdown below.

### The Unity double-ship trap — enforced automatically, not just documented

Vite copies `beach-volleyball/public/` (originals **and** `.br` siblings)
into `beach-volleyball/dist/public/` on every build, and
`build.extraResources` ships that whole folder into `resources/public/`
as-is. `precompressedUnityAssets.ts` never needs the raw `.data`/`.wasm` on
disk — it reads the `.br` sibling directly off the request path regardless
of whether the original exists — so leaving both in `resources/public/`
means shipping the same asset twice: the original **and** a same-sized-ish
Brotli copy, growing the package by ~534 MB instead of shrinking it.

This used to be a manual "remember to delete the raw files before you
package" step. It isn't anymore: `package.json`'s `build.beforePack` points
at `scripts/before-pack.cjs`, which chains this check with
`scripts/verify-native-abi.cjs` (see "Native module ABI" below) and which
electron-builder runs automatically before every pack — for both
`pnpm run electron:build` and the `npx electron-builder --win dir` fallback,
since both go through electron-builder's own hook lifecycle rather than an
npm script. The Unity check specifically:

1. **Fails the build loudly** (throws, aborting packaging before anything is
   copied) if the source `.br` files in
   `beach-volleyball/public/unity-build/Build/` are missing, or older than
   the `.data`/`.wasm` they're derived from — i.e. `compress-unity-data.cjs`
   was never run, or wasn't re-run after the Unity build changed. There is
   no silent fallback to shipping the raw originals.
2. **Deletes the raw `.data`/`.wasm`** from
   `beach-volleyball/dist/public/unity-build/Build/` if present, since that
   part is safe to automate deterministically.

`resources/public/unity-build/Build/` after packaging should contain only
`.br` files (plus the small `.framework.js`/`.loader.js`) — this is now
guaranteed rather than merely expected, but it's still worth spot-checking
after a packaging change.

### Native module ABI

`electron-builder` (invoked by both `pnpm run electron:build` and
`npx electron-builder --win dir`) runs `@electron/rebuild` as its first step,
every time, automatically:

```
• executing @electron/rebuild  electronVersion=32.3.3 arch=x64 buildFromSource=false
• installing native dependencies  arch=x64
• completed installing native dependencies
```

This is *supposed* to recompile native modules (`better-sqlite3` is the one
that matters here — it's a dependency of `api-server`, `lib/db`, and
`scripts`) against Electron's own Node ABI, which differs from the plain
Node.js ABI the workspace's pnpm-managed `node_modules` are built against.

**Do not trust this log output as proof it worked — as of 2026-08-26,
confirmed on this machine, it doesn't reliably rebuild anything.**
`@electron/rebuild` (and `pnpm exec electron-rebuild -f -w better-sqlite3`
run by hand) can print `✔ Rebuild Complete` while leaving the exact same
stale, wrong-ABI `.node` file in place — apparently satisfied by a
cached/prebuilt binary rather than actually compiling one. The only way to
tell is to check the resulting file's timestamp:

```
find node_modules -name better_sqlite3.node -exec ls -la {} \;
```

If it isn't from today, the "rebuild" didn't happen. Drive `node-gyp`
directly instead:

```
find node_modules artifacts/api-server/dist -name better_sqlite3.node -delete
cd node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3
pnpm exec node-gyp rebuild --target=<electron version> --arch=x64 \
  --dist-url=https://electronjs.org/headers
cd -
```

This one actually compiles from source (you'll see real MSBuild/gcc output,
not an instant "completed") and reliably produces a correctly-ABI'd binary.

**Order matters.** `artifacts/api-server/build.mjs` vendors `better-sqlite3`
into `artifacts/api-server/dist/node_modules` by copying whatever is
currently in the pnpm store at the moment `pnpm run build` runs. If the
store copy is fixed *after* that vendoring step (e.g. by running
`electron:build`'s `@electron/rebuild` after an already-stale `pnpm run
build`), the fix never reaches the packaged copy — you must rebuild the
native module **before** `pnpm run build`, then run `pnpm run build` again
so the fixed binary actually gets vendored. See step 0b in "Full rebuild +
repackage, in order" above.

**This is now enforced automatically.** `scripts/verify-native-abi.cjs`
(chained into `package.json`'s `build.beforePack` via
`scripts/before-pack.cjs`) loads the actual vendored
`artifacts/api-server/dist/node_modules/better-sqlite3` under the real
Electron binary (via `ELECTRON_RUN_AS_NODE=1`) and opens an in-memory
database before every pack. If that fails, packaging aborts with the
node-gyp commands above in the error message — it's no longer possible to
ship a build with this bug without the pack itself refusing to proceed.

Note: as of 2026-08-21 the `@electron/rebuild` step (when it does rebuild
something) operates on a copy electron-builder stages for packaging, not the
shared pnpm store — `pnpm --filter @workspace/api-server run dev` continued
to load `better-sqlite3` fine immediately after a packaging run. Not
re-verified since; treat it as unconfirmed rather than relying on it.

### NSIS installer

`build.win.target: "nsis"` in `package.json` builds a real installer
(`Volley-Ball-Empire Setup <version>.exe`), not just `win-unpacked`. **This
requires Bitdefender on-access-scan exclusions** for both:

- `C:\build\vbe` (the electron-builder output dir — `build.directories.output`
  in `package.json`)
- `C:\Users\<you>\AppData\Local\electron-builder\Cache\nsis` (the cached NSIS
  toolchain electron-builder downloads and shells out to)

covering both **Antivirus** and **Advanced Threat Defense** in Bitdefender.
Without both exclusions in place, the NSIS step intermittently fails signing/
staging the uninstaller with `spawn UNKNOWN` (via `execWine`, even on native
Windows) — almost certainly Bitdefender locking a freshly-written staging
file mid-write (see commit `0701b24`, which already moved the output dir
outside `Documents` for a related lock issue). With the exclusions in place
(added 2026-08-21), a full `pnpm run electron:build` completed cleanly and
produced an installable `.exe` — see [Verifying a rebuilt
package](#verifying-a-rebuilt-package) for the install+verify steps.

**Correction (2026-08-26): "completed cleanly and produced an installable
`.exe`" was not the same as "worked."** That build, the 2026-08-22
Brotli-precompression build, and every build in between actually crashed on
launch — the Electron shell window opened fine, but the forked server
process died immediately on `new Database(...)` with a `NODE_MODULE_VERSION`
mismatch (see "Native module ABI" above). Nothing above verified that; it
only verified that NSIS could produce and install a `.exe` without
Bitdefender interference, not that the app inside it actually ran. The
`better-sqlite3` binary vendored into every one of those packages was
already stale (dated 2026-08-22, never actually rebuilt for Electron's ABI
by any of the packaging runs since). This is now caught automatically by
`scripts/verify-native-abi.cjs` before packaging can complete — see "Native
module ABI" above.

**If you hit `spawn UNKNOWN` again**, do not keep retrying — that's a sign
the exclusions aren't actually in effect (wrong path, exclusion scope not
covering both Bitdefender modules, or a Bitdefender update reset them).
Confirm the exclusions before re-running, and fall back to an unpacked-only
build in the meantime:

```powershell
npx electron-builder --win dir
```

Note `pnpm run electron:build -- --dir` does **not** reliably do this — the
CLI's bare `--dir` shortcut only applies when no target is configured, and
`package.json` explicitly sets `win.target: "nsis"`, which wins. You must
pass `--win dir` to override it. `win-unpacked/Volley-Ball-Empire.exe` runs
fine standalone and doesn't need the installer for local testing.

## Verifying a rebuilt package

For a quick check, launch `win-unpacked` directly. For a real end-to-end
check of the installer itself, silent-install to a scratch directory first
(don't install over a previous test — `userData`, i.e. save games/profiles,
is keyed by `appId`/`productName` and is **shared** across every install and
every `win-unpacked` run on the machine, regardless of install path):

```powershell
# Installer path:
Start-Process -FilePath "C:\build\vbe\Volley-Ball-Empire Setup <version>.exe" `
  -ArgumentList "/S", "/D=C:\some-scratch-dir" -Wait
Start-Process -FilePath "C:\some-scratch-dir\Volley-Ball-Empire.exe"

# Or, for a quick unpacked-only check:
Start-Process -FilePath "C:\build\vbe\win-unpacked\Volley-Ball-Empire.exe"
```

Then against `http://localhost:4173` (the server's health check gates
window creation, so give it a few seconds):

- `GET /api/healthz` → `{"status":"ok"}`
- `GET /api/players/market-all?playerType=senior` → 196 players, each
  `imageUrl` should 200 with `Content-Type: image/webp`
- Staff portraits: enumerate `resources/public/images/staff/*/staff-*.webp`
  on disk and check each URL the same way — the `/api/staff/market` endpoint
  only returns *available* (unhired) staff, not the full roster of files.
- Regional round resolution needs an authenticated session with an actual
  team — the app uses local profiles, not passwordless local auth, and a
  fresh profile has no team until one is created:
  ```powershell
  curl -c cookies.txt http://localhost:4173/api/profiles          # existing profiles, if any
  curl -c cookies.txt -X POST http://localhost:4173/api/profiles `
    -H "Content-Type: application/json" -d '{"name":"Verify"}'    # or create a new one
  curl -c cookies.txt -b cookies.txt -X POST `
    http://localhost:4173/api/profiles/<id>/select
  curl -b cookies.txt "http://localhost:4173/api/locations"       # grab a locationId
  curl -b cookies.txt -X POST http://localhost:4173/api/team `
    -H "Content-Type: application/json" `
    -d '{"name":"Verify FC","locationId":1,"logoColor":"#1e3a8a"}'
  curl -b cookies.txt -X POST http://localhost:4173/api/calendar/advance
  ```
  Repeat `calendar/advance` until the response's `events` includes a
  `"Regional Round N: 18 continental fixtures auto-simulated"` line, then
  confirm `GET /api/regional-league/<continent>` shows that round's fixtures
  as `status: "completed"` with non-null scores and an updated ladder.

Close the app with `Get-Process | Where-Object ProcessName -like "*Volley*"
| Stop-Process -Force` when done — it doesn't have a scripted quit hook.

## Re-encode targets for future portraits

If a new senior or staff portrait is added as a raw upload (frequently a PNG
saved with a `.webp` extension — check with a magic-byte sniff, not the
filename, since `sharp(...).metadata().format` will say `"png"` for these),
re-encode it to match the existing set before committing:

| Set | Target dimensions | Target size | Resize strategy |
|---|---|---|---|
| Senior player portraits | 600×901 | ~60 KB | `fit: "cover", position: "attention"` |
| Staff portraits | 600×800 | ~29 KB | `fit: "cover", position: "attention"` |

Use `cover` + `attention` (sharp's content-aware crop), not `fill` — source
images are not all the same aspect ratio as the targets. A meaningful chunk
of the existing staff set (77 `head_coach`-style files, for instance) are
actually 1536×1024 landscape "trading card" graphics with a name banner and
background, not plain headshots; `fill` would visibly stretch/squash those.
`cover` + `attention` crops instead, keeping the subject centered without
distortion, and produces the same result as `fill` on sources that already
match the target aspect (no unnecessary cropping).

Binary-search the WebP `quality` parameter (`effort: 6`) until the output
lands within ~1 KB of the target byte count — quality varies per image, there
is no fixed number that hits every file. See commit `4c3144f`'s description
for the full re-encode this pattern was established from (180 seniors + 137
staff, `pnpm --filter @workspace/scripts` has `sharp` available as a
devDependency for this).

Before overwriting any existing portrait file in bulk, verify a
full-resolution original is recoverable elsewhere (e.g. `attached_assets/`)
by content hash, not filename — regenerated uploads frequently land under a
different name than the canonical file they replace.

## What's actually inside the 636 MB .data (as of 2026-08-22)

The `.data` file is Unity's `UnityWebData1.0` container format — a flat
archive with a tiny header (offset/size/name per entry) followed by
concatenated file contents. Parsing that header (see
`scripts/inspect-unity-data.cjs`, a one-off diagnostic, not part of the
build) shows it holds almost nothing but a single embedded Unity
`AssetBundle`:

| Entry | Size | % |
|---|---|---|
| `data.unity3d` (a `UnityFS` AssetBundle) | 627.0 MB | 98.5% |
| `Il2CppData/Metadata/global-metadata.dat` | 7.8 MB | 1.2% |
| `Resources/unity default resources` | 1.6 MB | 0.2% |
| everything else (`boot.config`, JSON manifests) | <0.1 MB | ~0% |

One level deeper, that `UnityFS` bundle (built with Unity `6000.3.16f1`,
internally LZ4HC-block-compressed) has its own directory of packed files
(see `scripts/inspect-unity-bundle.cjs`, same caveat — parses the bundle's
LZ4HC-compressed block directory by hand, no Unity tooling involved):

| Entry | Uncompressed size | % |
|---|---|---|
| `sharedassets0.assets` | 1263.9 MB | 97.9% |
| `resources.assets` | 13.0 MB | 1.0% |
| `globalgamemanagers.assets` | 7.1 MB | 0.5% |
| `level0` (scene) | 6.0 MB | 0.5% |
| `Resources/unity_builtin_extra` | 0.4 MB | ~0% |
| `globalgamemanagers` | 0.3 MB | ~0% |

(These are *logical/uncompressed* sizes reported by the bundle's own
directory, which is why they sum to more than the 627 MB compressed
`data.unity3d` — they don't map 1:1 onto compressed on-disk bytes, but the
proportions are a reliable guide.)

**Conclusion: virtually the entire budget (98%) lives in one file,
`sharedassets0.assets`** — Unity's bucket for assets referenced across more
than one scene (textures, materials, audio clips, meshes), as opposed to
scene-specific data (`level0`, 6 MB) or engine internals
(`globalgamemanagers*`, IL2CPP metadata). It isn't fragmented across many
small unused assets; it's concentrated in the shared asset pool. Going
further — an exact textures-vs-audio-vs-meshes split — means parsing
`sharedassets0.assets` as a Unity `SerializedFile` object table (class IDs
and per-object byte sizes), which needs either real Unity tooling (Editor's
Build Report / Memory Profiler, or a proper asset-inspection tool like
AssetStudio) or a much more involved hand-rolled parser than the two
scripts above — not attempted here.

This does line up with the 18%-Brotli-ratio observation that prompted the
investigation: if `sharedassets0.assets` is dominated by already-compressed
texture formats (crunched/ASTC) or compressed audio (ogg/mp3) rather than
raw bitmap/PCM data, Brotli would struggle to compress it further — which
is exactly what was measured (`.data` compressed to 82% of original size,
vs. `.wasm`, which is compiled code with much more redundancy, compressing
to 17.5%). That supports checking the *source* texture/audio import
settings in the Unity project (compression format, quality/bitrate) as the
next lever, rather than anything on the build/export side.
