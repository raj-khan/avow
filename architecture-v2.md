# store-decl — Architecture v2

> **Supersedes:** v1 (2026-10-29)
> **What changed:** v1 was a design document. v2 is a build plan. The core thesis holds. The sequencing, schema, customer discovery, and monetization are now concrete.
> **What did not change:** No dependencies. No talking to Google. The manifest lives in the app repo. `skip` exists so the tool never lies.

---

## 1. What v1 Got Right (Keep These)

I want to be explicit about what should not be touched, because the instinct to "improve" a good design usually breaks it.

| v1 decision | Why it stays |
|-------------|--------------|
| Manifest in the app repo, not central | It describes the app and must change in the same commit. A central store lets it drift. |
| `skip` as a first-class status | A confident green on an uninspectable repo is worse than no output. |
| Verification before autofill | Knowing the answer is the hard part. Filling is the cheap part. |
| No dependencies | CI tool, security-adjacent, long-lived. Built-ins only. |
| `why` on every rule | The reasoning is the asset. It goes stale silently if not written down. |
| White-label factories as the customer | Solo devs fill once. Factories refill dozens of times and carry account risk. |
| Tool never talks to Google | Safe to run in CI, safe to install. |
| `claims` rule | Checking that the listing number matches the shipped data is genuinely novel. |

Everything below builds on these. Nothing replaces them.

---

## 2. What v1 Left Unfinished

v1 is honest about its own gaps. Here they are, named:

| Gap | Where v1 says it | Why it matters |
|-----|------------------|----------------|
| **No customer validation** | Section 8, open question | The entire monetization thesis rests on "factories will pay." Nobody asked one. |
| **Schema is documentation only** | Section 5, "Next" | `check` does not enforce the manifest shape. A malformed manifest passes silently. |
| **Knowledge staleness unsolved** | Section 8, open question | Play changes forms without notice. `FORMS` will rot. |
| **No distribution plan** | Not addressed | Even if factories will pay, how do they find this? |
| **Chrome extension is a sketch** | Section 5, "Later" | Correctly deferred, but underspecified for when it lands. |
| **No pricing model** | Not addressed | "Factories will pay" is not a price. |
| **Content rating check missing** | Section 8, open question | The longest questionnaire has no rule. |

v2 closes each of these.

---

## 3. The Validation Sprint (Weeks 1-2, Before Any Code)

**This section is first because it is the most important thing in this document.**

v1 ends with an open question: *"How many white-label app factories exist that would pay for this?"* The answer is knowable in two weeks and should be known before another line of code is written.

### Who to find

Not "white-label app factories" in the abstract. Specific companies. Three categories:

| Category | Examples to search | How to find them |
|----------|-------------------|------------------|
| **Radio station app builders** | Companies shipping 20+ radio apps under one Play account | Play Store search "radio", check developer names, count apps per developer |
| **Restaurant/menu app builders** | White-label menu apps for restaurant chains | Play Store "restaurant menu", same developer-account check |
| **Mosque/church app builders** | Islamic app studios, church app platforms | Play Store "mosque app" / "church app", same check |
| **Agency/contractor firms** | Agencies publishing under client accounts | LinkedIn "Play Store publisher", agency sites |

**The search that finds them:** on the Play Store, open any app in the category. Tap the developer name. Count how many apps they publish. Developers with **10+ apps in the same category** are the target.

### What to ask (three questions, no pitch)

Do not lead with the product. Lead with the problem.

> 1. "How many apps did you publish on Play last year?"
> 2. "How long does the policy section of a submission take — the Data safety, content rating, advertising ID forms?"
> 3. "Has a submission ever been blocked or rejected because of a declaration?"

**What you're listening for:**

| Signal | Meaning |
|--------|---------|
| "A few hours per app" | Pain is real |
| "We have a checklist, it's fine" | Pain is manageable, they won't pay |
| "We've been rejected once" | Pain is expensive, they will pay |
| "Our QA guy does it" | Pain is outsourced, they might pay for a tool that replaces him |
| "What's Data safety?" | Not a customer, wrong tier of operation |

### Success criteria (decide before asking)

| Result | Action |
|--------|--------|
| 3+ say "several hours per app" AND 1+ has been rejected | **Build.** The market is real. |
| All say "it's fine, we have a process" | **Do not build.** Ship as a personal tool, move on. |
| 0-1 respond to outreach | **Do not build.** You cannot find the customers. |

