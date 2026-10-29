import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import assert from "node:assert/strict";
import { rules, byId } from "../src/rules/index.js";
import { FORMS, FORMS_OBSERVED, formsAge } from "../src/rules/completeness.js";
import { imageSize } from "../src/lib/imagesize.js";
import { permissions, gradleDependencies, permissionSources } from "../src/lib/android.js";
import { github } from "../src/lib/report.js";
import { diffManifests } from "../src/lib/diff.js";
import { loadManifest } from "../src/lib/manifest.js";

let passed = 0, failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`✗ ${name}\n  ${e.message}`);
  }
}

// A fake repo per test, so nothing depends on a real build having been run.
function repo(files) {
  const dir = mkdtempSync(join(tmpdir(), "avow-"));
  for (const [rel, body] of Object.entries(files)) {
    const path = join(dir, rel);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, typeof body === "string" ? body : JSON.stringify(body));
  }
  return dir;
}

const AD_ID = "com.google.android.gms.permission.AD_ID";
const manifestXml = (perms) =>
  `<manifest>${perms.map((p) => `<uses-permission android:name="${p}" />`).join("")}</manifest>`;
const MERGED = "android/app/build/intermediates/bundle_manifest/release/x/AndroidManifest.xml";

test("permissions parses the merged manifest", () => {
  assert.deepEqual(permissions(manifestXml(["android.permission.INTERNET", AD_ID])),
    ["android.permission.INTERNET", AD_ID]);
});

test("advertising-id fails on a no with AD_ID present", () => {
  const dir = repo({ [MERGED]: manifestXml([AD_ID]) });
  const r = byId.get("advertising-id").verify(
    { declarations: { advertising_id: { uses_advertising_id: false } } }, dir);
  assert.equal(r.status, "fail");
  rmSync(dir, { recursive: true });
});

const MERGER_REPORT = "android/app/build/outputs/logs/manifest-merger-release-report.txt";
const mergerReport = [
  "uses-permission#android.permission.INTERNET",
  "ADDED from /repo/android/app/src/main/AndroidManifest.xml:6:3-64",
  "MERGED from [host.exp.exponent:expo.modules.filesystem:57.0.7] /cache/AndroidManifest.xml:8:5-67",
  "\tandroid:name",
  "\t\tADDED from /repo/android/app/src/main/AndroidManifest.xml:6:20-62",
  `uses-permission#${AD_ID}`,
  "ADDED from [com.google.android.gms:play-services-measurement-api:21.5.0] /cache/AndroidManifest.xml:25:5-79",
  "application",
  "ADDED from /repo/android/app/src/main/AndroidManifest.xml:10:3-30:17",
].join("\n");

test("permissionSources attributes each permission to its libraries", () => {
  const dir = repo({ [MERGER_REPORT]: mergerReport });
  const s = permissionSources(dir);
  assert.deepEqual(s.get("android.permission.INTERNET"),
    ["the app's AndroidManifest.xml", "host.exp.exponent:expo.modules.filesystem:57.0.7"]);
  assert.deepEqual(s.get(AD_ID), ["com.google.android.gms:play-services-measurement-api:21.5.0"]);
  assert.equal(s.size, 2);
  rmSync(dir, { recursive: true });
});

test("advertising-id names the library that added AD_ID", () => {
  const dir = repo({ [MERGED]: manifestXml([AD_ID]), [MERGER_REPORT]: mergerReport });
  const r = byId.get("advertising-id").verify(
    { declarations: { advertising_id: { uses_advertising_id: false } } }, dir);
  assert.equal(r.status, "fail");
  assert.equal(r.detail[1], "added by com.google.android.gms:play-services-measurement-api:21.5.0");
  rmSync(dir, { recursive: true });
});

test("advertising-id passes on a no with AD_ID absent", () => {
  const dir = repo({ [MERGED]: manifestXml(["android.permission.INTERNET"]) });
  const r = byId.get("advertising-id").verify(
    { declarations: { advertising_id: { uses_advertising_id: false } } }, dir);
  assert.equal(r.status, "pass");
  rmSync(dir, { recursive: true });
});

