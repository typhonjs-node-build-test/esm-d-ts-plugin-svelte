import {
   Node,
   Project }                     from 'ts-morph';

import ts                        from 'typescript';

import { parseLeadingComments }  from '@typhonjs-build-test/esm-d-ts/transformer';

export class JSDocCommentParser
{
   /**
    * Finds any leading JSDoc comment block
    *
    * @param {ParsedLeadingComments}   jsdocComments - All parsed JSDoc comment blocks before a compiler node.
    *
    * @returns {import('ts-morph').JSDocStructure[]} All raw JSDoc comment blocks with `@componentDescription` tag.
    */
   static #parseComponentDescription(jsdocComments)
   {
      /** @type {import('ts-morph').JSDocStructure[]} */
      const results = [];

      for (let index = 0; index < jsdocComments.parsed.length; index++)
      {
         // TODO: FINISH UP CONVERTING comment-parser Block to ts-morph JSDocStructure
         // const entry = jsdocComments.parsed[index];
         // if (entry.tags.some((entry) => entry.tag === 'componentDescription'))
         // {
         //    // const tags = entry.tags.filter((entry) => entry.tag !== 'componentDescription').map((entry) => { tagName: entry.tag });
         //    /** @type {import('ts-morph').JSDocTagStructure[]} */
         //    const tags = entry.tags.map((entry) => { tagName: entry.tag });
         //
         //    results.push({
         //       description: entry.description,
         //       tags: [{ tagName: '' }]
         //    })
         //
         //    results.push(entry);
         // }
      }

      return results;
   }

   /**
    * Processes the script tag contents for JSDoc comments to preserve them across declaration generation.
    *
    * @param {string}   code - Svelte component script source code.
    *
    * @param {string}   filepath - Original source file path.
    *
    * @param {string}   relativeFilepath - Relative file path from compilation root directory.
    *
    * @param {import('@typhonjs-utils/logger-color').ColorLogger} logger - `esm-d-ts` logger instance.
    *
    * @returns {JSDocResults | undefined} Parsed JSDoc comment blocks for component description and exported props if
    *          defined.
    */
   static processScript(code, filepath, relativeFilepath, logger)
   {
      const project = new Project({
         compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ES2022,
         }
      });

      // Add the script contents to a virtual project.
      const sourceFile = project.createSourceFile('_component.ts', code);
      const tsSourceFile = sourceFile.compilerNode;

      const result = {
         componentDescription: void 0,
         props: new Map()
      }

      const warnings = {
         multipleComponentDescriptions: false
      }

      const isNamedDeclaration = (node) => Node.isClassDeclaration(node) || Node.isFunctionDeclaration(node) ||
       Node.isVariableDeclaration(node);

      let depth = -1;

      let lastComment = void 0;

      const walk = (node) =>
      {
         depth++;

         const jsdocComments = parseLeadingComments(node.compilerNode, tsSourceFile);

         const componentDescriptions = this.#parseComponentDescription(jsdocComments);

         if (componentDescriptions.length)
         {
            if (componentDescriptions.length > 1) { warnings.multipleComponentDescriptions = true; }

            const firstComponentDescription = componentDescriptions[0];

            // Already have a `componentDescription` comment block parsed and a second non-matching one is found.
            if (result.componentDescription && firstComponentDescription !== result.componentDescription)
            {
               warnings.multipleComponentDescriptions = true;
            }
            else
            {
               result.componentDescription = firstComponentDescription;
            }
         }

         // At the initial depth store the last comment block; it may be undefined.
         if (depth === 0) { lastComment = jsdocComments.lastComment; }

         // If a named declaration node is exported store the last comment block.
         if (isNamedDeclaration(node) && node.isExported() && lastComment)
         {
            result.props.set(node.getName(), lastComment);
         }

         // Recursively iterate over each child node
         node.forEachChild(walk);

         depth--;
      }

      // Start iterating from the root node
      sourceFile.forEachChild(walk);

      if (warnings.multipleComponentDescriptions)
      {
         logger.warn(`[plugin-svelte] Multiple '@componentDescription' JSDoc comment blocks detected in: ${
          relativeFilepath}`);
      }

      return result.componentDescription || result.props.size ? result : void 0;
   }
}

/**
 * @typedef {object} JSDocResults
 *
 * @property {string} componentDescription The first `@componentDescription` comment block.
 *
 * @property {Map<string, string>}  props Map of prop names to last leading comment block.
 */

/**
 * @typedef {object} ParsedLeadingComments Defines all leading JSDoc comments for a Typescript compiler node.
 *
 * @property {string[]} comments - All raw JSDoc comment blocks.
 *
 * @property {import('comment-parser').Block[]} parsed - All parsed JSDoc comment blocks.
 *
 * @property {string} lastComment - Last raw JSDoc comment block before node.
 *
 * @property {import('comment-parser').Block} lastParsed - Last parsed leading JSDoc comment block before node.
 */
