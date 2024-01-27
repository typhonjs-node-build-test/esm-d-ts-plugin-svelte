import { stringify }             from 'comment-parser';
import { parseLeadingComments }  from '@typhonjs-build-test/esm-d-ts/transformer';
import {
   Node,
   Project,
   StructureKind }               from 'ts-morph';
import ts                        from 'typescript';

/**
 * Parses the script section of a Svelte component extracting JSDoc comments to rejoin with the generated declarations.
 *
 * To support comment blocks for the generated class declaration the first comment block with `@componentDescription`
 * is stored.
 *
 * Note: Due to a `prettier` bug; quite likely related to {@link https://github.com/prettier/prettier/issues/14564} the
 * prop comments are stored as raw text and {@link PostprocessDTS} will perform full text replacements instead of
 * working with structured `ts-morph` JSDoc comment manipulation.
 */
export class JSDocCommentParser
{
   /**
    * Converts parsed JSDoc comments to `ts-morph` JSDocStructure comments.
    *
    * @param {import('@typhonjs-build-test/esm-d-ts').ParsedLeadingComments}   jsdocComments -
    *
    * @returns {StructuredLeadingComments} ts-morph converted comments.
    */
   static #convertLeadingComments(jsdocComments)
   {
      const parsed = jsdocComments.parsed.map((entry) => ({
         kind: StructureKind.JSDoc,
         description: entry.description,
         tags: entry.tags.map((tagEntry) =>
         {
            const tagName = tagEntry.tag;

            // Remove
            tagEntry.source[0].tokens.delimiter = '';
            tagEntry.source[0].tokens.postDelimiter = '';
            tagEntry.source[0].tokens.tag = '';
            tagEntry.source[0].tokens.postTag = '';
            tagEntry.source[0].tokens.start = '';
            tagEntry.source.length = 1;

            const text = stringify(tagEntry);

            return {
               tagName,
               text: text !== '' ? text : void 0
            };
         })
      }));

      return {
         comments: jsdocComments.comments,
         parsed,
         lastComment: jsdocComments.lastComment,
         lastParsed: parsed.length ? parsed[parsed.length - 1] : void 0
      };
   }

   /**
    * Finds any leading JSDoc comment block that includes `@componentDescription` tag.
    *
    * @param {import('@typhonjs-build-test/esm-d-ts').ParsedLeadingComments}   jsdocComments - All parsed JSDoc comment
    * blocks before a compiler node.
    *
    * @returns {import('ts-morph').JSDocStructure[]} All raw JSDoc comment blocks with `@componentDescription` tag.
    */
   static #parseComponentDescription(jsdocComments)
   {
      const comments = this.#convertLeadingComments(jsdocComments);

      const results = [];

      for (const entry of comments.parsed)
      {
         if (entry.tags.some((entry) => entry.tagName === 'componentDescription'))
         {
            const tags = entry.tags.filter((entry) => entry.tagName !== 'componentDescription');

            results.push({
               kind: StructureKind.JSDoc,
               description: entry.description,
               tags
            })
         }
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
    * @returns {ComponentJSDoc | undefined} Parsed JSDoc comment blocks for component description and exported props if
    *          defined.
    */
   static processScript(code, filepath, relativeFilepath, logger)
   {
      const project = new Project({
         compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ES2022,
         },
         useVirtualFileSystem: true
      });

      // Add the script contents to a virtual project.
      const sourceFile = project.createSourceFile('component.ts', code);
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

         // Assign the first encountered `@componentDescription` comment to the result. Check for multiple
         // `@componentDescription` comments to produce a warning message.
         if (componentDescriptions.length)
         {
            if (componentDescriptions.length > 1) { warnings.multipleComponentDescriptions = true; }

            const firstComponentDescription = componentDescriptions[0];

            // Already have a `componentDescription` comment block parsed and a second non-matching one is found.
            if (result.componentDescription &&
             firstComponentDescription?.description !== result.componentDescription.description)
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
 * @typedef {object} ComponentJSDoc
 *
 * @property {import('ts-morph').JSDocStructure} componentDescription The first `@componentDescription` comment block.
 *
 * @property {Map<string, string>}  props Map of prop names to last leading comment block.
 */

/**
 * @typedef {object} StructuredLeadingComments Defines all leading JSDoc comments for a Typescript compiler node.
 *
 * @property {string[]} comments - All raw JSDoc comment blocks.
 *
 * @property {import('ts-morph').JSDocStructure[]} parsed - All parsed JSDoc comment blocks.
 *
 * @property {string} lastComment - Last raw JSDoc comment block before node.
 *
 * @property {import('ts-morph').JSDocStructure} lastParsed - Last parsed leading JSDoc comment block before node.
 */
