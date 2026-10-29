# Chrome Web Store privacy, policy, listing and review requirements for avow (as of Oct 2026)

Context: avow is MV3, no `permissions`, no `host_permissions`, no service worker, one content script matching `https://play.google.com/console/*`. It reads a local JSON file the user picks and clicks radios/checkboxes on Play Console policy forms. It never submits, never uses network or storage, and collects nothing. Open source (raj-khan/avow, MIT).

## 1. Developer Program Policies: single purpose, User Data / Limited Use, Privacy practices tab, privacy policy

### Takeaway
avow fits single purpose easily. The open question is whether reading Play Console page content and a user-picked file locally counts as "handling user data". Google's FAQ says website content processed locally *is* user data, so the low-risk route is to publish a short privacy policy anyway, certify no collection, and declare no remote code.

### Cited Findings
- "An extension must have a single purpose that is narrow and easy to understand." [Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies)
- Single purpose violations carry the codes Red Magnesium, Red Copper, Red Lithium and Red Argon (multiple unrelated functions, extra functions via the action icon, and so on). [Troubleshooting](https://developer.chrome.com/docs/webstore/troubleshooting)
- "If your Product handles any user data, then you must post an accurate and up to date privacy policy." [Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies)
- If a product does not handle user data, "You have no special or new obligations under the User Data Policy." [User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
- User data includes "Website content and resources", form data, PII, authentication info and web browsing activity. "Handle" means "collecting, transmitting, using, or sharing user data". Disclosure applies "even when data is processed or stored locally on a user's device". Clipping or scraping content from a visited site is given as an example of handling. [User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
- Limited Use: extensions "may only collect, use, or transmit user data that is necessary for the extension's disclosed single purpose". Browsing-activity collection is prohibited except for a prominently described user-facing feature. Developers must publish an affirmative Limited Use compliance statement on a website belonging to the extension. [Limited Use](https://developer.chrome.com/docs/webstore/program-policies/limited-use)
- The Privacy practices tab has four parts: (1) single purpose description; (2) a justification for each permission declared in the manifest; (3) a remote code declaration ("No, I am not using remote code"), where undeclared remote code leads to rejection; (4) data usage checkboxes for collected data types, plus certifications covering compliance and Limited Use. Disclosures are shown to users and "should match your privacy policy URL". The policy "should include how data is collected, used, and disclosed." [Privacy tab docs](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)
- Privacy tab disclosures "must be accurate, up-to-date, and match the extension's privacy policy." [Best practices](https://developer.chrome.com/docs/webstore/best-practices)
- Purple Lithium is the code for collecting user data without a privacy policy, or with a missing or broken one. Purple Nickel covers collection without prominent disclosure and consent. Purple Magnesium covers browsing-activity collection with no user-facing need. [Troubleshooting](https://developer.chrome.com/docs/webstore/troubleshooting)
- **Recent change (announced July 1 2026, enforced from Aug 1 2026, existing listings included):** collected data must be "strictly necessary to the extension's disclosed single purpose". All collection must be prominently disclosed even when closely related to that purpose. Users must be told proactively if data handling changes after install. Also new: bans on prediction-market extensions and on extensions that circumvent AI-service safety guardrails. [CWS policy updates 2026](https://developer.chrome.com/blog/cws-policy-updates-2026)
- Remote code: "the full functionality of an extension must be easily discernible from its submitted code". Executing remotely fetched strings is banned, while remote data (not logic) is allowed. [Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies). The code is Blue Argon. Obfuscation is Red Titanium; minification is allowed. [Troubleshooting](https://developer.chrome.com/docs/webstore/troubleshooting)

### Inferences
- avow reads the Play Console DOM (website content) and a user-supplied file, both locally and transiently. A strict reading of the FAQ says that is "using" website content, so a privacy policy is technically arguable. A policy costs a single page and removes the main Purple Lithium risk, so publish one.
- Data checkboxes: nothing is collected or transmitted, so leaving all unticked is defensible. The privacy policy and listing should say plainly that page content and the JSON file are processed in memory only and never stored or sent.
- The Aug 2026 data-minimization and disclosure rules are a non-issue for a zero-collection extension. They do raise reviewer attention on extensions that touch page content, which makes a precise privacy policy more valuable.
- Even with no `permissions` key, the content script `matches` entry acts as host access. Expect the install prompt to read roughly "Read and change your data on play.google.com", and the dashboard may ask for a justification. This is based on knowledge of Chrome's behavior, not a fetched source; verify in the dashboard.
- Keep the shipped code unminified (it is open source anyway). That makes review faster and rules out Red Titanium.

### Gaps
- No official source says whether a content script that only reads DOM to click elements, with nothing collected, *requires* a privacy policy. The FAQ's definitions point both ways.
- I did not fetch the exact current list of data-type checkboxes in the dashboard.

## 2. Interacting with Google properties, form automation, branding and trademarks

### Takeaway
No CWS policy bans extensions that operate on Google sites or fill forms, provided they do not bypass logins, impersonate, or claim endorsement. Do not put "Google Play" in the extension name or icon. Use "for Google Play Console" style wording in the description, with trademark attribution.

### Cited Findings
- Prohibited: "facilitate unauthorized access to content on websites, such as circumventing paywalls or login restrictions." "Extensions must use existing Chrome APIs for their designated use case." [Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies)
- Impersonation: "Don't pretend to be someone else". Do not claim to be authorized or endorsed by a company when you are not. [Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies). The codes are Red Nickel, Red Potassium and Red Silicon (impersonation, false endorsement, functionality not matching the listing). [Troubleshooting](https://developer.chrome.com/docs/webstore/troubleshooting)
- Yellow Nickel (spam) includes "messages sent on the user's behalf without consent". [Troubleshooting](https://developer.chrome.com/docs/webstore/troubleshooting)
- CWS branding guidelines: "Don't use any Google trademarks or any confusingly similar marks as the name of your extension". "Don't use Google trademarks or a modified version of a Google trademark as the logo for your extension". Compatibility wording is allowed: "for", "for use with", "compatible with", with ™ (example: "for Google Chrome™"). When Google marks appear in the title or description, include attribution such as "Google Maps is a trademark of Google LLC. Use of this trademark is subject to Google Permissions." Unaltered screenshots of Google services may be used for illustrative purposes. [CWS Branding](https://developer.chrome.com/docs/webstore/branding)
- "Google Play™ store" appears on Google's trademark list. "Play Console" does not, but the list is "non-exhaustive". [Google trademark list](https://about.google/brand-resource-center/trademark-list/)
- Google brand terms: third parties may not register names or marks "confusingly similar to those of Google", and any use must carry a notice that the features are trademarks. [Google brand T&C](https://partnermarketinghub.withgoogle.com/brands/google/trademarks-and-terms/terms-and-conditions/)
- If images refer to Google brands, follow the Branding Guidelines. [Images](https://developer.chrome.com/docs/webstore/images)

### Inferences
- The name "avow" is clean. A subtitle such as "avow: Play Console declarations from JSON" puts a Google mark in the title, so the attribution line would then be mandatory. Simpler to keep the name as just "avow" and put "for Google Play Console™" in the summary and description.
- The icon must not use the Play triangle, Play colors in triangle form, or any Google logo.
- "Never submits" is a strong compliance point against both "acts on the user's behalf without consent" and deceptive behavior. State it explicitly in the listing.
- Add a "Not affiliated with or endorsed by Google" line to the description.
- Google Play's own Terms of Service on automated interaction with Play Console were not checked (out of CWS scope). The user stays in control and avow does not submit, which lowers the risk.

### Gaps
- No CWS policy found that addresses form-filling automation on Google properties specifically.
- No Google Play brand guidance found for third-party product naming. The Google Play partner hub covers only press materials ([Google Play brand hub](https://partnermarketinghub.withgoogle.com/brands/google-play/)).

## 3. Listing requirements

### Takeaway
Required: name (75 characters max), summary (manifest `description`, 132 characters max), detailed description, category, language, a 128x128 icon, and at least one 1280x800 screenshot. Promo tiles are optional, but without a small tile the extension ranks lower.

### Cited Findings
- `name` maximum is 75 characters. [manifest name](https://developer.chrome.com/docs/extensions/reference/manifest/name)
- `description` maximum is 132 characters, plain text. It is shown at chrome://extensions and in the Chrome Web Store. [manifest description](https://developer.chrome.com/docs/extensions/reference/manifest/description)
- Detailed description: "Start your description with a concise statement of what your item does". No keyword spam. Choose a primary category and a language. Optional fields: Official URL (a site verified in Google Search Console, which shows a verified-publisher link), Homepage URL, Support URL, a YouTube video, and the mature-content flag. [Listing docs](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)
- Store icon: 128x128 PNG inside the ZIP. Artwork is 96x96 with 16px transparent padding per side (about 112px diameter for circular icons). It must work on light and dark backgrounds, with no border and no large drop shadow. Non-transparent images get a 12px-radius rounded frame. [Images](https://developer.chrome.com/docs/webstore/images)
- Screenshots: at least 1, up to 5. Use 1280x800 (preferred) or 640x400, with square corners and full bleed (no padding). They are currently downscaled to 640x400. [Images](https://developer.chrome.com/docs/webstore/images)
- Small promo tile is 440x280 and marquee is 1400x560 (PNG or JPEG). Neither can be localized. "Extensions without one [small tile] are shown after those that have one". The marquee is required for marquee featuring. Avoid text, keep it readable at half size, and fill the area. [Images](https://developer.chrome.com/docs/webstore/images); [Listing docs](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)
- Keyword spam (Yellow Argon) includes "Unnatural repetition of the same keyword more than 5 times" and long lists of sites or brands. [Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies); [Troubleshooting](https://developer.chrome.com/docs/webstore/troubleshooting)
- Yellow Zinc is missing or misleading metadata (icon, title, screenshots, description). [Troubleshooting](https://developer.chrome.com/docs/webstore/troubleshooting)
- Listing should "explicitly communicate what the extension does". Images "should not be blurry or too busy." [Best practices](https://developer.chrome.com/docs/webstore/best-practices)

### Inferences
- Screenshots of the real Play Console are allowed under the "unaltered screenshots" branding clause. Blur app names and developer account details in them.
- Category: "Developer Tools" fits best. I did not verify the current category list.
- Support URL: the GitHub issues page. Homepage: the GitHub repo or a GitHub Pages site, which can also host the privacy policy and the Limited Use statement.

### Gaps
- No official limit found for the detailed description length.
- Category list not fetched.

## 4. Review process and rejection codes

### Takeaway
Most reviews take a few days and can take up to a few weeks. New developers and new extensions get extra scrutiny, but no permissions, a single narrow match pattern and readable code are the cheapest profile to review. The realistic rejection risks for avow are Yellow Magnesium (broken package), Yellow Zinc (thin metadata), Purple Lithium (privacy policy) and Red Nickel (listing does not match behavior).

### Cited Findings
- "For most extensions, review is completed within a few days, but it can take up to a few weeks." Contact support if an item has been pending "for more than three weeks". [Review process](https://developer.chrome.com/docs/webstore/review-process)
- Closer examination is triggered by new developers, new extensions, dangerous permissions, significant code changes, broad host permissions, and large or minified code volume. "All submissions go through the same review system". Review can be slower after a prior rejection. [Review process](https://developer.chrome.com/docs/webstore/review-process)
- A rejection email names the policy and how to appeal. The live listing is unaffected. Appeals go through the dashboard (item page, then Appeal). One Stop Support replies within up to 3 days. Published items with minor violations typically get 7–30 days to fix. The page was last updated 2021-12-10. [Review process](https://developer.chrome.com/docs/webstore/review-process)
- Full code table: Blue Argon (remote code), Yellow Magnesium (broken functionality, misnamed files), Purple Potassium (excessive permissions), Yellow Zinc (metadata), Red Nickel/Potassium/Silicon (deception, impersonation), Purple Lithium (privacy policy), Purple Nickel (disclosure), Purple Copper (insecure transmission), Purple Magnesium (browsing data), Red Magnesium/Copper/Lithium/Argon (single purpose), Yellow Argon (keyword stuffing), Yellow Lithium (redirect only), Yellow Nickel (spam), Red Titanium (obfuscation), Yellow Potassium (minimum functionality), Blue Titanium (enforcement circumvention), plus the Grey-series content codes. [Troubleshooting](https://developer.chrome.com/docs/webstore/troubleshooting)
- Developer reports: Purple Potassium rejections for unused `tabs` or `storage` permissions ([Chromium group thread](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/GdtnseYh5Ng); [june07 write-up](https://june07.com/chrome-web-store-rejection-notification-purple-potassium)). A Yellow Magnesium rejection was reversed on re-review ([Indie Hackers](https://www.indiehackers.com/post/extension-re-reviewed-and-approved-87c3f01e07)). One DEV.to article mislabels Purple Potassium as a metadata issue, which contradicts Google's table ([DEV](https://dev.to/bdilip48/chrome-web-store-rejection-codes-4hfj)). A vendor listing claims only one appeal is now allowed; this is unverified ([vendor listing](https://chromewebstore.google.com/detail/bipgdjideeiobpfcnpdilolhnolefacg)).
- MV3 is required for new submissions. [Best practices](https://developer.chrome.com/docs/webstore/best-practices)

### Inferences
- With no permissions, Purple Potassium is essentially impossible. Keep it that way: do not add `storage` or `activeTab` "just in case".
- Reviewers may not have a Play Console account to test with. Provide a test-instructions note, a sample JSON file and a short video showing the fill, so Yellow Magnesium ("doesn't work") is not raised just because the reviewer cannot reach the page.
- Yellow Potassium (minimum functionality) is low risk because avow does real work in-page, but the description must make that value obvious.

### Gaps
- No public data on typical review times for zero-permission extensions in 2026.
- Whether only one appeal is allowed per verdict is unconfirmed by official docs.

## 5. Developer account requirements

### Takeaway
Pay a one-time US$5 fee, accept the developer agreement, enable 2-Step Verification, set a permanent developer email, and declare trader or non-trader status (an EU DSA requirement). Verified-publisher status is optional, via a Search Console-verified site.

### Cited Findings
- One-time registration fee; agree to the developer agreement and policies. The developer email cannot be changed after creation. Some countries are ineligible. [Register](https://developer.chrome.com/docs/webstore/register)
- The fee is US$5, charged at registration since 2020; existing developers do not pay again. [Chromium Blog 2020](https://blog.chromium.org/2020/03/new-developer-dashboard-and.html?m=0). No 2026 change found.
- 2-Step Verification is "required for all developer accounts prior to publishing an extension or updating an existing extension." [2SV policy](https://developer.chrome.com/docs/webstore/program-policies/two-step-verification)
- "All developers on the Chrome Web Store are required to declare if they are a Trader or Non-Trader." Uses EU definitions; "Each publisher must make their own determination." Traders publish their legal name, an SMS-capable phone number and an address at the bottom of the listing. [Trader FAQ](https://developer.chrome.com/docs/webstore/program-policies/trader-verification-faq)
- Official URL / verified publisher requires a site verified in Google Search Console. [Listing docs](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)

### Inferences
- A free, MIT, non-commercial hobby project most naturally fits non-trader status, which keeps the address and phone off the listing. Re-declare as trader if avow is ever monetized or tied to a business.
- Pick a dedicated developer email, because it is permanent.

### Gaps
- The consequences of not declaring trader status are not stated in the FAQ.
- No official 2026 page states the fee amount; US$5 comes from the 2020 announcement.

## 6. Privacy-by-design practices and trust signals

### Takeaway
avow already sits at the minimization ceiling: no permissions, no network, no storage, no background. The work is to make that verifiable and to say it in the listing in plain, checkable terms.

### Cited Findings
- "Request access to the narrowest permissions necessary". [Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies)
- Data must be "strictly necessary" to the single purpose, and changes after install must be disclosed proactively (since Aug 2026). [CWS policy updates 2026](https://developer.chrome.com/blog/cws-policy-updates-2026)
- Send data only over HTTPS, in the request body (Purple Copper). [Troubleshooting](https://developer.chrome.com/docs/webstore/troubleshooting)
- Privacy tab disclosures are shown to users on the listing. [Privacy tab docs](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)

### Inferences
- Lock it in technically: add a manifest CSP `extension_pages` that blocks `connect-src` (if avow ever gains extension pages), and add a CI check that the manifest keeps no `permissions` or `host_permissions` and that the code has no `fetch`, `XMLHttpRequest`, `chrome.storage` or `eval`. This mirrors store-decl's "manifest contradicts code" philosophy.
- Listing trust copy, in short checkable lines: "No permissions. No network requests. Nothing stored. Never clicks Submit. Runs only on play.google.com/console. Source: github.com/raj-khan/avow." Also: "Not affiliated with Google."
- No telemetry and no error reporting, not even opt-in. Any future addition would trigger the post-install disclosure duty.
- Tag GitHub releases matching the CWS version so reviewers and users can diff the store ZIP against the source.

### Gaps
- No official CWS guidance on trust copy beyond accuracy; the suggestions above are inference.

---

## Prioritized task list for avow

1. Enable 2SV, register (US$5), declare **non-trader**, and use a dedicated permanent email. [Register](https://developer.chrome.com/docs/webstore/register), [2SV](https://developer.chrome.com/docs/webstore/program-policies/two-step-verification), [Trader FAQ](https://developer.chrome.com/docs/webstore/program-policies/trader-verification-faq)
2. Publish a one-page privacy policy (GitHub Pages or repo `PRIVACY.md` URL). It should say: no data collected, transmitted, stored or sold; page content and the JSON file are processed in memory on-device only; plus a Limited Use compliance statement. Link it in the Privacy tab. [User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq), [Limited Use](https://developer.chrome.com/docs/webstore/program-policies/limited-use)
3. Privacy tab: write the single-purpose sentence ("Fills Google Play Console policy declaration forms from a JSON file you choose; never submits"). Select "No, I am not using remote code". Leave data types unticked and tick the certifications. Justify the play.google.com/console match if asked. [Privacy tab](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)
4. Manifest: `name` "avow" (75 characters max) and a `description` of 132 characters or fewer that uses "for Google Play Console". Keep zero permissions and ship unminified code. [name](https://developer.chrome.com/docs/extensions/reference/manifest/name), [description](https://developer.chrome.com/docs/extensions/reference/manifest/description)
5. Assets: a 128x128 icon (96x96 artwork, no Google or Play marks), 1–5 screenshots at 1280x800 with account data blurred, and a 440x280 small tile. [Images](https://developer.chrome.com/docs/webstore/images), [Branding](https://developer.chrome.com/docs/webstore/branding)
6. Description: open with what it does, then the trust lines (no permissions, no network, no storage, never submits), "Not affiliated with or endorsed by Google", trademark attribution for Google Play, and no keyword repetition. [Branding](https://developer.chrome.com/docs/webstore/branding), [Troubleshooting](https://developer.chrome.com/docs/webstore/troubleshooting)
7. Reviewer aids: a sample JSON in the repo, a short YouTube demo linked in the listing, and test instructions. Category Developer Tools; support URL set to GitHub issues.
8. Test the exact ZIP you upload (paths, filename casing) before submitting, to avoid Yellow Magnesium. [Troubleshooting](https://developer.chrome.com/docs/webstore/troubleshooting)
9. Optional: verify a site in Search Console for the verified-publisher link, add a CI guard that fails if permissions, network or storage APIs appear, and tag a GitHub release per store version.
