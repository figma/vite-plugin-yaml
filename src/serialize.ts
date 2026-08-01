/**
 * Thrown when a YAML document uses anchors to reference itself. A module can
 * only export a value that is fully constructed by the time the module body
 * finishes, so a cycle has no valid representation here.
 */
export class CircularReferenceError extends Error {
  constructor(filename: string) {
    super(
      `${filename} contains a circular reference (an anchor that includes itself). ` +
        `Circular structures cannot be represented in a JavaScript module.`
    );
    this.name = 'CircularReferenceError';
  }
}

export class UnsupportedValueError extends Error {
  constructor(filename: string, value: unknown) {
    super(
      `${filename} produced a ${describe(value)}, which cannot be written to a ` +
        `JavaScript module. This usually comes from a custom \`schema\` option.`
    );
    this.name = 'UnsupportedValueError';
  }
}

function describe(value: unknown): string {
  if (typeof value === 'object' && value !== null) {
    return `${value.constructor?.name ?? 'object'} value`;
  }
  return `${typeof value} value`;
}

/**
 * Renders a parsed YAML document as the right-hand side of a JavaScript
 * assignment.
 *
 * The fast path wraps JSON in `JSON.parse`, which the engine parses faster than
 * an equivalent object literal and which sidesteps two ways an object literal
 * silently corrupts data: a key like `07` is an octal literal, and every ES
 * module is strict mode, where octal literals are a SyntaxError; and a
 * `__proto__` key in a literal reassigns the prototype instead of defining a
 * property, even when quoted.
 *
 * js-yaml's default schema can still produce timestamps, non-finite numbers and
 * binary data, none of which survive a JSON round trip, so those fall back to a
 * literal that names them explicitly.
 */
export function serialize(value: unknown, filename: string): string {
  if (isJsonSafe(value, new Set())) {
    return `JSON.parse(${quote(JSON.stringify(value))})`;
  }
  return literal(value, filename, new Set());
}

function isJsonSafe(value: unknown, ancestors: Set<object>): boolean {
  if (value === null) return true;

  switch (typeof value) {
    case 'boolean':
    case 'string':
      return true;
    case 'number':
      return Number.isFinite(value);
    case 'object':
      break;
    default:
      return false;
  }

  const object = value as object;
  if (ancestors.has(object)) return false;
  ancestors.add(object);
  try {
    if (Array.isArray(object)) {
      return object.every((item) => isJsonSafe(item, ancestors));
    }
    const prototype = Object.getPrototypeOf(object);
    if (prototype !== Object.prototype && prototype !== null) return false;
    return Object.values(object).every((item) => isJsonSafe(item, ancestors));
  } finally {
    ancestors.delete(object);
  }
}

function literal(value: unknown, filename: string, ancestors: Set<object>): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';

  switch (typeof value) {
    case 'string':
      return quote(value);
    case 'boolean':
      return String(value);
    case 'bigint':
      return `${value}n`;
    case 'number':
      // Every other number, including NaN and ±Infinity, round-trips through
      // String(); only negative zero loses its sign.
      return Object.is(value, -0) ? '-0' : String(value);
    case 'object':
      break;
    default:
      throw new UnsupportedValueError(filename, value);
  }

  const object = value as object;
  if (ancestors.has(object)) throw new CircularReferenceError(filename);
  ancestors.add(object);
  try {
    if (Array.isArray(object)) {
      return `[${object.map((item) => literal(item, filename, ancestors)).join(',')}]`;
    }
    if (object instanceof Date) {
      return `new Date(${object.getTime()})`;
    }
    if (ArrayBuffer.isView(object) && !(object instanceof DataView)) {
      const bytes = Array.from(object as unknown as ArrayLike<number>);
      return `new ${object.constructor.name}([${bytes.join(',')}])`;
    }
    if (object instanceof RegExp) {
      return String(object);
    }

    const prototype = Object.getPrototypeOf(object);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new UnsupportedValueError(filename, object);
    }

    const entries = Object.entries(object).map(
      ([key, item]) => `${key === '__proto__' ? '["__proto__"]' : quote(key)}:${literal(item, filename, ancestors)}`
    );
    return `{${entries.join(',')}}`;
  } finally {
    ancestors.delete(object);
  }
}

/**
 * JSON permits raw U+2028/U+2029 inside strings; JavaScript only accepts them
 * in string literals from ES2019 onward, so escape them for older targets.
 */
function quote(value: string): string {
  return JSON.stringify(value).replace(
    /[\u2028\u2029]/g,
    (char) => `\\u${char.codePointAt(0)!.toString(16)}`
  );
}
