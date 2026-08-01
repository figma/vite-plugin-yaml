[![Pipeline](https://github.com/figma/vite-plugin-yaml/actions/workflows/pipeline.yml/badge.svg)](https://github.com/figma/vite-plugin-yaml/actions/workflows/pipeline.yml)

# 🧹 vite-plugin-yaml

Transforms a YAML file into a JS object.

## 🚀 Install

```
npm install -D @modyfi/vite-plugin-yaml
# or
# yarn add -D @modyfi/vite-plugin-yaml
# or
# pnpm i -D @modyfi/vite-plugin-yaml
```

## 🦄 Usage

Add `ViteYAML` to `vite.config.js / vite.config.ts`:

```ts
// vite.config.js / vite.config.ts
import ViteYaml from '@modyfi/vite-plugin-yaml';

export default {
  plugins: [
    ViteYaml(), // you may configure the plugin by passing in an object with the options listed below
  ],
};
```

Then you can simply import yaml files like you would any other file:

```ts
import YamlContent from './your.yaml';

console.log(YamlContent.example);
```

Do note that you may have to include the file type in your import.

### 🔦 TypeScript support

The recommended way to add type definitions for `.yaml` or `.yml` modules is via a `tsconfig.json` file.

```ts
// tsconfig.json
{
  "compilerOptions": {
    ...
    "types": [
      ...
      "@modyfi/vite-plugin-yaml/modules"
      ],
  }
}
```

You may also add type definitions without `tsconfig`:

```ts
// vite-env.d.ts
/// <reference types="@modyfi/vite-plugin-yaml/modules" />
```

## 🐛 Options

```ts
/**
 * A minimatch pattern, or array of patterns, which specifies the files in the build the plugin should operate on.
 *
 * By default all files are targeted.
 */
include?: FilterPattern;
/**
 * A minimatch pattern, or array of patterns, which specifies the files in the build the plugin should ignore.
 *
 * By default no files are ignored.
 */
exclude?: FilterPattern;
/**
 * Schema used to parse yaml files.
 *
 * @see https://github.com/nodeca/js-yaml/blob/49baadd52af887d2991e2c39a6639baa56d6c71b/README.md#load-string---options-
 */
schema?: Schema;
/**
 * A function that will be called for error reporting.
 *
 * Defaults to `console.warn()`.
 */
onWarning?: (warning: YAMLException) => void;
```

## 🧪 Types for a specific file

The `modules` declaration types every YAML import as `Record<string, any>`. That is
deliberately loose: the plugin runs inside Vite, long after `tsc` has decided what
`./config.yaml` means, so it cannot describe the shape of an individual document the
way `resolveJsonModule` does for JSON.

Declare the shape yourself where you need `keyof typeof` or property checking:

```ts
// config.yaml.d.ts
declare const config: {
  hosts: Record<'staging' | 'production', string>;
};
export default config;
```

## 🩺 Troubleshooting

### `end of the stream or a document separator is expected`

Another plugin has already converted the file, and this plugin then tried to parse
the resulting JavaScript as YAML. Vite runs every matching `transform` hook in turn
and passes each one the previous hook's output, so two YAML plugins cannot both own
the same file. This most often shows up alongside `@intlify/unplugin-vue-i18n` when
its `include` option covers your YAML.

Give each plugin its own files:

```ts
ViteYaml({ exclude: '**/translations/**' }),
VueI18nPlugin({ include: resolve(__dirname, './translations/**') }),
```

`include` and `exclude` are matched against absolute paths, and a pattern that is not
itself absolute is resolved against `process.cwd()` — which is not reliably your project
root in a monorepo, or whenever Vite is started with `--config` from elsewhere. Write the
pattern so it does not depend on that, either by anchoring it with a leading `**/` as
above or by passing an absolute path from `resolve(__dirname, …)`. A bare
`'./translations/**'` matches nothing.

### The browser reports a YAML file has no default export

Or, for a document starting with `---`, `Invalid left-hand side expression in prefix
operation`. Both mean the same thing: the browser received the YAML itself and tried to
evaluate it as JavaScript, because nothing transformed the file.

Almost always the plugin is not in the Vite config that actually built the code. Check
that it is registered in the config being used, not only in the project's root
`vite.config.ts` — frameworks that wrap Vite (Quasar, Nuxt, Storybook) each have their
own place to add plugins, and a `viteFinal` that replaces rather than merges the plugin
list will drop it silently.

## 🛠️ Contributing

```
pnpm i && pnpm test && pnpm build
```

The plugin is typed and built against the Vite version in the root `devDependencies`
while `example/` pins an older one, so `pnpm example:build` checks that the supported
range in `peerDependencies` really does still work.
