import fs from "node:fs";
import path from "node:path";

/**
 * Walk up from process.cwd() until we find a directory containing packages/engine/src.
 * Works whether Next runs from repo root, apps/web, or a nested subdir.
 */
export function getRepoRoot(): string | null {
  let dir = process.cwd();
  const root = path.parse(dir).root;
  while (dir && dir !== root) {
    const engineSrc = path.join(dir, "packages", "engine", "src");
    if (fs.existsSync(engineSrc)) return dir;
    dir = path.resolve(dir, "..");
  }
  return null;
}

/**
 * Path to apps/web/public/research/latest. Prefer under repo root when available.
 */
export function getResearchLatestDir(): string {
  const repoRoot = getRepoRoot();
  if (repoRoot) {
    return path.join(repoRoot, "apps", "web", "public", "research", "latest");
  }
  return path.join(process.cwd(), "public", "research", "latest");
}
