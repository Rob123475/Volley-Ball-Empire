# Toolchain gotchas — tools in this repo that report success while failing

**The rule: in this repo, an exit code alone is not evidence.** Check the output
for the specific success marker each tool produces, or verify the effect
directly. Four separate tools here have reported success while erroring, and two
of them cost an afternoon each. This is a property of the toolchain, not a run
of bad luck.

---

## 1. `$?` after a pipe reports the LAST command, not yours

```bash
node build.mjs 2>&1 | tail -5; echo "EXIT:$?"     # WRONG — that is tail's status
```

`tail` almost always succeeds, so this prints `EXIT:0` no matter what `node`
did. This is how a failing server build was reported as passing.

```bash
node build.mjs 2>&1 | tail -5; echo "EXIT:${PIPESTATUS[0]}"   # right
node build.mjs > /tmp/out.txt 2>&1; echo "EXIT:$?"; tail -5 /tmp/out.txt  # better
```

`PIPESTATUS` is itself fragile — it is clobbered by the next command, including
the `echo` that reads it in a compound statement. Redirecting to a file and
checking `$?` immediately is the form that does not lie.

## 2. `build.mjs` prints failures BELOW a cheerful summary

esbuild prints its bundle table and `Done in NNNms` *before* the vendoring step
runs. A failure after that point scrolls in underneath a line that reads like
success, so `| tail -3` shows the happy summary and hides the error.

Fixed: failures now end in a `!!!!` banner, and success prints
`BUILD OK - bundle written and all external deps vendored` as the final line.

**Verify by:** the presence of `BUILD OK`. Its absence is the signal — do not
rely on the exit code or the esbuild summary.

## 3. `drizzle-kit push` — two separate traps

**It cannot run under system Node.** It loads `better-sqlite3`, which in this
repo is built for Electron's ABI (128), while system Node is ABI 137. It fails
with `ERR_DLOPEN_FAILED` **and exits 0.**

Run it under Electron's runtime instead:

```bash
ELECTRON=$(node -p "require('electron')")
KIT=node_modules/.pnpm/drizzle-kit@*/node_modules/drizzle-kit/bin.cjs
ELECTRON_RUN_AS_NODE=1 "$ELECTRON" "$KIT" push --force \
  --dialect=sqlite --schema=./src/schema/index.ts --url="$PWD/volleyball-empire.sqlite"
```

The config-file form (`--config ./drizzle.config.ts`) fails to resolve the
schema path; the explicit `--schema` flag works.

**It also cannot add a column to a table that has indexes.** SQLite requires a
table rebuild to add a column, and drizzle-kit recreates the indexes without
dropping them first — `SqliteError: index users_email_unique already exists`.
For a simple nullable column, use SQLite directly:

```bash
node -e "const {DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync('lib/db/volleyball-empire.sqlite');
db.exec('ALTER TABLE seasons ADD COLUMN career_save_id INTEGER;');
db.exec('PRAGMA wal_checkpoint(TRUNCATE);'); db.close();"
```

**Verify by:** `pragma table_info(<table>)` afterwards. Never by exit code.

## 4. `pnpm rebuild <pkg>` silently does nothing

`pnpm rebuild better-sqlite3` prints no output, exits 0, and does not rebuild —
`onlyBuiltDependencies` in `pnpm-workspace.yaml` does not list the package, so
its build scripts are blocked. (There is an `allowBuilds:` key in that file which
is **not** a real pnpm option and has no effect.)

**Verify by:** the binary's mtime, or a `require` test. Drive `node-gyp`
directly when you actually need a rebuild.

## 5. `@electron/rebuild` prints "Rebuild Complete" without producing a file

Documented in `scripts/verify-native-abi.cjs`, which exists because of it. It can
substitute a stale cached binary and still report success. That guard loads the
exact file that will ship, under the real Electron runtime, and aborts packaging
if it fails.

Seen again on 3 September 2026 on a Linux box: after deleting every
`better_sqlite3.node`, `pnpm exec electron-rebuild -f -w better-sqlite3` printed
`✔ Rebuild Complete` over a file still dated **May 2025**. The harness then died
with `NODE_MODULE_VERSION 127. This version of Node.js requires 128` — Node's
ABI where Electron's was needed.

### The fast way out: fetch the prebuilt Electron-ABI binary

Faster than driving `node-gyp`, and it cannot silently no-op — it either
downloads a binary or fails:

```bash
cd node_modules/.pnpm/better-sqlite3@<version>/node_modules/better-sqlite3
pnpm exec prebuild-install --runtime=electron --target=$(node -p "require('electron/package.json').version") --arch=x64
cd -
pnpm --filter @workspace/api-server run build   # re-vendor it into dist/node_modules
node scripts/verify-native-abi.cjs
```

`prebuild-install` names the exact artifact it wants
(`better-sqlite3-v11.10.0-electron-v128-linux-x64.tar.gz`), so a miss is a loud
404 rather than a stale success. Re-vendoring afterwards is not optional:
`artifacts/api-server/build.mjs` copies whatever is in the pnpm store at build
time, so a rebuild that stops at `node_modules/` leaves the shipped copy wrong.

### Why `node-gyp` may not be an option

The documented fallback — driving `node-gyp` directly with
`--runtime=electron --dist-url=https://electronjs.org/headers` — needs Electron's
header tarballs, and those are served **only** from `electronjs.org` /
`artifacts.electronjs.org`. They are not GitHub release assets. On a network that
blocks those hosts (a locked-down CI runner or sandbox) the build fails at
`configure` with a bare `Error: Request was cancelled.` that says nothing about
DNS or policy. `prebuild-install` above comes from GitHub releases instead, which
is usually still reachable.

