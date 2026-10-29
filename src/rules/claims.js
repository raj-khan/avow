import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { result, PASS, FAIL, SKIP } from "../lib/report.js";

function countAt(data, pointer) {
  // A pointer of "" means the document root. Anything else walks keys.
  let node = data;
  for (const key of pointer.split("/").filter(Boolean)) {
    if (node == null) return null;
    node = node[key];
  }
  if (Array.isArray(node)) return node.length;
  if (node && typeof node === "object") return Object.keys(node).length;
  return typeof node === "number" ? node : null;
}

export default {
  id: "claims",
  question: "Numbers in the listing match the shipped data",
  console_path: "Grow > Store presence > Main store listing",
  why:
    "A listing may not claim a count the app cannot show. The claim is written " +
    "once and the data keeps moving, so the two drift silently. This pins the " +
    "claim to the file the app actually ships.",
  verify(m, root) {
    const inv = m.invariants ?? {};
    const checks = Object.entries(inv).filter(([, v]) => v && v.claimed !== undefined && v.source_of_truth);
    if (!checks.length) return result(SKIP, this.id, "no claim invariants in the manifest");

    const problems = [];
    for (const [name, c] of checks) {
      const p = join(root, c.source_of_truth);
      if (!existsSync(p)) {
        problems.push(`${name}: ${c.source_of_truth} is missing`);
        continue;
      }
      let data;
      try {
        data = JSON.parse(readFileSync(p, "utf8"));
      } catch {
        problems.push(`${name}: ${c.source_of_truth} is not valid JSON`);
        continue;
      }
      const actual = countAt(data, c.pointer ?? "stations");
      if (actual === null) {
        problems.push(`${name}: nothing countable at "${c.pointer ?? "stations"}" in ${c.source_of_truth}`);
      } else if (actual !== c.claimed) {
        problems.push(`${name}: listing claims ${c.claimed}, ${c.source_of_truth} has ${actual}`);
      }

      // The claim also has to appear in the copy, or the invariant is guarding
      // a number nobody reads.
      const copy = [m.listing?.short_description, m.listing?.full_description, m.listing?.whats_new]
        .filter(Boolean).join("\n");
      if (copy && !copy.includes(String(c.claimed))) {
        problems.push(`${name}: ${c.claimed} is pinned but appears nowhere in the listing copy`);
      }
    }
    if (problems.length) return result(FAIL, this.id, `${problems.length} claim problem(s)`, problems);
    return result(PASS, this.id, `${checks.length} claim(s) match the shipped data`);
  },
};
