// The side panel: the same controls as the in-page panel, beside the page
// instead of over it. It holds the manifest text in this page's memory only,
// talks to the active tab's content script over a port (src/bridge.js), and
// re-sends the manifest whenever it attaches, so a reload of the Console tab
// does not lose it. Closing the panel forgets everything.

(function (avow) {
  const $ = (id) => document.getElementById(id);
  const el = (tag, props = {}, ...children) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "text") node.textContent = v;
      else if (k === "class") node.className = v;
      else node.setAttribute(k, v);
    }
    node.append(...children);
    return node;
  };

  let manifest = null; // { text, bytes, name }
  let port = null;
  let tabId = null;
  let nextId = 1;
  const pending = new Map();

  function request(type, extra = {}) {
    if (!port) return Promise.reject(new Error("Open a Play Console page in this tab first."));
    const id = nextId++;
    port.postMessage({ id, type, ...extra });
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  }

  function clearResults() {
    $("summary").textContent = "";
    $("tally").textContent = "";
    $("result").replaceChildren();
    $("legend").hidden = true;
    $("undo").disabled = true;
  }

  function setAttached(ok) {
    $("page").textContent = ok
      ? "Connected to this Play Console page."
      : "This tab is not a Play Console page. Open one, and avow connects to it.";
    $("fill").disabled = !(ok && manifest);
  }

  // Connect to a tab's content script. Resolves true once the bridge answers,
  // false when the tab has no avow content script (any non-Console page).
  function attach(id) {
    if (port) port.disconnect();
    for (const p of pending.values()) p.reject(new Error("Disconnected."));
    pending.clear();
    port = null;
    tabId = id;
    clearResults();
    return new Promise((resolve) => {
      let p;
      try {
        p = chrome.tabs.connect(id, { name: "avow-sidepanel" });
      } catch {
        setAttached(false);
        return resolve(false);
      }
      port = p;
      p.onMessage.addListener((msg) => {
        if (msg.type === "pageChanged") {
          clearResults();
          $("status").textContent = "Page changed. Fill again when this screen is ready.";
          return;
        }
        const waiter = pending.get(msg.id);
        if (!waiter) return;
        pending.delete(msg.id);
        if (msg.ok) waiter.resolve(msg.value);
        else waiter.reject(new Error(msg.error));
      });
      p.onDisconnect.addListener(() => {
        void chrome.runtime.lastError;
        if (port === p) port = null;
        setAttached(false);
        resolve(false);
      });
      request("status")
        .then(async (s) => {
          setAttached(true);
          if (manifest && !s.loaded) await sendManifest();
          resolve(true);
        })
        .catch(() => resolve(false));
    });
  }

  async function sendManifest() {
    $("error").textContent = "";
    $("warnings").replaceChildren();
    try {
      const { app, count, warnings } = await request("load", { text: manifest.text, bytes: manifest.bytes });
      $("status").textContent = `${app || manifest.name}: ${count} declarations loaded.`;
      for (const w of warnings) $("warnings").append(el("li", { text: w }));
      $("fill").disabled = false;
    } catch (e) {
      $("fill").disabled = true;
      $("status").textContent = "No manifest loaded.";
      $("error").textContent = e.message;
    }
  }

  async function loadText(text, name = "manifest", bytes = text.length) {
    $("error").textContent = "";
    try {
      avow.checkSize(bytes);
      avow.readManifest(text); // fail fast here, before the page sees it
    } catch (e) {
      manifest = null;
      $("fill").disabled = true;
      $("status").textContent = "No manifest loaded.";
      $("error").textContent = e.message;
      return;
    }
    manifest = { text, bytes, name };
    clearResults();
    if (port) await sendManifest();
    else $("status").textContent = `${name} picked. Open a Play Console page to use it.`;
  }

  async function fill() {
    const r = await request("fill");
    $("steps").hidden = true;
    $("result").replaceChildren();
    $("legend").hidden = false;
    $("undo").disabled = !r.canUndo;
    $("summary").textContent = r.summary;
    $("error").textContent = r.found && r.note ? r.note : "";
    $("tally").textContent = r.found ? `${r.filled} filled, ${r.left} left` : "";
    for (const s of r.sections) {
      const ul = el("ul");
      for (const { text, note, ref } of s.items) {
        const li = el("li");
        if (ref !== null) {
          const jump = el("button", { class: "jump", type: "button", text });
          jump.addEventListener("click", () => request("jump", { ref }));
          li.append(jump);
        } else {
          li.textContent = text;
        }
        if (note) li.append(el("small", { text: ` ${note}` }));
        ul.append(li);
      }
      $("result").append(el("h4", { text: `${s.title} (${s.items.length})` }), ul);
    }
    return r;
  }

  // Legend swatches come from the page marks, as in the in-page panel.
  for (const [kind, label] of [["filled", " filled from your manifest "], ["left", " yours to answer "], ["unknown", " not recognised"]]) {
    const m = avow.MARKS[kind];
    const fill = m.style === "solid" ? `background: ${m.color};` : "";
    $("legend").append(el("span", { class: "swatch", style: `border: 2px ${m.style} ${m.color}; ${fill}` }), label);
  }

  $("pick").addEventListener("click", () => $("file").click());
  $("file").addEventListener("change", async () => {
    const file = $("file").files[0];
    $("file").value = "";
    if (!file) return;
    try {
      avow.checkSize(file.size);
    } catch (e) {
      $("error").textContent = e.message;
      return;
    }
    await loadText(await file.text(), file.name, file.size);
  });
  $("fill").addEventListener("click", () => fill().catch((e) => ($("error").textContent = e.message)));
  $("undo").addEventListener("click", async () => {
    try {
      const { summary } = await request("undo");
      clearResults();
      $("summary").textContent = summary;
    } catch (e) {
      $("error").textContent = e.message;
    }
  });

  // Follow the active tab: switching tabs or reloading reconnects, and the
  // manifest is sent again. None of these events need the "tabs" permission.
  async function attachActive() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) await attach(tab.id);
  }
  chrome.tabs.onActivated.addListener(({ tabId: id }) => attach(id));
  chrome.tabs.onUpdated.addListener((id, info) => {
    if (id === tabId && info.status === "complete") attach(id);
  });
  attachActive();

  // For test/e2e.js, which opens this page as a tab and points it at a
  // fixture tab itself.
  globalThis.avowSidePanel = { attach, loadText, fill };
})((globalThis.avow = globalThis.avow || {}));
