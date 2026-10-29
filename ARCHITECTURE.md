# avow: what this is and where it goes

Written 2026-10-29, immediately after a first Google Play submission, while the
details were still fresh. Status markers are honest: **done**, **next**,
**later**, **maybe**.

## 1. The problem, precisely

Publishing a first Android app means answering about thirteen policy
questionnaires in the Play Console. The typing is trivial. Four things about it
are not.

**They are binding.** Play treats Data safety, Advertising ID, Content rating
and Target audience as declarations, not preferences. A wrong answer is an
enforcement matter against the developer account, not a correction you quietly
fix in the next release.

**Some are cross-checked against the build.** Declaring that the app does not
use an advertising ID while any dependency contributes the
`com.google.android.gms.permission.AD_ID` permission is an automatic rejection.
The developer usually did not add that permission; a library did.

**They go stale silently.** A listing claiming 310 items stays live long after
the data file says 290. A Data safety form filed truthfully in March is false
the day someone installs Sentry, and nothing anywhere notices.

**The reasoning is never recorded.** Six months later nobody remembers why
9-12 was left unticked, so the next release re-derives it, or worse, answers
differently.

Observed cost on one real submission: ten screens, one blocked review
submission (incomplete Advertising ID declaration, discovered only when the
Send for review button refused), and one near-miss on screenshot aspect ratio.

## 2. The shape of the answer

```
manifest (JSON, in the app's repo)
    |
    |-- holds every answer, each with a `why` and a `source`
    |
    +-- consumed by:
          avow check      verify against the repo        DONE
          avow explain    the reasoning, on demand       DONE
          avow forms      the Console's screen order     DONE
          extension             fill the forms in the browser  LATER
          avow api        push what the API can take     MAYBE
```

The manifest is the durable artifact. Everything else is a consumer of it and
is individually disposable. This ordering matters: an autofill extension built
first would have needed a hand-authored JSON anyway, and the authoring is where
the difficulty actually lives.

## 3. Why verification before autofill

The original idea was a Chrome extension that fills the Console from a JSON
file. That inverts the value.

Filling a field saves seconds. **Knowing the answer** is the hard part: that
ticking 9-12 pulls the app into the Families programme with its own ads/SDK
self-certification and content review; that a Data safety "no" has to survive
every future `npm install`; that a device-native 1080x2412 screenshot sits
outside Play's stated 9:16. An extension that fills fields from a manifest the
developer had to author unaided skips all of that and automates the cheap part.

So: the rules carry the knowledge, the CLI proves the manifest against the
code, and the browser layer is a thin delivery mechanism added last.

## 4. Current architecture (done)

```
src/cli.js            argument parsing, rule dispatch, exit codes
src/rules/index.js    the registry; array order is display order
src/rules/*.js        one rule per concern, each self-describing
src/lib/report.js     result/status vocabulary and the terminal renderer
src/lib/android.js    merged-manifest discovery, permissions, dependencies
src/lib/imagesize.js  PNG IHDR and JPEG SOF parsing, no image library
schema/*.json         JSON Schema for the manifest (documentation today)
test/run.js           fake repos in temp dirs, no real build required
```

### The rule contract

```js
export default {
  id: "advertising-id",
  question: "Does your app use advertising ID?",
  console_path: "App content > Advertising ID",
  why: "...what Play does with the answer and how it goes wrong...",
  verify(manifest, root) { return result(PASS|FAIL|WARN|SKIP, id, msg, detail?); },
};
```

Four statuses, and the distinctions are load-bearing:

| Status | Means | Exit code effect |
| --- | --- | --- |
| `pass` | checked and consistent | none |
| `fail` | Play would reject, or the manifest contradicts the repo | non-zero |
| `warn` | Play states it but does not enforce it | none |
| `skip` | the input needed is absent; **never guess** | none |

`skip` exists because the most dangerous output this tool could produce is a
confident green on a repo it could not actually inspect. If no release bundle
has been built, `advertising-id` cannot see the merged manifest, and it says so
rather than trusting the declaration.

### Rules today

| Rule | What it proves |
| --- | --- |
| `completeness` | every Console declaration is present, and explained |
| `advertising-id` | the answer against `AD_ID` in the **merged** manifest |
| `data-safety` | "no collection" against installed analytics/crash/attribution/ad SDKs |
| `listing-limits` | copy against Play's character caps |
| `assets` | icon, feature graphic, screenshot dimensions, bytes, ratio, count |
| `claims` | numbers in the listing against the data file the app ships |

