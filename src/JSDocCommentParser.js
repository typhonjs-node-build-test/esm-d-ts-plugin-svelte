import { parseLeadingComments }  from '@typhonjs-build-test/esm-d-ts/transformer';
import {
   Node,
   Project }                     from 'ts-morph';
import ts                        from 'typescript';

/**
 * Parses the script section of a Svelte component extracting JSDoc comments to rejoin with the generated declarations.
 *
 * To support comment blocks for the generated class declaration the first comment block with `@componentDescription`
 * is stored.
 *
 * Note: All comments parsed are stored as raw text and {@link PostprocessDTS} will perform full text replacements
 * instead of working with structured `ts-morph` JSDoc comment manipulation.
 */
export class JSDocCommentParser
{
   /**
    * Finds any leading JSDoc comment block that includes `@componentDescription` tag.
    *
    * @param {import('@typhonjs-build-test/esm-d-ts/transformer').ParsedLeadingComments}   jsdocComments - All parsed
    * JSDoc comment blocks before a compiler node.
    *
    * @returns {string[]} All raw JSDoc comment blocks with `@componentDescription` tag.
    */
   static #parseComponentDescription(jsdocComments)
   {
      const results = [];

      for (let i = 0; i < jsdocComments.parsed.length; i++)
      {
         if (jsdocComments.parsed[i].tags.some((entry) => entry.tag === 'componentDescription'))
         {
            results.push(jsdocComments.comments[i]);
         }
      }

      return results;
   }

   /**
    * Processes the script tag contents for JSDoc comments to preserve across declaration generation.
    *
    * @param {string}   code - Svelte component script source code.
    *
    * @param {string}   filepath - Original source file path.
    *
    * @param {string}   relativeFilepath - Relative file path from compilation root directory.
    *
    * @param {import('@typhonjs-utils/logger-color').ColorLogger} logger - `esm-d-ts` logger instance.
    *
    * @returns {ComponentJSDoc} Parsed JSDoc comment blocks for component description and exported props when defined.
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
         props: new Map(),
         propNames: new Set()
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

         // If a named declaration node is exported store the prop name and any last comment block.
         if (isNamedDeclaration(node) && node.isExported())
         {
            const propName = node.getName();

            // Store comment for prop.
            if (lastComment) { result.props.set(propName, lastComment); }

            // Add to all prop names Set.
            result.propNames.add(propName)
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

      return result;
   }
}

/**
 * @typedef {object} ComponentJSDoc JSDoc comments for the component description and props.
 *
 * @property {string} componentDescription The first `@componentDescription` comment block.
 *
 * @property {Map<string, string>}  props Map of prop names to last leading comment block.
 *
 * @property {Set<string>}  propNames A Set of all prop names regardless if they have comments or not.
 */
