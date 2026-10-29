# Security best practices for Chrome MV3 extensions (applied to avow), as of Oct 2026

Context: avow is an MV3 extension with no `permissions`, no `host_permissions`, no service worker. One classic content script matched to `https://play.google.com/console/*` renders a panel in a closed shadow root, reads a user-picked JSON file via `<input type=file>`, and clicks radios/checkboxes on Play Console forms. No submit, no network, no storage.

## 1. Content script isolation: what the page can see, tamper with, or spoof

### Takeaway
Isolated worlds hide avow's JavaScript variables from the page, but the DOM is shared, so everything avow reads from the Console DOM is page-controlled input. A closed shadow root hides the panel's internals from page scripts, but it is an obscurity layer, not a security boundary. On Play Console (a first-party Google page), the realistic risk is avow mis-clicking because the DOM changed, more than a hostile page.

### Cited Findings
- Content scripts "live in an isolated world"; JS variables in content scripts "are not visible to the host page"; page and content script "share access to the page's DOM"; static scripts default to `world: ISOLATED`. Injecting into the MAIN world makes the page's CSP apply. Source: [Chrome: Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- Chrome's security guidance: hostile pages can manipulate the DOM content scripts rely on, so content scripts are "not fully isolated from attacks"; treat content-script data as possibly attacker-crafted. (Page last updated 2018-03-06; principle still valid, details dated.) Source: [Chrome: Stay secure](https://developer.chrome.com/docs/extensions/develop/security-privacy/stay-secure)
- Closed mode denies JS outside the root access to its nodes; `host.shadowRoot` returns `null`. Source: [MDN: ShadowRoot.mode](https://developer.mozilla.org/docs/Web/API/ShadowRoot/mode)
- A closed shadow root created by a page is equally hidden from content scripts as from page scripts; Chromium discussed an isolated-world-only accessor (`openOrClosedShadowRoot`) to let extensions see closed roots. No confirmation found that it shipped. Source: [chromium-extensions: Proposal to access closed shadow root](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/JaHhogJuBOk); [Mozilla bug 1439153](https://bugzilla.mozilla.org/show_bug.cgi?id=1439153)
- The common "workaround" to reach closed roots is to wrap `attachShadow` at `document_start` in the page world; community notes call closed roots a weak barrier if another script can replace `attachShadow`. Source: [Mozilla bug 1439153](https://bugzilla.mozilla.org/show_bug.cgi?id=1439153)

### Inferences
- Because avow calls `attachShadow` from its isolated world, a page-world override of `Element.prototype.attachShadow` should not intercept it (each world has its own JS wrappers/prototypes). Not explicitly stated in Chrome docs; treat as well-understood behavior, not a documented guarantee.
- What the page can still do regardless of closed mode: see and remove the host element, restyle/overlay it (e.g. cover the panel with a fake button), observe its size/position, and listen at `document` for *composed* events from inside the root (pointer, keyboard, `input`, `focus`-family) with `target` retargeted to the host. Non-composed events such as `change` from the file input stay inside the root. File contents read via `FileReader`/`file.text()` in the isolated world are not reachable by page JS.
- The page can spoof the DOM avow targets: inject look-alike radios with the same labels, reorder options, or swap `aria-*` attributes so a label-match clicks the wrong control. On Play Console the page is Google's own, so a malicious page is unlikely; a Console redesign or A/B variant producing the same effect (wrong click) is likely. Defend against both with the same checks: match on label text *and* structure, read state back after clicking, refuse on ambiguity.
- Key danger is scope creep: clicking anything that is not a radio/checkbox inside a known question group (e.g. "Save", "Submit", "Discard", navigation) would turn a mis-match into a destructive action.

### Gaps
- No primary Chrome doc explicitly states that page-world prototype patches cannot affect isolated-world DOM calls; behavior is inferred from the isolated-world model.
- No source found on whether Play Console uses closed shadow roots of its own that avow would need to traverse.

## 2. DOM injection safety and untrusted JSON

### Takeaway
Build the panel with `createElement` + `textContent`, never `innerHTML` with interpolated strings; parse only with `JSON.parse`. A page's Trusted Types policy does not govern Chrome isolated-world content scripts, so avow cannot lean on the Console's CSP to catch mistakes.

### Cited Findings
- `innerHTML` and `document.write()` can let attackers inject scripts; create DOM nodes manually and insert dynamic text with `innerText`. Source: [Chrome: Stay secure](https://developer.chrome.com/docs/extensions/develop/security-privacy/stay-secure)
- Running page-supplied strings through `eval()` is "dangerous, and disallowed in Manifest V3"; "JSON.parse does not evaluate the attacker's scripts"; use the closure form of `setTimeout`; filter cross-site content before injecting. Source: [Chrome: Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- In Chrome, the page's Trusted Types headers do not govern content-script isolated worlds; code in the page's main world is still blocked if the site enforces TT. Source: [W3C Trusted Types wiki: effects on extension developers](https://github.com/w3c/trusted-types/wiki/Effects-of-deploying-Trusted-Types-on-browser-extension-developers)
- Firefox briefly enforced TT on isolated-world content scripts, then landed a patch exempting them. Source: [Mozilla bug 1947732](https://bugzilla.mozilla.org/show_bug.cgi?id=1947732)

### Inferences
- The JSON file is user-picked, but users download manifests from repos, PRs, or colleagues; treat every string in it (question ids, notes, `why` text) as hostile. Rendering a `why` string via `innerHTML` inside the shadow root would execute in the isolated world, which has the extension's privileges (here few, but still the extension's origin for any future API use).
- Validate the parsed shape before use: expected top-level keys, string/boolean types, length caps, and a file-size cap before reading, so a malformed or huge file fails cleanly instead of partially filling a form.
- Do not use file strings as CSS selectors or attribute names (`querySelector(userString)`): a crafted selector can match unintended controls. Map manifest ids to selectors through a fixed table in code.

### Gaps
- No current Chrome doc (vs. the W3C wiki) explicitly guarantees the TT exemption for isolated worlds.

## 3. Extension CSP, remote code ban, eval: does it apply to content scripts?

### Takeaway
MV3's manifest CSP governs extension pages (and sandbox), with a non-relaxable minimum; Chrome's CSP reference does not say it governs content scripts. The remote-code ban is a Web Store *policy* covering all extension code, content scripts included. avow, with no deps and no network, satisfies it trivially.

### Cited Findings
- Default MV3 `extension_pages` CSP: `script-src 'self'; object-src 'self';`; minimum enforced: `script-src 'self' 'wasm-unsafe-eval'; object-src 'self';`; cannot be relaxed further (e.g. adding `'unsafe-eval'` errors at install). Sandbox default allows `'unsafe-inline'` and `'unsafe-eval'`. The reference page does not address content scripts. Source: [Chrome: Manifest CSP](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy)
- Content scripts doc: the CSP "prevents the use of eval() as well as loading external scripts"; eval of page data "disallowed in Manifest V3"; MAIN-world scripts are subject to the page's CSP. Source: [Chrome: Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- MV3 Web Store requirement: full functionality must be discernible from submitted code; no remotely hosted code; no interpreters for remotely fetched commands; no `eval()` of remote strings. Remote config/data is allowed if all logic ships in the package. Source: [CWS: Additional requirements for MV3](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements); [CWS: Troubleshooting violations](https://developer.chrome.com/docs/webstore/troubleshooting)
- Obfuscation is disallowed; minification allowed but slows review; submit code as authored where possible. Source: [CWS: Review process](https://developer.chrome.com/docs/webstore/review-process)

### Inferences
- An explicit `content_security_policy.extension_pages` in avow's manifest is pointless today (no extension pages) but harmless; leaving it out keeps the manifest minimal per "limit manifest fields to those the extension relies on" ([Stay secure](https://developer.chrome.com/docs/extensions/develop/security-privacy/stay-secure)).
- Policy-relevant edge: the "interpreter" clause targets *remotely fetched* commands. avow interprets a *local, user-picked* JSON file that only selects among answers in code; this is data, not logic, and is fine. Keep it that way: the JSON should never carry selectors, scripts or action names that the extension executes generically.

### Gaps
- Chrome docs do not clearly state the exact CSP applied to isolated-world content scripts in MV3 (the content-scripts page implies a CSP blocking eval; the CSP reference is silent).

## 4. Permission minimization and the install warning

### Takeaway
"No permissions" is not "no warning": `content_scripts.matches` counts as host access and produces a host warning at install and on any widening change. activeTab (+ `scripting`) would show no install warning and inject only on user click, at the cost of one click per tab and a service worker or action handler.

### Cited Findings
- "Adding or changing match patterns in the `host_permissions` and `content_scripts.matches` fields" triggers a warning; `content_scripts.matches` entry: "Changes may trigger a warning." Optional permissions are recommended to avoid alarming warnings. Source: [Chrome: Declare permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions)
- Chromium: "Scriptable hosts are match patterns used in the content_scripts entry"; from a messaging standpoint they are treated the same as explicit hosts (read and modify data on those domains). Source: [Chromium extensions/docs/permissions.md](https://chromium.googlesource.com/chromium/src/+/HEAD/extensions/docs/permissions.md)
- Developer reports confirm content-script matches contribute to the host warning; widening matches in an update disabled the extension until users re-consented. Source: [chromium-extensions thread](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/dP7MPvywjVU); [demo-content-script-warning repo](https://github.com/jacksteamdev/demo-content-script-warning)
- `activeTab`: "does not display a permission warning"; grants temporary access to the active tab when the user invokes the extension (action click, context menu, command shortcut, omnibox); lasts while the user stays on the page/origin; with `scripting` allows injecting scripts. Presented as limiting exposure if the extension is compromised. Source: [Chrome: activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab); [Chrome: Permission warnings](https://developer.chrome.com/docs/extensions/develop/concepts/permission-warnings)
- Programmatic injection requires host permission or activeTab. Source: [Chrome: Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- Users can restrict any extension's host access to "on click" or a site list (since Chrome 70); Chrome then withholds access until clicked. Source: [Chrome: User controls for host permissions (MV2 doc)](https://developer.chrome.com/docs/extensions/mv2/runtime-host-permissions)
- Review speed: "Reviews may take longer for extensions that request broad host permissions"; powerful permissions and more code take longer; new developers/extensions get closer scrutiny. Source: [CWS: Review process](https://developer.chrome.com/docs/webstore/review-process)

### Inferences
- Expected install prompt for avow is a single-host warning along the lines of "Read and change your data on play.google.com". The path (`/console/*`) narrows where the script runs but, by Chrome's host-level permission messaging, is not reflected in the warning text. Exact string not verified from a primary source (see Gaps).
- A single non-wildcard host is the narrowest host grant possible, so avow should land in the fast end of review; "no permissions" avoids every API-level warning and every "powerful permission" review flag.
- Trade-off, static content script vs. activeTab + scripting:
  - Static (current): zero clicks, panel always present on Console pages; one host warning; script and host element present on every Console page even when unused (larger exposure surface to the page and to DOM changes); any future widening of `matches` disables the extension for users until re-consent.
  - activeTab + scripting: no install warning; code only runs after a user gesture on that tab; requires a toolbar action and usually a service worker (or `action` + `chrome.scripting.executeScript` from a worker), which adds a component, a `permissions` entry, and the need to handle "user clicked on a non-Console page". It also changes the extension's "nothing but a content script" story.
  - Middle ground for users who want it: Chrome's built-in "on click" site-access setting already gives users activeTab-like behavior over the static script without code changes.
- Recommendation leans to keeping the static script: the warning is honest (avow does read and change Console data), the scope is one host, and adding a service worker to remove the warning increases code and moving parts. Revisit if store reviewers or users push back on the warning.

### Gaps
- Exact warning string for a single host with `content_scripts` only: not found in fetched primary sources (Chromium `generated_resources.grd` too large to retrieve). Verify by loading the unpacked extension and using "Pack extension" + drag-install, or via the Web Store dashboard preview.
- Whether `scripting` itself shows a warning was not verified.
- Status of `permissions.addHostAccessRequest` in stable Chrome unknown.

## 5. Clickjacking, event spoofing and programmatic clicks

### Takeaway
`element.click()` dispatches an event with `isTrusted: false`; Angular/Material handlers usually accept it, but some Google surfaces ignore untrusted clicks. Programmatic clicks bypass any confirm-by-human step, so avow must constrain *what* it clicks and confirm state afterward. Conversely, the page can overlay or fake avow's own panel.

### Cited Findings
- `click()` runs synthetic click activation and sets `isTrusted` to false; `dispatchEvent` events are also untrusted. Source: [W3C bug 25504](https://www.w3.org/Bugs/Public/show_bug.cgi?id=25504); [Ben Nadel: Exploring Event.isTrusted](https://www.bennadel.com/blog/4873-exploring-event-istrusted-in-javascript.htm)
- One project reports Google Payments embedded forms ignore `isTrusted:false` clicks; the only trusted routes are real keyboard activation or Chrome debugger `Input.dispatchMouseEvent` (single-project notes, not independent). Source: [chrome-use commit](https://gitea.oimcloud.myaddr.tools/oimwiodev/chrome-use/commit/5a858af93f5d60d1ffce2c79bea6ac0f0d8669fb)
- Treat content-script inputs as attacker-crafted; do not let them trigger arbitrary actions. Source: [Chrome: Stay secure](https://developer.chrome.com/docs/extensions/develop/security-privacy/stay-secure)

### Inferences
- Do not "upgrade" to trusted input (the `debugger` permission) to work around ignored clicks: it carries a severe warning and a review penalty for a cosmetic gain. Prefer setting state the component accepts (click the `<input>` or its labelled host) and verify by reading `checked`/`aria-checked` back.
- If a click silently fails (handler ignores untrusted events, or the framework re-renders), avow should report "not applied" per item rather than assume success. A fill tool that over-reports success is the dangerous failure for a declarations audit trail.
- avow's own panel: because the page can overlay its host element, avow's only sensitive action is "apply", which itself never submits. Low clickjacking value to an attacker; still, require an explicit apply click (not auto-fill on file pick) and show a per-question diff first.
- Never let avow's own UI listen for page-originated events as triggers (e.g. a `message` or `CustomEvent` on `document`), since the page can dispatch those.

### Gaps
- No primary source found documenting whether Play Console's Angular Material radios/checkboxes check `isTrusted`; must be tested empirically.

## 6. Supply chain and release security

### Takeaway
avow's biggest real-world risk is not its code but its publishing account: every large extension compromise of 2017–2026 came through a phished developer account pushing a malicious auto-update. Hardware-key 2FA plus Verified CRX Uploads closes that path; no-deps, unminified source keeps review fast and lets users audit.

### Cited Findings
- Protect developer accounts with 2FA, "preferably with a security key"; use appropriate member roles. Source: [Chrome: Stay secure](https://developer.chrome.com/docs/extensions/develop/security-privacy/stay-secure)
- Verified CRX uploads (since May 7, 2025): opt in on the item's Package tab, supply an RSA public key; afterward uploads not signed with your private key are rejected, "even if your account or publishing workflow is compromised". Verified uploads are re-signed with the store key so the extension ID is unchanged. Source: [Chrome blog: Verified uploads in the CWS](https://developer.chrome.com/blog/verified-uploads-cws); [CWS: Update your item](https://developer.chrome.com/docs/webstore/update)
- Gotcha (Sept 2025): API uploads fail with `PKG_MUST_UPDATE_AS_CRX` until one signed CRX has been uploaded manually so the store learns the key. Source: [chromium-extensions: Uploading CRX via CWS API](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/SybCdMk2LIE)
- Obfuscation banned; minification allowed but slows review. Source: [CWS: Review process](https://developer.chrome.com/docs/webstore/review-process)
- `minimum_chrome_version`: optional string (major like `"126"` or full version); older Chrome sees "Not compatible" on the store; existing installs below the minimum stop receiving updates silently. Source: [Chrome: minimum_chrome_version](https://developer.chrome.com/docs/extensions/reference/manifest/minimum-chrome-version)
- Keep manifest fields and `web_accessible_resources` minimal (exposed resources let sites fingerprint the extension). Source: [Chrome: Stay secure](https://developer.chrome.com/docs/extensions/develop/security-privacy/stay-secure)

### Inferences
- With no build step, the release artifact can be a deterministic zip of tracked files (fixed file order, normalized timestamps, e.g. `git archive` of a tag), letting anyone diff the store package against the repo tag. No primary source on CWS reproducibility; this is standard practice, not a Chrome feature.
- Set `minimum_chrome_version` only to the oldest Chrome you test; raising it later silently strands users on older versions without updates.
- Keep the signing private key off the machine that holds the CWS session (offline or hardware-backed), otherwise verified uploads add little against a local compromise.

### Gaps
- No primary source found for CWS-side reproducible builds or package attestation beyond verified uploads.

## 7. Known incidents relevant to form-filling or Play-Console-targeting extensions

### Takeaway
No public incident found involving an extension that targets Play Console. The relevant pattern is account-takeover-then-malicious-update, which hit dozens of extensions and specifically harvested business/OAuth sessions, exactly the kind of session a Play Console tab holds.

### Cited Findings
- Dec 24, 2024: Cyberhaven employee phished by a fake "CWS Developer Support" email leading to a malicious OAuth app ("Privacy Policy Extension") with CWS management scope; attacker published malicious v24.10.4. Source: [BleepingComputer](https://bleepingcomputer.com/news/security/new-details-reveal-how-hackers-hijacked-35-google-chrome-extensions); [Island](https://www.island.io/info/cyberhaven-and-extension-takeover-incident)
- Same campaign: at least 35 extensions, ~2.6M users, code stealing Facebook business account data and AI-platform sessions (figures from secondary reporting; estimates vary). Source: [BleepingComputer](https://bleepingcomputer.com/news/security/new-details-reveal-how-hackers-hijacked-35-google-chrome-extensions); [Hackread](https://hackread.com/16-chrome-extensions-hacked-credential-theft-scheme/)
- 2017 precedent: Web Developer and Copyfish extensions hijacked via phished developer accounts to push adware. Source: [The Register](https://www.theregister.com/2017/08/02/chrome_web_developer_extension_hacked/); [Help Net Security](https://www.helpnetsecurity.com/2017/07/31/chrome-extension-hijack/)
- Feb 2026: malicious auto-updating extensions hijacked 500K+ VK accounts, using updates to push new payloads without user action. Source: [eSecurity Planet](https://www.esecurityplanet.com/threats/malicious-chrome-extensions-hijack-500000-vk-accounts-in-stealth-campaign/)
- Ongoing phishing of extension developers with fake CWS DMCA notices personalized with their real extension data (date not confirmed). Source: [Daily Security Review](https://dailysecurityreview.com/cyber-security/fake-chrome-web-store-dmca-notices-target-extension-developers/)

### Inferences
- An extension with host access to `play.google.com/console` that is later hijacked could read app lists, financial reports, user data exports, and could change policy declarations or publish settings in the developer's name. avow's minimal footprint does not stop this: a malicious update that keeps the same `matches` triggers no new warning, and a content script can likely still exfiltrate through the shared DOM (e.g. injecting an image beacon). So account security and verified uploads matter more than code hardening.

### Gaps
- No incidents found specifically for Play Console, Google Ads console, or generic "auto-fill policy form" extensions.
- Content-script exfiltration paths under MV3 (e.g. `fetch` from isolated world being treated with extension-origin CORS rules) not verified from a primary source in this session.

---

## Prioritized recommendations for avow (small, concrete)

1. **Account hardening first.** Security-key 2FA on the CWS publisher Google account; single-owner publisher or least-privilege roles. Treat any "CWS policy" or "DMCA" email as phishing until verified in the dashboard. ([Stay secure](https://developer.chrome.com/docs/extensions/develop/security-privacy/stay-secure); [Cyberhaven reporting](https://bleepingcomputer.com/news/security/new-details-reveal-how-hackers-hijacked-35-google-chrome-extensions))
2. **Opt in to Verified CRX Uploads** before the first public release; keep the private key offline; do one manual signed upload before any API automation. ([Verified uploads](https://developer.chrome.com/blog/verified-uploads-cws); [API gotcha](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/SybCdMk2LIE))
3. **No `innerHTML` anywhere.** Build the panel with `createElement`/`textContent`; add a test or lint grep that fails on `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `eval`, `new Function`, string `setTimeout`. ([Stay secure](https://developer.chrome.com/docs/extensions/develop/security-privacy/stay-secure); [Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts))
4. **Validate the JSON before touching the page.** Size cap before read, `JSON.parse` in try/catch, strict shape check, unknown keys reported; never use file strings as selectors, map ids through a fixed table in code. ([Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts))
5. **Click allowlist.** Only click `input[type=radio|checkbox]` (or their Material host) inside a question group whose label text matches the expected question; never click buttons, links or anything labelled save/submit/discard/publish. Refuse and report on zero or multiple matches.
6. **Verify after every click.** Read `checked`/`aria-checked` back; report each item as applied, already set, not found, or not applied (handles `isTrusted:false` being ignored and DOM drift). Do not add `debugger` to get trusted clicks. ([isTrusted](https://www.w3.org/Bugs/Public/show_bug.cgi?id=25504))
7. **Explicit apply step.** Picking a file shows a preview/diff; filling starts only on an explicit button click in the panel. Never trigger on page-dispatched events or `window.postMessage`.
8. **Keep the manifest minimal.** Exact `matches: ["https://play.google.com/console/*"]`, `world` left at ISOLATED, no `web_accessible_resources`, no `externally_connectable`, `all_frames` false unless needed. Never widen `matches` in an update (it re-prompts and can disable the extension). ([Declare permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions); [Stay secure](https://developer.chrome.com/docs/extensions/develop/security-privacy/stay-secure))
9. **Keep the static content script; do not switch to activeTab now.** One-host warning is honest and narrow; activeTab would add a service worker and permission. Document in the listing that users can set site access to "on click". Verify the exact install warning text by test-installing the packed CRX. ([activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab); [User host controls](https://developer.chrome.com/docs/extensions/mv2/runtime-host-permissions))
10. **Ship source as authored.** No minification, no obfuscation; release zip produced deterministically from a git tag so the store package can be diffed against the repo. ([Review process](https://developer.chrome.com/docs/webstore/review-process))
11. **Set `minimum_chrome_version`** to the oldest major you actually test (and only raise it deliberately, since users below it stop getting updates silently). ([minimum_chrome_version](https://developer.chrome.com/docs/extensions/reference/manifest/minimum-chrome-version))
12. **Treat the closed shadow root as UI isolation, not secrecy.** Put nothing sensitive in the panel; assume the page can see, remove or overlay the host element.
