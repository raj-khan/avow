// Console question wording, mapped to manifest answers. Matching is on the
// question text because Google reshuffles the Console's DOM constantly but
// rarely rewrites the legal wording.
//
// Drafted from Play's help pages, not yet confirmed against the live Console.
// Like FORMS in the CLI, record the date here once a real submission confirms
// the wording, and fix any question that does not match.

(function (avow) {
  avow.QUESTIONS_OBSERVED = null;

  const yesNo = (v) => (v === true ? "Yes" : v === false ? "No" : null);

  avow.QUESTIONS = [
    {
      form: "advertising_id",
      text: "Does your app use advertising ID?",
      answer: (d) => yesNo(d.uses_advertising_id),
    },
    {
      form: "ads",
      text: "Does your app contain ads?",
      answer: (d) => yesNo(d.contains_ads),
    },
    {
      form: "data_safety",
      text: "Does your app collect or share any of the required user data types?",
      answer: (d) =>
        d.collects_user_data === undefined && d.shares_user_data === undefined
          ? null
          : yesNo(Boolean(d.collects_user_data || d.shares_user_data)),
    },
    {
      form: "data_safety",
      text: "Is all of the user data collected by your app encrypted in transit?",
      answer: (d) => yesNo(d.encrypted_in_transit),
    },
    {
      form: "data_safety",
      text: "Do you provide a way for users to request that their data is deleted?",
      answer: (d) => yesNo(d.deletion_request_mechanism),
    },
    {
      form: "news_app",
      text: "Is your app a news app?",
      answer: (d) => yesNo(d.is_news_app),
    },
    {
      form: "government_app",
      text: "Is your app developed by or on behalf of a government?",
      answer: (d) => yesNo(d.is_government_app),
    },
  ];

  // Case, punctuation, curly quotes and spacing vary between Console
  // releases and translations of the same sentence; the words do not.
  avow.normalize = (s) =>
    String(s)
      .toLowerCase()
      .replace(/[‘’]/g, "'")
      .replace(/[^\p{L}\p{N}' ]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim();

  // The question whose wording appears in this text, or null. Console labels
  // often carry help text after the question, so containment, not equality.
  avow.matchQuestion = (text) => {
    const t = avow.normalize(text);
    return avow.QUESTIONS.find((q) => t.includes(avow.normalize(q.text))) || null;
  };

  // The option label to select, or a reason it cannot be filled. Only
  // answered and planned declarations fill: inherited ones were answered for
  // another app, and unanswered ones have no answer.
  avow.answerFor = (manifest, question) => {
    const d = manifest.declarations?.[question.form];
    if (!d) return { reason: `declarations.${question.form} is not in the manifest` };
    if (d.source !== "answered" && d.source !== "planned") {
      return { reason: `declarations.${question.form} is ${d.source || "missing a source"}` };
    }
    const label = question.answer(d);
    if (!label) return { reason: `declarations.${question.form} has no yes/no answer for this question` };
    return { label };
  };
})((globalThis.avow = globalThis.avow || {}));
