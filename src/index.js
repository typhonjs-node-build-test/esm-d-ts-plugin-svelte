import fs                  from 'node:fs';
import { fileURLToPath }   from 'node:url';

import { resolve }         from 'import-meta-resolve';
import { compile }         from 'svelte/compiler';
import { svelte2tsx }      from 'svelte2tsx';
import upath               from 'upath';

/**
 * Provides a plugin for `esm-d-ts` to handle Svelte components.
 */
class DTSPluginSvelte
{
   /**
    * Handles postprocessing generated DTS files.
    */
   postprocessDTS({ processedConfig })
   {
      const { compileFilepaths } = processedConfig;

console.log(`!!! DPS - postprocessDTS - compileFilepaths: `, compileFilepaths);
   }

   /**
    * Transform any Svelte files via `svelte2tsx` before TSC compilation.
    *
    * @param {object}   data - Data.
    *
    * @param {Map<string, string>}  data.memoryFiles - Stores transformed code and temp paths.
    *
    * @param {import('@typhonjs-build-test/esm-d-ts').ProcessedConfig} data.processedConfig - Processed config from
    *        `esm-d-ts` that contains the filepaths being compiled.
    */
   transformCompile({ memoryFiles, processedConfig })
   {
      const { compileFilepaths } = processedConfig;

      let hasSvelte = false;

      for (let cntr = compileFilepaths.length; --cntr >= 0;)
      {
         const filepath = compileFilepaths[cntr];
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
               compileFilepaths[cntr] = tempPath;
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

   /**
    * @param {import('@typhonjs-plugin/manager').PluginInvokeEvent} ev -
    */
   onPluginLoad(ev)
   {
      const eventbus = ev.eventbus;

      const options = { guard: true, sync: true };

      eventbus.on('postprocess:dts', this.postprocessDTS, this, options);
      eventbus.on('transform:compile', this.transformCompile, this, options);
      eventbus.on('transform:lexer:.svelte', this.transformLexer, this, options);
   }
}

const dtsPluginSvelte = new DTSPluginSvelte();

export default dtsPluginSvelte;
