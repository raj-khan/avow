# Backlog

Built from `architecture-v2.md`, reconciled with `CLAUDE.md`. One task per PR,
in order. Where v2 contradicts a deliberate constraint, the constraint wins and
the note says so.

Status: `todo`, `done`.

## Tasks

| # | Task | v2 section | Status |
|---|------|-----------|--------|
| 1 | Rename `store-decl` to `avow` (package, bin, CLI text, docs, schema `$id`) | n/a | done |
| 2 | CI: GitHub Actions runs `npm test` on PRs and main | n/a | done |
| 3 | `source` enum gains `inherited` and `unanswered`; `completeness` fails on `unanswered`, warns on `planned` and `inherited` | 4 | done |
| 4 | `--release` flag: `planned` and `inherited` fail instead of warn | 4 | done |
| 5 | Hand-rolled schema validator, run by `check` as a `schema` rule | 2, 11 Phase 1 | done |
| 6 | Dates on declarations (`answered_on`, `verified_on`) in schema and README | 4 | done |
| 7 | `FORMS` observation date; `forms` and `check` print its age, warn past 90 days | 7 | done |
| 8 | `data-safety` also reads `build.gradle` dependencies, not only `package.json` | 5 | done |
| 9 | Library attribution from the manifest-merger report, used by `advertising-id` | 5 | done |
| 10 | `permissions-inventory` rule: every merged permission accounted for, with its library | 6 | done |
| 11 | `content-rating` rule: result recorded, dated and explained | 6 | done |
| 12 | `stale-declarations` rule: dependency or claim files changed after `answered_on`, or answer older than 6 months | 6 | done |
| 13 | `listing-limits` warns on URLs, phone numbers, emoji and unqualified superlatives in the title | 5 | done |
| 14 | `--format github` emits Actions annotations | 11 Phase 1 | done |
| 15 | `avow diff`: declarations changed since a git revision | 11 Phase 2 | done |
| 16 | `extends`: a manifest inherits a shared baseline, per-app overrides win | 11 Phase 4 | done |
| 17 | Docs: ARCHITECTURE.md roadmap and rules table, README, drop "push" from the roadmap | 12 | done |
| 18 | `data-types` rule: data types spelled as Play lists them, consistent with the collection answer | 5 | done |

## Chrome extension (v2 section 9)

Lives in `extension/`, beside the CLI, so it shares the manifest schema and
tests. Plain MV3, no build step, no dependencies.

| # | Task | Status |
|---|------|--------|
| E1 | Scaffold: MV3 manifest with no permissions, in-page panel, manifest file picker, schema version check | done |
| E2 | Question-text matching: map manifest answers to Console question wording | done |
| E3 | Fill and highlight: tick the matching option, green; never submit | done |
| E4 | Unmapped panel: questions on screen with no answer, answers with no question on screen | done |
| E5 | Docs: load-unpacked instructions, ARCHITECTURE.md | done |
| E6 | App access: a radio question answered by option text, not Yes/No | done |
| E7 | Checkbox questions: Target audience age groups, ticking and unticking | done |
| E8 | Data safety data types as a checkbox question | done |
| E9 | Docs: coverage in extension README and ARCHITECTURE.md | done |
| E10 | Manifest `data_type_details` per data type, and a `data-type-details` CLI rule | done |
| E11 | Extension: work out which data type a per-type screen is for | done |
| E12 | Extension: collected/shared, processed ephemerally, required or optional | done |
| E13 | Extension: collection and sharing purposes, list kept in step with the CLI | done |
| E14 | Docs: per-type screens in extension README, README and ARCHITECTURE.md | done |

## Chrome extension: release readiness

From `reports/Chrome extension design best practices.md`, which holds the
sources and the acceptance criterion for each task. "Manual" tasks are account,
dashboard or design work outside the repo. P3 waits on the trigger listed in
the report.

