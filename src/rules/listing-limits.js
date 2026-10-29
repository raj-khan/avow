import { result, PASS, FAIL, SKIP } from "../lib/report.js";

// Play counts characters, and the Console silently truncates nothing: it
// refuses the save, so an over-limit string is a round trip through the
// browser rather than a bad listing.
const LIMITS = { title: 30, short_description: 80, full_description: 4000, whats_new: 500 };

export default {
  id: "listing-limits",
  question: "Store listing copy lengths",
  console_path: "Grow > Store presence > Main store listing",
  why:
    "Each field has a hard character cap. Checking in CI costs nothing and " +
    "catches the case where a count in the copy was edited without rechecking " +
    "the length.",
  verify(m) {
    const l = m.listing;
    if (!l) return result(SKIP, this.id, "no listing in the manifest");
    const over = [];
    let checked = 0;
    for (const [field, cap] of Object.entries(LIMITS)) {
      const v = l[field];
      if (typeof v !== "string") continue;
      checked++;
      if (v.length > cap) over.push(`${field}: ${v.length}/${cap}`);
    }
    if (!checked) return result(SKIP, this.id, "no checkable copy fields");
    if (!over.length) return result(PASS, this.id, `${checked} copy fields within their limits`);
    return result(FAIL, this.id, `${over.length} field(s) over the limit`, over);
  },
};
