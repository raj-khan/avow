# avow (formerly store-decl)

Google Play declarations as code. Read `ARCHITECTURE.md` before changing
anything structural; it holds the reasoning and the roadmap.

## What this is

A CLI that keeps the answers to Play Console policy questionnaires in one JSON
manifest inside an app's repo, with the reasoning attached to each answer, and
fails CI when the manifest contradicts the code.

It does **not** upload anything. Bundles, listings and rollouts are already
covered by the Play Developer API and `eas submit`. This tool covers the forms
no API reaches.

## Run it

```sh
node src/cli.js check /path/to/an/app/repo
node src/cli.js explain advertising
node src/cli.js forms
npm test
```

The reference app repo is `/media/raj/Work1/quran-radio`, whose
`store/release-manifest.json` is where this tool was extracted from. Every
change should be checked against it:

```sh
node src/cli.js check /media/raj/Work1/quran-radio --no-color
```

Expected today: 6 pass, 3 warn, 1 skip, 0 fail. The three warnings are real
and correct (five declarations carry `answer_notes` rather than a `why`; the
screenshots are genuinely 1:2.233; content rating records only an expected
rating, not the one IARC issued, and is undated). The skip is `permissions-inventory`: that
manifest has no `permissions` map yet. Do not "fix" any of them by weakening a
rule.

## Constraints that are deliberate

- **No runtime dependencies.** Node 20+ built-ins only. This runs in CI, where
  an image library or a schema validator is a liability. `src/lib/imagesize.js`
  parses PNG and JPEG headers by hand for exactly this reason.
- **Permissions come from the merged manifest.** Never read `app.json` or the
  authored `AndroidManifest.xml` to answer a permission question. Libraries and
  config plugins add permissions nobody wrote, and that gap is the whole
  failure mode `advertising-id` exists to catch.
- **`fail` blocks, `warn` does not.** A rule fails only when Play would reject
  or when the manifest contradicts the repo. Anything Play states but does not
  enforce warns. Failing on a listing Play is willing to accept makes the tool
  lie in the other direction, which is worse.
- **A rule that throws is a bug, not a policy problem.** `cli.js` catches and
  reports it as `warn`, so a crash never reads as a failed declaration.
- **`source: "answered"` means entered in the Console**, not merely decided.
  That distinction is what makes the manifest an audit trail.

## Adding a rule

1. New file in `src/rules/`, default-export an object with `id`, `question`,
   `console_path`, `why` (over 40 characters; a test asserts this) and
   `verify(manifest, root, { release, today })`.
2. `verify` returns `result(status, id, message, detail?)` from `lib/report.js`
   and must return `SKIP` rather than guess when the input it needs is absent.
3. Register it in `src/rules/index.js`. Order there is display order.
4. Add tests to `test/run.js` covering pass, fail and skip. Tests build a fake
   repo in a temp dir; never depend on a real Android build existing.
5. If the rule corresponds to a Console screen, add it to `FORMS` in
   `src/rules/completeness.js` in the position the Console presents it.

## Writing the `why`

This is the product, not decoration. It should say what Play does with the
answer and how it goes wrong, in the terms a developer filling the form has.
Write it the way you would explain it to someone staring at the screen, not the
way the policy document phrases it.

## Do not

- Add a dependency without a line in `ARCHITECTURE.md` saying why built-ins
  were not enough.
- Hard-code anything app-specific. `quran-radio` is a test fixture, not a
  tenant.
- Commit a real `credentials.json`, keystore, service account key or Play API
  token. None are needed: this tool never talks to Google.
- Weaken a rule to make a repo green.
