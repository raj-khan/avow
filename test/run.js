import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { rules, byId } from "../src/rules/index.js";
import { imageSize } from "../src/lib/imagesize.js";
import { permissions } from "../src/lib/android.js";

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

test("every rule carries a question, a path and a reason", () => {
  for (const r of rules) {
    assert.ok(r.id && r.question && r.console_path, `${r.id} is missing metadata`);
    assert.ok(r.why && r.why.length > 40, `${r.id} has no usable reason`);
  }
});

console.log(`\n${passed} passed${failed ? `, ${failed} failed` : ""}`);
process.exit(failed ? 1 : 0);
