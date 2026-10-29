# avow extension changelog

One heading per `version` in `manifest.json`. `npm run pack:extension`
refuses to build a version that has no heading here. Tag each store upload
`ext-v<version>` so the CLI and the extension release independently.

## 0.2.0

- Side panel: the toolbar button opens avow beside the Console with the same
  controls. It keeps the manifest across tab switches and reloads, until you
  close it, and the in-page panel steps aside while it is open.
- Adds the `sidePanel` permission (no install warning) and a service worker
  whose only job is opening the side panel.

## 0.1.0

First version, not yet on the Chrome Web Store.

- Fills App access, Ads, Advertising ID, Target audience, News app,
  Government app and all of Data safety, including each data type's
  collected/shared, ephemeral, required and purpose answers.
- Reads every control back after clicking it; anything the Console ignored is
  left for you, never reported as filled.
- Undo for a fill; marks clear when the Console changes screen.
- Panel: onboarding steps, legend, screen-reader announcements, keyboard jump
  list, Esc to collapse, pill when collapsed, dock top or bottom, dark mode,
  forced colors, popover top layer.
- No permissions, no network, no storage, never submits. Manifest files over
  1 MB are refused.
