import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";
import { FORMS } from "../src/rules/completeness.js";
import { DATA_TYPES, PURPOSES } from "../src/lib/play.js";

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
  assert.deepEqual([...s.notSeen.map((x) => x.form)], ["data_safety", "data_safety", "data_safety"]);
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

test("target audience is a checkbox question located by its option labels", () => {
  const avow = load("questions.js", "fill.js");
  const page = tree("Target age 5 and under 6-8 9-12 13-15 16-17 18 and over", "13-15");
  assert.equal(avow.locate(page, access).question.form, "target_audience");
});

test("answerFor returns checkbox labels and rejects values that are not options", () => {
  const avow = load("questions.js");
  const q = avow.QUESTIONS.find((x) => x.form === "target_audience");
  const m = (age_groups) => ({ declarations: { target_audience: { source: "answered", age_groups } } });
  assert.deepEqual([...avow.answerFor(m(["13-15", "18 and over"]), q).labels], ["13-15", "18 and over"]);
  assert.match(avow.answerFor(m(["teens"]), q).reason, /"teens", not an option/);
});

test("planChecks ticks listed options, unticks the rest, ignores foreign boxes", () => {
  const avow = load("questions.js", "fill.js");
  const q = avow.QUESTIONS.find((x) => x.form === "target_audience");
  const options = ["6-8", "13-15", "18 and over", "I agree to the terms"].map((label) => ({ label }));
  const plan = avow.planChecks(options, q, ["13-15", "18 and over"]);
  assert.deepEqual([...plan.map((p) => [p.option.label, p.want])].map((x) => [...x]),
    [["6-8", false], ["13-15", true], ["18 and over", true]]);
});

test("data types tick exactly, so Photos never ticks Photos and videos", () => {
  const avow = load("questions.js", "fill.js");
  const page = tree("Location Approximate location Precise location App info and performance Crash logs Diagnostics", "x");
  const q = avow.locate(page, access).question;
  assert.equal(q.kind, "checkboxes");
  assert.equal(q.form, "data_safety");
  const options = ["Photos and videos", "Photos", "Videos", "Crash logs"].map((label) => ({ label }));
  const plan = avow.planChecks(options, q, ["Photos", "Crash logs"]);
  assert.deepEqual([...plan.map((p) => `${p.option.label}=${p.want}`)], ["Photos=true", "Videos=false", "Crash logs=true"]);
});

test("data types refuse a manifest value Play does not list", () => {
  const avow = load("questions.js");
  const q = avow.QUESTIONS.find((x) => x.kind === "checkboxes" && x.form === "data_safety");
  const r = avow.answerFor({ declarations: { data_safety: { source: "answered", data_types: ["crash logs", "telemetry"] } } }, q);
  assert.match(r.reason, /"telemetry", not an option/);
});

test("extension data types and purposes match the CLI's lists exactly", () => {
  const avow = load("questions.js");
  assert.deepEqual([...avow.DATA_TYPES], DATA_TYPES);
  assert.deepEqual([...avow.PURPOSES], PURPOSES);
});

// Nodes with headings: { headings: [...], parent }.
const titledTree = (...levels) => levels.reduce((parent, headings) => ({ headings, parent }), null);
const titledAccess = { parent: (n) => n.parent, headings: (n) => n.headings };

test("dataTypeFor reads the nearest heading that names one data type", () => {
  const avow = load("questions.js", "fill.js");
  const page = titledTree(["Data safety", "Crash logs", "Diagnostics"], ["Crash logs", "Is this data collected"], []);
  assert.equal(avow.dataTypeFor(page, titledAccess), "Crash logs");
  assert.equal(avow.dataTypeFor(titledTree(["crash LOGS"], []), titledAccess), "Crash logs");
});

test("dataTypeFor refuses two types at once and help-text mentions", () => {
  const avow = load("questions.js", "fill.js");
  assert.equal(avow.dataTypeFor(titledTree(["Crash logs", "Diagnostics"], []), titledAccess), null);
  assert.equal(avow.dataTypeFor(titledTree(["Your name and photos"], []), titledAccess), null);
});

test("answerFor reads per-type answers from data_type_details", () => {
  const avow = load("questions.js");
  const q = { form: "data_safety", perType: true, answer: (t) => (t.collected ? "Yes" : "No") };
  const m = { declarations: { data_safety: { source: "answered", data_type_details: { "Crash logs": { collected: true } } } } };
  assert.equal(avow.answerFor(m, q, { dataType: "Crash logs" }).label, "Yes");
  assert.match(avow.answerFor(m, q, { dataType: "Photos" }).reason, /no data_type_details entry for "Photos"/);
  assert.match(avow.answerFor(m, q, {}).reason, /could not tell which data type/);
});

const perType = (avow, text) => avow.QUESTIONS.find((x) => x.perType && x.text.includes(text));
const crashManifest = (crash) => ({
  declarations: { data_safety: { source: "answered", data_type_details: { "Crash logs": crash } } },
});

test("collected or shared ticks by leading label, unticking the other", () => {
  const avow = load("questions.js", "fill.js");
  const q = perType(avow, "collected, shared, or both");
  const { labels } = avow.answerFor(crashManifest({ collected: true, shared: false }), q, { dataType: "Crash logs" });
  const options = [
    { label: "Collected  Data is transferred off the user's device" },
    { label: "Shared  Data is transferred to a third party" },
  ];
  const plan = avow.planChecks(options, q, [...labels]);
  assert.deepEqual([...plan.map((p) => p.want)], [true, false]);
});

test("ephemeral and required answer from the type's details", () => {
  const avow = load("questions.js", "fill.js");
  const m = crashManifest({ collected: true, ephemeral: true, required: false });
  assert.equal(avow.answerFor(m, perType(avow, "ephemerally"), { dataType: "Crash logs" }).label, "Yes");
  const required = perType(avow, "required for your app");
  const label = avow.answerFor(m, required, { dataType: "Crash logs" }).label;
  const options = [
    { label: "Data collection is required (users can't turn off this data collection)" },
    { label: "Users can choose whether this data is collected" },
  ];
  assert.equal(avow.pickOption(options, label), options[1]);
  assert.equal(avow.matchQuestion("Is this data required for your app, or can users choose whether it\u2019s collected?"), required);
});

test("purposes tick from the matching list, refusing off-list values", () => {
  const avow = load("questions.js", "fill.js");
  const collectedQ = perType(avow, "Why is this user data collected");
  const sharedQ = perType(avow, "Why is this user data shared");
  const m = crashManifest({ collected: true, shared: false, collection_purposes: ["Analytics", "Fraud prevention, security, and compliance"] });
  const { labels } = avow.answerFor(m, collectedQ, { dataType: "Crash logs" });
  const options = avow.PURPOSES.map((p) => ({ label: `${p}  Used for something` }));
  const ticked = avow.planChecks(options, collectedQ, [...labels]).filter((p) => p.want).map((p) => p.option.label);
  assert.deepEqual([...ticked], ["Analytics  Used for something", "Fraud prevention, security, and compliance  Used for something"]);
  assert.match(avow.answerFor(m, sharedQ, { dataType: "Crash logs" }).reason, /no answer/);
  const bad = crashManifest({ collected: true, collection_purposes: ["Telemetry"] });
  assert.match(avow.answerFor(bad, collectedQ, { dataType: "Crash logs" }).reason, /"Telemetry", not an option/);
});

console.log(`\n${passed} passed${failed ? `, ${failed} failed` : ""}`);
process.exit(failed ? 1 : 0);
