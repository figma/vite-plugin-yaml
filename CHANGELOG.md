# Changelog

## 2.0.0

### Fixed

- **Module ids carrying a query were served untransformed.** The file extension was
  matched against the whole id, so an id like `config.yaml?used` missed the check and the
  raw YAML was passed on to be evaluated as JavaScript. The extension is now matched
  against the path. Vite strips `?t=` and `?import` before the plugin pipeline, so the
  set of ids this affects is narrow — this is hardening, not a fix for
  [#29](https://github.com/figma/vite-plugin-yaml/issues/29), whose cause is the plugin
  not being registered in the Vite config that built the code.
- **Keys that look like numbers produced code that would not run.** `'07': foo` was
  emitted as `{ 07: "foo" }`, an octal literal, which is a `SyntaxError` in the strict
  mode every ES module runs under. ([#30](https://github.com/figma/vite-plugin-yaml/issues/30))
- **A `__proto__` key replaced the object's prototype** instead of becoming a property.
  Quoting the key does not change this; only a computed key defines a property.
- **`include` and `exclude` are matched against the file path** rather than the path
  plus any query, so a queried id matches the same patterns as a plain one.
- `?raw`, `?url` and the worker queries are explicitly left to Vite, which has already
  replaced the module body by the time this plugin runs. The old extension test excluded
  them as a side effect of not matching queried ids at all; matching on the path makes
  the exclusion deliberate. No change in behaviour.
- **A self-referencing anchor now reports an error** instead of silently emitting a
  `{$circularReference:1}` placeholder in place of the data.
- `!!binary` produces a `Uint8Array` rather than an object with numeric keys.
- The include/exclude filter is built once per plugin instance rather than on every
  file transformed.

### Changed

- **Removed the `raw` option.** It emitted `const data = [object Object];` for any
  mapping and an unquoted identifier for any string, so it only ever produced valid
  output for numbers and booleans. Output is now always both valid and compact, so the
  option has nothing left to select. ([#30](https://github.com/figma/vite-plugin-yaml/issues/30))
- Documents are emitted through `JSON.parse` on a string literal, which engines parse
  faster than an equivalent object literal. Timestamps, non-finite numbers and binary
  data fall back to a literal so they survive unchanged.
- `js-yaml` upgraded to `^4.3.1`, which carries the fix for
  [GHSA-mh29-5h37-fv8m](https://github.com/nodeca/js-yaml/security/advisories/GHSA-mh29-5h37-fv8m).
  ([#38](https://github.com/figma/vite-plugin-yaml/issues/38), supersedes
  [#39](https://github.com/figma/vite-plugin-yaml/pull/39))
- Dropped the `tosource` dependency, which was pinned to an alpha release and was the
  source of the serialization bugs above.

### Added

- **A hook filter on `transform`**, so Rolldown and Rollup 4.38+ skip this plugin for
  every non-YAML module in the graph instead of calling into it. Older versions ignore
  the field and behave exactly as before.
  ([#37](https://github.com/figma/vite-plugin-yaml/issues/37))
- A test suite, plus typecheck and test steps in CI. The repository previously had
  neither.

### Meta

- `repository`, `bugs` and `homepage` point at `figma/vite-plugin-yaml`. They still
  referenced the Modyfi organisation, whose repository is now empty.
  ([#40](https://github.com/figma/vite-plugin-yaml/issues/40))
