import { FAILSAFE_SCHEMA } from 'js-yaml';
import { describe, expect, it, vi } from 'vitest';

import ViteYaml from '../src/index';
import { CircularReferenceError } from '../src/serialize';

import type { PluginOptions } from '../src/index';
import type { Plugin } from 'vite';

function transform(code: string, id = '/project/src/fixture.yaml', options?: PluginOptions) {
  const { transform } = ViteYaml(options) as Plugin & {
    transform: (code: string, id: string) => { code: string } | null;
  };
  return transform(code, id);
}

/**
 * Runs the emitted module body and returns its default export. ES modules are
 * always strict, and the explicit directive reproduces that, so output that is
 * only a SyntaxError under strict mode fails here instead of in a browser.
 */
function evaluate(emitted: string): any {
  return new Function(`'use strict';\n${emitted.replace('export default data;', 'return data;')}`)();
}

function load(code: string, id?: string, options?: PluginOptions) {
  const result = transform(code, id, options);
  if (result === null) throw new Error('expected the plugin to transform this id');
  return evaluate(result.code);
}

describe('file matching', () => {
  it.each(['/src/a.yaml', '/src/a.yml', 'C:\\project\\a.yaml'])('transforms %s', (id) => {
    expect(transform('foo: bar', id)).not.toBeNull();
  });

  it.each(['/src/a.json', '/src/a.yamlx', '/src/a.ts', '/src/yaml'])('ignores %s', (id) => {
    expect(transform('foo: bar', id)).toBeNull();
  });

  // Vite strips `?t=` and `?import` before the plugin pipeline, so those never
  // reach the hook in practice; `?used` does, and carries real YAML. Accepting
  // all of them keeps the match on the path rather than the id.
  it.each([
    '/src/a.yaml?t=1714951438630&import',
    '/src/a.yaml?import',
    '/src/a.yaml?used',
    '/src/a.yml?t=1',
  ])('transforms %s', (id) => {
    expect(load('foo: bar', id)).toEqual({ foo: 'bar' });
  });

  // Vite has already replaced the module body by the time these reach transform.
  it.each(['/src/a.yaml?raw', '/src/a.yaml?url', '/src/a.yaml?worker', '/src/a.yaml?sharedworker'])(
    'leaves %s to Vite',
    (id) => {
      expect(transform('export default "foo: bar"', id)).toBeNull();
    }
  );
});

describe('include and exclude', () => {
  it('honours include', () => {
    const options = { include: '**/wanted/**' };
    expect(transform('a: 1', '/src/wanted/a.yaml', options)).not.toBeNull();
    expect(transform('a: 1', '/src/other/a.yaml', options)).toBeNull();
  });

  it('honours exclude', () => {
    const options = { exclude: '**/skipped/**' };
    expect(transform('a: 1', '/src/skipped/a.yaml', options)).toBeNull();
    expect(transform('a: 1', '/src/kept/a.yaml', options)).not.toBeNull();
  });

  // The pattern the README tells people to use for splitting files between two
  // YAML plugins. A pattern that is not anchored resolves against process.cwd(),
  // which is not reliably the project root, so `./translations/**` matches
  // nothing and the advice has to be a form that does not depend on cwd.
  it('excludes with the anchored pattern the README recommends', () => {
    const id = '/project/translations/en.yaml';
    expect(transform('a: 1', id, { exclude: '**/translations/**' })).toBeNull();
    expect(transform('a: 1', id, { exclude: '/project/translations/**' })).toBeNull();
  });

  // The query is not part of the path the user wrote a pattern for.
  it('matches patterns against the path, not the query', () => {
    const options = { exclude: '**/skipped/**' };
    expect(transform('a: 1', '/src/kept/a.yaml?t=1&import', options)).not.toBeNull();
    expect(transform('a: 1', '/src/skipped/a.yaml?t=1&import', options)).toBeNull();
  });
});

