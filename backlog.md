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
| 7 | `FORMS` observation date; `forms` and `check` print its age, warn past 90 days | 7 | todo |
| 8 | `data-safety` also reads `build.gradle` dependencies, not only `package.json` | 5 | todo |
| 9 | Library attribution from the manifest-merger report, used by `advertising-id` | 5 | todo |
| 10 | `permissions-inventory` rule: every merged permission accounted for, with its library | 6 | todo |
| 11 | `content-rating` rule: result recorded, dated and explained | 6 | todo |
| 12 | `stale-declarations` rule: dependency or claim files changed after `answered_on`, or answer older than 6 months | 6 | todo |
| 13 | `listing-limits` warns on URLs, phone numbers, emoji and unqualified superlatives in the title | 5 | todo |
| 14 | `--format github` emits Actions annotations | 11 Phase 1 | todo |
| 15 | `avow diff`: declarations changed since a git revision | 11 Phase 2 | todo |
| 16 | `extends`: a manifest inherits a shared baseline, per-app overrides win | 11 Phase 4 | todo |
| 17 | Docs: ARCHITECTURE.md roadmap and rules table, README, drop "push" from the roadmap | 12 | todo |

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
- Chrome extension (section 9, Phase 3): its own repo and review.
- Cross-app drift detection and dashboard (Phase 4 weeks 12-13): need the
  factory interviews first.
