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
 * Provides a plugin for `esm-d-ts` to handle Svelte components.
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
   static #regexScriptIsTS = /<script\s+[^>]*?lang=('|")(ts|typescript)('|")/;

   /**
    * Matches spurious `@typedef` statements output from `svelte2tsx` for removal.
    *
    * @type {RegExp}
    */
   static #regexTypedef = /\/\*\*[\s\S]*?@typedef[\s\S]*?__propDef[\s\S]*?\*\/\s*/g;

   #componentComments = new Map();

   // Plugin event callbacks -----------------------------------------------------------------------------------------

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
    * @param {import('@typhonjs-build-test/esm-d-ts/postprocess').PostProcess} data.PostProcess - Post process manager
    *        from `esm-d-ts`.
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

         // TODO: Remove logging
         // console.log(`!!! DPS - postprocessDTS - has entry: ${this.#componentComments.has(relativeFilepath)}; relativeFilepath: ${relativeFilepath}`)

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

   /**
    * Transform any Svelte files via `svelte2tsx` before TSC compilation.
    *
    * @param {object}   data - Data.
    *
    * @param {import('@typhonjs-utils/logger-color').ColorLogger} logger -
    *
    * @param {Map<string, string>}  data.memoryFiles - Stores transformed code and temp paths.
    *
    * @param {import('@typhonjs-build-test/esm-d-ts').ProcessedConfig} data.processedConfig - Processed config from
    *        `esm-d-ts` that contains the filepaths being compiled.
    */
   transformCompile({ logger, memoryFiles, processedConfig })
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

            try
            {
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

                  // TODO: Remove logging
                  // console.log(`!!! DPS - transformCompile - relativeFilepath: ${relativeFilepath} - jsdocResult: `, jsdocResult)

                  if (jsdocResult)
                  {
                     this.#componentComments.set(`${relativeFilepath}.d.ts`, jsdocResult);
                  }
               }
            }
            catch (err)
            {
               // TODO: handle error and remove file from compilation.
               throw err;
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
   transformLexer({ fileData })
   {
      const { js } = compile(fileData);
      return js.code;
   }

   // Plugin manager registration ------------------------------------------------------------------------------------

   /**
    * @param {import('@typhonjs-plugin/manager').PluginInvokeEvent} ev -
    */
   onPluginLoad(ev)
   {
      const eventbus = ev.eventbus;

      const options = { guard: true, sync: true };

      eventbus.on('lifecycle:start', this.lifecycleStart, this, options);
      eventbus.on('postprocess:dts', this.postprocessDTS, this, options);
      eventbus.on('transform:compile', this.transformCompile, this, options);
      eventbus.on('transform:lexer:.svelte', this.transformLexer, this, options);
   }
}
