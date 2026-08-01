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
 * A boolean to determine if JSON object should be serialized.
 *
 * @see https://www.npmjs.com/package/tosource for the motivation behind serialization of JSON.
 */
raw?: boolean;
/**
 * A function that will be called for error reporting.
 *
 * Defaults to `console.warn()`.
 */
onWarning?: (warning: YAMLException) => void;
```
