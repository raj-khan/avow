import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// The permissions Play cross-checks a declaration against live in the MERGED
// manifest, not in app.json or AndroidManifest.xml as authored: libraries and
// config plugins add permissions you never wrote. Reading the authored file
// instead is the mistake this module exists to prevent.

const BUNDLE_MANIFEST = [
  "android/app/build/intermediates/bundle_manifest/release",
  "android/app/build/intermediates/merged_manifests/release",
  "android/app/build/intermediates/packaged_manifests/release",
];

function findFile(dir, name, depth = 4) {
  let found = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isFile() && e.name === name) found.push(p);
    else if (e.isDirectory() && depth > 0) found = found.concat(findFile(p, name, depth - 1));
  }
  return found;
}

export function mergedManifest(root) {
  for (const base of BUNDLE_MANIFEST) {
    const hits = findFile(join(root, base), "AndroidManifest.xml");
    if (hits.length) {
      hits.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
      return { path: hits[0], xml: readFileSync(hits[0], "utf8") };
    }
  }
  return null;
}

const MERGER_LOGS = "android/app/build/outputs/logs";

// The manifest-merger report names the library behind every merged element.
// Returns Map<permission, string[]>: library coordinates, or "your
// AndroidManifest.xml" when only the app's own manifest adds it. Empty when
// no release build has produced a report.
export function permissionSources(root) {
  let name;
  try {
    name = readdirSync(join(root, MERGER_LOGS)).find((f) => /^manifest-merger-.*release.*-report\.txt$/.test(f));
  } catch {}
  const out = new Map();
  if (!name) return out;
  let current = null;
  for (const line of readFileSync(join(root, MERGER_LOGS, name), "utf8").split("\n")) {
    const head = line.match(/^uses-permission(?:-sdk-23)?#(\S+)/);
    if (head) {
      current = head[1];
      out.set(current, []);
      continue;
    }
    // Element-level ADDED/MERGED lines are unindented; attribute lines are
    // tab-indented and repeat the same sources.
    if (!current || !/^(ADDED|MERGED) from /.test(line)) {
      if (line && !/^\s/.test(line)) current = null;
      continue;
    }
    const lib = line.match(/^\w+ from \[([^\]]+)\]/);
    const src = lib ? lib[1] : "the app's AndroidManifest.xml";
    if (!out.get(current).includes(src)) out.get(current).push(src);
  }
  return out;
}

export function permissions(xml) {
  const out = new Set();
  for (const m of xml.matchAll(/<uses-permission[^>]*android:name="([^"]+)"/g)) out.add(m[1]);
  return [...out].sort();
}

const GRADLE_FILES = [
  "android/app/build.gradle", "android/app/build.gradle.kts",
  "app/build.gradle", "app/build.gradle.kts",
];
const GRADLE_CONFIGS = "implementation|api|compileOnly|runtimeOnly|releaseImplementation";

// "group:artifact" for every quoted Maven coordinate in a dependency line.
// Version catalogs and project() references are skipped: they name no
// artifact here, and guessing would make data-safety lie.
export function gradleDependencies(text) {
  const out = new Set();
  const line = new RegExp(`^\\s*(?:${GRADLE_CONFIGS})\\b[\\s(]*["']([^"':]+):([^"':]+)`, "gm");
  for (const m of text.matchAll(line)) out.add(`${m[1]}:${m[2]}`);
  return [...out];
}

export function dependencies(root) {
  const out = [];
  try {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    out.push(...Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }));
  } catch {}
  for (const rel of GRADLE_FILES) {
    try {
      out.push(...gradleDependencies(readFileSync(join(root, rel), "utf8")));
    } catch {}
  }
  return [...new Set(out)];
}