**Verify by:** `node scripts/verify-native-abi.cjs`.

---

## 6. A failing `pnpm -r` takes the REST of the chain with it

The build is a chain, and only the first link is a compile:

```
build = typecheck && pnpm -r run build && sync:public && test:harness
                                          ^^^^^^^^^^^    ^^^^^^^^^^^^
```

`pnpm -r` stops at the first workspace project that fails, and `&&` then skips
everything after it. So a failure in ANY artifact — including
`artifacts/mockup-sandbox`, which ships nothing — means the frontend is never
copied to where the server serves it from, and the five-suite harness never
runs. Neither omission is mentioned in the output. You get a stack trace about
whatever broke and nothing about the two steps that silently did not happen.

This is how `pnpm run build` came to be unrunnable as documented for an unknown
stretch of time. Both vite configs demanded a `PORT` environment variable at
module load — a value only the dev server uses, that nothing in the repo
supplies (there is no `.env`). Anyone whose shell had `PORT` set never saw it;
anyone else got a hard failure before the harness could run.

**Verify by:** `ALL HARNESSES PASSED` as the final line. That string is the only
proof the chain reached the end. A build that stops early and a build that
passed are the same exit code away from each other only if you never look.

**Guarded by:** `scripts/check-build-env.mjs`, wired into `typecheck` so it runs
first. It deletes `PORT` from the environment before loading each vite config,
so the check behaves identically for a developer who has `PORT` exported and one
who does not — the ambient environment cannot hide the regression. It asserts
both directions: building must succeed without `PORT`, and serving must still
refuse without it. Testing only the permissive direction would let someone
satisfy the guard by deleting the requirement outright.

## 7. Running the harness can leave Electron behind, and the NEXT build fails

Symptom, and it does not name the cause:

```
  CLOSE THE APP FIRST - build not started
  node_modules\better-sqlite3\build\Release\better_sqlite3.node is locked (EBUSY).
  Something is running the built server and holding it open, usually the game itself.
```

"Usually the game itself" is what makes this one expensive: the message sends you
looking for a window that is not open. `harness/invariants.mjs` boots Electron
per probe and `harness/run-all.mjs` boots one for the smoke server, and a run can
leave processes behind that outlive the run that spawned them. They keep the
native module open, and the next build refuses to start.

The guard is doing its job — it aborts BEFORE touching anything, so nothing is
half-written. Do not work around it by deleting `dist/`.

**Check what is actually holding it, before killing anything:**

```powershell
Get-Process electron | Select-Object Id, StartTime, Path
```

A `Path` under the repo's `node_modules` and a `StartTime` matching your last
harness run is a leftover probe. A `Path` under `C:\build\vbe` or an install
directory is the real game, and someone may be using it. `taskkill /IM
electron.exe /F` cannot tell the difference, which is why the check comes first.

**Verify by:** re-running the build. The guard is not sticky — once the handle is
released it proceeds normally.

## Native module ABI, in one place

`better-sqlite3` can only be built for one runtime at a time.

| Runtime | ABI | Used for |
|---|---|---|
| Electron 32.3.3 (Node 20.18.1) | 128 | **the shipped game** — keep the binary here |
| System Node 24 | 137 | nothing that ships |

Anything that touches the database — the server, the harness, `drizzle-kit` —
must run under `ELECTRON_RUN_AS_NODE=1 $(node -p "require('electron')")`.

Read-only inspection is the exception: Node 24's built-in `node:sqlite` needs no
native module and works regardless.

```bash
node -e "const {DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync('lib/db/volleyball-empire.sqlite',{readOnly:true});
console.log(db.prepare('select count(*) c from players').get());"
```

Do **not** rebuild `better-sqlite3` for system Node to make a script work. It
breaks the packaged app, and the failure appears at launch, not at build time.

To check which ABI a binary is actually built for, load it — do not trust a
wrapper's `require`, which may resolve a different copy:

```bash
node -e "try{process.dlopen({exports:{}},require('path').resolve(process.argv[1]));
console.log('ABI 137 (system node)')}catch(e){console.log('ABI 128 (Electron)')}" \
  artifacts/api-server/dist/node_modules/better-sqlite3/build/Release/better_sqlite3.node
```

---

## Escape sequences must go through the Edit tool, never a shell heredoc

**Standing rule: any edit containing a regex or an escape sequence is applied
with the Edit tool. Never through a `python - <<'EOF'` heredoc, `sed -i`, or any
other shell path.**

Backslashes cross three layers on the way to a file — shell, Python string, then
JavaScript string — and each one may consume a level. The failures are silent:

- A guard rule emitted `\s` where `\s` was meant. In JavaScript `"\s"` is just
  `"s"`, so the pattern matched nothing. The guard printed **OK** and the build
  passed. It shipped inert and was caught only because each branch was tested by
  hand that day.
- A fixture's `\n` became a literal newline inside a string, producing
  `SyntaxError: Invalid or unexpected token`. Loud, but only at run time.
- Three separate attempts to *deliberately* break a rule for testing silently
  did nothing, because the search string never matched what was actually in the
  file — twice reported as "the self-test missed it" before the real cause was
  found.

That last one is the point: the escaping problem also corrupts the tooling you
build to detect the escaping problem. The Edit tool passes strings through
unchanged and fails loudly when the old text does not match, which is the
property that matters.

Related: `harness/guard-selftest.mjs` exists because a guard that goes inert
fails silently. Every guard now has a committed known-bad input it must reject,
asserted on every build.
