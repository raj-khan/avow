# Chrome extension UX/UI design best practices (2026), applied to avow

Context checked against the repo: `extension/manifest.json` declares only a content script on `https://play.google.com/console/*` (`run_at: document_idle`), no permissions. `extension/src/panel.js` builds a closed-shadow-root panel (`position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; width: 320px; max-height: 60vh`), hard-coded light colours, a `box-shadow`, a collapse button with a static `aria-label="Collapse"`, a `#status` div without a live-region role, and clickable `<li class="jump">` rows. `extension/src/fill.js` marks questions with inline `outline: 3px solid|dashed <color>` plus a `title`, and finds questions by heading/label **text** (`textContent`, `aria-label`, `aria-labelledby`).

## 1. Surface choice: in-page panel vs side panel vs popup

### Takeaway
A side panel fits a "companion to a long form" tool better than an injected panel or a popup, and the `sidePanel` permission shows no install warning. It still needs a content script (plus messaging) to touch the page. The popup is the wrong surface, because it closes as soon as focus leaves it. The cheapest high-value step is to keep the injected panel but make it collapsible and movable and keep it off the Save bar. Move to a side panel only if the in-page panel keeps colliding with Console UI.

### Cited Findings
- Side panels "display alongside web pages", attached to one tab or a whole window, and are controlled by the Side Panel API. Popups open from the action icon, a shortcut, or `openPopup()`. Source: [Chrome: Extension UI](https://developer.chrome.com/docs/extensions/develop/ui)
- The Side Panel API requires `"sidePanel"` in `permissions`. It is available from Chrome 114. `open()` needs Chrome 116+, `getLayout()` 140+, `close()`/`onOpened` 141+ and `onClosed` 142+. Source: [chrome.sidePanel](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- `sidePanel`: **no warning**. `storage`, `activeTab`, `scripting`, `contextMenus`, `unlimitedStorage`: no warning. `tabs`: "Read your browsing history." Source: [Permissions list](https://developer.chrome.com/docs/extensions/reference/permissions-list)
- Clicking the action icon opens the panel via `setPanelBehavior({ openPanelOnActionClick: true })`, which defaults to false and needs an `"action"` key. `sidePanel.open()` "may only be called in response to a user action", for example an action click, a keyboard shortcut, a context menu, or a gesture in an extension page or content script. Source: [chrome.sidePanel](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- Panels can be enabled per tab with `setOptions({tabId, enabled})`, typically from `tabs.onUpdated` after checking the URL. When you navigate to a site where the panel is not enabled, "the side panel will close". It "remains open when navigating between tabs (if set to do so)". Source: [chrome.sidePanel](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- Users can choose whether the side panel appears on the left or right. Source: [chrome.sidePanel](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- Official side panel guidance: it should be a "helpful companion ... providing complementary functionality". It should "actively enhance the user's current task while causing minimal distractions". Show it only on relevant sites. Provide in-extension onboarding. The single-purpose policy applies to the panel too. Source: [Side Panel launch blog](https://developer.chrome.com/blog/extension-side-panel-launch); [Quality guidelines](https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines)
- Content scripts can use `runtime.sendMessage/onMessage/connect`, `storage` and `i18n` directly. Other APIs are reached by messaging the extension. Source: [Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- An extension page talks to a content script with `tabs.sendMessage()` or `tabs.connect()`. A port disconnects when "the tab containing the port is unloaded (for example, if the tab is navigated)". Messages are capped at 64 MiB and are **JSON-serialized** in Chrome, not structured-cloned, so a `File`/`Blob` cannot be sent directly. Source: [Messaging](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)
- Programmatic injection (`scripting`) requires host permissions. Declared `content_scripts` matches do not need a separate `permissions` entry. Source: [Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- Chrome Web Store best practices: "Avoid distracting users when implementing a persistent UI". Source: [CWS best practices](https://developer.chrome.com/docs/webstore/best-practices)

### Inferences
- **Popup: reject.** Popups dismiss when focus moves to the page. That breaks a "fill, then review on the page" flow and loses any state held in the popup's memory.
- **Side panel pros:** it never overlaps the Console (no z-index war, cannot cover the Save bar), it gets the full window height for the review list, and it adds no permission warning. **Cons:** it needs an `action` key, a service worker or panel script, and `tabs.sendMessage` to the existing content script. The content script still does all DOM work. The manifest has to be sent as text (JSON), which is fine because it already is JSON. It also loses the "point at the question" proximity unless the content-script outlines stay.
- **Messaging without host permissions:** the content script is already injected by the `content_scripts` match. `tabs.sendMessage(tabId, ...)` to it should therefore work with no host permissions and no `tabs` permission. The panel can get the tab id from `sidePanel.onOpened`'s `tabId` or `tabs.query({active:true,currentWindow:true})`, whose `url` is withheld without `tabs`/host permission. This is inferred from the docs above. I found no single page that states it outright.
- **File persistence across Console navigations without `storage`:** Play Console is an Angular SPA, so in-app route changes do not unload the document. A parsed manifest held in a content-script variable should survive route changes and be lost on full reload or on a new tab. A side panel's JS memory lives as long as the panel stays open, so the side panel survives even full reloads of the Console tab, which makes it more robust. The existing copy ("forgotten when you leave the page") is accurate for the content-script approach. `chrome.storage.session` would also work and has no warning, but it needs the `storage` permission, which conflicts with the "no permissions" stance only cosmetically.

### Gaps
- No official page explicitly states that `tabs.sendMessage` to a manifest-declared content script needs no host permission. This is inferred.
- No current Chrome-authored "design a superior UX" page for in-page injected UI exists. The old URL 404s (`/docs/extensions/develop/ui/create-a-superior-ux`), and the UI overview says content-script injected UI is "not covered".

## 2. Chrome's own UX guidance and Google design conventions (without impersonation)

### Takeaway
Chrome's guidance is thin but consistent: one purpose, minimal distraction, explain what the action does, onboard early, and keep visuals consistent with your own brand. Trademark rules forbid Google marks as your name or logo and allow "for Google Play™" phrasing. Nothing forbids looking native to the host page. The inference: borrow Google's neutral greys and system fonts for legibility, but give avow its own name, mark and accent so it is never mistaken for Console UI.

### Cited Findings
- Describe the action with a tooltip (`default_title`). You are "not required to implement all" surfaces, and a shortcut can replace visible UI. Source: [Extension UI](https://developer.chrome.com/docs/extensions/develop/ui)
- "Design your extension with the user in mind ... a simple, intuitive, and seamless user interface". Start onboarding at the store listing. The listing "should explicitly communicate what the extension does". Source: [CWS best practices](https://developer.chrome.com/docs/webstore/best-practices)
- Side panel should match "the logo, colors, icons, and fonts of your extension and store listing". Source: [Side Panel launch blog](https://developer.chrome.com/blog/extension-side-panel-launch)
- "Don't use any Google trademarks or any confusingly similar marks as the name of your extension", and don't use a Google mark or a modified one as your logo. To describe compatibility, use "for", "for use with" or "compatible with" plus ™ and an attribution line. Unaltered screenshots of Google services are allowed for illustration. Source: [CWS branding guidelines](https://developer.chrome.com/docs/webstore/branding)

### Inferences
- Store listing text like "avow, for Google Play Console™" plus the attribution line complies. Avoid the Play triangle or Console icon in avow's icon.
- In-page, the current `#202124 / #5f6368 / #dadce0` palette blends in. Add an avow-specific accent (header strip or wordmark) so the panel reads as a third-party tool, not a Console dialog.

### Gaps
- I found no Google document on visually mimicking Google product UI. The branding page explicitly does not address look-and-feel.
- I did not fetch Material 3 docs in this pass. No Material-specific claims are made here.

## 3. Unobtrusive injection: layout, z-index, collapsing, position, the Save bar

### Takeaway
The panel sits in the same bottom-right corner as the Console's sticky Save bar, which is the most likely real-world collision. WCAG 2.2 SC 2.4.11 explicitly calls out sticky footers and non-modal overlays that hide the focused element. Fix it by making the panel collapsible to a small pill, keyboard-dismissable (Esc), and movable or dockable to the top. The Popover API's top layer can replace the `2147483647` z-index hack.

### Cited Findings
- SC 2.4.11 Focus Not Obscured (Minimum), **AA**: the focused component must not be "entirely hidden due to author-created content". Typical offenders are "sticky footers, sticky headers, and non-modal dialogs". Persistent overlays pass if they "can be hidden or collapsed by use of a dedicated keyboard command" (e.g. Escape). Only the *initial* position of user-movable content is tested. 2.4.12 (AAA) requires none of the focused component be obscured. Source: [W3C Understanding 2.4.11](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)
- A shown popover "is put into the top layer so it will sit on top of all other page content". `popover="manual"` cannot be light-dismissed and lets several popovers be open at once. Popovers are always non-modal. Popover API: Baseline 2025. Source: [MDN Using the Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using); [MDN Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API)
- Persistent UI should cause "minimal distractions". Source: [Quality guidelines](https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines)

### Inferences
- Concrete: (a) render the panel host with `popover="manual"` and call `showPopover()`, so stacking no longer depends on z-index. (b) Default to a collapsed pill after fill completes, or offer top-right placement. (c) Make Esc collapse it. (d) Remember position/collapsed state per tab session in memory. Persisting across reloads would need `storage`, or `localStorage` on the Console origin, which writes to Google's origin and is best avoided.
- `max-height: 60vh` on a bottom-anchored panel covers the lower part of the form, where the Save bar and the last questions sit. A side panel avoids this entirely.

### Gaps
- I did not verify the Console Save bar's exact DOM or height. That needs a live check.

## 4. Accessibility (WCAG 2.2) for injected UI

### Takeaway
Current gaps against WCAG 2.2 AA: "Filled N" is not announced (4.1.3), the jump list is mouse-only `<li>`s, the collapse button doesn't expose state, the outlines rely on green vs yellow plus a solid/dashed difference, there is no dark mode, and `box-shadow` vanishes in forced colors. All are small fixes inside one shadow root.

### Cited Findings
- SC 4.1.3 Status Messages (**AA**): status messages must be programmatically determinable without focus. Use `role="status"` for results such as "18 results returned", `role="alert"` for errors, and `role="log"` for sequential progress. `aria-live="assertive"` on non-urgent content is listed as a failure. Source: [W3C Understanding 4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
- Chrome extension a11y: everything should be operable by keyboard, controls must be focusable, prefer native HTML controls over ARIA-decorated ones, keep focus visible, check contrast, check colour-deficiency visibility (e.g. Coblis), pass a 200% zoom test, and don't clash with Chrome zoom shortcuts. The page dates from 2012, so treat its ARIA details as dated. Source: [Chrome: Accessibility](https://developer.chrome.com/docs/extensions/how-to/ui/a11y)
- Shadow DOM scopes IDs, so IDREF ARIA (`aria-labelledby`, `aria-describedby`, `aria-controls`, `aria-activedescendant`) cannot cross shadow roots. The workaround is to keep related components in one root. Reference Target for cross-root ARIA was still pre-release in the cited update. Source: [Nolan Lawson, Shadow DOM and accessibility](https://nolanlawson.com/2022/11/28/shadow-dom-and-accessibility-the-trouble-with-aria/)
- In `forced-colors: active`, `color`, `background-color`, `border-color` and `outline-color` are replaced with system colours, and **`box-shadow` is forced to `none`**. Borders and outlines stay visible, so use them instead of shadows. Use system colours (`Canvas`, `CanvasText`, `ButtonText`, ...) for small fixes. Baseline widely available since Sept 2022. Source: [MDN forced-colors](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/forced-colors)

### Inferences
- The panel's own IDREFs (e.g. `aria-controls` from toggle to `.body`) work because they are inside one shadow root. Page elements cannot be referenced from it, so "jump to question" must move focus programmatically (`el.scrollIntoView(); el.focus()` on the first control) rather than rely on ARIA links.
- Outlines on page elements survive forced colours, but both colours collapse to the same system colour. The solid/dashed/dotted pattern then becomes the only cue, so that distinction must carry meaning on its own. Also add a small text badge such as "avow: filled" or "avow: yours" next to each block so colour is never the sole signal (SC 1.4.1 Use of Color; not fetched this pass).
- Green vs yellow is a weak pair for deuteranopia. Blue (filled) vs orange (yours) is a safer common choice. This is a design inference, not sourced.
- Dark mode: add `@media (prefers-color-scheme: dark)` tokens inside the shadow style. Add `@media (prefers-reduced-motion: reduce)` if any scroll animation is added (`scrollIntoView({behavior: 'smooth'})` should become `'auto'`).
- Focus management: after "Fill", move focus to the result heading or leave it on the button and announce via `role="status"`. "Jump" should be real `<button>`s. The toggle should have `aria-expanded` and an `aria-controls` pointing at the body.

### Gaps
- I did not fetch SC 1.4.1 (Use of Color), 1.4.11 (Non-text Contrast), 2.3.3 or the WAI-ARIA APG disclosure pattern this pass. The recommendations above that lean on them are flagged as inferences.

## 5. SPA handling in Play Console

### Takeaway
avow currently acts only on button press, which is the right default for cost: no observer runs while idle. To keep the panel accurate after Angular route changes, listen to the Navigation API's `navigatesuccess` and `currententrychange` events (Baseline 2026) and clear stale marks and results. Do not run a permanent `MutationObserver` over `document.body`.

### Cited Findings
- `document_idle` is the "preferred and default" `run_at`. It runs between `document_end` and just after `window.onload`. Source: [Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- Content scripts run in an isolated world: page JS variables are invisible to them, but the DOM is shared. Source: [Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- The Navigation API (`window.navigation`) fires `navigate` for any navigation, `navigatesuccess`/`navigateerror` after intercepted navigations settle, and `currententrychange` when the current entry changes. It is "Baseline 2026, Newly available", since January 2026. Source: [MDN Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API)
- Userscripts in the wild detect SPA route changes by listening to `navigatesuccess` on `window.navigation`. Source: [Greasy Fork "Detect-Nav"](https://greasyfork.org/scripts/503878-detect-nav)

### Inferences
- In the isolated world `window.navigation` is a DOM API object and should fire its events for the page's navigations, the same way DOM events do. I found no doc confirming this for extension content scripts specifically, so verify it live.
- Pattern: on `currententrychange`, clear marks, reset the result list, and show "Page changed, click Fill again". Optionally, after a route change, run one short, debounced `MutationObserver` that disconnects once a known question heading appears, then enable the Fill button. Avoid `subtree: true` observers that stay connected while the panel is idle, because Angular re-renders often.
- Marks applied via inline `style.outline` on Angular-managed nodes can be dropped when Angular re-renders. Re-marking on demand (a "Re-check" button) is simpler than fighting the framework.

### Gaps
- I found no measured performance numbers for MutationObserver cost on Play Console.

## 6. Onboarding, empty and error states, undo, shortcuts

### Takeaway
First-run guidance can live entirely in the panel's empty state, so no storage is needed. Explain yellow inline. Undo is feasible by snapshotting each control's prior checked state before filling. A keyboard shortcut via the `commands` manifest key needs no permission, but it lands in the service worker, so avow would need a background script that messages the content script (or `_execute_action` once an action/side panel exists).

### Cited Findings
- Onboarding: "provide sufficient documentation or training within the extension" to retain users and avoid bad reviews. Source: [Side Panel launch blog](https://developer.chrome.com/blog/extension-side-panel-launch)
- `commands` is a manifest key, and the docs list no permission for it. There are at most 4 suggested shortcuts. Shortcuts must include Ctrl or Alt, and Ctrl+Alt is not allowed. Users remap shortcuts at `chrome://extensions/shortcuts`. `_execute_action` triggers the action without dispatching `onCommand`. Examples handle `onCommand` in the service worker, and OS/Chrome shortcuts always win. Source: [chrome.commands](https://developer.chrome.com/docs/extensions/reference/api/commands)
- `sidePanel.open()` may be called from a keyboard shortcut (user action). Source: [chrome.sidePanel](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- Shortcuts must not conflict with Chrome zoom shortcuts, and keyboard shortcuts should be documented in the UI. Source: [Chrome: Accessibility](https://developer.chrome.com/docs/extensions/how-to/ui/a11y)

### Inferences
- Empty state before a pick: a 3-step numbered list ("1 Pick your manifest, 2 Fill, 3 Review yellow, then press Save yourself"). This replaces a first-run tour and needs no storage.
- "Why yellow": the legend in the result list should say it plainly ("Yellow: avow has no answer in your manifest, or the manifest says decide by hand"; "Dashed: avow could not recognise this question"). Put each item's reason in the visible list, not only in a `title` tooltip, which keyboard and touch users cannot reach.
- Errors: when the manifest fails to parse, name the file and the problem, and keep "Pick manifest" focused. When there are no known questions on the page, list which Console forms avow supports.
- Undo: before `fill`, record `{element, wasChecked}` for each control touched. Offer "Undo fill", which re-clicks to restore. Angular forms need real click events, so use the same path `fill.js` uses. The snapshot is lost on route change, which is acceptable.
- Shortcut: an in-panel key listener (e.g. Alt+Shift+F while the panel has focus) needs no manifest change. A global shortcut needs a `background.service_worker` that calls `tabs.sendMessage` to the content script.

### Gaps
- No source confirms whether a `commands` entry without an `action` key still gets a usable shortcut UI entry. It is presumed so, but untested.

## 7. Internationalization

### Takeaway
`chrome.i18n` handles avow's own strings (usable directly in content scripts, no permission). The bigger risk is that `fill.js` matches Console questions by English text, so a Console set to another language silently matches nothing. avow should detect a non-English Console and say so, rather than show "no questions found".

### Cited Findings
- `_locales/<code>/messages.json`, and `default_locale` is required if `_locales` exists. `getMessage` returns `""` for missing keys. It accepts up to 9 substitutions. `@@bidi_dir` gives text direction. `getUILanguage()` returns the browser UI language. `detectLanguage()` runs CLD on a string. The docs list no permission requirement. Source: [chrome.i18n](https://developer.chrome.com/docs/extensions/reference/api/i18n)
- `i18n` is directly available to content scripts. Source: [Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)

### Inferences
- Detect the Console language from `document.documentElement.lang`. If it is not `en*`, show "avow recognises the English Console only. Switch Play Console language to English (Settings) to fill." This is a clear, honest empty state. The page's `lang` should be more reliable than `getUILanguage()`, because the Console language can differ from Chrome's.
- Longer term, anchor matching on structure (form control `name`/`formcontrolname`, order within known sections) instead of prose. That is a research item and needs a live DOM survey.
- Localizing avow's own UI is low priority while matching is English-only. Do it after matching is language-independent.

### Gaps
- I did not verify whether Play Console sets `<html lang>` to the chosen Console language, or whether it exposes stable non-text attributes on questionnaire controls. This needs a live check.

---

## Prioritized task list for avow (small, concrete)

1. **Announce results.** Add `role="status"` to `#status` and `#result` in `panel.js` (WCAG 4.1.3). Make the error path use `role="alert"`.
2. **Keyboard-operable jump list.** Replace `li.jump` click rows with `<button>` elements that `scrollIntoView()` and focus the question's first control.
3. **Collapse properly.** Add `aria-expanded` and `aria-controls` to `#toggle`, update its label ("Collapse"/"Expand"), and collapse on Esc (WCAG 2.4.11 escape hatch). Collapse to a small pill after fill.
4. **Stay off the Save bar.** Offer top-right placement or a dock toggle, held in memory. Lower `max-height` when anchored at the bottom. Verify against the live Console Save bar.
5. **Not colour alone.** Switch to a colour-blind-safe pair (e.g. blue = filled, orange = yours). Keep solid/dashed/dotted as distinct patterns. Add a tiny visible text tag on each marked block. Put each reason in the panel list, not just `title`.
6. **Theme and forced colours.** Move colours to CSS custom properties with a `prefers-color-scheme: dark` block. In `forced-colors: active`, swap `box-shadow` for a `border: 1px solid CanvasText`.
7. **Empty state as onboarding.** Before a manifest is picked, show 3 numbered steps plus a one-line "Yellow means..." legend after fill.
8. **Language guard.** If `document.documentElement.lang` is not English, say avow supports only the English Console, instead of "no questions found".
9. **Route-change hygiene.** On `navigation` `currententrychange` (where present), clear marks and results and prompt "Page changed, Fill again". No persistent observer.
10. **Undo fill.** Snapshot prior checked states before filling and offer a one-click restore.
11. **Popover top layer.** Show the panel host via `popover="manual"` and `showPopover()` instead of `z-index: 2147483647`.
12. **Later / optional:** move to `chrome.sidePanel` (no warning; needs `action`, a service worker and `tabs.sendMessage`) if in-page placement keeps colliding with the Console. Add a `commands` shortcut only once a service worker exists. Localize avow's own strings via `_locales` after matching is language-independent. For the store listing, use "for Google Play Console™" with attribution, and no Google marks in the icon.
