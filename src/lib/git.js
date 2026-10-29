import { execFileSync } from "node:child_process";

// Git is the only record of when a file changed that survives a fresh clone;
// mtimes do not. Every function returns null rather than throwing when the
// repo, the file or git itself is absent, so callers can SKIP.

function git(root, args) {
  try {
    return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

export function isRepo(root) {
  return git(root, ["rev-parse", "--is-inside-work-tree"]) === "true";
}

// YYYY-MM-DD of the last commit touching `rel`, or today when it has
// uncommitted changes, or null when git has never seen it.
export function lastChanged(root, rel, today = new Date()) {
  if (git(root, ["status", "--porcelain", "--", rel])) return today.toISOString().slice(0, 10);
  return git(root, ["log", "-1", "--format=%cs", "--", rel]) || null;
}

export function show(root, rev, rel) {
  return git(root, ["show", `${rev}:${rel}`]);
}
