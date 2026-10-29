// The side panel's way into the page. It connects to this tab's content
// script over a port named "avow-sidepanel" and sends requests; each reply
// carries the request's id. Everything runs through the same actions the
// in-page panel uses, which stays hidden while a side panel is attached.
//
// Only the extension's own pages can open a port to a content script (there
// is no externally_connectable), and the sender is checked anyway.

(function (avow) {
  const runtime = globalThis.chrome?.runtime;
  if (!runtime?.onConnect) return;

  const REQUESTS = {
    load: (msg) => avow.load(String(msg.text ?? ""), Number(msg.bytes) || undefined),
    fill: () => avow.runFill(),
    jump: (msg) => avow.jump(Number(msg.ref)),
    undo: () => avow.undo(),
    status: () => ({ loaded: Boolean(avow.manifest), lang: document.documentElement.lang || "" }),
  };

  let attached = 0;
  runtime.onConnect.addListener((port) => {
    if (port.name !== "avow-sidepanel" || port.sender?.id !== runtime.id) return;
    attached++;
    avow.setPanelHidden?.(true);

    port.onMessage.addListener((msg) => {
      const handler = REQUESTS[msg?.type];
      try {
        if (!handler) throw new Error(`unknown request "${msg?.type}"`);
        port.postMessage({ id: msg.id, ok: true, value: handler(msg) });
      } catch (e) {
        port.postMessage({ id: msg?.id, ok: false, error: e.message });
      }
    });

    const off = avow.onPageChange(() => port.postMessage({ type: "pageChanged" }));
    port.onDisconnect.addListener(() => {
      off();
      attached--;
      if (!attached) avow.setPanelHidden?.(false);
    });
  });
})((globalThis.avow = globalThis.avow || {}));
