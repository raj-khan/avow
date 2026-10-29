# store-decl

Google Play declarations as code: author them once, verify them against the
repo, and keep the reasoning next to the answer.

## Why

Shipping a first Android release means answering about thirteen policy
questionnaires in the Play Console. The hard part is not typing. It is that

- Play treats several of them as **binding declarations**. A wrong answer is an
  enforcement matter, not a correction you can quietly fix later.
- Some answers are **cross-checked against your build**. Declaring that you do
  not use an advertising ID while a transitive dependency adds the `AD_ID`
  permission is an automatic rejection.
- Answers **go stale silently**. A listing claiming 310 items stays in the
  Console long after the data file says 290, and installing one analytics SDK
  invalidates a data safety form filed months ago.
- The reasoning is **never written down**, so the next release reconstructs it
  from memory.

`store-decl` keeps the answers in one JSON file in the repo, with a `why` on
each, and fails CI when the file contradicts the code.

## Use

```sh
store-decl init                 # write a starter manifest
store-decl check                # verify it against this repo
store-decl explain advertising  # why that answer is what it is
store-decl forms                # every Console screen, in submission order
```

`check` exits non-zero on a failure, so it drops into CI unchanged. Warnings
do not fail the build: they are for things Play states but does not enforce,
which should not block a listing Play is willing to accept.

## Rules

| Rule | Checks |
| --- | --- |
| `completeness` | every declaration Play asks for is present, and explained |
| `advertising-id` | the declaration against `AD_ID` in the **merged** manifest |
| `data-safety` | "no collection" against installed analytics, crash, attribution and ad SDKs |
| `listing-limits` | copy against Play's character caps |
| `assets` | icon, feature graphic and screenshot dimensions, bytes, aspect ratio and count |
| `claims` | numbers in the listing against the data file the app ships |

Permissions are read from the merged release manifest, not from the authored
`AndroidManifest.xml` or `app.json`, because libraries and config plugins add
permissions you never wrote, and that gap is the whole failure mode.

## Status

0.1.0, extracted from a real first submission. See `ARCHITECTURE.md` for the
plan and the reasoning behind each design call. The form order in
`src/rules/completeness.js` was observed in the Console; Play does not publish
it. No dependencies, Node 20+.

## Not in scope yet

Uploading. The Play Developer API covers bundles, listings and rollouts for
every release after the first, and `eas submit` already wraps it. The forms
here are the ones no API reaches.
