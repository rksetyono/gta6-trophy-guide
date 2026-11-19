// Leonida Legend — the hand-in program for the gta6-trophy-guide-01 entry.
//
// It gathers this repository's guide (app/) and its screenshots (screenshots/)
// into the output directory and writes output/dossier.json, the summary the
// judge reads, using the vendored make.fun library. The library is left
// exactly as the kit shipped it: the scorer rebuilds the dossier with its
// own copy and the two must match byte for byte.
//
// Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// In the grader, MAKEFUN_OUTPUT_DIR is unset and /output is used instead.
// The program is deterministic: two runs over the same repository write the
// same bytes, because it only copies files and lets the library summarise
// them — it stamps nothing with a time or a random value. The screenshots
// in screenshots/ are real renders of app/ in desktop Chrome, taken by
// this entry's maker with the headless shell; they are copied in verbatim.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-frontend.ts";

// The gate's own caps, so a bad entry fails here first instead of at the
// scorer: at most 4 screenshots of 256 KiB, at most 993 files and
// directories in app/ totalling 48 MiB, and a 160 KiB dossier text.
const DOSSIER_OPTIONS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
};

const repoRoot = fileURLToPath(new URL(".", import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

function countEntries(dir: string): number {
  let total = 0;
  for (const entry of readdirSync(dir)) {
    total += 1;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) total += countEntries(full);
  }
  return total;
}

function handIn(): void {
  const appDir = join(repoRoot, "app");
  const shotsDir = join(repoRoot, "screenshots");
  if (!existsSync(appDir)) throw new Error(`missing app/ beside ${repoRoot}`);
  if (!existsSync(join(appDir, "index.html"))) throw new Error("app/index.html is missing");
  if (!existsSync(join(appDir, "data", "trophies.json"))) {
    throw new Error("app/data/trophies.json is missing");
  }

  mkdirSync(outDir, { recursive: true });
  cpSync(appDir, join(outDir, "app"), { recursive: true });
  mkdirSync(join(outDir, "screenshots"), { recursive: true });
  if (existsSync(shotsDir)) {
    cpSync(shotsDir, join(outDir, "screenshots"), { recursive: true });
  }

  const dossier = buildDossier(outDir, DOSSIER_OPTIONS);
  writeFileSync(join(outDir, "dossier.json"), dossier);

  const shotNames = existsSync(shotsDir)
    ? readdirSync(shotsDir).filter((name) => !name.startsWith(".")).sort()
    : [];
  console.log(
    `handed in ${countEntries(join(outDir, "app"))} app entries and ` +
      `${shotNames.length} screenshot(s) (${shotNames.join(", ") || "none"}) to ${outDir}`,
  );
}

handIn();
