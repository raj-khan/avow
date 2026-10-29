import { result, PASS, WARN, SKIP } from "../lib/report.js";

export default {
  id: "content-rating",
  question: "Content rating answers, reasons and issued rating are recorded",
  console_path: "App content > Content ratings",
  why:
    "The IARC questionnaire is long and almost none of it is checkable from " +
    "code, so this rule checks the record instead: each answer has a reason, " +
    "and the ratings IARC issued are written down with a date. When a store " +
    "or regulator asks why the app is rated Everyone, that record is the answer.",
  verify(m) {
    const cr = m.declarations?.content_rating;
    if (!cr) return result(SKIP, this.id, "not declared in the manifest");
    if (cr.source !== "answered") {
      return result(SKIP, this.id, `source is ${cr.source ?? "missing"}; nothing entered in the Console to record yet`);
    }
    const answers = Object.keys(cr.answers ?? {});
    const notes = cr.answer_notes ?? {};
    const problems = answers.filter((k) => !notes[k]).map((k) => `answers.${k}: no entry in answer_notes`);
    // An expected rating is a guess made before submitting; the issued one
    // comes back from IARC and can differ per region.
    if (!cr.result) {
      problems.push(
        cr.expected_rating
          ? `result: not recorded (only expected_rating "${cr.expected_rating}")`
          : "result: the rating IARC issued is not recorded"
      );
    }
    if (!cr.answered_on) problems.push("answered_on: the questionnaire is not dated");

    if (problems.length) return result(WARN, this.id, `${problems.length} gap(s) in the record`, problems);
    return result(PASS, this.id, `${answers.length} answers explained, rating "${cr.result}" recorded`);
  },
};