test("advertising-id fails on a yes with AD_ID absent", () => {
  const dir = repo({ [MERGED]: manifestXml(["android.permission.INTERNET"]) });
  const r = byId.get("advertising-id").verify(
    { declarations: { advertising_id: { uses_advertising_id: true } } }, dir);
  assert.equal(r.status, "fail");
  rmSync(dir, { recursive: true });
});

test("advertising-id skips when no release build exists", () => {
  const dir = repo({ "package.json": { name: "x" } });
  const r = byId.get("advertising-id").verify(
    { declarations: { advertising_id: { uses_advertising_id: false } } }, dir);
  assert.equal(r.status, "skip");
  rmSync(dir, { recursive: true });
});

test("permissions-inventory passes when every permission is accounted for", () => {
  const dir = repo({ [MERGED]: manifestXml(["android.permission.INTERNET"]) });
  const r = byId.get("permissions-inventory").verify(
    { permissions: { "android.permission.INTERNET": "streams audio" } }, dir);
  assert.equal(r.status, "pass");
  rmSync(dir, { recursive: true });
});

test("permissions-inventory warns on unaccounted and stale permissions", () => {
  const dir = repo({
    [MERGED]: manifestXml(["android.permission.INTERNET", AD_ID]),
    [MERGER_REPORT]: mergerReport,
  });
  const r = byId.get("permissions-inventory").verify(
    { permissions: { "android.permission.INTERNET": "streams audio", "android.permission.CAMERA": "scan" } }, dir);
  assert.equal(r.status, "warn");
  assert.deepEqual(r.detail, [
    `${AD_ID}: unaccounted, added by com.google.android.gms:play-services-measurement-api:21.5.0`,
    "android.permission.CAMERA: accounted for, but not in the merged manifest",
  ]);
  rmSync(dir, { recursive: true });
});

test("permissions-inventory skips without a build or an inventory", () => {
  const empty = repo({ "package.json": {} });
  assert.equal(byId.get("permissions-inventory").verify({ permissions: {} }, empty).status, "skip");
  const built = repo({ [MERGED]: manifestXml(["android.permission.INTERNET"]) });
  assert.equal(byId.get("permissions-inventory").verify({}, built).status, "skip");
  rmSync(empty, { recursive: true });
  rmSync(built, { recursive: true });
});

test("data-safety fails when a tracking SDK is installed", () => {
  const dir = repo({ "package.json": { dependencies: { "@sentry/react-native": "^5" } } });
  const r = byId.get("data-safety").verify(
    { declarations: { data_safety: { collects_user_data: false, shares_user_data: false } } }, dir);
  assert.equal(r.status, "fail");
  assert.deepEqual(r.detail, ["@sentry/react-native"]);
  rmSync(dir, { recursive: true });
});

test("data-safety passes on a clean dependency tree", () => {
  const dir = repo({ "package.json": { dependencies: { expo: "^54", react: "19.0.0" } } });
  const r = byId.get("data-safety").verify(
    { declarations: { data_safety: { collects_user_data: false, shares_user_data: false } } }, dir);
  assert.equal(r.status, "pass");
  rmSync(dir, { recursive: true });
});

test("gradleDependencies reads quoted coordinates in both DSLs", () => {
  const gradle = [
    'implementation("com.facebook.react:react-android")',
    "    implementation 'com.google.firebase:firebase-analytics:22.1.0'",
    '    api "com.squareup.okhttp3:okhttp:4.12.0"',
    "    implementation jscFlavor",
    "    implementation project(':lib')",
    "    implementation libs.androidx.core",
  ].join("\n");
  assert.deepEqual(gradleDependencies(gradle), [
    "com.facebook.react:react-android",
    "com.google.firebase:firebase-analytics",
    "com.squareup.okhttp3:okhttp",
  ]);
});

