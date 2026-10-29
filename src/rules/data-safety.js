import { dependencies } from "../lib/android.js";
import { result, PASS, FAIL, SKIP } from "../lib/report.js";

// Substrings, not exact names: the ecosystem renames packages constantly and a
// near miss here is worse than a false positive, which a human can wave off.
const TRACKING = [
  "analytics", "crashlytics", "sentry", "bugsnag", "mixpanel", "amplitude",
  "segment", "posthog", "appsflyer", "adjust", "branch-sdk", "firebase-perf",
  "facebook-sdk", "react-native-fbsdk", "admob", "google-mobile-ads",
  "onesignal", "clevertap", "datadog",
];

export default {
  id: "data-safety",
  question: "Does your app collect or share any of the required user data types?",
  console_path: "App content > Data safety",
  why:
    "Play treats this form as a binding declaration: an answer that does not " +
    "match behaviour is an enforcement matter, not a correction. Declaring no " +
    "collection stays true only while no analytics, crash reporting, " +
    "attribution or advertising SDK is installed, and those arrive quietly as " +
    "transitive upgrades.",
  verify(m, root) {
    const ds = m.declarations?.data_safety;
    if (!ds) return result(SKIP, this.id, "not declared in the manifest");
    if (ds.collects_user_data || ds.shares_user_data) {
      return result(
        PASS,
        this.id,
        "declares collection or sharing; the declared types are not machine-checkable"
      );
    }
    const hits = dependencies(root).filter((d) =>
      TRACKING.some((t) => d.toLowerCase().includes(t))
    );
    if (!hits.length) {
      return result(PASS, this.id, "declares no collection, and no tracking dependency is installed");
    }
    return result(
      FAIL,
      this.id,
      `declares no collection, but ${hits.length} tracking dependenc${hits.length === 1 ? "y is" : "ies are"} installed`,
      hits
    );
  },
};
