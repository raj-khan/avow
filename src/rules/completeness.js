import { result, PASS, FAIL, WARN } from "../lib/report.js";

// Every Console screen observed during a real first submission, in the order
// it was presented. Derived from an actual 1.0 submission rather than from
// Play's documentation, which does not publish the order.
export const FORMS = [
  ["app_access", "App access / Sign in details"],
  ["content_rating", "Content ratings"],
  ["target_audience", "Target audience"],
  ["data_safety", "Data safety"],
  ["financial_features", "Financial features"],
  ["advertising_id", "Advertising ID"],
  ["ads", "Ads"],
  ["news_app", "News app"],
  ["government_app", "Government app"],
  ["health", "Health apps"],
  ["data_deletion", "Data deletion"],
  ["external_marketing", "External marketing"],
  ["ai_assets", "AI asset declaration"],
];

export default {
  id: "completeness",
  question: "Every declaration Play asks for is present",
  console_path: "App content",
  why:
    "Play blocks the review submission on any missing declaration, but names " +
    "only one at a time, so each omission costs a round trip. This lists them " +
    "all at once.",
  verify(m) {
    const d = m.declarations ?? {};
    const missing = FORMS.filter(([k]) => !d[k]).map(([k, label]) => `${k}: ${label}`);
    const unexplained = Object.entries(d)
      .filter(([, v]) => !v.why && v.source !== "n/a")
      .map(([k]) => k);

    if (missing.length) {
      return result(FAIL, this.id, `${missing.length} declaration(s) missing`, missing);
    }
    if (unexplained.length) {
      return result(
        WARN,
        this.id,
        `all ${FORMS.length} declarations present, ${unexplained.length} without a reason`,
        unexplained
      );
    }
    return result(PASS, this.id, `all ${FORMS.length} declarations present and explained`);
  },
};
