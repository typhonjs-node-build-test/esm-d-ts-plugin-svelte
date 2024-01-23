import fs                  from 'node:fs';
import { fileURLToPath }   from 'node:url';

import { resolve }         from 'import-meta-resolve';
import { compile }         from 'svelte/compiler';
import { svelte2tsx }      from 'svelte2tsx';

/**
 * Provides a plugin for `esm-d-ts` to handle Svelte components.
 */
class DTSPluginSvelte
{
   /**
    * Transform any Svelte files via `svelte2tsx` before TSC compilation.
    *
    * @param {object}   data - Data.
    *
    * @param {string[]} data.filepaths - File paths being compiled by TSC.
    *
    * @param {Map<string, string>}  data.memoryFiles - Stores transformed code and temp paths.
    */
   compileTransform({ filepaths, memoryFiles })
   {
      let hasSvelte = false;

      for (let cntr = filepaths.length; --cntr >= 0;)
      {
         const filepath = filepaths[cntr];
         if (filepath.endsWith('.svelte'))
         {
            hasSvelte = true;

            try
            {
               const code = fs.readFileSync(filepath, 'utf-8').toString();
               const isTsFile = (/<script\s+[^>]*?lang=('|")(ts|typescript)('|")/).test(code);

               const tempPath = `${filepath}${isTsFile ? '.ts' : '.js'}`;

               const tsx = svelte2tsx(code, {
                  filename: filepath,
                  isTsFile,
                  mode: 'dts',
                  noSvelteComponentTyped: true
               });

               memoryFiles.set(tempPath, tsx.code);
               filepaths[cntr] = tempPath;
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
         filepaths.push(svelteShims);
      }
   }

   /**
    * Handles postprocessing generated DTS files.
    */
   dtsPostprocess()
   {

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
    * @param {import('@typhonjs-plugin/manager').PluginInvokeEvent} ev -
    */
   onPluginLoad(ev)
   {
      const eventbus = ev.eventbus;

      const options = { guard: true, sync: true };

      eventbus.on('compile:transform', this.compileTransform, this, options);
      eventbus.on('dts:postprocess', this.dtsPostprocess, this, options);
      eventbus.on('lexer:transform:.svelte', this.lexerTransform, this, options);
   }
}

const dtsPluginSvelte = new DTSPluginSvelte();

export default dtsPluginSvelte;
