import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

// A factory keeps one baseline manifest and a thin one per app. Objects merge
// key by key, so an app can override a single declaration field; arrays and
// scalars are replaced whole, because half a screenshot list or half a
// data_types answer is never what anyone meant.

function merge(base, over) {
  if (!isObject(base) || !isObject(over)) return over;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = k in base ? merge(base[k], v) : v;
  return out;
}

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

export function loadManifest(path, seen = []) {
  const abs = resolve(path);
  if (seen.includes(abs)) throw new Error(`extends cycle: ${[...seen, abs].join(" -> ")}`);
  if (!existsSync(abs)) {
    throw new Error(seen.length ? `extends target ${abs} does not exist` : `No manifest at ${abs}`);
  }
  let m;
  try {
    m = JSON.parse(readFileSync(abs, "utf8"));
  } catch (e) {
    throw new Error(`${abs} is not valid JSON: ${e.message}`);
  }
  if (typeof m.extends !== "string") return m;
  const { extends: parent, ...own } = m;
  return merge(loadManifest(resolve(dirname(abs), parent), [...seen, abs]), own);
}
