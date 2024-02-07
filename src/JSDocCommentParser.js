import { parseLeadingComments }  from '@typhonjs-build-test/esm-d-ts/transformer';
import { ESTreeParsedComment }   from '@typhonjs-build-test/esm-d-ts/util';
import { Node, Project }         from 'ts-morph';
import ts                        from 'typescript';

/**
 * Parses the script section of a Svelte component extracting JSDoc comments to rejoin with the generated declarations.
 *
 * To support comment blocks for the generated class declaration the first comment block with `@componentDocumentation`
 * is stored.
 *
 * Note: All comments parsed are stored as raw text and {@link PostprocessDTS} will perform full text replacements
 * instead of working with structured `ts-morph` JSDoc comment manipulation.
 */
export class JSDocCommentParser
{
   /**
    * These JSDoc tags are forwarded onto the generated namespace.
    *
    * @type {Set<string>}
    */
   static #componentTags = new Set(['hidden', 'ignore', 'internal']);

   /**
    * These JSDoc tags are processed in the `@componentDocumentation` tagged comment block and subsequently removed.
    *
    * @type {Set<string>}
    */
   static #removeTags = new Set(['componentDocumentation', 'implements', 'param']);

   /**
    * Finds any leading JSDoc comment block that includes `@componentDocumentation` tag.
    *
    * @param {import('@typhonjs-build-test/esm-d-ts/transformer').ParsedLeadingComments}   jsdocComments - All parsed
    * JSDoc comment blocks before a compiler node.
    *
    * @param {import('@typhonjs-utils/logger-color').ColorLogger} logger - `esm-d-ts` logger instance.
    *
    * @param {string}   relativeFilepath - Relative file path from compilation root directory.
    *
    * @returns {({
    *    comment: string,
    *    events: Map<string, { comment?: string, type?: string }>,
    *    interfaces: Set<string>
    *    tags: import('ts-morph').JSDocTagStructure[] }[]
    * )} All raw JSDoc comment blocks with `@componentDocumentation` tag and additional tags to forward to generated
    *    namespace.
    */
   static #parseComponentDescription(jsdocComments, logger, relativeFilepath)
   {
      const results = [];

      for (let i = 0; i < jsdocComments.parsed.length; i++)
      {
         if (jsdocComments.parsed[i].tags.some((entry) => entry.tag === 'componentDocumentation'))
         {
            const events = new Map();
            const interfaces = new Set();
            const tags = [];

            const parsed = new ESTreeParsedComment(jsdocComments.comments[i]);

            const parsedTags = parsed.ast.tags;

            for (let i = parsedTags.length; --i >= 0;)
            {
               const parsedTag = parsedTags[i];
               const tagName = parsedTag.tag;

               // Store the type specified to be added as an interface to the Svelte component.
               if (tagName === 'implements')
               {
                  if (interfaces.has(parsedTag.rawType))
                  {
                     logger.warn(`[plugin-svelte] Duplicated '@implements' tags for \`${
                      parsedTag.rawType}\` in component documentation: ${relativeFilepath}`);
                  }

                  interfaces.add(parsedTag.rawType);
               }

               // Pull out name / description / type from `@param` as data to attach to the `Events` type alias.
               if (tagName === 'param')
               {
                  const name = parsedTag.name;

                  if (name === '')
                  {
                     logger.warn(`[plugin-svelte] Skipping @param tag with no name in component documentation: ${
                      relativeFilepath}`);
                     continue;
                  }

                  const type = parsedTag.rawType !== '' ? parsedTag.rawType : void 0;

                  let comment;
                  if (parsedTag.description !== '')
                  {
                     // Remove any leading white space and hyphen and replace newlines with proper JSDoc delimiter.
                     comment = `/**\n * ${parsedTag.description.replace(/^[\s-]+/, '').replace(/\n/g, '\n * ')}\n */`;
                  }

                  if (type === void 0 && comment === void 0)
                  {
                     logger.warn(
                      `[plugin-svelte] Skipping @param tag with no type or description in component documentation: ${
                        relativeFilepath}`);
                     continue;
                  }

                  events.set(name, { comment, type });
               }
               else if (this.#componentTags.has(tagName)) // Store any tags to forward to generated namespace.
               {
                  if (this.#componentTags.has(tagName)) { tags.push({ tagName }); }
               }
            }

            results.push({
               comment: parsed.removeTags(this.#removeTags).toString(),
               events,
               interfaces,
               tags
            });
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

      /** @type {ComponentJSDoc} */
      const result = {
         componentDocumentation: void 0,
         componentEvents: void 0,
         componentInterfaces: void 0,
         componentTags: [],
         propComments: new Map(),
         propNames: new Set(),
         propTypes: new Map(),
         relativeFilepath,
         scriptCode: void 0
      }

      const isNamedDeclaration = (node) => Node.isClassDeclaration(node) || Node.isFunctionDeclaration(node) ||
       Node.isVariableDeclaration(node);

      let depth = -1;

      let lastComment = void 0;
      let lastParsed = void 0;

      const walk = (node) =>
      {
         depth++;

         const jsdocComments = parseLeadingComments(node.compilerNode, tsSourceFile);

         // Assign the first encountered `@componentDocumentation` comment to the result. Ignore any additional
         // `@componentDocumentation` tagged comments.
         if (result.componentDocumentation === void 0)
         {
            const componentDocumentation = this.#parseComponentDescription(jsdocComments, logger, relativeFilepath);

            if (componentDocumentation.length)
            {
               result.componentDocumentation = componentDocumentation[0].comment;
               result.componentEvents = componentDocumentation[0].events;
               result.componentInterfaces = componentDocumentation[0].interfaces;
               result.componentTags = componentDocumentation[0].tags;

               // Replace the source node JSDoc with processed component documentation JSDoc.
               node.replaceWithText(`${result.componentDocumentation}\n${node.getText()}`);
            }
         }

         // At the initial depth store the last comment block; it may be undefined.
         if (depth === 0)
         {
            lastComment = jsdocComments.lastComment;
            lastParsed = jsdocComments.lastParsed;
         }

         // If a named declaration node is exported store the prop name, any last comment block and types.
         if (isNamedDeclaration(node) && node.isExported())
         {
            const propName = node.getName();

            // Store comment for prop.
            if (lastComment) { result.propComments.set(propName, lastComment); }

            // Store any types defined in `@type` for prop. Only take the first parsed `@type` tag.
            if (lastParsed)
            {
               for (const entry of lastParsed.tags)
               {
                  if (entry.tag === 'type' && typeof entry.type === 'string')
                  {
                     result.propTypes.set(propName, entry.type);
                     break;
                  }
               }
            }

            // Add to all prop names Set.
            result.propNames.add(propName)
         }

         // Recursively iterate over each child node
         node.forEachChild(walk);

         depth--;
      }

      // Start iterating from the root node
      sourceFile.forEachChild(walk);

      result.scriptCode = sourceFile.getFullText();

      return result;
   }
}

/**
 * @typedef {object} ComponentJSDoc JSDoc comments for the component description and props.
 *
 * @property {string} [componentDocumentation] The first `@componentDocumentation` raw comment block.
 *
 * @property {Map<string, { comment?: string, type?: string }>} [componentEvents] The component documentation
 * parsed `@property` tags repurposed to describe custom events in the `Events` type alias.
 *
 * @property {Set<string>} componentInterfaces - Types defined by @implements in component documentation.
 *
 * @property {import('ts-morph').JSDocTagStructure[]} componentTags Any tags to forward to generated namespace from
 * component documentation comment block.
 *
 * @property {Map<string, string>}  propComments Map of prop names to last leading raw comment block.
 *
 * @property {Map<string, string>}  propTypes Map of prop names to @type tagged type.
 *
 * @property {Set<string>}  propNames A Set of all prop names regardless if they have comments or not.
 *
 * @property {string}   relativeFilepath - Relative source file path.
 *
 * @property {string}   scriptCode The modified script source code after AST processing.
 */
