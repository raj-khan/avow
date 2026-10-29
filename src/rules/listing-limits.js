import { result, PASS, FAIL, WARN, SKIP } from "../lib/report.js";

// Play counts characters, and the Console silently truncates nothing: it
// refuses the save, so an over-limit string is a round trip through the
// browser rather than a bad listing.
const LIMITS = { title: 30, short_description: 80, full_description: 4000, whats_new: 500 };

// Play's metadata policy bars these from the title. It enforces them through
// review rather than at save time, and brand names collide with the word
// list, so they warn instead of failing.
const TITLE_RULES = [
  [/\p{Extended_Pictographic}/u, "emoji"],
  [/https?:\/\/|www\.|\.(?:com|net|org|io|app)\b/i, "a URL"],
  [/\+?\d[\d\s().-]{7,}\d/, "a phone number"],
  [/(?:^|\W)(?:best|top|#\s?1|number one|app of the year)(?:\W|$)/i, "a performance or ranking claim"],
  [/(?:^|\W)(?:free|sale|discount|no ads|cash back)(?:\W|$)/i, "a price or promotion"],
];

export default {
  id: "listing-limits",
  question: "Store listing copy lengths",
  console_path: "Grow > Store presence > Main store listing",
  why:
    "Each field has a hard character cap. Checking in CI costs nothing and " +
    "catches the case where a count in the copy was edited without rechecking " +
    "the length. The title also may not carry emoji, URLs, phone numbers, " +
    "rankings like \"#1\" or promotions like \"free\", which review rejects.",
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
    const notes = typeof l.title === "string"
      ? TITLE_RULES.filter(([re]) => re.test(l.title)).map(([, what]) => `title: contains ${what}`)
      : [];
    if (over.length) return result(FAIL, this.id, `${over.length} field(s) over the limit`, [...over, ...notes]);
    if (notes.length) {
      return result(WARN, this.id, `${checked} copy fields within their limits, title against policy`, notes);
    }
    return result(PASS, this.id, `${checked} copy fields within their limits`);
  },
};
