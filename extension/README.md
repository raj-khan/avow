# avow for Chrome

Fills the yes/no declarations on Play Console pages from an avow manifest you
pick. It does not decide anything: the answers come from the manifest, which
`avow check` has already verified against your repo.

## Install (unpacked)

1. Open `chrome://extensions` and turn on **Developer mode**.
2. **Load unpacked** and choose this `extension/` folder.
3. Open a Play Console page such as App content > Ads.

## Use

1. In the avow panel (bottom right), **Pick manifest** and choose your
   `store/release-manifest.json`.
2. **Fill this page**. Recognised questions are ticked and outlined green.
3. Anything outlined yellow is yours: either the manifest has no usable answer
   (the reason is in the tooltip and the panel), or avow does not know the
   question (dashed outline).
4. Read the page and save it yourself.

## What it will never do

- **Submit or save.** It clicks radio options and nothing else.
- **Touch the network or your session.** No permissions, no background
  worker, no storage. `test/extension.js` fails the build if any of that
  appears in the source.
- **Remember the manifest.** It lives in memory until you leave the page.
- **Fill `inherited` or `unanswered` declarations.** Only `answered` and
  `planned` ones.

## Coverage

Seven questions today: Advertising ID, Ads, three Data safety yes/no
questions, News app and Government app. Their wording in
`src/questions.js` comes from Play's help pages and has not yet been
confirmed in a live Console; `QUESTIONS_OBSERVED` is `null` until it is. If a
question is not recognised, fix its `text` there and set the date.

Manifests that use `extends` are not resolved here; answers that live only in
the baseline are left unfilled, and the panel says so.
