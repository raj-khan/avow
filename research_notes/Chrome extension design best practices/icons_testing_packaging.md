# Icons, visual assets, testing and engineering quality for the avow MV3 extension (2026)

Context checked in repo (2026-10-29): `extension/manifest.json` is MV3, version `0.1.0`, one content script (`src/load.js`, `questions.js`, `fill.js`, `panel.js`) on `https://play.google.com/console/*` at `document_idle`. It has **no `icons` key, no `action` key, no `minimum_chrome_version`**, no permissions and no service worker.

## Icons: manifest sizes, action icon, design guidance, production, legibility, trademarks

### Takeaway
Ship square PNGs at 16, 32, 48 and 128 under `icons`, plus 16/24/32 under `action.default_icon`. SVG is rejected in both places, and unpacked extensions must use PNG. The 128px icon should hold about 96x96 of artwork inside transparent padding, read well on light and dark backgrounds, and carry no border or large shadow. It must not be a modified Google or Play mark.

### Cited Findings
- `icons` sizes and where each appears: 16x16 is the favicon on extension pages and the context-menu icon; 32x32 is "often" required by Windows; 48x48 shows on the extensions management page; 128x128 shows at install time and in the Chrome Web Store. Source: [Chrome: Configure extension icons](https://developer.chrome.com/docs/extensions/develop/ui/configure-icons)
- "SVG files are not supported for any icons declared in the manifest." PNG gives the best results; BMP, GIF, ICO and JPEG are accepted. Icons should be square, since non-square ones may be distorted. With no icons, Chrome generates one from the first letter of the name. Source: [Configure extension icons](https://developer.chrome.com/docs/extensions/develop/ui/configure-icons)
- `action.default_icon`: toolbar icons are 16 DIP square. The manifest example shows optional `"16"`, `"24"` and `"32"` keys, and multiple sizes are recommended to cover scale factors like 1.25x/1.5x. Chrome picks the closest size and scales it, which can lose quality. "SVG isn't supported." Unpacked extensions must use PNG. `action` is optional, but the docs recommend always declaring `action` with `default_icon`. Source: [chrome.action API](https://developer.chrome.com/docs/extensions/reference/api/action)
- `action.setIcon({imageData})` accepts ImageData (for example from an OffscreenCanvas) and is meant for static images only. Source: [chrome.action API](https://developer.chrome.com/docs/extensions/reference/api/action)
- Web Store icon: a 128x128 PNG with "actual icon size … 96x96 (for square icons)" and transparent padding making up the rest. It should work on light and dark backgrounds. Don't add a border, because the UI may add edges. For dark icons, consider a subtle white outer glow. Avoid large drop shadows (small ones for contrast are fine). Keep it front-facing. Bottom bevel, if any, about 4px. An icon with no alpha gets placed in a frame with 12px rounded corners. Source: [Chrome Web Store: Supplying images](https://developer.chrome.com/docs/webstore/images)
- Visual weight by shape at 128px: square artwork 96x96; "squarish" about 75–80% of width; circular about 112px diameter (85–90% of width). Source: [Supplying images](https://developer.chrome.com/docs/webstore/images)
- Trademarks: do not use Google trademarks, or confusingly similar marks, as the extension or company name without written permission. Do not use "a modified version of a Google trademark as the logo". Refer to compatibility as "for", "for use with" or "compatible with" plus ™, in text smaller than your own logo, and attribute (for example "Google Play is a trademark of Google LLC."). Unaltered screenshots of Google services are allowed for illustrative purposes. Source: [Chrome Web Store: Branding guidelines](https://developer.chrome.com/docs/webstore/branding)
- 16px legibility practice: align edges and strokes to the pixel grid to avoid blur from half-pixels, use flat simple geometry, and check at real size (zoom to 16x16 and squint; if it isn't readable at a glance, simplify). Source: [Volvo Cars icon construction](https://design.volvocars.com/icons/construction/); [Productboard iconography guidelines](https://design.productboard.com/latest/foundations/design/iconography/guidelines-hIPSBEVC-hIPSBEVC); [Favicon design best practices](https://faviconbuilder-app.pages.dev/guides/favicon-design-best-practices/)
- GitHub Primer Octicons use a consistent 1.5px stroke at both 16 and 24px. A 1–2px corner radius is suggested for 16x16 icons. Source: [Primer Octicons design guidelines](https://primer.style/octicons/guidelines/design); [UX Planet: Practical guide to icon design](https://uxplanet.org/practical-guide-to-icon-design-794baf5624c8)

### Inferences
- avow currently gets the auto-generated letter icon. Adding `icons` is also a store prerequisite (see Packaging: `icons` is a required field for upload).
- Adding `"action": {"default_icon": {...}}` needs no permission and no service worker, so it fits the README's "no permissions, no background worker" promise. It does change what `test/extension.js` may need to allow, if that test whitelists manifest keys.
- Producing PNGs without a runtime dependency: keep a hand-authored `icon.svg` as the source of truth and export the PNGs once (for example, headless Chrome screenshot of the SVG at each size, or an `inkscape`/`rsvg-convert` one-liner on a dev machine), then commit the PNGs. This keeps CI and the package dependency-free. This is my recommendation and not from a cited source; the 16px file in particular should be hand-tuned to the pixel grid rather than just downscaled from 128, per the legibility sources above.
- Avoid Play's colored triangle and Google's four-color palette and "G" shapes, given the "modified version of a Google trademark" rule. A checkmark-in-a-shape that loosely suggests a play-button triangle is exactly the risky look-alike.
- Icon concept for "avow" (to declare openly; verifies then fills declarations): **a raised-hand / oath glyph is hard to read at 16px; instead use a bold lowercase "a" whose bowl closes into a check-mark tail**, or more simply **a speech-bubble (declaration) containing a thick check**. Recommended version, chosen because it survives 16px: a rounded square (about 96x96 inside the 128 canvas, 16px corner radius) in a single saturated non-Google hue (deep indigo `#3B2F8F` or teal `#0F766E`), with a heavy white check whose stroke is a whole number of pixels at every exported size (2px at 16, 3px at 24, 4px at 32). On dark toolbars the colored square gives its own contrast, so no glow is needed. At 128, an optional small speech-bubble tail at the bottom-left corner of the square adds the "declare" idea. Drop it at 16px.

### Gaps
- Chrome docs no longer state whether 24px is still needed in `action.default_icon` beyond the example, and they give no current per-platform list of where 32px is used other than "Windows often".
- I found no official Chrome guidance on dark-mode toolbar icon variants. Manifest `icons` has no theme-specific variant that I could confirm.

## Store visual assets: screenshots, promo tiles, what works

### Takeaway
Ship 1 to 5 screenshots at 1280x800 (or 640x400 for text-heavy UI), full bleed, showing the real experience. Add the 440x280 small promo tile, because listings without it rank after those that have one. The 1400x560 marquee only matters for featuring.

### Cited Findings
- Screenshots: at least 1, preferably the maximum of 5; 1280x800 or 640x400; square corners, no padding (full bleed); show the actual user experience and core features. 1280x800 is "preferrable" but currently downscaled to 640x400. Use 640x400 if text gets illegible when downscaled. Source: [Supplying images](https://developer.chrome.com/docs/webstore/images)
- Promo tiles: small 440x280; marquee 1400x560 (required for marquee featuring). "Extensions without a small promo image appear after those that have one." Promo images are not localized, so avoid text or target the largest locale. Source: [Supplying images](https://developer.chrome.com/docs/webstore/images)
- Effective promo images: communicate the brand rather than reusing a screenshot; avoid text; must still work at half size; assume a light gray background; saturated colors, avoid big white/light-gray areas; fill the whole region with well-defined edges; follow branding guidelines if Google brands appear. Source: [Supplying images](https://developer.chrome.com/docs/webstore/images)
- Unaltered screenshots of Google services may be used for illustrative purposes. Source: [Branding guidelines](https://developer.chrome.com/docs/webstore/branding)

### Inferences
- avow's UI is a small panel plus green/yellow outlines on Play Console forms, which is text-heavy. Capture at 1280x800 with browser zoom raised, or crop to 640x400, so the outlines and panel text remain readable after downscaling.
- Screenshots should come from a demo or test Play Console app with no real developer account names or app IDs visible. The Play Console page itself stays unaltered so it falls under the "unaltered screenshot" allowance. Keep avow's own panel visually distinct from Google's UI.
- A suggested set of 3: (1) the panel after "Fill this page" with green outlines on Ads/Advertising ID; (2) a yellow-outlined question with the reason tooltip ("you decide this one"); (3) the CLI `avow check` output next to the manifest, to show the verify step happens before the fill.

### Gaps
- No first-party data on conversion lift from screenshots or promo tiles beyond the ordering rule for the small tile.

## Testing: automating E2E for an unpacked MV3 extension, content scripts on fixtures, staying dependency-free, CI

### Takeaway
Branded Chrome 137+ ignores `--load-extension`, so automated runs must use Chromium or Chrome for Testing (or Puppeteer's `enableExtensions`/`installExtension`). Extensions load only in new headless mode, not `chrome-headless-shell`. avow's current approach (Node `vm` unit tests plus a headless smoke test on fixture HTML) is sound. Its blind spot is that a fixture URL does not match `https://play.google.com/console/*`, so manifest matching and injection order are not exercised unless the test either serves fixtures under that URL or injects the scripts itself.

### Cited Findings
- Chrome 137 stopped honoring `--load-extension` in official branded builds because it was abused to load malware. Chromium and Chrome for Testing still support it. Alternatives: Developer mode "Load unpacked", or Chromium / Chrome for Testing. Source: [Chromium-extensions PSA, April 2025](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/1-g8EFx2BBY/m/S0ET5wPjCAAJ)
- Playwright: extensions work only with `chromium.launchPersistentContext()`, `channel: 'chromium'`, and `--disable-extensions-except` / `--load-extension` args. The `chromium` channel allows extensions in headless mode. "Google Chrome and Microsoft Edge removed the command-line flags needed to side-load extensions." MV3 service workers suspend after about 30s idle. Source: [Playwright: Chrome extensions](https://playwright.dev/docs/chrome-extensions)
- Puppeteer: `puppeteer.launch({ enableExtensions: [path] })`, or `enableExtensions: true` then `browser.installExtension(path)` (returns ID); `browser.extensions()`, `uninstallExtension()`. Content scripts inject normally on `page.goto()` to a matching URL. `page.extensionRealms()` + `realm.evaluate()` runs code in the content-script world. `page.triggerExtensionAction(extension)` triggers the action. Source: [Puppeteer: Chrome extensions guide](https://pptr.dev/guides/chrome-extensions)
- Puppeteer typings: `enableExtensions` is boolean or list of paths; `headless: true` is new headless, `'shell'` is the old headless shell. Source: [puppeteer-core 25.4.0 LaunchOptions.ts](https://app.unpkg.com/puppeteer-core@25.4.0/files/src/node/LaunchOptions.ts)
- Chrome's E2E guide: use `--headless=new`; old headless "does not support loading extensions". Use headless on machines with no display. Prefer testing user-visible behavior over internal state. A fixed extension ID can be set via the manifest `key`. Source: [Chrome: End-to-end testing for extensions](https://developer.chrome.com/docs/extensions/how-to/test/end-to-end-testing)
- Since Chrome 132.0.6793.0, old headless ships only as the standalone `chrome-headless-shell` binary; new headless shares code with headful Chrome. Source: [Chrome Headless mode](https://developer.chrome.com/docs/chromium/headless)
- Chrome's Puppeteer tutorial uses `headless: false, pipe: true, enableExtensions: [...]` and suggests new headless outside development. It does not cover content scripts. Its package.json pins `puppeteer ^24.8.1` and Jest. Source: [Chrome: Test extensions with Puppeteer](https://developer.chrome.com/docs/extensions/how-to/test/puppeteer)
- Conflict: an older FAQ claims extensions don't work headless, but it describes the pre-new-headless `--load-extension` path and is likely outdated. Source: [webscraping.ai FAQ](https://webscraping.ai/faq/puppeteer/how-can-i-use-puppeteer-with-chrome-extensions); compare [Chrome E2E guide](https://developer.chrome.com/docs/extensions/how-to/test/end-to-end-testing)

### Inferences
- Dependency-free path that matches avow's constraints: spawn Chrome for Testing (or Chromium) with `--headless=new --load-extension=extension --disable-extensions-except=extension --user-data-dir=<tmp> --remote-debugging-pipe` (or `--remote-debugging-port`) and drive it with Node 22+'s built-in `WebSocket` over CDP. No npm package is needed. To make the real manifest match fire on fixture HTML, map the Play URL to a local server with `--host-resolver-rules="MAP play.google.com 127.0.0.1:<port>"` plus `--ignore-certificate-errors`, or intercept requests via CDP `Fetch.enable` and fulfill `https://play.google.com/console/...` with fixture HTML. Either one tests `matches`, `run_at` and script order for real. This is a design suggestion and I did not verify it end to end.
- If a test-only dependency is accepted later, isolate it in `devDependencies` (or a separate `test/e2e/package.json`) so the shipped zip and the CLI's zero-runtime-deps promise are unaffected. Puppeteer downloads Chrome for Testing itself, which sidesteps the branded-Chrome flag removal.
- CI: pin the Chrome for Testing version (the build bumps otherwise), run headless=new, use a fresh temp `--user-data-dir` per run, and save a screenshot plus console log as artifacts on failure.
- Play Console is a single-page app. `document_idle` injection fires once per full page load, so in-app navigation between App content screens will not re-inject. Fixture tests should include a "DOM swapped after load" case if the panel is expected to follow navigation.

### Gaps
- I found no first-party doc that explicitly states Chrome for Testing new-headless loads extensions via `enableExtensions`. It is implied by the Chrome E2E guide and the Playwright doc, not stated outright.
- No official guidance on testing content scripts specifically; the Puppeteer guide's `extensionRealms()` is the closest.

## Packaging: zip, version bumping, excluding tests, validation, minimum_chrome_version, update flow

### Takeaway
Zip the contents of `extension/` (manifest at the zip root) with only runtime files, bump `version` on every upload, and set `minimum_chrome_version` deliberately, since users below it silently stop getting updates.

### Cited Findings
- The manifest must be in the root of the zip, "not in a folder". Required fields: `name`, `version`, `icons`, `description` (132 characters max). Start low (for example 0.0.0.1). "Cannot parse the manifest" is often caused by comments in JSON. Manifest metadata can't be edited in the dashboard; fix it, bump version, re-zip. Source: [Chrome Web Store: Prepare your extension](https://developer.chrome.com/docs/webstore/prepare)
- Package size limit 2GB. After review you have 30 days to publish a deferred submission before it reverts to draft. New publishers are limited to two published extensions at first. Source: [Publish in the Chrome Web Store](https://developer.chrome.com/docs/webstore/publish)
- Updates: upload a new zip with all files; "Each new version must have a larger version number than the previous version." Updates get the same review. Percentage rollout is only for items with over 10,000 seven-day active users; only one partial rollout at a time. New permissions prompt users to accept or the extension is disabled. Source: [Update your Chrome Web Store item](https://developer.chrome.com/docs/webstore/update)
- `minimum_chrome_version`: a string matching part of a Chrome version (for example `"126"`). New installs below it see "Not compatible". Existing users below it stop receiving updates silently. Source: [Manifest: minimum_chrome_version](https://developer.chrome.com/docs/extensions/reference/manifest/minimum-chrome-version)

### Inferences
- avow's description is 101 characters, within the 132 limit. Its `icons` key is missing, so it cannot be uploaded as is.
- A zero-dependency `scripts/pack.sh` (or `node` script using the system `zip`) run from inside `extension/` keeps the manifest at root: `cd extension && zip -r ../dist/avow-$(version).zip manifest.json src icons -x '*.test.js'`. Using an allowlist (named paths) is safer than an exclude list, because a stray fixture or `README.md` can't leak in. Keep `test/` outside `extension/` (it already is).
- A pack-time check in Node can validate the manifest without a schema library: JSON parses, `manifest_version === 3`, version matches the format below, every path in `content_scripts[].js` and `icons` exists, each icon PNG's IHDR width/height equals its key (reuse `src/lib/imagesize.js`), and no `permissions`/`host_permissions`/`background` key appears.
- `minimum_chrome_version`: avow uses only plain DOM APIs in an isolated world, so a conservative value (for example the version where the APIs used were introduced, or simply omit it) avoids stranding users. Set it only if a test proves a newer API is required.
- Increasing permissions in a later version triggers a re-consent prompt and can disable the extension for users, which is a further reason to keep the manifest permission-free.

### Gaps
- No official statement on how quickly installed users receive a published update (commonly said to be within hours, but I found no first-party figure).

## Performance: content script cost, run_at, MutationObservers, memory

### Takeaway
`document_idle` (the default) is the right choice for avow. It acts on user click, so cost should be near zero until the panel is used. If an observer is added for SPA navigation, scope it narrowly, debounce, and disconnect.

### Cited Findings
- `run_at`: `document_start` injects while the DOM is still loading; `document_end` once the DOM is complete but subresources may still load; `document_idle` (default) after DOM and resources finish. `world` defaults to `ISOLATED`, which the page cannot access; `MAIN` exposes the script to page interference. `all_frames` defaults to false (top frame only). The reference page gives no explicit performance guidance. Source: [Manifest: content_scripts](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts)
- MutationObserver: `subtree: true` extends monitoring to all descendants and so produces more notifications; `attributeFilter` limits notifications to the named attributes; at least one of `childList`/`attributes`/`characterData` is required. Source: [MDN: MutationObserver.observe()](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/observe)
- Community guidance (not official): observe the smallest practical subtree, request only the change types needed, batch/debounce callbacks, use `takeRecords()` to flush, and `disconnect()` once the target appears or when done. Source: [Chrome extension MutationObserver guide (blog)](https://chrome-extension-guide.pages.dev/2025/05/05/chrome-extension-mutation-observer-guide/); [MutationObserver cost](https://frontcore.vercel.app/docs/frontend/performance-and-core-web-vitals/mutation-observer-cost)

### Inferences
- avow's four classic scripts share one isolated world and load on every Play Console page. Keep top-level work to defining functions and mounting the small panel. Defer question scanning until "Fill this page" is clicked, so no observer runs on pages the user never fills.
- If following SPA navigation becomes necessary, listen for URL changes cheaply (for example compare `location.href` on `popstate`/a low-frequency check, or one `childList`-only observer on the app's main container with debounce) instead of `subtree: true` on `document.body` with attributes.
- Memory: the README says the manifest stays in memory until the page is left. Drop references (and any listeners on detached Console DOM) when the panel closes or the route changes, so a long Console session doesn't hold stale nodes.

### Gaps
- No first-party Chrome numbers on per-content-script overhead; the relevant official docs are silent on performance.

## Versioning and release hygiene

### Takeaway
`version` is 1–4 dot-separated integers (0–65535, no leading zeros, not all zeros), compared left to right. Semver `MAJOR.MINOR.PATCH` fits directly. Prerelease labels belong in `version_name`, which is display-only.

### Cited Findings
- `version`: one to four dot-separated integers, each 0–65535; no leading zero on non-zero parts (`032` invalid); not all zeros (`0`, `0.0.0.0` invalid; `0.1.0.0` valid). Compared leftmost first, missing parts count as zero (`1.2.0` > `1.1.9.9999` > `1.1`). A newer published version auto-updates installs. Source: [Manifest: version](https://developer.chrome.com/docs/extensions/reference/manifest/version)
- `version_name`: optional, display-only descriptive string such as `"1.0 beta"` or `"build rc2"`; doesn't affect updates; falls back to `version`. Source: [Manifest: version](https://developer.chrome.com/docs/extensions/reference/manifest/version)
- Every upload must have a higher version than the previous one. Source: [Prepare your extension](https://developer.chrome.com/docs/webstore/prepare); [Update your item](https://developer.chrome.com/docs/webstore/update)

### Inferences
- avow's `0.1.0` is valid. Semver prerelease strings like `0.2.0-beta.1` are **invalid** in `version`; express betas as `0.2.0.1` with `version_name: "0.2.0 beta 1"`.
- Since a rejected or abandoned upload still burns its version number, bump in a dedicated commit (`Update extension version to 0.2.0`) and tag (`ext-v0.2.0`) separately from the CLI's tags, so the CLI and extension release on their own cadences.
- Keep a short `extension/CHANGELOG.md` (Keep a Changelog style) that is not included in the zip allowlist. The pack script can refuse to build if the manifest version has no matching changelog heading.

### Gaps
- No Chrome Web Store requirement for a changelog; I found no official source recommending one.

## Prioritized task list for avow (small, concrete)

1. **Add icons (blocks store upload).** Author `extension/icons/icon.svg` (the indigo/teal rounded square with a whole-pixel white check; optional speech-bubble tail only at 128). Export once to `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png` (artwork about 96x96 inside 128 with transparent padding), hand-tune the 16px on the pixel grid, commit PNGs. Add `"icons"` and `"action": {"default_title": "avow", "default_icon": {"16","24","32"}}` to the manifest. No permission or worker needed. Sources: [icons](https://developer.chrome.com/docs/extensions/develop/ui/configure-icons), [action](https://developer.chrome.com/docs/extensions/reference/api/action), [images](https://developer.chrome.com/docs/webstore/images).
2. **Manifest/pack check in `test/extension.js`.** Assert that icon files exist and their PNG dimensions match their keys (via `src/lib/imagesize.js`), that `version` matches `^(0|[1-9]\d{0,4})(\.(0|[1-9]\d{0,4})){0,3}$` with each part ≤ 65535 and not all zero, that description ≤ 132 chars, and that there are no permissions or background. Sources: [version](https://developer.chrome.com/docs/extensions/reference/manifest/version), [prepare](https://developer.chrome.com/docs/webstore/prepare).
3. **`scripts/pack-extension` (no deps).** Allowlist zip from inside `extension/` (manifest at root; `manifest.json`, `src/`, `icons/` only) into `dist/` (already git-ignored per user rules). Sources: [prepare](https://developer.chrome.com/docs/webstore/prepare).
4. **Make the smoke test exercise the real `matches`.** Run Chrome for Testing with `--headless=new` and `--load-extension`, and serve fixtures under `https://play.google.com/console/...` via `--host-resolver-rules` or CDP `Fetch` fulfillment, driven by Node's built-in WebSocket. Pin the CfT version in CI. Sources: [PSA](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/1-g8EFx2BBY/m/S0ET5wPjCAAJ), [E2E guide](https://developer.chrome.com/docs/extensions/how-to/test/end-to-end-testing).
5. **Add an SPA-navigation fixture case**: the DOM is replaced after load, and the panel either survives or re-scans on click. Keep any observer narrow, debounced and disconnected. Sources: [content_scripts](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts), [MDN observe](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/observe).
6. **Store assets**: 3 screenshots at 1280x800 (zoomed for legibility) from a demo app, plus a 440x280 small promo tile with the logo on a saturated field, no text. Description says "for Google Play Console" with attribution. Sources: [images](https://developer.chrome.com/docs/webstore/images), [branding](https://developer.chrome.com/docs/webstore/branding).
7. **Release hygiene**: `extension/CHANGELOG.md`, separate `ext-v*` tags, `version_name` for betas, and leave `minimum_chrome_version` unset unless a test proves it is needed. Sources: [version](https://developer.chrome.com/docs/extensions/reference/manifest/version), [minimum_chrome_version](https://developer.chrome.com/docs/extensions/reference/manifest/minimum-chrome-version).
