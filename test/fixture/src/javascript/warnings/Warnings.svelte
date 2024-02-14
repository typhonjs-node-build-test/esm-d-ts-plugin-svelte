<script>
   /**
    * Tests warnings generated from bad / duplicate comments.
    *
    * @param nameNoTypeOrDescription
    * @param {{noParamName: boolean}}
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