test("data-safety fails on a tracking SDK added in build.gradle", () => {
  const dir = repo({
    "package.json": { dependencies: { expo: "^54" } },
    "android/app/build.gradle": "dependencies {\n  implementation 'com.google.android.gms:play-services-ads:23.0.0'\n}",
  });
  const r = byId.get("data-safety").verify(
    { declarations: { data_safety: { collects_user_data: false, shares_user_data: false } } }, dir);
  assert.equal(r.status, "fail");
  assert.deepEqual(r.detail, ["com.google.android.gms:play-services-ads"]);
  rmSync(dir, { recursive: true });
});

const rated = (over) => ({
  declarations: {
    content_rating: {
      source: "answered",
      answers: { violence: false },
      answer_notes: { violence: "No violent content." },
      result: "PEGI 3, ESRB Everyone",
      answered_on: "2026-10-27",
      ...over,
    },
  },
});

test("content-rating passes a complete, dated record", () => {
  assert.equal(byId.get("content-rating").verify(rated()).status, "pass");
});

test("content-rating warns on an unexplained answer, a missing result and no date", () => {
  const r = byId.get("content-rating").verify(
    rated({ answer_notes: {}, result: undefined, expected_rating: "Everyone", answered_on: undefined }));
  assert.equal(r.status, "warn");
  assert.deepEqual(r.detail, [
    "answers.violence: no entry in answer_notes",
    'result: not recorded (only expected_rating "Everyone")',
    "answered_on: the questionnaire is not dated",
  ]);
});

test("content-rating skips until the questionnaire is answered", () => {
  assert.equal(byId.get("content-rating").verify(rated({ source: "planned" })).status, "skip");
  assert.equal(byId.get("content-rating").verify({ declarations: {} }).status, "skip");
});

const typed = (over) => ({ declarations: { data_safety: { source: "answered", ...over } } });

test("data-types passes Play's labels and an empty list with no collection", () => {
  const r = byId.get("data-types");
  assert.equal(r.verify(typed({ collects_user_data: true, data_types: ["Crash logs", "Diagnostics"] })).status, "pass");
  assert.equal(r.verify(typed({ collects_user_data: false, shares_user_data: false, data_types: [] })).status, "pass");
});

test("data-types fails unknown or misspelled types and contradictions", () => {
  const r = byId.get("data-types");
  assert.deepEqual(r.verify(typed({ collects_user_data: true, data_types: ["crash logs", "Telemetry"] })).detail, [
    '"crash logs": Play spells it "Crash logs"',
    '"Telemetry": not a Play data type',
  ]);
  assert.deepEqual(r.verify(typed({ collects_user_data: true, data_types: [] })).detail,
    ["declares collection or sharing, but lists no data types"]);
  assert.deepEqual(r.verify(typed({ collects_user_data: false, data_types: ["Photos"] })).detail,
    ["declares no collection or sharing, but lists 1 data type(s)"]);
});

test("data-types skips without a data_types list", () => {
  assert.equal(byId.get("data-types").verify(typed({ collects_user_data: false })).status, "skip");
});

const detailed = (details, over = {}) => typed({
  collects_user_data: true,
  shares_user_data: false,
  data_types: Object.keys(details),
  data_type_details: details,
  ...over,
});
const crash = { collected: true, shared: false, ephemeral: false, required: true, collection_purposes: ["Analytics"] };

test("data-type-details passes consistent per-type answers", () => {
  assert.equal(byId.get("data-type-details").verify(detailed({ "Crash logs": crash })).status, "pass");
});

test("data-type-details fails contradictions, bad purposes and missing fields", () => {
  const r = byId.get("data-type-details").verify(detailed({
    "Crash logs": { ...crash, shared: true, collection_purposes: ["analytics", "Telemetry"] },
    "Diagnostics": { collected: true },
  }));
  assert.equal(r.status, "fail");
  assert.deepEqual(r.detail, [
    "Crash logs: shared, but data_safety.shares_user_data is not true",
    'Crash logs: collection_purposes "analytics", Play spells it "Analytics"',
    'Crash logs: collection_purposes "Telemetry" is not a Play purpose',
    "Crash logs: sharing_purposes is empty; the Console asks for at least one purpose",
    "Diagnostics: required must be true or false",
    "Diagnostics: ephemeral must be true or false",
    "Diagnostics: collection_purposes is empty; the Console asks for at least one purpose",
  ]);
});

