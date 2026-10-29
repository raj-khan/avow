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

// Play changes these screens without notice and publishes no feed, so the
// only honest freshness signal is when they were last seen. Update this, and
// FORMS, after every real submission that shows a new or reordered screen.
export const FORMS_OBSERVED = { on: "2026-10-27", during: "a real 1.0 submission" };
export const FORMS_STALE_DAYS = 90;

export function formsAge(today = new Date()) {
  return Math.floor((today - new Date(`${FORMS_OBSERVED.on}T00:00:00Z`)) / 86400000);
}

export default {
  id: "completeness",
  question: "Every declaration Play asks for is present",
  console_path: "App content",
  why:
    "Play blocks the review submission on any missing declaration, but names " +
    "only one at a time, so each omission costs a round trip. This lists them " +
    "all at once.",
  verify(m, root, { release = false } = {}) {
    const d = m.declarations ?? {};
    const missing = FORMS.filter(([k]) => !d[k]).map(([k, label]) => `${k}: ${label}`);
    const sourced = (s) => Object.entries(d).filter(([, v]) => v.source === s).map(([k]) => k);
    // An unanswered declaration cannot be entered in the Console, so the
    // submission is blocked exactly as if it were missing.
    const unanswered = sourced("unanswered");
    // Planned is decided but not entered; inherited was answered for a
    // different app. Both are true of the manifest and not yet of the Console.
    const pending = [
      ...sourced("planned").map((k) => `${k}: planned, not yet entered in the Console`),
      ...sourced("inherited").map((k) => `${k}: inherited from another app, not re-answered`),
    ];
    const unexplained = Object.entries(d)
      .filter(([, v]) => !v.why && v.source !== "n/a" && v.source !== "unanswered")
      .map(([k]) => k);

    if (missing.length || unanswered.length) {
      const detail = [...missing, ...unanswered.map((k) => `${k}: unanswered`)];
      return result(FAIL, this.id, `${detail.length} declaration(s) missing or unanswered`, detail);
    }
    // At release time the manifest has to describe what the Console holds, and
    // a pending answer means it does not.
    if (release && pending.length) {
      return result(FAIL, this.id, `${pending.length} declaration(s) not answered in the Console`, pending);
    }
    if (pending.length || unexplained.length) {
      const parts = [];
      if (pending.length) parts.push(`${pending.length} not yet answered in the Console`);
      if (unexplained.length) parts.push(`${unexplained.length} without a reason`);
      return result(
        WARN,
        this.id,
        `all ${FORMS.length} declarations present, ${parts.join(", ")}`,
        [...pending, ...unexplained]
      );
    }
    return result(PASS, this.id, `all ${FORMS.length} declarations present and explained`);
  },
};
