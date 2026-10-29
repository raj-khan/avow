import { mergedManifest, permissions, permissionSources } from "../lib/android.js";
import { result, PASS, FAIL, SKIP } from "../lib/report.js";

const AD_ID = "com.google.android.gms.permission.AD_ID";

export default {
  id: "advertising-id",
  question: "Does your app use advertising ID?",
  console_path: "App content > Advertising ID",
  why:
    "Play cross-checks this answer against the AD_ID permission in your merged " +
    "manifest. Declaring no while a dependency pulls the permission in is an " +
    "automatic rejection, and the permission usually arrives from a library " +
    "rather than from anything you wrote.",
  verify(m, root) {
    const declared = m.declarations?.advertising_id?.uses_advertising_id;
    if (declared === undefined) {
      return result(SKIP, this.id, "not declared in the manifest");
    }
    const merged = mergedManifest(root);
    if (!merged) {
      return result(SKIP, this.id, "no merged release manifest found; build a release bundle first");
    }
    const present = permissions(merged.xml).includes(AD_ID);
    if (declared === present) {
      return result(
        PASS,
        this.id,
        `declared ${declared}, AD_ID permission ${present ? "present" : "absent"}`
      );
    }
    const from = permissionSources(root).get(AD_ID) ?? [];
    return result(
      FAIL,
      this.id,
      declared
        ? "declared as used, but AD_ID is absent from the merged manifest"
        : "declared as unused, but AD_ID is present in the merged manifest",
      [merged.path, ...from.map((s) => `added by ${s}`)]
    );
  },
};
