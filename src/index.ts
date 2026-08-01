import { load, DEFAULT_SCHEMA } from 'js-yaml';
import { createFilter } from '@rollup/pluginutils';

import { serialize } from './serialize';

import type { YAMLException, Schema } from 'js-yaml';
import type { Plugin } from 'vite';
import type { FilterPattern } from '@rollup/pluginutils';

export type PluginOptions = {
  /**
   * A minimatch pattern, or array of patterns, which specifies the files in the build the plugin
   * should operate on.
   *
   * By default all files are targeted.
   */
  include?: FilterPattern;
  /**
   * A minimatch pattern, or array of patterns, which specifies the files in the build the plugin
   * should ignore.
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
};

const yamlExtension = /\.ya?ml(?:$|\?)/;

/**
 * Queries through which Vite serves a file as something other than its own
 * contents. By the time `transform` runs, `?raw` has already become a JS module
 * exporting a string and `?url` a module exporting a path, so neither is YAML
 * any more. Mirrors Vite's own `isSpecialQuery`.
 */
const specialQuery = /[?&](?:worker|sharedworker|raw|url)\b/;

/**
 * Transform YAML files to JS objects.
 */
export default (options: PluginOptions = {}): Plugin => {
  const filter = createFilter(options.include, options.exclude);
  const schema = options.schema ?? DEFAULT_SCHEMA;
  const onWarning =
    typeof options.onWarning === 'function'
      ? options.onWarning
      : (warning: YAMLException) => console.warn(warning.toString());

  return {
    name: 'vite:transform-yaml',

    transform: {
      // Rolldown and Rollup >=4.38 skip the handler entirely for ids that miss
      // this filter, which keeps the plugin off every non-YAML module in the
      // graph. Older versions ignore the field and call the handler as before.
      filter: { id: { include: yamlExtension, exclude: specialQuery } },

      handler(code: string, id: string) {
        if (!yamlExtension.test(id) || specialQuery.test(id)) return null;

        // Some ids carry a query — `?used` is the one Vite generates that still
        // holds YAML — so both the extension test above and the patterns below
        // have to look at the path alone. Vite strips `?t=` and `?import` before
        // the plugin pipeline, so those never arrive here.
        const [filepath] = id.split('?');
        if (!filter(filepath)) return null;

        const data = load(code, { filename: filepath, schema, onWarning });

        return {
          code: `const data = ${serialize(data, filepath)};\nexport default data;`,
          // YAML lines have no counterpart in an emitted object, so there is
          // nothing to map. An empty map stops Rollup warning about the gap.
          map: { mappings: '' },
        };
      },
    },
  };
};
