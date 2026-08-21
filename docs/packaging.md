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

`electron/main.js` picks paths based on `app.isPackaged`:
- **Packaged**: `PUBLIC_DIR = process.resourcesPath/public`, server entry =
  `process.resourcesPath/server/dist/index.mjs`.
- **Unpackaged** (`electron:dev`, or running the server standalone):
  `PUBLIC_DIR = artifacts/api-server/dist/public`, server entry =
  `artifacts/api-server/dist/index.mjs`.

That second row is the trap — see [The dist/public trap](#the-distpublic-trap-dont-skip-this).

## Full rebuild + repackage, in order

```powershell
# 1. Typecheck + build every workspace (frontend, api-server, scripts, etc.)
#    vite needs these two env vars even for a one-shot build, not just dev.
$env:PORT = "5173"; $env:BASE_PATH = "/"
pnpm run build

# 2. api-server's build.mjs wipes artifacts/api-server/dist/ on every build,
#    so if you want a standalone (non-Electron) dev server to serve the new
#    images, re-copy AFTER building, not before:
Remove-Item -Recurse -Force artifacts/api-server/dist/public -ErrorAction SilentlyContinue
Copy-Item -Recurse artifacts/beach-volleyball/public/* artifacts/api-server/dist/public/

# 3. Strip that same folder again before packaging — see next section.
Remove-Item -Recurse -Force artifacts/api-server/dist/public

# 4. Package. See "NSIS vs --dir" below for why this uses --win dir.
npx electron-builder --win dir

# 5. If you need the standalone dev server again afterward, restore step 2's copy.
Copy-Item -Recurse artifacts/beach-volleyball/public/* artifacts/api-server/dist/public/
```

Output lands in `C:\build\vbe\win-unpacked` (see
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

### Electron-ABI native rebuild

`electron-builder` (invoked by both `pnpm run electron:build` and
`npx electron-builder --win dir`) runs `@electron/rebuild` as its first step,
every time, automatically:

```
• executing @electron/rebuild  electronVersion=32.3.3 arch=x64 buildFromSource=false
• installing native dependencies  arch=x64
• completed installing native dependencies
```

This recompiles native modules (`better-sqlite3` is the one that matters
here — it's a dependency of `api-server`, `lib/db`, and `scripts`) against
Electron's own Node ABI, which differs from the plain Node.js ABI the
workspace's pnpm-managed `node_modules` are built against. You cannot skip or
shortcut this by hand-copying `dist/` folders into `resources/` — the
packaged app's server process needs Electron-ABI native binaries or it will
crash on startup with a `NODE_MODULE_VERSION` mismatch. It runs before the
"packaging" step in every `electron-builder` invocation, so treat its log
output as normal, not a failure.

Note: as of 2026-08-21 this rebuild operates on a copy electron-builder
stages for packaging, not the shared pnpm store — `pnpm --filter
@workspace/api-server run dev` continued to load `better-sqlite3` fine
immediately after a packaging run. If a future electron-builder upgrade
changes that (the tool's own log suggests adding a `postinstall:
electron-builder install-app-deps` script, which rebuilds in place), re-verify
this before assuming dev mode still works untouched after packaging.

### NSIS vs `--dir`

The NSIS installer step (`build.win.target: "nsis"` in `package.json`) is
flaky on this dev machine — it intermittently fails signing/staging the
uninstaller with `spawn UNKNOWN` while trying to shell out via Wine, most
likely Bitdefender's on-access scanner locking a freshly-written staging file
(see commit `0701b24`, which already moved the output dir outside `Documents`
for a related lock issue). This is unresolved, not fixed.

Until it's resolved, build `win-unpacked` only and skip the installer:

```powershell
npx electron-builder --win dir
```

`pnpm run electron:build -- --dir` does **not** reliably do this — the CLI's
bare `--dir` shortcut only applies when no target is configured, and
`package.json` explicitly sets `win.target: "nsis"`, which wins. You must
pass `--win dir` to override it. `win-unpacked/Volley-Ball-Empire.exe` is a
fully functional build for local testing and doesn't need the installer.

## Verifying a rebuilt package

```powershell
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
- Regional round resolution needs an authenticated session — the app uses
  local profiles, not passwordless local auth:
  ```powershell
  curl -c cookies.txt http://localhost:4173/api/profiles          # list profiles, grab an id
  curl -c cookies.txt -b cookies.txt -X POST `
    http://localhost:4173/api/profiles/<id>/select
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

## Known remaining bulk (not addressed by this pipeline)

As of the 2026-08-21 portrait re-encode, `resources/` is 746 MB and the
total unpacked build is 1011 MB. Player and staff portraits are now a small
fraction of that (22 MB). The dominant cost is
`resources/public/unity-build/Build/Volleyball_WebGL_Uncompressed_2.data`
at 636 MB (91% of `resources/`, 63% of the whole package) — a Unity WebGL
build whose own filename says it's uncompressed. Unity WebGL builds normally
ship Brotli- or Gzip-compressed `.data`/`.wasm` files, typically 3-4x
smaller; re-exporting that build with compression enabled is a separate
project from the image pipeline this doc describes, but it's the next real
lever if the package size needs to come down further.
