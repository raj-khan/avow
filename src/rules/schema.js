import { readFileSync } from "node:fs";
import { validate } from "../lib/schema.js";
import { result, PASS, FAIL } from "../lib/report.js";

const SCHEMA = JSON.parse(
  readFileSync(new URL("../../schema/manifest.schema.json", import.meta.url), "utf8")
);

export default {
  id: "schema",
  question: "The manifest has the shape every other rule reads",
  console_path: "n/a (the manifest itself)",
  why:
    "Every other rule reads fields by name. A misspelled key or a string where " +
    "a boolean belongs makes those rules skip or pass on nothing, so a " +
    "malformed manifest would otherwise come out green.",
  verify(m) {
    const errors = validate(SCHEMA, m);
    if (!errors.length) return result(PASS, this.id, "manifest matches the schema");
    return result(FAIL, this.id, `${errors.length} schema error(s)`, errors);
  },
};
