import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";

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

const EXT = new URL("../extension/", import.meta.url).pathname;
const SRC = join(EXT, "src");

// Content scripts are classic scripts that hang everything off globalThis.avow,
// so tests run the DOM-free ones in a fresh context rather than importing them.
function load(...files) {
  const ctx = vm.createContext({});
  for (const f of files) vm.runInContext(readFileSync(join(SRC, f), "utf8"), ctx, { filename: f });
  return ctx.avow;
}

test("extension asks for no permissions and runs only on the Play Console", () => {
  const m = JSON.parse(readFileSync(join(EXT, "manifest.json"), "utf8"));
  assert.equal(m.manifest_version, 3);
  for (const key of ["permissions", "host_permissions", "optional_permissions", "background", "externally_connectable", "web_accessible_resources"]) {
    assert.equal(m[key], undefined, `manifest.json must not declare ${key}`);
  }
  assert.deepEqual(m.content_scripts.map((c) => c.matches).flat(), ["https://play.google.com/console/*"]);
});

test("extension source never touches the network, storage or a submit", () => {
  const banned = /\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts|localStorage|sessionStorage|indexedDB|chrome\.storage|chrome\.runtime\.connect)\b|\.submit\(|requestSubmit/;
  for (const f of readdirSync(SRC)) {
    const hit = readFileSync(join(SRC, f), "utf8").match(banned);
    assert.equal(hit, null, `${f} uses ${hit?.[0]}`);
  }
});

test("readManifest accepts a schema 1 manifest without warnings", () => {
  const avow = load("load.js");
  const { manifest, warnings } = avow.readManifest(JSON.stringify({ schema: 1, declarations: { ads: {} } }));
  assert.deepEqual(Object.keys(manifest.declarations), ["ads"]);
  assert.equal(warnings.length, 0);
});

test("readManifest warns on another schema version and an unresolved extends", () => {
  const avow = load("load.js");
  const { warnings } = avow.readManifest(JSON.stringify({ schema: 2, extends: "../base.json", declarations: {} }));
  assert.equal(warnings.length, 2);
  assert.match(warnings[0], /schema 2/);
  assert.match(warnings[1], /extends/);
});

test("readManifest rejects invalid JSON and non-manifests", () => {
  const avow = load("load.js");
  assert.throws(() => avow.readManifest("{"), /Not valid JSON/);
  assert.throws(() => avow.readManifest("[]"), /expected a JSON object/);
  assert.throws(() => avow.readManifest('{"schema":1}'), /no declarations/);
});

console.log(`\n${passed} passed${failed ? `, ${failed} failed` : ""}`);
process.exit(failed ? 1 : 0);