test("data-type-details fails details for an undeclared type, warns on missing ones", () => {
  const r = byId.get("data-type-details");
  const stray = r.verify(detailed({ "Crash logs": crash }, { data_types: ["Crash logs", "Diagnostics"], data_type_details: { "Crash logs": crash, "Photos": crash } }));
  assert.equal(stray.status, "fail");
  assert.ok(stray.detail.includes("Photos: has details but is not in data_types"));
  const gap = r.verify(detailed({ "Crash logs": crash }, { data_types: ["Crash logs", "Diagnostics"] }));
  assert.equal(gap.status, "warn");
  assert.deepEqual(gap.detail, ["Diagnostics: no entry in data_type_details"]);
  assert.equal(r.verify(typed({ data_types: [] })).status, "skip");
});

test("listing-limits fails an over-long title", () => {
  const r = byId.get("listing-limits").verify({ listing: { title: "x".repeat(31) } });
  assert.equal(r.status, "fail");
});

test("listing-limits warns on title policy breaches", () => {
  const warn = (title) => byId.get("listing-limits").verify({ listing: { title } });
  assert.deepEqual(warn("#1 Radio 📻 FREE").detail, [
    "title: contains emoji",
    "title: contains a performance or ranking claim",
    "title: contains a price or promotion",
  ]);
  assert.deepEqual(warn("Radio www.radio.com").detail, ["title: contains a URL"]);
  assert.deepEqual(warn("Call +1 555 123 4567").detail, ["title: contains a phone number"]);
  assert.equal(warn("Quran Radio: Live Recitation").status, "pass");
  assert.equal(warn("Topaz Freedom Notes").status, "pass");
});

test("claims fails when the listing claims more than the data file holds", () => {
  const dir = repo({ "dist/catalogue.json": { stations: [1, 2, 3] } });
  const r = byId.get("claims").verify({
    listing: { full_description: "310 stations" },
    invariants: { count: { claimed: 310, source_of_truth: "dist/catalogue.json" } },
  }, dir);
  assert.equal(r.status, "fail");
  rmSync(dir, { recursive: true });
});

test("claims fails when a pinned number is absent from the copy", () => {
  const dir = repo({ "dist/catalogue.json": { stations: [1, 2, 3] } });
  const r = byId.get("claims").verify({
    listing: { full_description: "lots of stations" },
    invariants: { count: { claimed: 3, source_of_truth: "dist/catalogue.json" } },
  }, dir);
  assert.equal(r.status, "fail");
  rmSync(dir, { recursive: true });
});

// Commits every file in `dir` with the given date, so history is deterministic.
function commit(dir, date) {
  const env = { ...process.env, GIT_AUTHOR_DATE: `${date}T12:00:00Z`, GIT_COMMITTER_DATE: `${date}T12:00:00Z` };
  const g = (...a) => execFileSync("git", ["-C", dir, "-c", "user.name=t", "-c", "user.email=t@t", ...a], { env, stdio: "ignore" });
  if (!existsSync(join(dir, ".git"))) g("init", "-q");
  g("add", "-A");
  g("commit", "-qm", date);
}

const TODAY = new Date("2026-10-29T00:00:00Z");

test("stale-declarations warns when dependencies changed after the answer", () => {
  const dir = repo({ "package.json": { dependencies: {} }, "dist/c.json": [1] });
  commit(dir, "2026-10-20");
  writeFileSync(join(dir, "package.json"), JSON.stringify({ dependencies: { "@sentry/react-native": "5" } }));
  commit(dir, "2026-10-25");
  const r = byId.get("stale-declarations").verify({
    declarations: { data_safety: { source: "answered", answered_on: "2026-10-22" } },
    invariants: { n: { source_of_truth: "dist/c.json", verified: "2026-10-21" } },
  }, dir, { today: TODAY });
  assert.equal(r.status, "warn");
  assert.deepEqual(r.detail, ["data_safety: answered 2026-10-22, package.json changed 2026-10-25; review"]);
  rmSync(dir, { recursive: true });
});