**This costs two weeks and zero dollars.** If you skip it, you are betting the project on a guess.

---

## 4. Manifest Schema (Concrete, Not Illustrative)

v1 says the schema exists in `schema/*.json` but is documentation only. Here is what it should actually contain, in a form that can be enforced.

### Top-level structure

```json
{
  "$schema": "https://store-decl.dev/schema/v1.json",
  "version": "1.0.0",
  "app": {
    "id": "com.example.app",
    "name": "Example App",
    "repo": "https://github.com/example/app",
    "release": "1.0.0"
  },
  "declarations": {
    "advertising_id": { ... },
    "data_safety": { ... },
    "content_rating": { ... },
    "target_audience": { ... },
    "ads": { ... },
    "app_access": { ... },
    "news_app": { ... },
    "covid_contact_tracing": { ... },
    "data_deletion": { ... },
    "financial_features": { ... },
    "health_features": { ... }
  },
  "listing": {
    "title": "...",
    "short_description": "...",
    "full_description": "...",
    "assets": { ... }
  },
  "claims": [ ... ]
}
```

### Every declaration follows the same shape

```json
{
  "answer": true,
  "source": "answered",
  "why": "The app uses Firebase Analytics for usage tracking, which does not contribute an advertising ID but does contribute analytics collection.",
  "answered_on": "2026-10-27",
  "answered_by": "developer",
  "verified_by": "advertising-id",
  "verified_on": "2026-10-29"
}
```

**The `source` field is the whole point.** It is an enum:

| `source` | Meaning | How `check` treats it |
|----------|---------|----------------------|
| `answered` | A human decided and wrote why | Normal verification |
| `planned` | A human intends to do this but hasn't | **Warn** in normal mode, **fail** with `--release` |
| `inherited` | Copied from a template or parent app | **Warn** — inherited answers are stale by definition |
| `unanswered` | Not yet decided | **Fail** — you cannot ship a declaration you haven't made |

v1's open question — *"Should `check` hard-fail on a declaration with `source: 'planned'` when run with a `--release` flag?"* — the answer is **yes**, and `inherited` should also fail under `--release`, because an inherited declaration is a guess about a different app.

---

## 5. Rules (Concrete Implementations)

v1 lists six rules. Here is what each actually does and what it returns.

### `completeness`

**Question:** Every Console declaration present and explained?

**Check:** Walks `declarations.*`. For each:
- Missing → `fail` with "declaration not present"
- Present but `source: "unanswered"` → `fail`
- Present but no `why` → `fail`
- Present, answered, with `why` → `pass`

**Why it exists:** The most common submission failure is a declaration that was never made because the form was skipped.

### `advertising-id`

**Question:** Does the app use advertising ID?

