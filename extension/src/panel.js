// The in-page panel. It lives in a shadow root so the Console's styles and
// ours cannot touch each other, and the manifest lives only in this closure.

(function (avow) {
  if (document.getElementById("avow-panel-host")) return;

  const host = document.createElement("div");
  host.id = "avow-panel-host";
  const root = host.attachShadow({ mode: "closed" });
  root.innerHTML = `
    <style>
      .panel { position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; width: 320px;
        max-height: 60vh; overflow: auto; font: 13px/1.4 system-ui, sans-serif; color: #202124;
        background: #fff; border: 1px solid #dadce0; border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, .2); }
      header { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid #dadce0; }
      header strong { flex: 1; }
      .body { padding: 8px 12px; }
      .collapsed .body { display: none; }
      button { font: inherit; cursor: pointer; }
      .warn { color: #b06000; }
      .error { color: #c5221f; }
      ul { margin: 4px 0; padding-left: 18px; }
    </style>
    <div class="panel">
      <header>
        <strong>avow</strong>
        <button id="pick">Pick manifest</button>
        <button id="fill" disabled>Fill this page</button>
        <button id="toggle" aria-label="Collapse">–</button>
      </header>
      <div class="body">
        <input id="file" type="file" accept=".json,application/json" hidden>
        <div id="status">Pick your release-manifest.json. It is read locally and forgotten when you leave the page.</div>
        <ul id="warnings" class="warn"></ul>
        <div id="result"></div>
      </div>
    </div>`;

  const $ = (id) => root.getElementById(id);
  const panel = root.querySelector(".panel");
  avow.ui = { root, $ };

  $("toggle").addEventListener("click", () => panel.classList.toggle("collapsed"));
  $("pick").addEventListener("click", () => $("file").click());
  $("file").addEventListener("change", async () => {
    const file = $("file").files[0];
    $("file").value = "";
    if (!file) return;
    $("warnings").replaceChildren();
    try {
      const { manifest, warnings } = avow.readManifest(await file.text());
      avow.manifest = manifest;
      const n = Object.keys(manifest.declarations).length;
      $("status").className = "";
      $("status").textContent = `${manifest.app?.package || file.name}: ${n} declarations loaded.`;
      for (const w of warnings) {
        const li = document.createElement("li");
        li.textContent = w;
        $("warnings").append(li);
      }
      $("fill").disabled = false;
    } catch (e) {
      avow.manifest = null;
      $("fill").disabled = true;
      $("status").className = "error";
      $("status").textContent = e.message;
    }
  });

  // Filling waits for a click: the human decides when the page is the right
  // one, and saving stays theirs too.
  $("fill").addEventListener("click", () => {
    if (!avow.manifest) return;
    const report = avow.fillPage(avow.manifest);
    const n = (s) => report.filter((r) => r.status === s).length;
    $("result").textContent = report.length
      ? `Filled ${n("filled")}, left ${n("unfilled")} for you (yellow). Review, then save in the Console.`
      : "No yes/no questions found on this page.";
    avow.lastReport = report;
  });

  document.body.append(host);
})((globalThis.avow = globalThis.avow || {}));
