// The service worker's only job: make the toolbar button open avow's side
// panel. It reads nothing, stores nothing and sends nothing.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