| # | Priority | Type | Task | Status |
|---|----------|------|------|--------|
| X1 | P0 | Manual | Put a security key on the publisher Google account (2SV is mandatory anyway) and use a dedicated, permanent developer email | todo |
| X2 | P0 | Manual | Register on the Chrome Web Store (US$5) and declare non-trader | todo |
| X3 | P0 | Manual | Generate an RSA signing key offline and opt in to Verified CRX Uploads on the item's Package tab | todo |
| X4 | P0 | Code | Read back each control after `click()` in `fill.js`; report applied, already set or not applied, and mark "not applied" yellow | done |
| X5 | P0 | Manual | Author `extension/icons/icon.svg`, export PNGs at 16, 24, 32, 48 and 128, hand-tune 16px; no Google marks or colors | done |
| X6 | P0 | Code | Add `icons` and `action` (`default_title`, `default_icon` 16/24/32) to `manifest.json` | done |
| X7 | P0 | Code | Manifest checks in `test/extension.js`: icon files exist and their dimensions match their keys (via `src/lib/imagesize.js`), `version` format valid, `description` 132 characters or fewer | done |
| X8 | P0 | Code | `scripts/pack-extension.sh`: allowlist zip (`manifest.json`, `src/`, `icons/`) from inside `extension/` into `dist/`, from a clean git tree | todo |
| X9 | P0 | Code | Add `PRIVACY.md` (no collection, in-memory processing only, Limited Use statement) and link it from the README | todo |
| X10 | P0 | Manual | Fill the Privacy practices tab: single-purpose sentence, "No remote code", no data types, certifications ticked, privacy policy URL | todo |
| X11 | P1 | Code | Build the panel with `createElement` and a `<style>` set via `textContent`, then ban `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `eval` and `new Function` in the source test | todo |
| X12 | P1 | Code | Cap manifest file size (for example 1 MB) before `file.text()` in `panel.js` | todo |
| X13 | P1 | Code | `role="status"` on `#status` and `#result`, `role="alert"` on parse errors | todo |
| X14 | P1 | Code | Replace `li.jump` with `<button>`s that scroll to the question and focus its first control | todo |
| X15 | P1 | Code | Toggle gets `aria-expanded`, `aria-controls` and a label that switches between Collapse and Expand; Esc collapses the panel | todo |
| X16 | P1 | Code | Collapse to a pill after a fill, and add a top-right dock toggle held in memory | todo |
| X17 | P1 | Code | Language guard: if `document.documentElement.lang` is not `en*`, show "English Console only" instead of "no questions found" | todo |
| X18 | P1 | Code | Add `extension/test-manifest.json` (sample) and reviewer test instructions in `extension/README.md` | todo |
| X19 | P1 | Manual | Capture 3 screenshots at 1280x800 from a demo app with account details hidden, and make a 440x280 promo tile with no text | todo |
| X20 | P1 | Manual | Write the listing: name "avow", summary with "for Google Play Console™", trust lines (no permissions, no network, nothing stored, never submits), "Not affiliated with Google", attribution line, category Developer Tools, support URL to GitHub issues | todo |
| X21 | P1 | Manual | Test-install the packed CRX and record the exact install warning text; record a short demo video | todo |
| X22 | P2 | Code | Swap green and yellow for a colorblind-safe pair, and add a small visible text tag to each marked block | todo |
| X23 | P2 | Code | Move colors to CSS custom properties with a `prefers-color-scheme: dark` block; in `forced-colors`, replace `box-shadow` with a `CanvasText` border; give the panel its own accent | todo |
| X24 | P2 | Code | Use `scrollIntoView` with `behavior: "auto"` under `prefers-reduced-motion` | todo |
| X25 | P2 | Code | Empty state as three numbered steps, plus a one-line legend after a fill | todo |
| X26 | P2 | Code | On Navigation API `currententrychange` (when present), clear marks and results and show "Page changed, fill again"; no persistent observer | todo |
| X27 | P2 | Code | Undo: snapshot each touched control's prior state before a fill and offer "Undo fill" through the same click path | todo |
| X28 | P2 | Code | Show the panel host with `popover="manual"` and `showPopover()`, and drop the `z-index` hack | todo |
| X29 | P2 | Code | Opt-in E2E script (`test/e2e.js`, Node 22+, not in `npm test`): Chrome for Testing in new headless mode, CDP `Fetch` serving fixtures under `https://play.google.com/console/`, built-in `WebSocket` | todo |
| X30 | P2 | Code | `extension/CHANGELOG.md` kept out of the zip; the pack script refuses a version with no changelog heading; tag releases `ext-v*` | todo |
| X31 | P3 | Manual | Verify a site in Search Console for the verified-publisher link | todo |
| X32 | P3 | Code | Move to `chrome.sidePanel` (needs `action`, a panel script and messaging) | todo |
| X33 | P3 | Code | Structure-based matching (control attributes, order within known sections), then `_locales` for avow's own strings | todo |
| X34 | P3 | Code | Set `minimum_chrome_version` | todo |

## Deliberately not taken from v2

- **`completeness` failing on a missing `why`.** Play does not reject for it,
  so it stays a `warn` (`CLAUDE.md`: fail only when Play would reject or the
  manifest contradicts the repo).
- **`advertising-id` downgrading "declared yes, permission absent" to `warn`.**
  That is the manifest contradicting the repo, so it stays a `fail`.
- **Reshaping the manifest to v2's illustrative layout** (`answer` keys,
  top-level `claims[]`, `version` string). Existing manifests use `schema: 1`,
  per-form keys and `invariants`; the rules keep reading that shape.

## Not code, or not this repo

- Phase 0 validation sprint and outreach (sections 3, 8).
- Documentation site, pricing page, Stripe (sections 10, 11).
- Cross-app drift detection and dashboard (Phase 4 weeks 12-13): need the
  factory interviews first.
