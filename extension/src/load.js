// Parsing and checking the manifest the user picked. No DOM here, so the
// same file runs under Node in test/extension.js.
//
// The extension holds no state between page loads on purpose: the manifest
// is re-picked every session, so there is never a cached copy to go stale or
// to leak.

(function (avow) {
  // The manifest schema version this extension understands. A newer manifest
  // may carry fields it would silently ignore, which reads as "filled
  // everything" when it did not.
  avow.SCHEMA_VERSION = 1;

  // A real manifest is a few kilobytes. Anything past this is the wrong file,
  // and refusing it before reading keeps a huge pick from freezing the tab.
  avow.MAX_MANIFEST_BYTES = 1024 * 1024;

  avow.checkSize = function (bytes) {
    if (bytes > avow.MAX_MANIFEST_BYTES) {
      throw new Error(
        `That file is ${(bytes / 1024 / 1024).toFixed(1)} MB; an avow manifest is at most 1 MB. Pick store/release-manifest.json.`
      );
    }
  };

  avow.readManifest = function (text) {
    let manifest;
    try {
      manifest = JSON.parse(text);
    } catch (e) {
      throw new Error(`Not valid JSON: ${e.message}`);
    }
    if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
      throw new Error("Not an avow manifest: expected a JSON object");
    }
    if (!manifest.declarations || typeof manifest.declarations !== "object") {
      throw new Error("Not an avow manifest: no declarations");
    }
    const warnings = [];
    if (manifest.schema !== avow.SCHEMA_VERSION) {
      warnings.push(
        `Manifest schema ${manifest.schema ?? "missing"}, this extension understands ${avow.SCHEMA_VERSION}. ` +
        "Answers it does not recognise will be left unfilled."
      );
    }
    if (typeof manifest.extends === "string") {
      warnings.push(
        `This manifest extends ${manifest.extends}, which the extension cannot read, ` +
        "so answers that live only in the baseline will be left unfilled."
      );
    }
    return { manifest, warnings };
  };
})((globalThis.avow = globalThis.avow || {}));
