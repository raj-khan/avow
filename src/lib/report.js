export const PASS = "pass", FAIL = "fail", WARN = "warn", SKIP = "skip";

export function result(status, rule, message, detail) {
  return { status, rule, message, detail };
}

const MARK = { pass: "✓", fail: "✗", warn: "!", skip: "·" };
const COLOR = { pass: "\x1b[32m", fail: "\x1b[31m", warn: "\x1b[33m", skip: "\x1b[90m" };

export function print(results, { color = true } = {}) {
  const c = (s, t) => (color ? `${COLOR[s]}${t}\x1b[0m` : t);
  for (const r of results) {
    console.log(`${c(r.status, MARK[r.status])} ${r.rule.padEnd(22)} ${r.message}`);
    if (r.detail) for (const line of [].concat(r.detail)) console.log(`  ${c("skip", line)}`);
  }
  const n = (s) => results.filter((r) => r.status === s).length;
  const parts = [`${n(PASS)} passed`];
  if (n(FAIL)) parts.push(c(FAIL, `${n(FAIL)} failed`));
  if (n(WARN)) parts.push(c(WARN, `${n(WARN)} warned`));
  if (n(SKIP)) parts.push(`${n(SKIP)} skipped`);
  console.log(`\n${parts.join(", ")}`);
  return n(FAIL) === 0;
}

// GitHub Actions workflow commands, so failures annotate the manifest in the
// PR diff instead of hiding in the log. Skips stay out: they are not findings.
const LEVEL = { fail: "error", warn: "warning" };
const escData = (t) => t.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
const escProp = (t) => escData(t).replace(/:/g, "%3A").replace(/,/g, "%2C");

export function github(results, file) {
  return results
    .filter((r) => LEVEL[r.status])
    .map((r) => {
      const body = [r.message, ...[].concat(r.detail ?? [])].join("\n");
      return `::${LEVEL[r.status]} file=${escProp(file)},title=${escProp(`avow ${r.rule}`)}::${escData(body)}`;
    });
}
