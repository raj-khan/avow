import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";
import { FORMS } from "../src/rules/completeness.js";

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

test("matchQuestion ignores case, punctuation, quotes and trailing help text", () => {
  const avow = load("questions.js");
  assert.equal(avow.matchQuestion("Does your app use advertising ID?").form, "advertising_id");
  assert.equal(avow.matchQuestion("  DOES YOUR APP CONTAIN ADS  Learn more").form, "ads");
  assert.equal(avow.matchQuestion("Is your app a \u201cnews\u201d app?").form, "news_app");
  assert.equal(avow.matchQuestion("Does your app use location?"), null);
});

test("answerFor maps declarations to Yes or No", () => {
  const avow = load("questions.js");
  const q = (form, text) => avow.QUESTIONS.find((x) => x.form === form && (!text || x.text.includes(text)));
  const m = {
    declarations: {
      advertising_id: { source: "answered", uses_advertising_id: false },
      data_safety: { source: "planned", collects_user_data: false, shares_user_data: true, encrypted_in_transit: "n/a" },
    },
  };
  assert.deepEqual({ ...avow.answerFor(m, q("advertising_id")) }, { label: "No" });
  assert.deepEqual({ ...avow.answerFor(m, q("data_safety", "collect or share")) }, { label: "Yes" });
  assert.match(avow.answerFor(m, q("data_safety", "encrypted")).reason, /no answer/);
  assert.match(avow.answerFor(m, q("ads")).reason, /not in the manifest/);
});

test("answerFor refuses inherited and unanswered declarations", () => {
  const avow = load("questions.js");
  const ads = avow.QUESTIONS.find((x) => x.form === "ads");
  for (const source of ["inherited", "unanswered"]) {
    const r = avow.answerFor({ declarations: { ads: { source, contains_ads: false } } }, ads);
    assert.equal(r.label, undefined);
    assert.match(r.reason, new RegExp(source));
  }
});

test("every question maps to a form the CLI knows", () => {
  const avow = load("questions.js");
  const known = new Set(FORMS.map(([k]) => k));
  for (const q of avow.QUESTIONS) assert.ok(known.has(q.form), `${q.form} is not in FORMS`);
});

// A minimal tree: { text, parent } stands in for DOM nodes.
const tree = (...texts) => texts.reduce((parent, text) => ({ text, parent }), null);
const access = { parent: (n) => n.parent, text: (n) => n.text };

test("locate finds the smallest block holding exactly one question", () => {
  const avow = load("questions.js", "fill.js");
  const page = tree(
    "Does your app contain ads? Yes No Does your app use advertising ID? Yes No",
    "Does your app contain ads? Learn more Yes No",
    "Yes No",
  );
  const found = avow.locate(page, access);
  assert.equal(found.question.form, "ads");
  assert.equal(found.block.text, "Does your app contain ads? Learn more Yes No");
});

test("locate gives up when the nearest match holds two questions", () => {
  const avow = load("questions.js", "fill.js");
  const page = tree("Does your app contain ads? Yes No Is your app a news app? Yes No", "Yes No");
  assert.equal(avow.locate(page, access), null);
  assert.equal(avow.locate(tree("Pick a category", "Yes No"), access), null);
});

test("pickOption matches the answer word, not a word inside a description", () => {
  const avow = load("questions.js", "fill.js");
  const options = [
    { label: "Yes  Your app shows ads, including Nothing but a yes" },
    { label: "No  Your app does not show ads" },
  ];
  assert.equal(avow.pickOption(options, "No"), options[1]);
  assert.equal(avow.pickOption(options, "Yes"), options[0]);
  assert.equal(avow.pickOption([{ label: "Not sure" }], "No"), null);
});

test("summarize splits the report and lists same-form questions not on screen", () => {
  const avow = load("questions.js", "fill.js");
  const q = (text) => avow.QUESTIONS.find((x) => x.text.includes(text));
  const report = [
    { status: "filled", question: q("collect or share"), label: "No" },
    { status: "unfilled", question: q("contain ads"), reason: "inherited" },
    { status: "unknown", text: "Which age groups?" },
  ];
  const s = avow.summarize(report);
  assert.equal(s.filled.length, 1);
  assert.equal(s.unfilled.length, 1);
  assert.equal(s.unknown.length, 1);
  assert.deepEqual([...s.notSeen.map((x) => x.form)], ["data_safety", "data_safety"]);
});

test("app access is answered by option text", () => {
  const avow = load("questions.js", "fill.js");
  const q = avow.QUESTIONS.find((x) => x.form === "app_access");
  const block = tree(
    "App access All functionality in my app is available without any access restrictions " +
    "All or some functionality in my app is restricted Add instructions",
    "options",
  );
  assert.equal(avow.locate(block, access).question, q);
  const options = [
    { label: "All functionality in my app is available without any access restrictions" },
    { label: "All or some functionality in my app is restricted  Provide login details" },
  ];
  const label = (restricted) =>
    avow.answerFor({ declarations: { app_access: { source: "answered", restricted } } }, q).label;
  assert.equal(avow.pickOption(options, label(false)), options[0]);
  assert.equal(avow.pickOption(options, label(true)), options[1]);
});

console.log(`\n${passed} passed${failed ? `, ${failed} failed` : ""}`);
process.exit(failed ? 1 : 0);
