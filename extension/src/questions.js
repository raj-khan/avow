// Console question wording, mapped to manifest answers. Matching is on the
// question text because Google reshuffles the Console's DOM constantly but
// rarely rewrites the legal wording.
//
// Drafted from Play's help pages, not yet confirmed against the live Console.
// Like FORMS in the CLI, record the date here once a real submission confirms
// the wording, and fix any question that does not match.

(function (avow) {
  avow.QUESTIONS_OBSERVED = null;

  // Play's data type labels. src/lib/play.js holds the CLI's copy and a test
  // keeps the two identical.
  avow.DATA_TYPES = [
    "Approximate location", "Precise location",
    "Name", "Email address", "User IDs", "Address", "Phone number", "Race and ethnicity",
    "Political or religious beliefs", "Sexual orientation", "Other info",
    "User payment info", "Purchase history", "Credit score", "Other financial info",
    "Health info", "Fitness info",
    "Emails", "SMS or MMS", "Other in-app messages",
    "Photos", "Videos",
    "Voice or sound recordings", "Music files", "Other audio files",
    "Files and docs", "Calendar events", "Contacts",
    "App interactions", "In-app search history", "Installed apps", "Other user-generated content", "Other actions",
    "Web browsing history",
    "Crash logs", "Diagnostics", "Other app performance data",
    "Device or other IDs",
  ];

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
      // No question sentence to anchor on reliably, so the option text is the
      // anchor; the answer is the full option label rather than Yes or No.
      form: "app_access",
      text: "All functionality in my app is available without any access restrictions",
      answer: (d) =>
        d.restricted === false
          ? "All functionality in my app is available without any access restrictions"
          : d.restricted === true
            ? "All or some functionality in my app is restricted"
            : null,
    },
    {
      // The data types step. Category headings (Location, Personal info...)
      // are not options, so they are never ticked or unticked.
      form: "data_safety",
      kind: "checkboxes",
      anchor: ["Approximate location", "Crash logs"],
      options: avow.DATA_TYPES,
      answer: (d) => (Array.isArray(d.data_types) ? d.data_types : null),
    },
    {
      // Checkbox questions name every option so the extension can untick
      // the ones the manifest excludes, and touches no checkbox outside them.
      // The anchor is a set of option labels that only this screen shows.
      form: "target_audience",
      kind: "checkboxes",
      anchor: ["5 and under", "18 and over"],
      options: ["5 and under", "6-8", "9-12", "13-15", "16-17", "18 and over"],
      answer: (d) => (Array.isArray(d.age_groups) ? d.age_groups : null),
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

  // Whether normalized text shows this question: its sentence, or every one
  // of its anchor labels. Console labels often carry help text after the
  // question, so containment, not equality.
  avow.shows = (q, t) =>
    q.text ? t.includes(avow.normalize(q.text)) : q.anchor.every((a) => t.includes(avow.normalize(a)));

  avow.matchQuestion = (text) => {
    const t = avow.normalize(text);
    return avow.QUESTIONS.find((q) => avow.shows(q, t)) || null;
  };

  // The option label to select, or a reason it cannot be filled. Only
  // answered and planned declarations fill: inherited ones were answered for
  // another app, and unanswered ones have no answer.
  // Per-type questions (perType: true) are asked once for every data type, so
  // their answer comes from data_type_details for the type on screen, which
  // the caller works out and passes as context.dataType.
  avow.answerFor = (manifest, question, context = {}) => {
    const d = manifest.declarations?.[question.form];
    if (!d) return { reason: `declarations.${question.form} is not in the manifest` };
    if (d.source !== "answered" && d.source !== "planned") {
      return { reason: `declarations.${question.form} is ${d.source || "missing a source"}` };
    }
    let subject = d;
    if (question.perType) {
      const type = context.dataType;
      if (!type) return { reason: "could not tell which data type this screen is for" };
      subject = d.data_type_details?.[type];
      if (!subject) return { reason: `no data_type_details entry for "${type}"` };
    }
    const value = question.answer(subject);
    if (!value) return { reason: `declarations.${question.form} has no answer for this question` };
    if (question.kind !== "checkboxes") return { label: value };
    const known = new Set(question.options.map(avow.normalize));
    const strange = value.filter((v) => !known.has(avow.normalize(v)));
    if (strange.length) {
      return { reason: `declarations.${question.form} lists ${strange.map((v) => `"${v}"`).join(", ")}, not an option on this screen` };
    }
    return { labels: value };
  };
})((globalThis.avow = globalThis.avow || {}));
