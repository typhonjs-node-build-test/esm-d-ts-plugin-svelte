import { parseImportType } from '@typhonjs-build-test/esm-d-ts/util';
import { Node }            from 'ts-morph';
import ts                  from 'typescript';

/**
 * Provides the postprocessing of the intermediate Svelte component declarations transforming the declaration format
 * to a better structure for library consumption. Instead of named type alias exports the output of `svelte2tsx` is
 * transformed into a namespace w/ exported type aliases that matches the name of the Svelte component. This allows the
 * entire declaration for a Svelte component to be exported when
 * `export { default as <COMPONENT_NAME> } from './<COMPONENT_NAME>.svelte'` is utilized.
 *
 * JSDoc comments are also rejoined to the generated declaration for props and a component header comment that is
 * marked by the `@componentDocumentation` tag.
 *
 * For events types defined by `@param` in the component documentation comment block the type and any added description
 * is replaced in the `Events` type alias. Warnings will be logged for specified event names that are not found.
 *
 * The rejoining of comments uses `replaceWithText` on declaration nodes instead of `addJsDoc` working with `ts-morph`
 * structures as both do a full replacement on the source file text.
 */
export class PostprocessDTS
{
   /**
    * @param {object}   data - Data.
    *
    * @param {import('./JSDocCommentParser.js').ComponentJSDoc} comments - Any parsed comments.
    *
    * @param {import('@typhonjs-utils/logger-color').ColorLogger} data.logger -
    *
    * @param {import('ts-morph').SourceFile} data.sourceFile - `ts-morph` SourceFile.
    */
   static process({ comments, logger, sourceFile })
   {
      this.#transform(comments, logger, sourceFile);
   }

