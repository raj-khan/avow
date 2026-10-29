# Privacy policy

Applies to the avow Chrome extension and the avow CLI. Last updated 2026-10-29 (side panel added).

## What avow handles

- **The manifest file you pick.** The extension reads it when you choose it.
  Picked in the in-page panel, it is kept in the page's memory and forgotten
  when you leave or reload the page. Picked in the side panel, it is kept in
  the side panel's memory and forgotten when you close the side panel. It is
  never written to disk or extension storage.
- **The Play Console page you are on.** The extension reads the question text
  and form controls on that page so it can tick the answers your manifest
  gives. It reads nothing else and keeps nothing.

The CLI reads files in the repository you point it at, and nothing else.

## What avow does not do

- It collects no personal or sensitive user data.
- It sends nothing anywhere. It has no network code, no analytics, no
  telemetry and no remote code.
- It stores nothing: no cookies, no local storage, no extension storage.
- It asks Chrome for one permission, `sidePanel`, which shows no install
  warning and only lets avow open its own panel beside the page. Its only
  access to web pages is the content script on
  `https://play.google.com/console/*`.
- Its background service worker does one thing: make the toolbar button open
  the side panel. It reads no pages, stores nothing and sends nothing.
- It never submits or saves a Console form. You do that.

These claims are enforced by `test/extension.js`, which fails the build if the
extension gains any other permission, calls a Chrome API not on a per-file
list, or uses network, storage or submit APIs.

## Limited Use

The use of information received from Google APIs and web pages will adhere to
the Chrome Web Store User Data Policy, including the Limited Use requirements.
avow uses the page content it reads only to fill the form in front of you, does
not transfer it to anyone, does not use it for advertising, and does not let
humans read it.

## Contact

Questions: open an issue at https://github.com/raj-khan/avow/issues.
