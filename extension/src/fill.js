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
      const hits = avow.QUESTIONS.filter((q) => avow.shows(q, t));
      if (hits.length === 1) return { question: hits[0], block: node };
      if (hits.length > 1) return null;
    }
    return null;
  };

  // Which data type a per-type screen is about: walking up from the
  // question, the first ancestor whose headings name exactly one data type.
  // Headings only, and whole-text matches, because "Name" and "Photos" also
  // turn up inside help text.
  avow.dataTypeFor = (start, { parent, headings }) => {
    const labels = new Map(avow.DATA_TYPES.map((t) => [avow.normalize(t), t]));
    for (let node = start; node; node = parent(node)) {
      const named = new Set(headings(node).map(avow.normalize).filter((h) => labels.has(h)));
      if (named.size === 1) return labels.get([...named][0]);
      if (named.size > 1) return null;
    }
    return null;
  };

  // The option whose label is the answer. Labels can carry a description
  // after the answer ("No  Your app does not..."), so the answer must be the
  // whole label or its leading words.
  avow.pickOption = (options, label) => {
    const want = avow.normalize(label);
    return options.find((o) => {
      const l = avow.normalize(o.label);
      return l === want || l.startsWith(`${want} `);
    }) || null;
  };

  // For a checkbox question: each on-screen option that is one of the
  // question's own, and whether it should end up ticked. Labels must match
  // exactly, because "Photos" must not tick "Photos and videos".
  avow.planChecks = (options, question, labels) => {
    const own = new Set(question.options.map(avow.normalize));
    const want = new Set(labels.map(avow.normalize));
    return options
      .filter((o) => own.has(avow.normalize(o.label)))
      .map((o) => ({ option: o, want: want.has(avow.normalize(o.label)) }));
  };

  // What the panel lists after a fill. notSeen covers questions from a form
  // that is on screen but whose question is not: the Console splits Data
  // safety across steps, so these are for the next screen, not errors.
  avow.summarize = (report) => {
    const onScreen = new Set(report.filter((r) => r.question).map((r) => r.question));
    const forms = new Set([...onScreen].map((q) => q.form));
    const perTypeShown = [...onScreen].some((q) => q.perType);
    return {
      filled: report.filter((r) => r.status === "filled"),
      unfilled: report.filter((r) => r.status === "unfilled"),
      unknown: report.filter((r) => r.status === "unknown"),
      // Per-type questions only count as missing on a per-type screen.
      notSeen: avow.QUESTIONS.filter((q) => forms.has(q.form) && !onScreen.has(q) && (!q.perType || perTypeShown)),
    };
  };

  // --- DOM ---

  const RADIOS = 'input[type="radio"], [role="radio"]';
  const CHECKBOXES = 'input[type="checkbox"], [role="checkbox"]';
  const up = { parent: (n) => n.parentElement, text: (n) => n.textContent };
  const HEADINGS = 'h1, h2, h3, h4, h5, h6, [role="heading"], legend';
  const titled = {
    parent: (n) => n.parentElement,
    headings: (n) => {
      const out = [...n.querySelectorAll(HEADINGS)].map((h) => h.textContent);
      if (n.matches(HEADINGS)) out.push(n.textContent);
      if (n.matches('[role="dialog"]') && n.getAttribute("aria-label")) out.push(n.getAttribute("aria-label"));
      return out;
    },
  };
  const contextFor = (question, block) =>
    question.perType ? { dataType: avow.dataTypeFor(block, titled) } : {};

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
  function mark(block, color, title, style = "solid") {
    block.style.outline = `3px ${style} ${color}`;
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

  // Checkboxes that belong to no known checkbox question are left alone and
  // unreported: consent boxes and filters are everywhere in the Console.
  function fillCheckboxes(manifest) {
    const blocks = new Map();
    for (const el of document.querySelectorAll(CHECKBOXES)) {
      if (el.closest("#avow-panel-host")) continue;
      const found = avow.locate(el.parentElement, up);
      if (!found || found.question.kind !== "checkboxes") continue;
      if (!blocks.has(found.block)) blocks.set(found.block, { question: found.question, options: [] });
      blocks.get(found.block).options.push({ node: el, label: labelOf(el) });
    }
    const report = [];
    for (const [block, { question, options }] of blocks) {
      const answer = avow.answerFor(manifest, question, contextFor(question, block));
      if (!answer.labels) {
        mark(block, "#f9ab00", answer.reason);
        report.push({ status: "unfilled", question, block, reason: answer.reason });
        continue;
      }
      const plan = avow.planChecks(options, question, answer.labels);
      const seen = new Set(plan.map((p) => avow.normalize(p.option.label)));
      const missing = answer.labels.filter((l) => !seen.has(avow.normalize(l)));
      for (const { option, want } of plan) if (isChecked(option.node) !== want) option.node.click();
      if (missing.length) {
        const reason = `ticked what was found; no checkbox for ${missing.map((l) => `"${l}"`).join(", ")}`;
        mark(block, "#f9ab00", reason);
        report.push({ status: "unfilled", question, block, reason });
        continue;
      }
      const label = answer.labels.join(", ") || "none";
      mark(block, "#1e8e3e", `ticked ${label} from declarations.${question.form}`);
      report.push({ status: "filled", question, block, label });
    }
    return report;
  }

  // Returns what happened to every question on the page, for the panel.
  avow.fillPage = (manifest) => {
    avow.clearMarks();
    const report = [];
    for (const { container, options } of groups()) {
      const found = avow.locate(container, up);
      if (!found || found.question.kind === "checkboxes") {
        const text = container.textContent.replace(/\s+/g, " ").trim().slice(0, 120);
        mark(container, "#f9ab00", "question not in avow's list; answer it yourself", "dashed");
        report.push({ status: "unknown", block: container, text });
        continue;
      }
      const { question, block } = found;
      const answer = avow.answerFor(manifest, question, contextFor(question, block));
      if (!answer.label) {
        mark(block, "#f9ab00", answer.reason);
        report.push({ status: "unfilled", question, block, reason: answer.reason });
        continue;
      }
      const option = avow.pickOption(options, answer.label);
      if (!option) {
        const reason = `no "${answer.label}" option found next to this question`;
        mark(block, "#f9ab00", reason);
        report.push({ status: "unfilled", question, block, reason });
        continue;
      }
      if (!isChecked(option.node)) option.node.click();
      mark(block, "#1e8e3e", `filled "${answer.label}" from declarations.${question.form}`);
      report.push({ status: "filled", question, block, label: answer.label });
    }
    report.push(...fillCheckboxes(manifest));
    return report;
  };
})((globalThis.avow = globalThis.avow || {}));