   /**
    * Transforms the default declaration output of `svelte2tsx` creating a better declaration structure for
    * consumption and documentation.
    *
    * @param {import('./JSDocCommentParser.js').ComponentJSDoc} comments - Any parsed comments.
    *
    * @param {import('@typhonjs-utils/logger-color').ColorLogger} logger -
    *
    * @param {import('ts-morph').SourceFile} sourceFile - `ts-morph` SourceFile.
    */
   static #transform(comments, logger, sourceFile)
   {
      // Alter default exported class --------------------------------------------------------------------------------

      /* v8 ignore next 6 */
      /** @type {import('ts-morph').ClassDeclaration} */
      const classDeclaration = sourceFile.getDefaultExportSymbol()?.getDeclarations()?.[0];
      if (!classDeclaration)
      {
         throw new Error('[plugin-svelte] PostprocessDTS error: Could not locate default exported component class.');
      }

      const className = classDeclaration.getName();

      classDeclaration.setIsExported(false);
      classDeclaration.setHasDeclareKeyword(true);

      if (comments?.componentDocumentation)
      {
         classDeclaration.replaceWithText(`${comments.componentDocumentation}\n${classDeclaration.getText()}`);
      }

      /* v8 ignore next 6 */
      const heritageClause = classDeclaration.getHeritageClauseByKind(ts.SyntaxKind.ExtendsKeyword);
      if (!heritageClause)
      {
         throw new Error(
          '[plugin-svelte] PostprocessDTS error: Could not locate extends heritage clause for component class.');
      }

      const svelteComponentTypeArgs = heritageClause.getTypeNodes()[0];

      // Rewrite SvelteComponent templated types with the namespaced types generated below.
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

      // Add any interfaces as defined by `@implements` tags in component documentation. -----------------------------

      if (comments?.componentInterfaces?.size)
      {
         /**
          * Stores the identifier strings for synthetic import declaration generation from `@implements` tags. In the
          * post. The imports are grouped by import module path.
          *
          * @type {Map<string, Set<string>>}
          */
         const importIdents = new Map();

         for (const entry of comments.componentInterfaces)
         {
            // Parse any import types statement.
            const result = parseImportType(entry);

            if (result)
            {
               // Add the imported identifier to the module Map.
               if (importIdents.has(result.module)) { importIdents.get(result.module).add(result.identImport); }
               else { importIdents.set(result.module, new Set([result.identImport])); }

               classDeclaration.addImplements(result.identFull);
            }

            // TODO: Presently: it is necessary to use import types for `@implements` as TSC will elide normal imports.
            // else
            // {
            //    classDeclaration.addImplements(entry);
            // }
         }

         // Synthetically add any import types as actual imports in source file.
         if (importIdents.size)
         {
            for (const module of [...importIdents.keys()].sort())
            {
               const idents = [...importIdents.get(module)].sort();

               sourceFile.addImportDeclaration({
                  isTypeOnly: true,
                  namedImports: idents,
                  moduleSpecifier: module
               })
            }
         }
      }

      // Extract type alias definitions from `__propDef` variable ----------------------------------------------------

      /* v8 ignore next 5 */
      const propDef = sourceFile.getVariableDeclaration('__propDef');
      if (!propDef)
      {
         throw new Error(`[plugin-svelte] PostprocessDTS error: Could not locate '__propDef' variable.`);
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

      propAlias.addJsDoc({ description: `Props type alias for {@link ${className} | associated component}.` });
      eventAlias.addJsDoc({ description: `Events type alias for {@link ${className} | associated component}.` });
      slotAlias.addJsDoc({ description: `Slots type alias for {@link ${className} | associated component}.` });

      const componentTags = comments?.componentTags ? comments.componentTags : [];
      namespace.addJsDoc({
         description: `Event / Prop / Slot type aliases for {@link ${className} | associated component}.`,
         tags: componentTags
      });

      // Add comments & types from `@property` tags in comment documentation to events. ------------------------------

      if (comments?.componentEvents?.size)
      {
         // Store all event names to post warnings for ones that are not found in the declarations.
         const remainingEventNames = new Set(comments.componentEvents.keys());

         const replaceElementMembered = (typeNode) =>
         {
            for (const propertyNode of typeNode.getProperties())
            {
               const propertyName = propertyNode.getName();

               // Must strip any leading / trailing quotes.
               const cleanPropertyName = propertyName.replace(/^['"]|['"]$/g, '');

               if (!comments.componentEvents.has(cleanPropertyName)) { continue; }

               // Remove event name from remaining set.
               remainingEventNames.delete(cleanPropertyName);

               const eventData = comments.componentEvents.get(cleanPropertyName)

               if (typeof eventData.type === 'string') { propertyNode.setType(eventData.type); }

               if (typeof eventData.comment === 'string')
               {
                  propertyNode.replaceWithText(`\n${eventData.comment}\n${propertyNode.getText()}`);
               }
            }
         };

         const eventTypeNode = eventAlias.getTypeNode();

         if (Node.isIntersectionTypeNode(eventTypeNode))
         {
            for (const typeNode of eventTypeNode.getTypeNodes())
            {
               if (Node.isTypeElementMembered(typeNode)) { replaceElementMembered(typeNode); }
            }
         }
         else if (Node.isTypeElementMembered(eventTypeNode))
         {
            replaceElementMembered(eventTypeNode);
         }

         if (remainingEventNames.size)
         {
            for (const eventName of remainingEventNames)
            {
               logger.warn(`[plugin-svelte] Event types substitution for event name '${eventName}' not found in: ${
                comments.relativeFilepath}`);
            }
         }
      }

      // Add types from `@type` tags in comments from props. ---------------------------------------------------------

      if (comments?.propTypes?.size)
      {
         // Update all prop types in the associated namespace
         const propTypeNode = propAlias.getTypeNode();
         if (Node.isTypeElementMembered(propTypeNode))
         {
            for (const propertyNode of propTypeNode.getProperties())
            {
               const propertyName = propertyNode.getName();
               if (comments.propTypes.has(propertyName)) { propertyNode.setType(comments.propTypes.get(propertyName)); }
            }
         }
      }

      // Add any prop comments. --------------------------------------------------------------------------------------

      if (comments?.propComments?.size)
      {
         const propTypeNode = propAlias.getTypeNode();

         if (Node.isTypeElementMembered(propTypeNode))
         {
            for (const propertyNode of propTypeNode.getProperties())
            {
               const propertyName = propertyNode.getName();
               if (comments.propComments.has(propertyName))
               {
                  propertyNode.replaceWithText(
                   `\n${comments.propComments.get(propertyName)}\n${propertyNode.getText()}`);
               }
            }
         }
      }

      // Remove all type aliases -------------------------------------------------------------------------------------

      const typeAliases = sourceFile.getTypeAliases();
      for (const typeAlias of typeAliases) { typeAlias.remove(); }

      // Add types / comments to all accessors linking them to the props type alias / definition. --------------------

      if (comments?.propNames?.size)
      {
         const accessorsGet = classDeclaration.getGetAccessors();
         for (const accessorGet of accessorsGet)
         {
            const propName = accessorGet.getName();

            if (comments.propNames.has(propName))
            {
               // Add return type.
               const returnType = comments.propTypes.get(propName);
               if (returnType && returnType !== 'any') { accessorGet.setReturnType(returnType); }

               // Add comment linking `Props` namespace.
               const newComment = `/** Getter for {@link ${className}.Props.${propName} | ${propName}} prop. */`;
               accessorGet.replaceWithText(`\n${newComment}\n${accessorGet.getText()}`);
            }
         }

         const accessorsSet = classDeclaration.getSetAccessors();
         for (const accessorSet of accessorsSet)
         {
            const propName = accessorSet.getName();
            if (comments.propNames.has(propName))
            {
               // Add argument type.
               const argType = comments.propTypes.get(propName);
               if (argType && argType !== 'any') { accessorSet.getParameters()?.[0]?.setType(argType); }

               // Add comment linking `Props` namespace.
               const newComment = `/** Setter for {@link ${className}.Props.${propName} | ${propName}} prop. */`;
               accessorSet.replaceWithText(`\n${newComment}\n${accessorSet.getText()}`);
            }
         }
      }

      // Add default export ------------------------------------------------------------------------------------------

      sourceFile.addExportAssignment({ expression: className, isExportEquals: false });
   }
}
