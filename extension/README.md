# avow for Chrome

Fills Play Console declarations from an avow manifest you
pick. It does not decide anything: the answers come from the manifest, which
`avow check` has already verified against your repo.

## Install (unpacked)

1. Open `chrome://extensions` and turn on **Developer mode**.
2. **Load unpacked** and choose this `extension/` folder.
3. Open a Play Console page such as App content > Ads.

## Package for the Chrome Web Store

```sh
npm run pack:extension   # dist/avow-extension-<version>.zip
```

The zip holds only `manifest.json`, `src/` and the PNG icons, from the last
commit; the script refuses to run with uncommitted changes in `extension/`.
Bump `version` in `manifest.json` for every upload.

## Use

1. In the avow panel (bottom right), **Pick manifest** and choose your
   `store/release-manifest.json`.
2. **Fill this page**. Recognised questions are ticked and outlined green.
3. Anything outlined yellow is yours: either the manifest has no usable answer
   (the reason is in the tooltip and the panel), or avow does not know the
   question (dashed outline).
4. Read the page and save it yourself.

## Try it, or review it, without an app of your own

`test-manifest.json` is a sample manifest for a made-up app. It exercises
every screen the extension fills.

1. Load the extension unpacked (above), or install the store build.
2. Open any Play Console app page, for example App content > Ads. Changes
   are not saved unless you click Save, so this is safe on a real account.
3. In the avow panel, **Pick manifest** and choose `test-manifest.json`.
4. **Fill this page**. For the Ads screen, "No" is selected and outlined
   green, and the panel reports "Filled 1".
5. Leave the page without saving, or save if the answers are right for you.

What each screen gets from the sample:

| Screen | Filled with |
| --- | --- |
| App access | All functionality available without restrictions |
| Ads, Advertising ID, News app, Government app | No |
| Target audience | 13-15, 16-17, 18 and over |
| Data safety, first step | Collects: Yes; encrypted in transit: Yes; deletion requests: No |
| Data safety, data types | Crash logs only |
| Data safety, Crash logs | Collected; not ephemeral; required; purpose Analytics |

The extension never clicks Save or Submit, and makes no network requests.

## What it will never do

- **Submit or save.** It clicks radio options and checkboxes that belong to
  a question it knows, and nothing else.
- **Touch the network or your session.** No permissions, no background
  worker, no storage. `test/extension.js` fails the build if any of that
  appears in the source.
- **Remember the manifest.** It lives in memory until you leave the page.
- **Fill `inherited` or `unanswered` declarations.** Only `answered` and
  `planned` ones.

Privacy policy: [`PRIVACY.md`](../PRIVACY.md).

## Coverage

| Screen | Manifest field | Kind |
| --- | --- | --- |
| App access | `app_access.restricted` | radio, by option text |
| Ads | `ads.contains_ads` | yes/no |
| Advertising ID | `advertising_id.uses_advertising_id` | yes/no |
| Target audience | `target_audience.age_groups` | checkboxes |
| Data safety, first step | `data_safety.collects_user_data` / `shares_user_data`, `encrypted_in_transit`, `deletion_request_mechanism` | yes/no |
| Data safety, data types | `data_safety.data_types` (Play's labels, e.g. `"Crash logs"`) | checkboxes |
| Data safety, each data type: collected or shared | `data_type_details[type].collected` / `.shared` | checkboxes |
| Data safety, each data type: processed ephemerally | `data_type_details[type].ephemeral` | yes/no |
| Data safety, each data type: required or optional | `data_type_details[type].required` | radio, by option text |
| Data safety, each data type: purposes | `data_type_details[type].collection_purposes` / `.sharing_purposes` | checkboxes |
| News app | `news_app.is_news_app` | yes/no |
| Government app | `government_app.is_government_app` | yes/no |

For checkbox screens the manifest lists what should be ticked; every other
option on that screen is unticked. Checkboxes that belong to no known question
(consent boxes, filters, category headings) are never touched. A value that is
not one of Play's options is refused with the reason, not guessed at.

Per-type screens are matched to a data type by their heading: the nearest
heading that names exactly one of Play's data types, by its whole text. If
none does, or two do, the screen is left yellow rather than guessed.

Still manual: login instructions for restricted apps, Content ratings, Financial features, Health,
Data deletion URL and anything with free text.

The wording in `src/questions.js` comes from Play's help pages and has not yet
been confirmed in a live Console; `QUESTIONS_OBSERVED` is `null` until it is.
If a question is not recognised (dashed yellow outline), fix its `text` or
`anchor` there and set the date.

Manifests that use `extends` are not resolved here; answers that live only in
the baseline are left unfilled, and the panel says so.
