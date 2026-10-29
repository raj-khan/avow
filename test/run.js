import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { rules, byId } from "../src/rules/index.js";
import { FORMS, FORMS_OBSERVED, formsAge } from "../src/rules/completeness.js";
import { imageSize } from "../src/lib/imagesize.js";
import { permissions, gradleDependencies } from "../src/lib/android.js";

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

test("listing-limits fails an over-long title", () => {
  const r = byId.get("listing-limits").verify({ listing: { title: "x".repeat(31) } });
  assert.equal(r.status, "fail");
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

test("every rule carries a question, a path and a reason", () => {
  for (const r of rules) {
    assert.ok(r.id && r.question && r.console_path, `${r.id} is missing metadata`);
    assert.ok(r.why && r.why.length > 40, `${r.id} has no usable reason`);
  }
});

console.log(`\n${passed} passed${failed ? `, ${failed} failed` : ""}`);
process.exit(failed ? 1 : 0);