`claims` additionally fails when a pinned number appears nowhere in the copy,
because an invariant guarding a number nobody reads is decoration.

## 5. Roadmap

### Next

- **Schema validation in `check`.** The schema exists but nothing enforces it.
  Needs a small hand-rolled validator, since a dependency is not worth it for
  one document shape.
- **`avow diff`.** Compare the manifest against the previous git revision
  and list which declarations changed. A changed Data safety answer should be
  loud in review; today it is one line in a diff nobody reads closely.
- **Permission inventory rule.** Report every permission in the merged manifest
  that the manifest does not account for, with the library that contributed it.
  This generalises `advertising-id` into the check developers actually want:
  "what is my bundle asking for, and why".
- **`--format github`.** Emit GitHub Actions annotations so failures land on the
  diff rather than in a log.

### Later

- **The Chrome extension.** MV3, content script on `play.google.com/console/*`.
  Three non-negotiables, learned from watching the Console:
  1. **Match on question text, not CSS selectors.** Google reshuffles that DOM
     constantly but rarely rewrites the legal wording.
  2. **Never auto-submit.** These are binding declarations. Fill, highlight
     anything unmapped, let the human read and click.
  3. **No credentials, no network.** The extension reads a local manifest file
     the user picks. It must never hold a Google session or phone home, or it
     becomes a credential-theft target sitting on the Play Console.
- **App Store Connect.** The same problem exists on iOS: privacy nutrition
  labels, encryption export compliance, content rights, age rating. Larger
  surface, same shape. The manifest grows a `ios` section rather than forking.
- **Multi-app.** An app factory wants one shared policy baseline plus per-app
  overrides. Needs a manifest `extends` key and nothing else architecturally.

### Maybe

- **Push the machine-fillable parts.** The Play Developer API covers listing
  text, graphics and release notes. The manifest already holds all of it, so
  `avow push` is mostly plumbing. Deliberately deprioritised: `eas
  submit` already does this for anyone on Expo, and competing with it is not
  the point.
- **Hosted.** A dashboard that watches repos and warns when a dependency
  invalidates a filed declaration. This is the only version with recurring
  revenue, and also the only one needing a server, auth and someone's repo
  access. Do not start here.

## 6. Who this is for

Solo developers fill these forms once per app and will not pay. They are the
right early users and the wrong customers.

The people who refill them constantly are **white-label app factories**: radio,
restaurant, mosque and church, school, real estate and event apps, shipping
tens of near-identical bundles a year under one developer account. Same
declarations every time, filled by whoever is free that afternoon, and a single
wrong Data safety answer can suspend the account that carries all of them.
Concentrated risk, repeated work, existing CI. That is the shape of a customer.

Second candidate: **agencies and contractors** who publish under a client's
account and need to hand over a defensible record of what was declared and why.
The `why` field and `source: "answered"` are already that artifact.

## 7. Decisions worth not relitigating

- **No dependencies.** CI tool, long-lived, security-adjacent. Built-ins only.
  Anything added needs a line here explaining why built-ins failed.
- **JSON, not YAML or TOML.** It is read by a CLI, a browser extension and
  possibly a server, and `JSON.parse` is everywhere. Comments go in `$comment`.
- **The manifest lives in the app's repo, not here.** It describes the app and
  must change in the same commit as the code that makes it true. A central
  store would let them drift, which is the problem.
- **The tool never talks to Google.** No OAuth, no service account, no API
  token. It reads files. This keeps it safe to run in CI and safe to install.
- **`quran-radio` is a fixture, not a tenant.** Nothing app-specific belongs in
  the rules.

## 8. Open questions

- Should `check` hard-fail on a declaration with `source: "planned"` when run
  with a `--release` flag? Probably, but the flag's semantics need thought.
- Content rating is a long questionnaire whose answers are mostly unverifiable
  from code. Is recording them with reasoning enough, or is there a useful
  check hiding in there?
- Play changes these forms without notice. There is no feed to watch. The
  honest answer may be that `FORMS` is versioned by observation and dated, and
  the tool says how old its knowledge is.

## 9. Provenance

`FORMS` in `src/rules/completeness.js` is the screen order observed during the
Quran Radio 1.0.0 submission on 2026-10-27, not documentation: Play does not
publish the order. The `why` on each rule is the reasoning worked out while
answering it for real. That is the asset here, and it only stays accurate if
future submissions are recorded the same way.