test("stale-declarations warns on an old answer and an uncommitted data change", () => {
  const dir = repo({ "dist/c.json": [1] });
  commit(dir, "2026-01-10");
  writeFileSync(join(dir, "dist/c.json"), "[1,2]");
  const r = byId.get("stale-declarations").verify({
    declarations: { news_app: { source: "answered", answered_on: "2026-03-01" } },
    invariants: { n: { source_of_truth: "dist/c.json", verified: "2026-10-01" } },
  }, dir, { today: TODAY });
  assert.deepEqual(r.detail, [
    "news_app: answered 2026-03-01, over 182 days ago; re-verify",
    "invariants.n: verified 2026-10-01, dist/c.json changed 2026-10-29; review",
  ]);
  rmSync(dir, { recursive: true });
});

test("stale-declarations passes current records and skips without git or dates", () => {
  const dir = repo({ "package.json": {} });
  const m = { declarations: { ads: { source: "answered", answered_on: "2026-10-28" } } };
  assert.equal(byId.get("stale-declarations").verify(m, dir, { today: TODAY }).status, "skip");
  commit(dir, "2026-10-20");
  assert.equal(byId.get("stale-declarations").verify(m, dir, { today: TODAY }).status, "pass");
  assert.equal(byId.get("stale-declarations").verify({}, dir, { today: TODAY }).status, "skip");
  rmSync(dir, { recursive: true });
});

test("completeness fails on a missing declaration", () => {
  const r = byId.get("completeness").verify({ declarations: { app_access: { why: "x" } } });
  assert.equal(r.status, "fail");
});

const allForms = (over = {}) => ({
  declarations: Object.fromEntries(
    FORMS.map(([k]) => [k, { source: "answered", why: "x", ...over[k] }])
  ),
});

test("completeness passes when every declaration is answered and explained", () => {
  assert.equal(byId.get("completeness").verify(allForms()).status, "pass");
});

test("completeness fails on an unanswered declaration", () => {
  const r = byId.get("completeness").verify(allForms({ ads: { source: "unanswered" } }));
  assert.equal(r.status, "fail");
  assert.deepEqual(r.detail, ["ads: unanswered"]);
});

test("completeness warns on planned and inherited declarations", () => {
  const r = byId.get("completeness").verify(
    allForms({ ads: { source: "planned" }, health: { source: "inherited" } }));
  assert.equal(r.status, "warn");
  assert.equal(r.detail.length, 2);
});

test("completeness fails planned and inherited declarations under --release", () => {
  const m = allForms({ ads: { source: "planned" }, health: { source: "inherited" } });
  const r = byId.get("completeness").verify(m, ".", { release: true });
  assert.equal(r.status, "fail");
  assert.equal(r.detail.length, 2);
});

test("schema passes a well-formed manifest", () => {
  const r = byId.get("schema").verify({
    schema: 1,
    app: { package: "com.example.app" },
    invariants: { $comment: "comments are allowed at any level" },
    ...allForms(),
  });
  assert.equal(r.status, "pass");
});

test("schema fails a wrong type, a bad enum and a missing key", () => {
  const r = byId.get("schema").verify({
    schema: 1,
    app: { package: "com.example.app", version_code: "3" },
    declarations: { ads: { source: "maybe" } },
  });
  assert.equal(r.status, "fail");
  assert.deepEqual(r.detail, [
    '$.app.version_code: expected integer, got string',
    '$.declarations.ads.source: must be one of "answered", "planned", "inherited", "unanswered", "n/a"',
  ]);
  const missing = byId.get("schema").verify({ schema: 1, declarations: {} });
  assert.deepEqual(missing.detail, ['$: missing required "app"']);
});

test("schema fails a declaration date that is not YYYY-MM-DD", () => {
  const r = byId.get("schema").verify({
    schema: 1,
    app: { package: "com.example.app" },
    declarations: { ads: { source: "answered", why: "x", answered_on: "27/10/2026" } },
  });
  assert.deepEqual(r.detail, ["$.declarations.ads.answered_on: must be a YYYY-MM-DD date"]);
});

