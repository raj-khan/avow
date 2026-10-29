// A validator for the subset of JSON Schema that schema/manifest.schema.json
// uses, and nothing more. A schema library would be a dependency for one
// document shape; an unsupported keyword is ignored rather than guessed at.

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function typeOf(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (Number.isInteger(v)) return "integer";
  return typeof v;
}

function typeMatches(want, v) {
  const got = typeOf(v);
  return [].concat(want).some((t) => t === got || (t === "number" && got === "integer"));
}

export function validate(schema, value, path = "$") {
  const errors = [];
  const at = (msg) => errors.push(`${path}: ${msg}`);

  if (schema.type && !typeMatches(schema.type, value)) {
    at(`expected ${[].concat(schema.type).join(" or ")}, got ${typeOf(value)}`);
    return errors;
  }
  if ("const" in schema && value !== schema.const) at(`must be ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) {
    at(`must be one of ${schema.enum.map((e) => JSON.stringify(e)).join(", ")}`);
  }

  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      at(schema.minLength === 1 ? "must not be empty" : `shorter than ${schema.minLength}`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      at(`${value.length} characters, max ${schema.maxLength}`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) at(`does not match ${schema.pattern}`);
    if (schema.format === "date" && !DATE.test(value)) at("must be a YYYY-MM-DD date");
  }

  if (typeof value === "number" && schema.minimum !== undefined && value < schema.minimum) {
    at(`must be at least ${schema.minimum}`);
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      at(`${value.length} items, min ${schema.minItems}`);
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      at(`${value.length} items, max ${schema.maxItems}`);
    }
    if (schema.items) value.forEach((v, i) => errors.push(...validate(schema.items, v, `${path}[${i}]`)));
  }

  if (typeOf(value) === "object") {
    for (const key of schema.required ?? []) {
      if (!(key in value)) at(`missing required "${key}"`);
    }
    const props = schema.properties ?? {};
    for (const [key, v] of Object.entries(value)) {
      // Comments go in "$comment" at any level (ARCHITECTURE.md), so it is
      // never an unexpected or mistyped key.
      if (key === "$comment" && !props[key]) continue;
      if (props[key]) errors.push(...validate(props[key], v, `${path}.${key}`));
      else if (schema.additionalProperties === false) at(`unexpected "${key}"`);
      else if (typeof schema.additionalProperties === "object") {
        errors.push(...validate(schema.additionalProperties, v, `${path}.${key}`));
      }
    }
  }
  return errors;
}
