import fs                        from 'node:fs';
import { fileURLToPath }         from 'node:url';

import { getFileList }           from '@typhonjs-utils/file-util';
import { isObject }              from '@typhonjs-utils/object';
import { resolve }               from 'import-meta-resolve';
import { compile }               from 'svelte/compiler';
import { svelte2tsx }            from 'svelte2tsx';

import upath                     from 'upath';

import { JSDocCommentParser }    from './JSDocCommentParser.js';
import { PostprocessDTS }        from './PostprocessDTS.js';

/**
 * Provides a plugin for `esm-d-ts` to handle Svelte 4 components. Future support for Svelte 5 / mixed mode 4 & 5 is
 * forthcoming.
 */
export class DTSPluginSvelte
{
   /**
    * Capture script content.
    *
    * @type {RegExp}
    */
   static #regexScriptContent = /<script\b[^>]*>(?<contents>[\s\S]*?)<\/script>/;

   /**
    * Is any script tag Typescript.
    *
    * @type {RegExp}
    */
   static #regexScriptIsTS = /<script\s+[^>]*?lang=['"](ts|typescript)['"]/;

   /**
    * Detects an intermediate DTS Svelte filename extension.
    *
    * @type {RegExp}
    */
   static #regexSvelteFile = /\.svelte\.(js|ts)$/;

   /**
    * Matches spurious `@typedef` statements output from `svelte2tsx` for removal.
    *
    * @type {RegExp}
    */
   static #regexTypedef = /\/\*\*[\s\S]*?@typedef[\s\S]*?__propDef[\s\S]*?\*\/\s*/g;

   /**
    * Stores the relative intermediate declaration Svelte file path to parsed component JSDoc.
    *
    * @type {Map<string, import('./JSDocCommentParser.js').ComponentJSDoc>}
    */
   #componentComments = new Map();

   // Plugin event callbacks -----------------------------------------------------------------------------------------

   /**
    * Filters raised diagnostic messages from the Typescript compiler for Svelte components. There can be some noisy
    * warnings from `svelte2tsx` output depending on the complexity of the component. These diagnostic messages are
    * moved to the `debug` log level.
    *
    * The codes targeted are:
    * - `1005` - ',' expected.
    * - `2451` - redeclared block scope variable.
    *
    * @param {object}   data - Data.
    *
    * @param {import('typescript').Diagnostic}  data.diagnostic - Diagnostic to test.
    *
    * @param {Function}   data.diagnosticLog - Diagnostic logging helper.
    *
    * @returns {boolean} Filtered state.
    */
   compileDiagnosticFilter({ diagnostic, diagnosticLog })
   {
      if (DTSPluginSvelte.#regexSvelteFile.test(diagnostic?.file?.fileName) &&
       (diagnostic.code === 1005 || diagnostic.code === 2451))
      {
         diagnosticLog(diagnostic, 'debug');
         return true;
      }
   }

   /**
    * Transform any Svelte files via `svelte2tsx` before TSC compilation.
    *
    * @param {object}   data - Data.
    *
    * @param {import('@typhonjs-utils/logger-color').ColorLogger} data.logger - Logger instance.
    *
    * @param {Map<string, string>}  data.memoryFiles - Stores transformed code and temp paths.
    *
    * @param {import('@typhonjs-build-test/esm-d-ts').ProcessedConfig} data.processedConfig - Processed config from
    *        `esm-d-ts` that contains the filepaths being compiled.
    */
   compileTransform({ logger, memoryFiles, processedConfig })
   {
      const { compileFilepaths, compilerOptions } = processedConfig;

      let hasSvelte = false;

      const rootDir = compilerOptions.rootDir;

      for (let cntr = compileFilepaths.length; --cntr >= 0;)
      {
         const filepath = compileFilepaths[cntr];
         if (filepath.endsWith('.svelte'))
         {
            const relativeFilepath = upath.relative(rootDir, filepath);

            hasSvelte = true;

            // Any exceptions raised are caught by `esm-d-ts`.

            const code = fs.readFileSync(filepath, 'utf-8').toString();
            const isTsFile = DTSPluginSvelte.#regexScriptIsTS.test(code);

            const tempPath = `${filepath}${isTsFile ? '.ts' : '.js'}`;

            const tsx = svelte2tsx(code, {
               filename: filepath,
               isTsFile,
               mode: 'dts',
               noSvelteComponentTyped: true
            });

            memoryFiles.set(tempPath, tsx.code);
            compileFilepaths[cntr] = tempPath;

            // Process script contents for JSDoc comments.
            const match = DTSPluginSvelte.#regexScriptContent.exec(code);
            if (match)
            {
               const jsdocResult = JSDocCommentParser.processScript(match.groups.contents, filepath,
                relativeFilepath, logger);

               if (jsdocResult)
               {
                  this.#componentComments.set(`${relativeFilepath}.d.ts`, jsdocResult);
               }
            }
         }
      }

      if (hasSvelte)
      {
         const svelteShims = fileURLToPath(resolve('svelte2tsx/svelte-shims-v4.d.ts', import.meta.url));
         compileFilepaths.push(upath.toUnix(svelteShims));
      }
   }

