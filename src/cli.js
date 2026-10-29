#!/usr/bin/env node
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { rules, byId } from "./rules/index.js";
import { FORMS } from "./rules/completeness.js";
import { print } from "./lib/report.js";

const DEFAULT_MANIFEST = "store/release-manifest.json";

function usage() {
  console.log(`avow - Google Play declarations as code

  avow check [repo]          verify the manifest against the repo
  avow explain [question]    why an answer is what it is
  avow forms                 every Console screen, in submission order
  avow init [repo]           write a starter manifest

Options
  --manifest <path>   default ${DEFAULT_MANIFEST}, relative to the repo
  --json              machine-readable output
  --no-color
`);
}

function parse(argv) {
  const opts = { positional: [], manifest: DEFAULT_MANIFEST, json: false, color: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--manifest") opts.manifest = argv[++i];
    else if (a === "--json") opts.json = true;
    else if (a === "--no-color") opts.color = false;
    else if (a === "-h" || a === "--help") opts.help = true;
    else opts.positional.push(a);
  }
  return opts;
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
      return r.verify(manifest, root);
    } catch (e) {
      return { status: "warn", rule: r.id, message: `rule errored: ${e.message}` };
    }
  });
  if (opts.json) {
    console.log(JSON.stringify({ root, manifest: opts.manifest, results }, null, 2));
    process.exit(results.some((r) => r.status === "fail") ? 1 : 0);
  }
  console.log(`${root}  (${opts.manifest})\n`);
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

if (cmd === "forms") {
  console.log("Play Console declarations, in the order a first submission presents them:\n");
  FORMS.forEach(([key, label], i) => {
    console.log(`  ${String(i + 1).padStart(2)}. ${label.padEnd(32)} declarations.${key}`);
  });
  console.log("\nObserved during a real 1.0 submission. Play does not publish this order.");
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
