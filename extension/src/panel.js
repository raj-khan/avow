// The in-page panel. It lives in a shadow root so the Console's styles and
// ours cannot touch each other, and the manifest lives only in this closure.

(function (avow) {
  if (document.getElementById("avow-panel-host")) return;

  const host = document.createElement("div");
  host.id = "avow-panel-host";
  const root = host.attachShadow({ mode: "closed" });

  // Built with createElement and textContent only, so no string, from the
  // manifest or anywhere else, is ever parsed as HTML. The Console's Trusted
  // Types policy does not cover content scripts, so nothing else would catch it.
  const el = (tag, props = {}, ...children) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "text") node.textContent = v;
      else if (k === "class") node.className = v;
      else if (k in node && typeof v === "boolean") node[k] = v;
      else node.setAttribute(k, v);
    }
    node.append(...children);
    return node;
  };

  const style = el("style", { text: `
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
    h4 { margin: 10px 0 2px; font-size: 12px; text-transform: uppercase; color: #5f6368; }
    button.jump { all: unset; cursor: pointer; text-decoration: underline; }
    button.jump:focus-visible { outline: 2px solid #1a73e8; outline-offset: 2px; }
    small { color: #5f6368; }
  ` });

  root.append(
    style,
    el("div", { class: "panel" },
      el("header", {},
        el("strong", { text: "avow" }),
        el("button", { id: "pick", text: "Pick manifest" }),
        el("button", { id: "fill", text: "Fill this page", disabled: true }),
        el("button", { id: "toggle", "aria-label": "Collapse", text: "\u2013" }),
      ),
      el("div", { class: "body" },
        el("input", { id: "file", type: "file", accept: ".json,application/json", hidden: true }),
        // Live regions exist from the start and only their text changes, which
        // is what screen readers need to announce an update.
        el("div", {
          id: "status",
          role: "status",
          text: "Pick your release-manifest.json. It is read locally and forgotten when you leave the page.",
        }),
        el("div", { id: "error", class: "error", role: "alert" }),
        el("ul", { id: "warnings", class: "warn" }),
        el("p", { id: "summary", role: "status" }),
        el("div", { id: "result" }),
      ),
    ),
  );

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
    $("error").textContent = "";
    $("summary").textContent = "";
    $("result").replaceChildren();
    try {
      avow.checkSize(file.size);
      const { manifest, warnings } = avow.readManifest(await file.text());
      avow.manifest = manifest;
      const n = Object.keys(manifest.declarations).length;
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
      $("status").textContent = "No manifest loaded.";
      $("error").textContent = e.message;
    }
  });

  // Filling waits for a click: the human decides when the page is the right
  // one, and saving stays theirs too.
  $("fill").addEventListener("click", () => {
    if (!avow.manifest) return;
    const report = avow.fillPage(avow.manifest);
    const { filled, unfilled, unknown, notSeen } = avow.summarize(report);
    $("result").replaceChildren();
    if (!report.length) {
      $("summary").textContent = "No questions avow knows were found on this page.";
      return;
    }
    $("summary").textContent = `Filled ${filled.length}, left ${unfilled.length + unknown.length} for you. ` +
      "Everything outlined yellow is yours to answer. Review the page, then save in the Console.";
    section("Left for you", unfilled.map((r) => [r.question.text || r.question.form, r.reason, r.block]));
    section("Not in avow's question list", unknown.map((r) => [r.text, "", r.block]));
    section("Not seen on this page", notSeen.map((q) => [q.text || q.anchor.join(", "), "may be on the next step of this form"]));
  });

  const CONTROLS = 'input, [role="radio"], [role="checkbox"], select, textarea, button, [tabindex]';
  function goTo(block) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    block.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    // The first control that can take focus; failing that, the block itself,
    // so keyboard users still land on the question rather than staying put.
    let target = [...block.querySelectorAll(CONTROLS)].find((n) => n.tabIndex >= 0 && !n.disabled);
    if (!target) {
      if (!block.hasAttribute("tabindex")) block.setAttribute("tabindex", "-1");
      target = block;
    }
    target.focus({ preventScroll: true });
  }

  function section(title, items) {
    if (!items.length) return;
    const h = document.createElement("h4");
    h.textContent = `${title} (${items.length})`;
    const ul = document.createElement("ul");
    for (const [text, note, block] of items) {
      const li = document.createElement("li");
      if (block) {
        // A real button, so the list works from the keyboard; it moves focus
        // to the question's first control so the answer can be set at once.
        const jump = el("button", { class: "jump", type: "button", text });
        jump.addEventListener("click", () => goTo(block));
        li.append(jump);
      } else {
        li.textContent = text;
      }
      if (note) li.append(el("small", { text: ` ${note}` }));
      ul.append(li);
    }
    $("result").append(h, ul);
  }

  document.body.append(host);
})((globalThis.avow = globalThis.avow || {}));
