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

  // Colours are tokens so dark mode and forced-colors only swap values. The
  // accent is avow's own indigo, from the icon, so the panel never passes
  // for part of the Console.
  const style = el("style", { text: `
    .panel {
      --bg: #fff; --fg: #1f1f24; --muted: #5f6368; --line: #dadce0;
      --accent: #3b2f8f; --on-accent: #fff; --focus: #3b2f8f;
      --warn: #a04b00; --error: #b3261e;
      position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; width: 340px;
      max-height: 60vh; overflow: auto; font: 13px/1.45 system-ui, sans-serif; color: var(--fg);
      background: var(--bg); border: 1px solid var(--line); border-radius: 10px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, .18); color-scheme: light dark;
    }
    @media (prefers-color-scheme: dark) {
      .panel {
        --bg: #232329; --fg: #ececf1; --muted: #a8a8b3; --line: #3d3d46;
        --accent: #a99cf5; --on-accent: #17132e; --focus: #a99cf5;
        --warn: #f5b26b; --error: #f2b8b5;
        box-shadow: 0 4px 16px rgba(0, 0, 0, .5);
      }
    }
    /* Windows high contrast drops shadows and repaints colours; a solid
       border in the system text colour keeps the panel's edge. */
    @media (forced-colors: active) {
      .panel { box-shadow: none; border: 2px solid CanvasText; }
      button { border: 1px solid ButtonText; }
    }
    header { display: flex; align-items: center; gap: 6px; padding: 8px 10px; border-bottom: 1px solid var(--line); }
    header strong { color: var(--accent); letter-spacing: .02em; }
    #tally { flex: 1; color: var(--muted); font-size: 12px; white-space: nowrap; }
    .body { padding: 8px 12px 10px; }
    .collapsed .body { display: none; }
    /* Collapsed is a pill: just the name, the tally and the toggle, small
       enough to leave the Console's Save bar clear. */
    .collapsed { width: auto; border-radius: 999px; }
    .collapsed header { border-bottom: 0; padding: 4px 6px 4px 12px; }
    .collapsed #dock { display: none; }
    .actions { display: flex; gap: 8px; margin-bottom: 8px; }
    .actions button { flex: 1; padding: 6px 8px; }
    .top { top: 16px; bottom: auto; }
    button {
      font: inherit; font-size: 12px; white-space: nowrap; cursor: pointer; color: var(--fg);
      background: transparent; border: 1px solid var(--line); border-radius: 6px; padding: 3px 8px;
    }
    button:hover:not(:disabled) { border-color: var(--accent); }
    button:disabled { cursor: default; opacity: .5; }
    button:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
    #fill { background: var(--accent); color: var(--on-accent); border-color: var(--accent); font-weight: 600; }
    #dock, #toggle { padding: 3px 7px; }
    .warn { color: var(--warn); }
    .error { color: var(--error); }
    .error:empty, #summary:empty { display: none; }
    #summary { margin: 8px 0 4px; font-weight: 600; }
    ul { margin: 4px 0; padding-left: 18px; }
    h4 { margin: 10px 0 2px; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
    button.jump { all: unset; cursor: pointer; text-decoration: underline; }
    button.jump:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
    small { color: var(--muted); }
  ` });

  root.append(
    style,
    el("div", { class: "panel" },
      el("header", {},
        el("strong", { text: "avow" }),
        el("span", { id: "tally" }),
        el("button", {
          id: "dock", type: "button", "aria-label": "Move avow panel to the top", text: "\u2191",
        }),
        el("button", {
          id: "toggle", type: "button", "aria-label": "Collapse avow panel",
          "aria-expanded": "true", "aria-controls": "body", text: "\u2013",
        }),
      ),
      el("div", { class: "body", id: "body" },
        el("div", { class: "actions" },
          el("button", { id: "pick", type: "button", text: "Pick manifest" }),
          el("button", { id: "fill", type: "button", text: "Fill this page", disabled: true }),
        ),
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

  // Collapsed is the panel's way out of the Console's road: Esc from anywhere
  // inside it gets the Save bar and the form back (WCAG 2.4.11).
  avow.setCollapsed = (collapsed) => {
    panel.classList.toggle("collapsed", collapsed);
    $("toggle").setAttribute("aria-expanded", String(!collapsed));
    $("toggle").setAttribute("aria-label", `${collapsed ? "Expand" : "Collapse"} avow panel`);
    $("toggle").textContent = collapsed ? "+" : "\u2013";
  };
  $("toggle").addEventListener("click", () => avow.setCollapsed(!panel.classList.contains("collapsed")));
  // Docking is held in memory only, like everything else here; the panel
  // starts at the bottom on every page load.
  $("dock").addEventListener("click", () => {
    const top = panel.classList.toggle("top");
    $("dock").textContent = top ? "\u2193" : "\u2191";
    $("dock").setAttribute("aria-label", `Move avow panel to the ${top ? "bottom" : "top"}`);
  });
  panel.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || panel.classList.contains("collapsed")) return;
    e.stopPropagation();
    avow.setCollapsed(true);
    $("toggle").focus();
  });
  $("pick").addEventListener("click", () => $("file").click());
  $("file").addEventListener("change", async () => {
    const file = $("file").files[0];
    $("file").value = "";
    if (!file) return;
    $("warnings").replaceChildren();
    $("error").textContent = "";
    $("summary").textContent = "";
    $("tally").textContent = "";
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
    const note = avow.languageNote(document.documentElement.lang);
    if (!report.length) {
      $("summary").textContent = note || "No questions avow knows were found on this page.";
      return;
    }
    if (note) $("error").textContent = note;
    const left = unfilled.length + unknown.length;
    $("tally").textContent = `${filled.length} filled, ${left} left`;
    // Nothing left to do: get out of the way so the Save bar is free.
    if (!left) avow.setCollapsed(true);
    $("summary").textContent = `Filled ${filled.length}, left ${left} for you. ` +
      "Everything outlined orange is yours to answer. Review the page, then save in the Console.";
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
