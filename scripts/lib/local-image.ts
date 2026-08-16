import { copyFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// scripts/src/lib -> repo root
const WORKSPACE_ROOT = resolve(__dirname, "../../../");
const ASSETS_DIR = resolve(WORKSPACE_ROOT, "attached_assets");
const PUBLIC_IMAGES_ROOT = resolve(
  WORKSPACE_ROOT,
  "artifacts/beach-volleyball/public/images/players",
);

/**
 * Replaces the old Replit-object-storage upload. The app is now a fully
 * offline desktop build, so player portraits ship as plain static files
 * bundled with the frontend instead of being fetched from cloud storage.
 *
 * Copies attached_assets/<sourceFileName> into
 * artifacts/beach-volleyball/public/images/players/<subdir>/ (defaulting to
 * "seniors", the same folder seed-new-batch-players.ts already uses) and
 * returns the URL path the server should store/serve —
 * e.g. "/images/players/seniors/foo.webp".
 */
export function localImageUrl(sourceFileName: string, subdir: string = "seniors"): string | null {
  const src = resolve(ASSETS_DIR, sourceFileName);
  if (!existsSync(src)) {
    console.error(`  ⚠ source image not found: ${src}`);
    return null;
  }
  const destDir = resolve(PUBLIC_IMAGES_ROOT, subdir);
  mkdirSync(destDir, { recursive: true });
  const dest = resolve(destDir, sourceFileName);
  copyFileSync(src, dest);
  return `/images/players/${subdir}/${sourceFileName}`;
}

