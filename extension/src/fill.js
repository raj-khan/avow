// Finds yes/no questions on the current Console page and ticks the answer the
// manifest gives. It clicks radio options and nothing else: never Save, never
// Submit. The human reads the highlighted page and saves it themselves.

(function (avow) {
  // --- Pure: no DOM, takes accessors so tests can pass plain objects. ---

  // Walk up from a radio group to the smallest ancestor whose text contains
  // exactly one known question. Two questions in one ancestor means we have
  // climbed past the block, so the match is ambiguous and nothing is filled.
  avow.locate = (start, { parent, text }) => {
    for (let node = start; node; node = parent(node)) {
      const t = avow.normalize(text(node));
      const hits = avow.QUESTIONS.filter((q) => t.includes(avow.normalize(q.text)));
      if (hits.length === 1) return { question: hits[0], block: node };
      if (hits.length > 1) return null;
    }
    return null;
  };

  // The option whose label is the answer. Labels can carry a description
  // after the word ("No  Your app does not..."), so the first word decides.
  avow.pickOption = (options, label) => {
    const want = avow.normalize(label);
    return options.find((o) => {
      const l = avow.normalize(o.label);
      return l === want || l.startsWith(`${want} `);
    }) || null;
  };

  // --- DOM ---

  const RADIOS = 'input[type="radio"], [role="radio"]';

  function labelOf(el) {
    if (el.getAttribute("aria-label")) return el.getAttribute("aria-label");
    const ids = el.getAttribute("aria-labelledby");
    if (ids) {
      return ids.split(/\s+/).map((id) => document.getElementById(id)?.textContent || "").join(" ");
    }
    if (el.labels?.length) return el.labels[0].textContent;
    const wrap = el.closest("label");
    if (wrap) return wrap.textContent;
    return el.textContent;
  }

  function groups() {
    const out = new Map();
    for (const el of document.querySelectorAll(RADIOS)) {
      if (el.closest("#avow-panel-host")) continue;
      const box = el.closest('[role="radiogroup"]') ||
        (el.name ? `name:${el.name}` : el.parentElement?.parentElement || el.parentElement);
      if (!out.has(box)) out.set(box, []);
      out.get(box).push({ node: el, label: labelOf(el) });
    }
    return [...out.entries()].map(([box, options]) => ({
      container: typeof box === "string" ? commonAncestor(options.map((o) => o.node)) : box,
      options,
    }));
  }

  function commonAncestor(nodes) {
    let a = nodes[0].parentElement;
    while (a && !nodes.every((n) => a.contains(n))) a = a.parentElement;
    return a || document.body;
  }

  const isChecked = (el) => el.checked === true || el.getAttribute("aria-checked") === "true";

  const marked = new Set();
  function mark(block, color, title) {
    block.style.outline = `3px solid ${color}`;
    block.style.outlineOffset = "4px";
    if (title) block.title = `avow: ${title}`;
    marked.add(block);
  }

  avow.clearMarks = () => {
    for (const b of marked) {
      b.style.outline = "";
      b.style.outlineOffset = "";
      if (b.title.startsWith("avow: ")) b.title = "";
    }
    marked.clear();
  };

  // Returns what happened to every radio group on the page, for the panel.
  avow.fillPage = (manifest) => {
    avow.clearMarks();
    const report = [];
    for (const { container, options } of groups()) {
      const found = avow.locate(container, { parent: (n) => n.parentElement, text: (n) => n.textContent });
      if (!found) {
        report.push({ status: "unknown", block: container, text: container.textContent.trim().slice(0, 120) });
        continue;
      }
      const { question, block } = found;
      const answer = avow.answerFor(manifest, question);
      if (!answer.label) {
        mark(block, "#f9ab00", answer.reason);
        report.push({ status: "unfilled", question, reason: answer.reason });
        continue;
      }
      const option = avow.pickOption(options, answer.label);
      if (!option) {
        const reason = `no "${answer.label}" option found next to this question`;
        mark(block, "#f9ab00", reason);
        report.push({ status: "unfilled", question, reason });
        continue;
      }
      if (!isChecked(option.node)) option.node.click();
      mark(block, "#1e8e3e", `filled "${answer.label}" from declarations.${question.form}`);
      report.push({ status: "filled", question, label: answer.label });
    }
    return report;
  };
})((globalThis.avow = globalThis.avow || {}));
