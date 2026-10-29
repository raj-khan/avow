#!/usr/bin/env node
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import { rules, byId } from "./rules/index.js";
import { FORMS, FORMS_OBSERVED, FORMS_STALE_DAYS, formsAge } from "./rules/completeness.js";
import { print, github } from "./lib/report.js";
import { diffManifests } from "./lib/diff.js";
import { isRepo, revExists, show } from "./lib/git.js";

const DEFAULT_MANIFEST = "store/release-manifest.json";

function usage() {
  console.log(`avow - Google Play declarations as code

  avow check [repo]          verify the manifest against the repo
  avow explain [question]    why an answer is what it is
  avow diff [repo]           declarations changed since a git revision
  avow forms                 every Console screen, in submission order
  avow init [repo]           write a starter manifest

Options
  --manifest <path>   default ${DEFAULT_MANIFEST}, relative to the repo
  --since <rev>       diff against this revision, default HEAD
  --release           planned and inherited declarations fail instead of warn
  --json              machine-readable output
  --format github     GitHub Actions annotations on the manifest (or json)
  --no-color
`);
}

function parse(argv) {
  const opts = { positional: [], manifest: DEFAULT_MANIFEST, json: false, color: true, release: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--manifest") opts.manifest = argv[++i];
    else if (a === "--json") opts.json = true;
    else if (a === "--format") opts.format = argv[++i];
    else if (a === "--release") opts.release = true;
    else if (a === "--since") opts.since = argv[++i];
    else if (a === "--no-color") opts.color = false;
    else if (a === "-h" || a === "--help") opts.help = true;
    else opts.positional.push(a);
  }
  return opts;
}

function formsFreshness() {
  const age = formsAge();
  const line = `form knowledge last observed ${FORMS_OBSERVED.on} (${age} day${age === 1 ? "" : "s"} ago)`;
  if (age <= FORMS_STALE_DAYS) return line;
  return `WARNING: ${line}. Play may have changed its forms.\n` +
    "Re-check them during your next submission and update FORMS in src/rules/completeness.js.";
}

function load(root, rel) {
  const path = join(root, rel);
  if (!existsSync(path)) {
    console.error(`No manifest at ${path}\nRun \`avow init\` to write a starter one.`);
    process.exit(2);
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    console.error(`${path} is not valid JSON: ${e.message}`);
    process.exit(2);
  }
}

const [cmd, ...rest] = process.argv.slice(2);
const opts = parse(rest);
if (opts.format === "json") opts.json = true;
else if (opts.format && opts.format !== "github") {
  console.error(`Unknown format "${opts.format}"; expected github or json.`);
  process.exit(2);
}
if (opts.help || !cmd) {
  usage();
  process.exit(cmd ? 0 : 1);
}

if (cmd === "check") {
  const root = resolve(opts.positional[0] ?? ".");
  const manifest = load(root, opts.manifest);
  // A rule that throws is a bug in avow, not a failed declaration, so it
  // must not read as a policy problem.
  const results = rules.map((r) => {
    try {
      return r.verify(manifest, root, { release: opts.release });
    } catch (e) {
      return { status: "warn", rule: r.id, message: `rule errored: ${e.message}` };
    }
  });
  const failed = results.some((r) => r.status === "fail");
  if (opts.format === "github") {
    const file = relative(process.cwd(), join(root, opts.manifest)) || opts.manifest;
    for (const line of github(results, file)) console.log(line);
    process.exit(failed ? 1 : 0);
  }
  if (opts.json) {
    const forms_observed = { ...FORMS_OBSERVED, age_days: formsAge() };
    console.log(JSON.stringify({ root, manifest: opts.manifest, forms_observed, results }, null, 2));
    process.exit(failed ? 1 : 0);
  }
  console.log(`${root}  (${opts.manifest})`);
  console.log(`${formsFreshness()}\n`);
  process.exit(print(results, { color: opts.color }) ? 0 : 1);
}

if (cmd === "explain") {
  const q = opts.positional.join(" ").toLowerCase();
  const matches = q
    ? rules.filter((r) =>
        [r.id, r.question, r.console_path].join(" ").toLowerCase().includes(q)
      )
    : rules;
  if (!matches.length) {
    console.error(`Nothing matches "${q}". Try \`avow explain\` for all of them.`);
    process.exit(2);
  }
  for (const r of matches) {
    console.log(`\x1b[1m${r.question}\x1b[0m`);
    console.log(`  ${r.console_path}`);
    console.log(`\n  ${r.why.replace(/(.{1,72})(\s|$)/g, "$1\n  ").trim()}\n`);
  }
  process.exit(0);
}

if (cmd === "diff") {
  const root = resolve(opts.positional[0] ?? ".");
  const since = opts.since ?? "HEAD";
  if (!isRepo(root)) {
    console.error(`${root} is not a git repository; nothing to diff against.`);
    process.exit(2);
  }
  if (!revExists(root, since)) {
    console.error(`Unknown revision "${since}" in ${root}.`);
    process.exit(2);
  }
  const after = load(root, opts.manifest);
  const old = show(root, since, opts.manifest);
  let before = {};
  if (old !== null) {
    try {
      before = JSON.parse(old);
    } catch (e) {
      console.error(`${opts.manifest} at ${since} is not valid JSON: ${e.message}`);
      process.exit(2);
    }
  }
  const changes = diffManifests(before, after);
  if (opts.json) {
    console.log(JSON.stringify({ root, since, changes }, null, 2));
    process.exit(0);
  }
  if (old === null) console.log(`${opts.manifest} does not exist at ${since}; everything is new.\n`);
  if (!changes.length) {
    console.log(`No declaration changes since ${since}.`);
    process.exit(0);
  }
  const mark = { added: "+", removed: "-", changed: "~" };
  console.log(`${changes.length} declaration change(s) since ${since}:\n`);
  for (const c of changes) {
    console.log(`${mark[c.kind]} ${c.name} ${c.kind}`);
    for (const f of c.fields) console.log(`    ${f.field}: ${f.before ?? "(none)"} -> ${f.after ?? "(none)"}`);
  }
  process.exit(0);
}

if (cmd === "forms") {
  console.log("Play Console declarations, in the order a first submission presents them:\n");
  FORMS.forEach(([key, label], i) => {
    console.log(`  ${String(i + 1).padStart(2)}. ${label.padEnd(32)} declarations.${key}`);
  });
  console.log(`\nObserved during ${FORMS_OBSERVED.during}. Play does not publish this order.`);
  console.log(formsFreshness());
  process.exit(0);
}

if (cmd === "init") {
  const root = resolve(opts.positional[0] ?? ".");
  const path = join(root, opts.manifest);
  if (existsSync(path)) {
    console.error(`${path} already exists; refusing to overwrite a declaration file.`);
    process.exit(2);
  }
  const starter = {
    schema: 1,
    updated: new Date().toISOString().slice(0, 10),
    app: { package: "", version_name: "", version_code: 0, free_or_paid: "free" },
    listing: { title: "", short_description: "", full_description: "", whats_new: "" },
    assets: { icon_512: "", feature_graphic_1024x500: "", phone_screenshots: [] },
    declarations: Object.fromEntries(
      FORMS.map(([k, label]) => [k, { source: "unanswered", question: label, why: "" }])
    ),
    invariants: {},
  };
  writeFileSync(path, JSON.stringify(starter, null, 2) + "\n");
  console.log(`Wrote ${path} with ${FORMS.length} declarations to fill in.`);
  process.exit(0);
}

console.error(`Unknown command "${cmd}"`);
usage();
process.exit(1);
