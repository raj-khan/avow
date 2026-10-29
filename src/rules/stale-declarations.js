import { existsSync } from "node:fs";
import { join } from "node:path";
import { isRepo, lastChanged } from "../lib/git.js";
import { result, PASS, WARN, SKIP } from "../lib/report.js";

// Declarations whose truth depends on what is installed. A dependency change
// after the answer was given is exactly how they go stale.
const DEPENDENCY_BOUND = ["data_safety", "advertising_id", "ads"];
const DEPENDENCY_FILES = [
  "package.json", "android/app/build.gradle", "android/app/build.gradle.kts",
  "app/build.gradle", "app/build.gradle.kts",
];
const MAX_AGE_DAYS = 182;

const days = (from, to) => Math.floor((to - new Date(`${from}T00:00:00Z`)) / 86400000);

export default {
  id: "stale-declarations",
  question: "Nothing has changed under a declaration since it was answered",
  console_path: "App content",
  why:
    "Play does not tell you when an answer stops being true; your next " +
    "install does it silently. A Data safety answer from March is suspect the " +
    "moment package.json changes in June, and a pinned listing number is " +
    "suspect once its data file moves. This compares each dated answer with " +
    "the repo's own history.",
  verify(m, root, { today = new Date() } = {}) {
    if (!isRepo(root)) return result(SKIP, this.id, "not a git repository; no history to compare against");
    const d = m.declarations ?? {};
    const problems = [];
    let dated = 0;

    const depChanges = DEPENDENCY_FILES
      .filter((f) => existsSync(join(root, f)))
      .map((f) => [f, lastChanged(root, f, today)])
      .filter(([, on]) => on);

    for (const [key, v] of Object.entries(d)) {
      if (v.source !== "answered" || !v.answered_on) continue;
      dated++;
      if (days(v.answered_on, today) > MAX_AGE_DAYS) {
        problems.push(`${key}: answered ${v.answered_on}, over ${MAX_AGE_DAYS} days ago; re-verify`);
      }
      if (!DEPENDENCY_BOUND.includes(key)) continue;
      for (const [file, on] of depChanges) {
        if (on > v.answered_on) problems.push(`${key}: answered ${v.answered_on}, ${file} changed ${on}; review`);
      }
    }

    for (const [name, c] of Object.entries(m.invariants ?? {})) {
      if (!c?.verified || !c.source_of_truth) continue;
      dated++;
      const on = lastChanged(root, c.source_of_truth, today);
      if (on && on > c.verified) {
        problems.push(`invariants.${name}: verified ${c.verified}, ${c.source_of_truth} changed ${on}; review`);
      }
    }

    if (!dated) return result(SKIP, this.id, "no answered_on or verified dates to compare against");
    if (problems.length) return result(WARN, this.id, `${problems.length} record(s) may be stale`, problems);
    return result(PASS, this.id, `${dated} dated record(s), none older than the repo changes under them`);
  },
};
