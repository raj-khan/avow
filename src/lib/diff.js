// What changed in the declarations between two manifests, as leaf paths. A
// changed Data safety answer should be loud in review; in a raw JSON diff it
// is one line among reformatting.

function leaves(node, prefix, out) {
  if (node && typeof node === "object" && !Array.isArray(node)) {
    for (const [k, v] of Object.entries(node)) leaves(v, prefix ? `${prefix}.${k}` : k, out);
  } else {
    out.set(prefix, JSON.stringify(node));
  }
  return out;
}

const SECTIONS = ["declarations", "permissions"];

export function diffManifests(before = {}, after = {}) {
  const changes = [];
  for (const section of SECTIONS) {
    const a = before[section] ?? {};
    const b = after[section] ?? {};
    for (const key of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
      const name = `${section}.${key}`;
      if (!(key in a)) {
        changes.push({ kind: "added", name, fields: [] });
        continue;
      }
      if (!(key in b)) {
        changes.push({ kind: "removed", name, fields: [] });
        continue;
      }
      const la = leaves(a[key], "", new Map());
      const lb = leaves(b[key], "", new Map());
      const fields = [...new Set([...la.keys(), ...lb.keys()])]
        .filter((f) => la.get(f) !== lb.get(f))
        .map((f) => ({ field: f, before: la.get(f), after: lb.get(f) }));
      if (fields.length) changes.push({ kind: "changed", name, fields });
    }
  }
  return changes;
}
