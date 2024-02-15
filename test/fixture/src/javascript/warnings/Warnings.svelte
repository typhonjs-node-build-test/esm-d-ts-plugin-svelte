<script>
   /**
    * Tests warnings generated from bad / duplicate comments.
    *
    * @param nameNoTypeOrDescription
    * @param {{noParamName: boolean}}
    * @param {CustomEvent<{ foo: boolean }>} unusedEvent - An unused event.
    *
    * @implements {import('./types').ITest}
    * @implements {import('./types').ITest}
    *
    * @componentDocumentation
    */

   /**
    * Something foo
    */
   export function foo() {}
</script>

<div>Warnings</div>
