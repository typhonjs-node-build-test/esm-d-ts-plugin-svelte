import fs                  from 'node:fs';
import { fileURLToPath }   from 'node:url';

import { getFileList }     from '@typhonjs-utils/file-util';
import { resolve }         from 'import-meta-resolve';
import { compile }         from 'svelte/compiler';
import { svelte2tsx }      from 'svelte2tsx';
import {
   ClassDeclaration,
   Node }                  from 'ts-morph';
import ts                  from 'typescript';
import upath               from 'upath';

/**
 * Provides a plugin for `esm-d-ts` to handle Svelte components.
 */
class DTSPluginSvelte
{
   static #regexTypedef = /\/\*\*[\s\S]*?@typedef[\s\S]*?__propDef[\s\S]*?\*\/\s*/g;

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
         // Pre-process to remove spurious typedef JSDoc comments.
         const fileData = fs.readFileSync(filepath, 'utf-8');
         fs.writeFileSync(filepath, fileData.replaceAll(DTSPluginSvelte.#regexTypedef, ''));

         PostProcess.process({
            filepath,
            processors: [this.postprocessDTSImpl.bind(this)]
         });
      }
   }

   /**
    * Manipulates the default declaration output of `svelte2tsx` via `PostProcess`.
    *
    * @param {object} options - Options
    *
    * @param {import('ts-morph').SourceFile} options.sourceFile - `ts-morph` SourceFile.
    */
   postprocessDTSImpl({ sourceFile })
   {
      // Alter default exported class --------------------------------------------------------------------------------

      /** @type {ClassDeclaration} */
      const classDeclaration = sourceFile.getDefaultExportSymbol()?.getDeclarations()?.[0];
      if (!classDeclaration)
      {
         // TODO: Cancel processing
      }

      const className = classDeclaration.getName();

      classDeclaration.setIsExported(false);
      classDeclaration.setHasDeclareKeyword(true);

      const heritageClause = classDeclaration.getHeritageClauseByKind(ts.SyntaxKind.ExtendsKeyword);

      if (!heritageClause)
      {
         // TODO: Cancel processing
      }

      const svelteComponentTypeArgs = heritageClause.getTypeNodes()[0];

      if (svelteComponentTypeArgs && Node.isExpressionWithTypeArguments(svelteComponentTypeArgs))
      {
         const typeArguments = svelteComponentTypeArgs.getTypeArguments();

         if (typeArguments.length === 3)
         {
            typeArguments[0].replaceWithText(`${className}.Props`);
            typeArguments[1].replaceWithText(`${className}.Events`);
            typeArguments[2].replaceWithText(`${className}.Slots`);
         }
      }

      // Extract type alias definitions from `__propDef` variable ----------------------------------------------------

      const propDef = sourceFile.getVariableDeclaration('__propDef');

      if (!propDef)
      {
         // TODO: Cancel processing
      }

      const propsType = propDef.getType().getProperty('props').getValueDeclaration().getType().getText();
      const eventsType = propDef.getType().getProperty('events').getValueDeclaration().getType().getText();
      const slotsType = propDef.getType().getProperty('slots').getValueDeclaration().getType().getText();

      // Remove unused `__propDef` variable.
      propDef.remove();

      // ----------------

      // Create a namespace
      const namespace = sourceFile.addModule({ name: className, hasDeclareKeyword: true });

      // Add type aliases to the namespace
      const propAlias = namespace.addTypeAlias({ name: 'Props', type: propsType, isExported: true });
      const eventAlias = namespace.addTypeAlias({ name: 'Events', type: eventsType, isExported: true });
      const slotAlias = namespace.addTypeAlias({ name: 'Slots', type: slotsType, isExported: true });

      propAlias.addJsDoc({ description: `Props type alias for {@link ${className}}.` });
      eventAlias.addJsDoc({ description: `Events type alias for {@link ${className}}.` });
      slotAlias.addJsDoc({ description: `Slots type alias for {@link ${className}}.` });

      namespace.addJsDoc({ description: `Event / Prop / Slot type aliases for {@link ${className}}.` });

      // Remove all type aliases -------------------------------------------------------------------------------------

      const typeAliases = sourceFile.getTypeAliases();
      for (const typeAlias of typeAliases) { typeAlias.remove(); }

      // Add default export ------------------------------------------------------------------------------------------

      sourceFile.addExportAssignment({ expression: className, isExportEquals: false });
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