describe('serialization', () => {
  it('handles scalars, nesting and arrays', () => {
    expect(load('a:\n  b: [1, two, true, null]\n')).toEqual({ a: { b: [1, 'two', true, null] } });
  });

  it('exports a top-level scalar', () => {
    expect(load('hello\n')).toBe('hello');
  });

  it('exports undefined for an empty document', () => {
    expect(load('')).toBeUndefined();
  });

  // `{ 07: "foo" }` is an octal literal, which is a SyntaxError in a module.
  it('emits keys that look like numbers without corrupting them', () => {
    expect(load("'07': foo\n'0x1f': hex\n'1.2.3': version\n8: eight\n")).toEqual({
      '07': 'foo',
      '0x1f': 'hex',
      '1.2.3': 'version',
      '8': 'eight',
    });
  });

  // In an object literal `__proto__:` reassigns the prototype rather than
  // defining a key, and quoting it does not change that.
  it('treats __proto__ as an ordinary key', () => {
    const data = load('__proto__:\n  polluted: true\nkept: true\n');
    expect(Object.getPrototypeOf(data)).toBe(Object.prototype);
    expect(Object.prototype.hasOwnProperty.call(data, '__proto__')).toBe(true);
    expect(data.kept).toBe(true);
    expect(({} as any).polluted).toBeUndefined();
  });

  it('preserves timestamps', () => {
    const data = load('when: 2024-01-01T00:00:00Z\n');
    expect(data.when).toBeInstanceOf(Date);
    expect(data.when.toISOString()).toBe('2024-01-01T00:00:00.000Z');
  });

  it('preserves non-finite numbers', () => {
    expect(load('a: .nan\nb: .inf\nc: -.inf\n')).toEqual({ a: NaN, b: Infinity, c: -Infinity });
  });

  it('preserves binary data as bytes', () => {
    const data = load('b: !!binary aGk=\n');
    expect(data.b).toBeInstanceOf(Uint8Array);
    expect(Array.from(data.b)).toEqual([104, 105]);
  });

  it('escapes line separators that are legal in JSON but not in older JavaScript', () => {
    const result = transform('a: "x\u2028y\u2029z"');
    expect(result!.code).not.toMatch(/[\u2028\u2029]/);
    expect(evaluate(result!.code)).toEqual({ a: 'x\u2028y\u2029z' });
  });

  it('duplicates a shared anchor rather than sharing it', () => {
    expect(load('a: &x {k: 1}\nb: *x\n')).toEqual({ a: { k: 1 }, b: { k: 1 } });
  });

  // Previously emitted a `{$circularReference:1}` placeholder, silently
  // replacing the user's data with something that never round-trips.
  it('reports a circular anchor instead of emitting a placeholder', () => {
    expect(() => transform('a: &x\n  self: *x\n')).toThrow(CircularReferenceError);
  });
});

describe('options', () => {
  it('applies a custom schema', () => {
    expect(load('a: 1\nb: true\n', '/src/a.yaml', { schema: FAILSAFE_SCHEMA })).toEqual({
      a: '1',
      b: 'true',
    });
  });

  it('reports parse errors with the file path, not the query', () => {
    const parse = () =>
      transform('a: [1, 2\n', '/src/broken.yaml?t=1&import', { onWarning: () => {} });
    expect(parse).toThrow(/broken\.yaml/);
    expect(parse).not.toThrow(/\?t=1/);
  });

  it('routes js-yaml warnings to onWarning', () => {
    const onWarning = vi.fn();
    transform('%FOO bar\n---\na: 1\n', '/src/a.yaml', { onWarning });
    expect(onWarning).toHaveBeenCalledOnce();
    expect(onWarning.mock.calls[0][0].message).toMatch(/unknown document directive/);
  });

  it('warns on the console when no handler is given', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    transform('%FOO bar\n---\na: 1\n');
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});

describe('sourcemap', () => {
  it('returns an empty map so Rollup does not warn about a missing one', () => {
    expect(transform('a: 1')!).toMatchObject({ map: { mappings: '' } });
  });
});