test("formsAge counts whole days since FORMS was observed", () => {
  const seen = new Date(`${FORMS_OBSERVED.on}T00:00:00Z`);
  assert.equal(formsAge(seen), 0);
  assert.equal(formsAge(new Date(seen.getTime() + 91 * 86400000 + 3600000)), 91);
});

test("github format annotates fails and warns, not passes or skips", () => {
  const lines = github([
    { status: "fail", rule: "schema", message: "1 schema error(s)", detail: ["$.app: missing, really"] },
    { status: "warn", rule: "assets", message: "100% sure" },
    { status: "pass", rule: "claims", message: "ok" },
    { status: "skip", rule: "permissions-inventory", message: "no build" },
  ], "store/release-manifest.json");
  assert.deepEqual(lines, [
    "::error file=store/release-manifest.json,title=avow schema::1 schema error(s)%0A$.app: missing, really",
    "::warning file=store/release-manifest.json,title=avow assets::100%25 sure",
  ]);
});

test("diffManifests reports added, removed and changed declarations by field", () => {
  const before = {
    declarations: {
      data_safety: { source: "answered", collects_user_data: false, data_types: ["none"] },
      news_app: { source: "answered" },
    },
  };
  const after = {
    declarations: {
      data_safety: { source: "answered", collects_user_data: true, data_types: ["crash logs"] },
      ads: { source: "planned" },
    },
    permissions: { "android.permission.INTERNET": "streams" },
    listing: { title: "ignored" },
  };
  assert.deepEqual(diffManifests(before, after), [
    { kind: "added", name: "declarations.ads", fields: [] },
    { kind: "changed", name: "declarations.data_safety", fields: [
      { field: "collects_user_data", before: "false", after: "true" },
      { field: "data_types", before: '["none"]', after: '["crash logs"]' },
    ] },
    { kind: "removed", name: "declarations.news_app", fields: [] },
    { kind: "added", name: "permissions.android.permission.INTERNET", fields: [] },
  ]);
  assert.deepEqual(diffManifests(after, after), []);
});

test("loadManifest merges a baseline, the app's own values winning", () => {
  const dir = repo({
    "baseline/release-manifest.json": {
      schema: 1,
      declarations: {
        ads: { source: "answered", contains_ads: false, why: "factory policy" },
        data_safety: { source: "answered", data_types: ["crash logs", "diagnostics"] },
      },
    },
    "app/store/release-manifest.json": {
      extends: "../../baseline/release-manifest.json",
      app: { package: "com.example.app" },
      declarations: { ads: { contains_ads: true, why: "banner on the home screen" }, data_safety: { data_types: [] } },
    },
  });
  const m = loadManifest(join(dir, "app/store/release-manifest.json"));
  assert.equal(m.extends, undefined);
  assert.deepEqual(m.declarations, {
    ads: { source: "answered", contains_ads: true, why: "banner on the home screen" },
    data_safety: { source: "answered", data_types: [] },
  });
  assert.equal(m.schema, 1);
  rmSync(dir, { recursive: true });
});

test("loadManifest rejects a missing base and an extends cycle", () => {
  const dir = repo({
    "a.json": { extends: "b.json" },
    "b.json": { extends: "a.json" },
    "c.json": { extends: "nope.json" },
  });
  assert.throws(() => loadManifest(join(dir, "a.json")), /extends cycle/);
  assert.throws(() => loadManifest(join(dir, "c.json")), /does not exist/);
  rmSync(dir, { recursive: true });
});

test("every rule carries a question, a path and a reason", () => {
  for (const r of rules) {
    assert.ok(r.id && r.question && r.console_path, `${r.id} is missing metadata`);
    assert.ok(r.why && r.why.length > 40, `${r.id} has no usable reason`);
  }
});

console.log(`\n${passed} passed${failed ? `, ${failed} failed` : ""}`);
process.exit(failed ? 1 : 0);