**Check:**
1. Read `declarations.advertising_id.answer`
2. Locate merged manifest (`build/intermediates/merged_manifests/*/AndroidManifest.xml` or the release bundle's)
3. If no merged manifest found → `skip` with "no release bundle built; cannot verify"
4. If `AD_ID` permission present AND answer is `false` → `fail` with the library that contributed it
5. If `AD_ID` absent AND answer is `true` → `warn` with "declared yes but no permission found; may be unused"
6. If both match → `pass`

**The library attribution** is the useful part. v1 mentions this. Implementation: parse `build/intermediates/merged_manifest/<variant>/manifest-merger-*-report.txt` which lists every permission and its source dependency.

### `data-safety`

**Question:** Does "no data collection" survive the dependency tree?

**Check:**
1. Read `declarations.data_safety.answer`
2. If `answer` is not `"no_collection"` → `skip` (nothing to verify)
3. Scan `package.json` / `build.gradle` / `Podfile` for known SDKs:

```js
const TRACKING_SDKS = {
  'firebase-analytics': 'Firebase Analytics collects usage data',
  'firebase-crashlytics': 'Crashlytics collects crash reports',
  'sentry': 'Sentry collects error data',
  'amplitude': 'Amplitude collects analytics',
  'mixpanel': 'Mixpanel collects analytics',
  'segment': 'Segment routes analytics',
  'adjust': 'Adjust collects attribution',
  'appsflyer': 'AppsFlyer collects attribution',
  'branch': 'Branch collects attribution',
  'facebook-sdk': 'Facebook SDK collects event data',
  'google-mobile-ads': 'AdMob collects advertising data',
};
```

4. Any match → `fail` with the SDK and what it collects
5. No match → `pass`

**This is the rule that catches the silent staleness problem.** You answer "no collection" in March, install Sentry in June, and nothing notices. This notices.

### `listing-limits`

**Question:** Does the listing copy fit Play's caps?

**Check:**
- Title ≤ 30 chars
- Short description ≤ 80 chars
- Full description ≤ 4000 chars
- No phone numbers, no URLs, no emoji in title
- No "Best", "#1", "Top" unqualified superlatives (Play's policy — `warn` not `fail`)

### `assets`

**Question:** Do icon, feature graphic, and screenshots meet Play's specs?

**Check** (from v1, unchanged — this one was already concrete):
- Icon: 512×512 PNG, no alpha
- Feature graphic: 1024×500 PNG/JPEG
- Screenshots: min 2, max 8, ratio 9:16 (portrait) or 16:9 (landscape), each ≥ 320px on short edge
- Bytes: each < 8MB

**The near-miss v1 mentions** — a 1080×2412 screenshot sits outside 9:16 — is caught here.

### `claims`

**Question:** Do numbers in the listing match the shipped data?

**Check** (from v1, extended):
1. Walk `claims[]` in the manifest: `[{ "text": "310 items", "source": "src/data/items.json", "path": "$.length" }]`
2. For each, evaluate the source and compare to the stated number
3. Mismatch → `fail`
4. Number in source but nowhere in listing → `fail` (the "invariant guarding a number nobody reads" case v1 describes)
5. Number in listing but no claim entry → `warn` with "number in listing has no verification"

---

## 6. New Rules (v2 Additions)

### `permissions-inventory`

**Question:** What is the bundle asking for, and is it accounted for?

This is the generalization of `advertising-id` that v1 asks for: *"what is my bundle asking for, and why."*

**Check:**
1. Parse the merged manifest for every `<uses-permission>`
2. Read `declarations.permissions_accounted[]` — a list of permissions the developer has acknowledged with a reason
3. Unaccounted permission → `warn` with the library that contributed it
4. Accounted permission not in manifest → `warn` with "declared but not present"

**Why it's a `warn` not a `fail`:** Permissions are not themselves a policy violation. An unreviewed permission is a risk, not a rejection. But the developer should see every one.

**This is the check that would have caught the AD_ID problem before Play did.**

### `content-rating`

**Question:** Are the content rating answers recorded, and is the rationale present?

v1 flags content rating as an open question: *"a long questionnaire whose answers are mostly unverifiable from code."*

That's correct. You cannot verify "does this app contain violence" from a `package.json`. But you can verify:

1. All content rating questions are answered (`source` not `unanswered`)
2. Each answer has a `why`
3. The IARC rating result is recorded (`declarations.content_rating.result: "PEGI 3"`)
4. The result is dated

**What this rule is actually for:** Six months after submission, when you need to prove what you declared, the reasoning is there. v1 says this reasoning *"only stays accurate if future submissions are recorded the same way."* This rule enforces the recording.

### `stale-declarations`

**Question:** Has anything invalidated a declaration since it was made?

**Check:**
1. For each declaration, compare `answered_on` against the last commit date of:
   - `package.json` / `build.gradle` (dependency changes)
   - the merged manifest (permission changes)
   - the data files referenced by `claims`
2. If a relevant file changed after `answered_on` → `warn` with "declaration dated X, dependency file changed Y — review"
3. If `answered_on` is older than 6 months → `warn` with "declaration is stale, re-verify"

**This is the answer to v1's staleness problem.** You cannot know what Play changed. But you can know what *your app* changed since you answered.

---

## 7. Knowledge Freshness (v1's Open Question, Answered)

v1 says:

> *"Play changes these forms without notice. There is no feed to watch. The honest answer may be that `FORMS` is versioned by observation and dated, and the tool says how old its knowledge is."*

That is the correct answer. Here is how to implement it.

### The `FORMS` structure

```js
export const FORMS = {
  observed_on: "2026-10-27",
  observed_during: "Quran Radio 1.0.0 submission",
  screen_order: [
    { id: "app_access", question: "Is your app restricted to users with a specific login?" },
    { id: "ads", question: "Does your app contain ads?" },
    { id: "content_rating", question: "Please rate your app..." },
    // ...
  ],
};
```

### The staleness warning

Every `check` run prints:

```
store-decl: form knowledge last observed 2026-10-27 (2 days ago)
```

And if it's older than 90 days:

```
store-decl: WARNING — form knowledge is 94 days old. Play may have changed.
            Re-submit an app and update FORMS in src/rules/completeness.js.
```

### The observation ritual

Add to v1's "Provenance" section — this is a *process*, not just a note:

1. Every time you submit an app, open `FORMS` before starting
2. Note any screen that is new, renamed, or reordered
3. Update `observed_on` and `observed_during`
4. Commit with message `forms: observed YYYY-MM-DD during <app> submission`

**This is the only honest way to keep the knowledge fresh.** There is no feed. There is only observation, dated and recorded.

---

## 8. Distribution (What v1 Doesn't Address)

The tool is useless if factories never hear about it. Here is how they find it.

### The channel that works: the Play Store itself

White-label factories publish under their own developer account. Their name is on every app they ship.

| Step | Action |
|------|--------|
| 1 | Find 50 apps in a category (radio, mosque, restaurant) |
| 2 | Open each app, tap the developer name |
| 3 | Record: developer name, app count, contact email (from the listing) |
| 4 | Build a list of the 20 developers with the most apps |
| 5 | Email each one. Not a pitch — a specific finding. |

### The email that works

Not "introducing store-decl." Instead:

> Subject: Data safety declarations across your 14 apps
>
> Hi [name],
>
> I checked your 14 published apps against Play's current declaration requirements. Three of them declare "no data collection" but include Firebase Analytics in their dependencies. That's a rejection risk if Play audits.
>
> I built a CLI that catches this before submission. No signup, runs in your CI, reads a JSON file in the repo.
>
> Want the list of which three?
>
> — [your name]

**Why this works:** You did the work first. You found a specific problem in their specific apps. You are not selling a tool; you are handing them a finding.

### The channel that doesn't work

- Product Hunt (wrong audience — solo devs, not factories)
- Hacker News (same)
- Twitter (same)
- Ads (no budget, no funnel)

**The only channel that reaches factories is direct outreach with a specific finding.** Budget two weeks for this. It is slower than launching. It is the only thing that works.

---

## 9. Chrome Extension (Specification, Not Sketch)

v1 defers this correctly. Here is what it needs to be when it lands.

### The three non-negotiables (v1's list, unchanged)

1. **Match on question text, not CSS selectors.** Google reshuffles the DOM but rarely rewrites the legal wording.
2. **Never auto-submit.** Fill, highlight unmapped, let the human click.
3. **No credentials, no network.** Reads a local manifest file the user picks. Never holds a session. Never phones home.

### The additional requirements

| Requirement | Why |
|-------------|-----|
| **Manifest file picker on first use** | Not a stored copy, not synced — a file the user selects |
| **Visible "unmapped fields" panel** | Shows what the extension couldn't fill and why |
| **No persistent state across sessions** | The manifest is re-read each time; no cached credentials |
| **Manifest version check** | If the manifest's `version` is older than the extension's expected schema, warn |
| **Extension ID documented in manifest** | The manifest's `$schema` URL points to a version the extension understands |

### The extension's job, precisely

```
User opens Play Console "Data safety" form
       ↓
Extension reads a manifest file the user selects
       ↓
Extension matches question text against FORMS
       ↓
For each match, fill the field and highlight green
       ↓
For each no-match, highlight yellow with "not in manifest"
       ↓
User reviews, clicks submit themselves
```

**The extension does not decide anything.** It moves text from a file the developer already wrote into fields the developer already decided. The decision happened in the manifest, before the browser opened.

---

## 10. Pricing (What v1 Doesn't Say)

v1 says factories will pay. It does not say how much.

### The model

| Tier | Price | What it includes |
|------|-------|------------------|
| **Free** | $0 | CLI, all rules, unlimited local runs |
| **Team** | $49/month | Shared manifest template, CI integration, Slack alerts on declaration staleness |
| **Factory** | $199/month | Multi-app dashboard, cross-app declaration drift detection, audit log |
| **Enterprise** | Custom | Self-hosted, SSO, custom rules |

### Why this pricing

| Reason | Evidence |
|--------|----------|
| Free tier must be genuinely useful | Solo devs are the early users, not the customers |
| $49/month matches a dev tool, not a SaaS | GitHub, Linear, Sentry all sit here |
| $199/month is the "factory" price | A single suspended account costs more than this |
| Enterprise is where the real money is | Factories with 50+ apps have procurement processes |

### The revenue math

| Scenario | Customers | MRR |
|----------|-----------|-----|
| Validation | 3 | $147 |
| Side income | 15 | $735 |
| Full-time | 50 | $2,450 |
| Scaling | 200 | $9,800 |

**At 50 Team customers ($2,450 MRR), the tool is a real business.** At 15, it is a serious side project.

---

## 11. Build Roadmap

### Phase 0 — Validation (Weeks 1-2, before code)

| Week | Task | Deliverable |
|------|------|-------------|
| 1 | Build the factory list (20 developers) | Spreadsheet with names, app counts, contact emails |
| 1 | Send 20 emails with specific findings | 20 sent, 5+ responses |
| 2 | Three calls with respondents | Written notes on pain, willingness to pay |
| 2 | **Decision: build or don't** | Documented go/no-go |

**Do not write code until Phase 0 is complete.**

### Phase 1 — Harden v1 (Weeks 3-4)

| Week | Task |
|------|------|
| 3 | Schema validation in `check` (v1's "Next" item) |
| 3 | `permissions-inventory` rule |
| 4 | `stale-declarations` rule |
| 4 | `--format github` for CI annotations |

### Phase 2 — Manifest as artifact (Weeks 5-6)

| Week | Task |
|------|------|
| 5 | `store-decl diff` — compare manifest against previous git revision |
| 5 | `store-decl explain <rule>` — print the `why` for any rule |
| 6 | Documentation site (static, `store-decl.dev`) |

### Phase 3 — Extension (Weeks 7-10)

| Week | Task |
|------|------|
| 7 | Extension scaffold, manifest file picker |
| 8 | Question-text matching against FORMS |
| 9 | Fill + highlight for all Data safety fields |
| 10 | Unmapped-fields panel, testing against a real submission |

### Phase 4 — Multi-app (Weeks 11-14)

| Week | Task |
|------|------|
| 11 | Team manifest template (`extends` key) |
| 12 | Cross-app drift detection |
| 13 | Dashboard (static site reading a shared repo) |
| 14 | Pricing page, Stripe integration |

---

## 12. What v1 Got Wrong (Explicitly)

I want to be honest about this because v1 is good enough that its mistakes could be missed.

| v1 claim | v2 correction |
|----------|---------------|
| *"Solo developers... will not pay"* | Correct, but the framing implies they are useless. They are the **distribution channel** — a solo dev who likes the tool tells their agency, their client, their friend's factory. |
| *"The Chrome extension [is] a thin delivery mechanism added last"* | True in sequencing, false in importance. The extension is the **product** for factories. The CLI is the product for solo devs. Both matter. |
| *"Maybe: push the machine-fillable parts"* | This should be **no**, not maybe. `eas submit` exists, and competing with it is not the point. Remove from roadmap. |
| *"The only version with recurring revenue"* (hosted) | False. The Team and Factory tiers are recurring revenue without a hosted dashboard. Hosted is for scale, not for revenue. |

---

## 13. Open Questions (v2's, Not v1's)

v1's open questions are answered. These are new.

| Question | Why it's open |
|----------|---------------|
| **How do you verify content rating answers from code?** | You mostly can't. The rule records reasoning, not correctness. Is that enough to sell? |
| **Should the extension write back to the manifest?** | If a developer fills a field manually in the Console that the extension couldn't fill, should the extension record that answer back to the manifest? Tempting, but it inverts the "manifest is the source of truth" principle. |
| **What is the upgrade trigger from Free to Team?** | A solo dev will never hit a limit. A dev whose app gets rejected will. Is the trigger the rejection? Or the second app? Or the first CI integration? |
| **Does the factory customer exist in enough numbers?** | Two weeks of outreach answers this. Until then, everything above is a hypothesis. |

---

## 14. The Honest Summary

v1 was a well-reasoned design for a tool that solves a real problem for a customer who may or may not exist in enough numbers to matter.

v2 does three things:

1. **Makes the customer hypothesis falsifiable** — Phase 0 answers "do factories exist and will they pay" before a line of code is written
2. **Fills the gaps v1 left open** — schema enforcement, staleness, permissions inventory, distribution, pricing
3. **Corrects v1's wrong framing** — solo devs are the channel, not the customer; the extension is the product, not the plumbing; hosted is for scale, not for revenue

**The next action is not to read this document again. It is to build the list of 20 factories and send 20 emails.**

Everything after Phase 0 depends on what those 20 factories say.

---

**Ready for the factory outreach spreadsheet and email template?** That's the first artifact Phase 0 needs.
