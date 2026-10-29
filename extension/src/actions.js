// What a surface (the in-page panel, or the side panel through the bridge)
// can ask for: load a manifest, fill, jump to a question, undo. Results are
// plain data, so they can cross a message port unchanged; DOM nodes stay
// here and are referred to by index.

(function (avow) {
  let targets = [];

  avow.load = (text, bytes = text.length) => {
    avow.checkSize(bytes);
    try {
      const { manifest, warnings } = avow.readManifest(text);
      avow.manifest = manifest;
      return { app: manifest.app?.package || "", count: Object.keys(manifest.declarations).length, warnings };
    } catch (e) {
      avow.manifest = null;
      throw e;
    }
  };

  avow.runFill = () => {
    if (!avow.manifest) throw new Error("Pick a manifest first.");
    const report = avow.fillPage(avow.manifest);
    const { filled, unfilled, unknown, notSeen } = avow.summarize(report);
    targets = [];
    const ref = (block) => (block ? targets.push(block) - 1 : null);
    const left = unfilled.length + unknown.length;
    const note = avow.languageNote(document.documentElement.lang);
    return {
      found: report.length,
      filled: filled.length,
      left,
      note,
      canUndo: avow.canUndo(),
      summary: report.length
        ? `Filled ${filled.length}, left ${left} for you. Everything outlined orange is yours to answer. ` +
          "Review the page, then save in the Console."
        : note || "No questions avow knows were found on this page.",
      sections: [
        { title: "Left for you", items: unfilled.map((r) => ({ text: r.question.text || r.question.form, note: r.reason, ref: ref(r.block) })) },
        { title: "Not in avow's question list", items: unknown.map((r) => ({ text: r.text, note: "", ref: ref(r.block) })) },
        { title: "Not seen on this page", items: notSeen.map((q) => ({ text: q.text || q.anchor.join(", "), note: "may be on the next step of this form", ref: null })) },
      ].filter((s) => s.items.length),
    };
  };

  const CONTROLS = 'input, [role="radio"], [role="checkbox"], select, textarea, button, [tabindex]';
  avow.jump = (index) => {
    const block = targets[index];
    if (!block?.isConnected) return false;
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
    return true;
  };

  avow.undo = () => {
    const { restored, failed } = avow.undoFill();
    targets = [];
    return {
      restored,
      failed,
      summary: `Undid ${restored} change${restored === 1 ? "" : "s"}.` +
        (failed ? ` ${failed} could not be put back by clicking (a radio question that had no answer before, ` +
          "or a control that ignored the click); check those yourself." : ""),
    };
  };

  // Play Console changes screens without reloading, so marks and results
  // from the last screen would describe questions that are gone. The
  // Navigation API reports those in-app moves; where it is missing nothing
  // listens, rather than watching the whole page with an observer.
  const pageListeners = [];
  avow.onPageChange = (fn) => pageListeners.push(fn);
  globalThis.navigation?.addEventListener?.("currententrychange", () => {
    avow.clearMarks();
    targets = [];
    for (const fn of pageListeners) fn();
  });
})((globalThis.avow = globalThis.avow || {}));
