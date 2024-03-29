import fs                        from 'node:fs';
import { fileURLToPath }         from 'node:url';

import { getFileList }           from '@typhonjs-utils/file-util';
import { isObject }              from '@typhonjs-utils/object';
import { resolve }               from 'import-meta-resolve';
import { svelte2tsx }            from 'svelte2tsx';
import ts                        from 'typescript';
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
   static #regexScriptIsTS = /<script\s+[^>]*?lang=(['"]?)(ts|typescript)\1[^>]*>/;

   /**
    * Replace script contents after JSDoc processing.
    *
    * @type {RegExp}
    */
   static #regexScriptReplace = /(<script\b[^>]*>)([\s\S]*?)(<\/script>)/;

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
   static #regexTypedef = /\/\*\*\s*?@typedef[\s\S]*?__propDef[\s\S]*?\*\/\s*/g;

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
    * @param {import('@typhonjs-build-test/esm-d-ts').PluginEvent.Data['compile:diagnostic:filter']} data - Event data.
    *
    * @returns {import('@typhonjs-build-test/esm-d-ts').PluginEvent.Returns['compile:diagnostic:filter']} Filtered
    *          state.
    */
   compileDiagnosticFilter({ diagnostic, diagnosticLog, message })
   {
      // Move logging for the following diagnostic codes to the `debug` log level.
      /* v8 ignore next 6 */
      if (DTSPluginSvelte.#regexSvelteFile.test(diagnostic?.file?.fileName) &&
       (diagnostic.code === 1005 || diagnostic.code === 2451))
      {
         diagnosticLog(diagnostic, 'debug');
         return true;
      }

      // Ignore the following codes / message strings.

      // Currently `svelte2tsx` does not include a definition / declaration for `__sveltets_createSlot` in DTS mode.
      if (diagnostic.code === 2304 && message.startsWith(`Cannot find name '__sveltets_createSlot'`)) { return true; }

      // Currently `svelte2tsx` when exporting a function prop and `svelte:options` accessors is true an unknown
      // `undefined` accessor pair is added to the declarations.
      if (diagnostic.code === 2339 && message.startsWith(`Property 'undefined' does not exist on type '{`))
      {
         return true;
      }
   }

   /**
    * Transform any Svelte files via `svelte2tsx` before TSC compilation.
    *
    * @param {import('@typhonjs-build-test/esm-d-ts').PluginEvent.Data['compile:transform']} data - Event data.
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

            let code = fs.readFileSync(filepath, 'utf-8').toString();
            const isTsFile = DTSPluginSvelte.#regexScriptIsTS.test(code);
            const tempPath = `${filepath}${isTsFile ? '.ts' : '.js'}`;

            // Process script contents for JSDoc comments.
            const match = DTSPluginSvelte.#regexScriptContent.exec(code);
            if (match)
            {
               const jsdocResult = JSDocCommentParser.processScript(match.groups.contents, filepath,
                relativeFilepath, logger);

               if (jsdocResult)
               {
                  // Replace the script contents with the processed script after JSDoc processing the
                  // `@componentDocumentation` tagged JSDoc comment block has been sanitized. This is done so that
                  // running TSC via `checkJs` does not have spurious warnings.
                  code = code.replace(DTSPluginSvelte.#regexScriptReplace, `$1${jsdocResult.scriptCode}$3`);

                  this.#componentComments.set(`${relativeFilepath}.d.ts`, jsdocResult);
               }
            }

            const tsx = svelte2tsx(code, {
               filename: filepath,
               isTsFile,
               mode: 'dts',
               noSvelteComponentTyped: true
            });

            memoryFiles.set(tempPath, tsx.code);
            compileFilepaths[cntr] = tempPath;
         }
      }

      if (hasSvelte)
      {
         compileFilepaths.push(upath.toUnix(fileURLToPath(resolve('svelte2tsx/svelte-jsx-v4.d.ts', import.meta.url))));

         compileFilepaths.push(upath.toUnix(fileURLToPath(resolve('svelte2tsx/svelte-shims-v4.d.ts',
          import.meta.url))));
      }
   }

   /**
    * Compiles the Svelte component returning the JS code so that `es-module-lexer` can parse it.
    *
    * @param {import('@typhonjs-build-test/esm-d-ts').PluginEvent.Data['lexer:transform']} data - Event data.
    *
    * @returns {import('@typhonjs-build-test/esm-d-ts').PluginEvent.Returns['lexer:transform']} Compiled script / JS
    *          section of Svelte component.
    */
   lexerTransform({ compilerOptions, fileData })
   {
      const isTsFile = DTSPluginSvelte.#regexScriptIsTS.test(fileData);
      const match = DTSPluginSvelte.#regexScriptContent.exec(fileData);

      const code = match ? match.groups.contents : 'export {};';

      if (isTsFile)
      {
         return ts.transpileModule(code, {
            compilerOptions: {
               ...compilerOptions,
               allowImportingTsExtensions: true,
               declaration: false
            },
            /* v8 ignore next 1 */ // Ignore nullish coalescing branch.
            jsDocParsingMode: ts.JSDocParsingMode?.ParseNone ?? 1, // Added in TS 5.3+
            reportDiagnostics: false
         }).outputText;
      }
      else
      {
         return code;
      }
   }

   /**
    * Svelte v4 types will add a triple slash reference `/// <reference types="svelte" />` for generated types.
    * To remove it a regex is added to the `esm-d-ts` GenerateConfig -> `dtsReplace`.
    *
    * @param {import('@typhonjs-build-test/esm-d-ts').PluginEvent.Data['lifecycle:start']} data - Event data.
    */
   lifecycleStart({ processedConfig })
   {
      const { generateConfig } = processedConfig;

      /* v8 ignore next 4 */
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
    * @param {import('@typhonjs-build-test/esm-d-ts').PluginEvent.Data['compile:end']} data - Event data.
    */
   async postprocessDTS({ PostProcess, processedConfig })
   {
      const { dtsDirectoryPath, generateConfig } = processedConfig;

      // No postprocessing when running `checkJs`.
      if (generateConfig.tsCheckJs) { return; }

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
