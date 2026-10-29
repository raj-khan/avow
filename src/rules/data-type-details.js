import { PURPOSES } from "../lib/play.js";
import { result, PASS, FAIL, WARN, SKIP } from "../lib/report.js";

const KNOWN = new Map(PURPOSES.map((p) => [p.toLowerCase(), p]));

function purposes(type, field, list, problems) {
  if (!Array.isArray(list) || !list.length) {
    problems.push(`${type}: ${field} is empty; the Console asks for at least one purpose`);
    return;
  }
  for (const p of list) {
    const known = KNOWN.get(String(p).toLowerCase());
    if (!known) problems.push(`${type}: ${field} "${p}" is not a Play purpose`);
    else if (known !== p) problems.push(`${type}: ${field} "${p}", Play spells it "${known}"`);
  }
}

export default {
  id: "data-type-details",
  question: "Each declared data type has its collected, shared and purpose answers",
  console_path: "App content > Data safety > Data usage and handling",
  why:
    "After the data types, the Console asks the same questions for every type: " +
    "collected or shared, processed ephemerally, required or optional, and " +
    "why. These are the answers users see on the listing, and they are the " +
    "ones most often filled in from memory and left inconsistent with the " +
    "top-level collect and share answers.",
  verify(m) {
    const ds = m.declarations?.data_safety;
    const types = Array.isArray(ds?.data_types) ? ds.data_types : [];
    if (!types.length) return result(SKIP, this.id, "no data types declared");
    const details = ds.data_type_details ?? {};
    const problems = [];
    const missing = types.filter((t) => !details[t]);

    for (const type of Object.keys(details)) {
      if (!types.includes(type)) problems.push(`${type}: has details but is not in data_types`);
    }
    for (const type of types) {
      const d = details[type];
      if (!d) continue;
      if (!d.collected && !d.shared) problems.push(`${type}: neither collected nor shared`);
      if (d.collected && !ds.collects_user_data) {
        problems.push(`${type}: collected, but data_safety.collects_user_data is not true`);
      }
      if (d.shared && !ds.shares_user_data) {
        problems.push(`${type}: shared, but data_safety.shares_user_data is not true`);
      }
      if (d.collected) {
        if (typeof d.required !== "boolean") problems.push(`${type}: required must be true or false`);
        if (typeof d.ephemeral !== "boolean") problems.push(`${type}: ephemeral must be true or false`);
        purposes(type, "collection_purposes", d.collection_purposes, problems);
      }
      if (d.shared) purposes(type, "sharing_purposes", d.sharing_purposes, problems);
    }

    // Missing details are an incomplete record, not a form Play rejects: the
    // answers exist in the Console, the manifest just does not hold them.
    const gaps = missing.map((t) => `${t}: no entry in data_type_details`);
    if (problems.length) return result(FAIL, this.id, `${problems.length} data type detail problem(s)`, [...problems, ...gaps]);
    if (gaps.length) return result(WARN, this.id, `${gaps.length} of ${types.length} data type(s) without details`, gaps);
    return result(PASS, this.id, `all ${types.length} data type(s) have consistent details`);
  },
};
