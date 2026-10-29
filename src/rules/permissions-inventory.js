import { mergedManifest, permissions, permissionSources } from "../lib/android.js";
import { result, PASS, WARN, SKIP } from "../lib/report.js";

export default {
  id: "permissions-inventory",
  question: "Every permission the bundle requests is accounted for",
  console_path: "App bundle explorer > Permissions; App content for sensitive ones",
  why:
    "Play reviews what the merged manifest requests, not what you wrote, and " +
    "several permissions (location, contacts, SMS, all-files access) trigger " +
    "their own declaration forms or a rejection. Libraries add permissions " +
    "silently, so the list nobody reviewed is the one Play holds you to.",
  verify(m, root) {
    const merged = mergedManifest(root);
    if (!merged) {
      return result(SKIP, this.id, "no merged release manifest found; build a release bundle first");
    }
    const present = permissions(merged.xml);
    const accounted = m.permissions;
    if (!accounted) {
      return result(SKIP, this.id, `no permissions inventory in the manifest; the bundle requests ${present.length}`);
    }
    const sources = permissionSources(root);
    const unaccounted = present
      .filter((p) => !accounted[p])
      .map((p) => {
        const from = sources.get(p);
        return from?.length ? `${p}: unaccounted, added by ${from.join(", ")}` : `${p}: unaccounted`;
      });
    const absent = Object.keys(accounted)
      .filter((p) => !present.includes(p))
      .map((p) => `${p}: accounted for, but not in the merged manifest`);

    if (!unaccounted.length && !absent.length) {
      return result(PASS, this.id, `all ${present.length} permissions accounted for`);
    }
    const parts = [];
    if (unaccounted.length) parts.push(`${unaccounted.length} unaccounted`);
    if (absent.length) parts.push(`${absent.length} no longer requested`);
    return result(WARN, this.id, `${present.length} permissions, ${parts.join(", ")}`, [...unaccounted, ...absent]);
  },
};
