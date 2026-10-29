import { DATA_TYPES } from "../lib/play.js";
import { result, PASS, FAIL, SKIP } from "../lib/report.js";

const KNOWN = new Map(DATA_TYPES.map((t) => [t.toLowerCase(), t]));

export default {
  id: "data-types",
  question: "Data safety data types are ones Play lists, and agree with the answer",
  console_path: "App content > Data safety > Data types",
  why:
    "The data types step is a fixed list, and the manifest has to name entries " +
    "on it: a type spelled your own way cannot be entered as written, so the " +
    "form gets filled from memory instead. Declaring collection with no types, " +
    "or types with no collection, is a form the Console will not accept.",
  verify(m) {
    const ds = m.declarations?.data_safety;
    if (!ds || !Array.isArray(ds.data_types)) return result(SKIP, this.id, "no data_safety.data_types in the manifest");
    const problems = [];
    for (const t of ds.data_types) {
      const known = KNOWN.get(String(t).toLowerCase());
      if (!known) problems.push(`"${t}": not a Play data type`);
      else if (known !== t) problems.push(`"${t}": Play spells it "${known}"`);
    }
    const declares = Boolean(ds.collects_user_data || ds.shares_user_data);
    if (declares && !ds.data_types.length) {
      problems.push("declares collection or sharing, but lists no data types");
    }
    if (!declares && ds.data_types.length) {
      problems.push(`declares no collection or sharing, but lists ${ds.data_types.length} data type(s)`);
    }
    if (problems.length) return result(FAIL, this.id, `${problems.length} data type problem(s)`, problems);
    return result(
      PASS,
      this.id,
      ds.data_types.length ? `${ds.data_types.length} data type(s), all on Play's list` : "no data types, consistent with no collection"
    );
  },
};
