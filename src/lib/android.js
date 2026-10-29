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

export function permissions(xml) {
  const out = new Set();
  for (const m of xml.matchAll(/<uses-permission[^>]*android:name="([^"]+)"/g)) out.add(m[1]);
  return [...out].sort();
}

export function dependencies(root) {
  try {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    return Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  } catch {
    return [];
  }
}