   /**
    * Compiles the Svelte component returning the JS code so that `es-module-lexer` can parse it.
    *
    * @param {object}   data - Data.
    *
    * @param {string}   data.fileData - Svelte component file to compile / transform
    *
    * @returns {string} Compiled JS section of Svelte component.
    */
   lexerTransform({ fileData })
   {
      const { js } = compile(fileData);
      return js.code;
   }

   /**
    * Svelte v4 types will add a triple slash reference `/// <reference types="svelte" />` for generated types.
    * To remove it a regex is added to the `esm-d-ts` GenerateConfig -> `dtsReplace`.
    *
    * @param {object}   data - Event data.
    *
    * @param {import('@typhonjs-build-test/esm-d-ts').ProcessedConfig} data.processedConfig - `esm-d-ts` processed
    *        configuration data.
    */
   lifecycleStart({ processedConfig })
   {
      const { generateConfig } = processedConfig;

      if (isObject(generateConfig?.dtsReplace))
      {
         generateConfig.dtsReplace['/\\/\\/ <reference.*\\/>'] = '';
      }
      else
      {
         generateConfig.dtsReplace = { '/\\/\\/ <reference.*\\/>': '' };
      }

      // Clear component comment map on each generation invocation.
      this.#componentComments.clear();
   }

   /**
    * Handles postprocessing intermediate generated DTS files.
    *
    * @param {object} data - Event data.
    *
    * @param {typeof import('@typhonjs-build-test/esm-d-ts/postprocess').PostProcess} data.PostProcess - Post process
    *        manager from `esm-d-ts`.
    *
    * @param {import('@typhonjs-build-test/esm-d-ts').ProcessedConfig} data.processedConfig - `esm-d-ts` processed
    *        configuration data.
    */
   async postprocessDTS({ PostProcess, processedConfig })
   {
      const { dtsDirectoryPath } = processedConfig;

      const svelteDTSPaths = await getFileList({
         dir: dtsDirectoryPath,
         includeFile: /\.svelte\.d\.ts$/,
         resolve: true,
         walk: true
      });

      for (const filepath of svelteDTSPaths)
      {
         const relativeFilepath = upath.relative(dtsDirectoryPath, filepath);

         // Pre-process to remove spurious typedef JSDoc comments.
         const fileData = fs.readFileSync(filepath, 'utf-8');
         fs.writeFileSync(filepath, fileData.replaceAll(DTSPluginSvelte.#regexTypedef, ''));

         PostProcess.process({
            filepath,
            processors: [({ logger, sourceFile }) => PostprocessDTS.process({
               comments: this.#componentComments.get(relativeFilepath),
               logger,
               sourceFile,
            })]
         });
      }
   }

   // Plugin manager registration ------------------------------------------------------------------------------------

   /**
    * @param {import('@typhonjs-plugin/manager').PluginInvokeEvent} ev -
    */
   onPluginLoad(ev)
   {
      const eventbus = ev.eventbus;

      const options = { async: true };

      // Event registration in the order which the events are fired.

      eventbus.on('lifecycle:start', this.lifecycleStart, this, options);
      eventbus.on('lexer:transform:.svelte', this.lexerTransform, this, options);
      eventbus.on('compile:transform', this.compileTransform, this, options);
      eventbus.on('compile:diagnostic:filter', this.compileDiagnosticFilter, this, options);
      eventbus.on('compile:end', this.postprocessDTS, this, options);
   }
}
