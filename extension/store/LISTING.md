# Chrome Web Store listing

Everything the developer dashboard asks for, ready to paste. Nothing in this
folder goes into the upload zip.

## Upload

1. `npm run pack:extension`: builds `dist/avow-extension-<version>.zip`.
2. Dashboard > **New item** > upload the zip.
3. Fill the tabs below, then **Submit for review**. Leave "Publish
   automatically after review" off for the first release so you can check
   the live listing first.
4. Tag the commit: `git tag ext-v<version> && git push origin ext-v<version>`.

## Store listing tab

**Name** (from `manifest.json`): avow

**Summary** (from `manifest.json` `description`, 132 characters max):

> Fills Play Console declarations from an avow manifest you pick. Never submits, never connects anywhere.

**Description:**

```
avow fills the declaration forms in Google Play Console™ (App content and Data safety) from a release manifest file that you pick. The answers come from your file, not from avow: it ticks what the manifest says, outlines everything else for you to answer, and never saves or submits.

How it works
1. Pick your store/release-manifest.json (written and checked by the free avow CLI against your app's code).
2. Click "Fill this page". Questions avow knows are ticked from your manifest and outlined blue.
3. Anything outlined orange is yours: either your manifest has no answer, or avow does not know the question.
4. Review the page and save it yourself. Undo puts every control back the way it was.

Covers App access, Ads, Advertising ID, Target audience, News app, Government app and Data safety, including each data type's collected or shared, ephemeral, required and purpose answers.

Use it from the panel on the page, or click the toolbar button to open it in Chrome's side panel beside the Console.

Built to be trusted with your Console:
• One permission, sidePanel, which shows no install warning.
• Runs only on play.google.com/console.
• No network access: nothing is sent anywhere, no analytics.
• Nothing stored: the manifest lives in memory and is forgotten when you leave the page or close the side panel.
• Never clicks Save or Submit.
• Open source: https://github.com/raj-khan/avow

English Console only for now.

Not affiliated with or endorsed by Google. Google Play and Google Play Console are trademarks of Google LLC.
```

**Category:** Developer Tools

**Language:** English

**Store icon:** `icons/icon128.png`

**Screenshots** (1280x800, in this order). They show a neutral demo page, so
no Console account details appear:

1. `store/1-fill-1280x800.png`: a filled App content page, one question left for you
2. `store/2-data-safety-1280x800.png`: a Data safety data type filled
3. `store/3-side-panel-1280x800.png`: the same fill from the side panel

**Small promo tile** (440x280): `store/promo-tile-440x280.png`

**Official URL:** none until a site is verified (backlog X31).

**Homepage URL:** https://github.com/raj-khan/avow

**Support URL:** https://github.com/raj-khan/avow/issues

## Privacy practices tab

**Single purpose:**

> Fills Google Play Console declaration forms from a release manifest file the user picks.

**Permission justification, `sidePanel`:**

> Opens avow's controls in Chrome's side panel when the user clicks the toolbar button, so they sit beside the Play Console form instead of over it. No other use.

**Host permission justification** (the content script on `https://play.google.com/console/*`):

> The content script runs only on Play Console pages. It reads the question text and form controls on the page the user is viewing and ticks the answers from the manifest file the user picked. It never saves or submits a form and sends nothing anywhere.

**Remote code:** No, I am not using remote code. All JavaScript is in the package.

**Data usage:** tick no data types. avow reads the page and the manifest
locally, in memory, to fill the form in front of the user. It collects and
transmits nothing.

**Certifications:** tick all three:

- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** https://github.com/raj-khan/avow/blob/main/PRIVACY.md

## Distribution tab

- **Visibility:** Public (or Unlisted for a quiet first release).
- **Regions:** All regions.

## Test instructions (for the reviewer)

```
avow needs no login of its own. To see it work you need a Google Play Console developer account with any app.

1. Download the sample manifest: https://github.com/raj-khan/avow/blob/main/extension/test-manifest.json
2. Open Play Console > any app > App content > Ads.
3. In the avow panel (bottom right), click "Pick manifest" and choose test-manifest.json.
4. Click "Fill this page". "No" is selected and outlined blue, and the panel reports "Filled 1".
5. Leave without saving. Nothing changes unless you click Save in the Console.

The toolbar button opens the same controls in the side panel.
```
